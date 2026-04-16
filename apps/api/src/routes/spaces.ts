import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { audit } from '../lib/audit.js';
import { isAdmin } from '../lib/permissions.js';
import { slugify } from '../lib/slug.js';

const createSpace = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
});

const addMember = z.object({
  userId: z.string().uuid(),
  role: z.enum(['OWNER', 'CONTRIBUTOR', 'READER']),
});

export async function spacesRoutes(app: FastifyInstance) {
  app.get('/api/v1/spaces', { preHandler: [app.authenticate] }, async (req) => {
    const uid = req.user.sub;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });

    if (isAdmin(user)) {
      const spaces = await prisma.space.findMany({ orderBy: { name: 'asc' } });
      return { spaces };
    }

    const memberships = await prisma.spaceMember.findMany({
      where: { userId: uid },
      include: { space: true },
    });
    return { spaces: memberships.map((m) => m.space) };
  });

  app.post('/api/v1/spaces', { preHandler: [app.authenticate] }, async (req, reply) => {
    const uid = req.user.sub;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    if (!isAdmin(user)) return reply.status(403).send({ error: 'Forbidden' });

    const parsed = createSpace.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });

    const slug = slugify(parsed.data.slug ?? parsed.data.name);
    const space = await prisma.space.create({
      data: {
        slug,
        name: parsed.data.name,
        description: parsed.data.description,
        members: {
          create: { userId: uid, role: 'OWNER' },
        },
      },
    });

    await audit('space.created', 'Space', space.id, uid, { slug: space.slug });

    return { space };
  });

  app.get('/api/v1/spaces/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const uid = req.user.sub;
    const id = (req.params as { id: string }).id;

    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    const space = await prisma.space.findUnique({
      where: { id },
      include: {
        members: { include: { user: { select: { id: true, email: true, role: true } } } },
      },
    });
    if (!space) return reply.status(404).send({ error: 'Not found' });

    if (!isAdmin(user)) {
      const m = await prisma.spaceMember.findUnique({
        where: { spaceId_userId: { spaceId: id, userId: uid } },
      });
      if (!m) return reply.status(403).send({ error: 'Forbidden' });
    }

    return { space };
  });

  app.post('/api/v1/spaces/:id/members', { preHandler: [app.authenticate] }, async (req, reply) => {
    const uid = req.user.sub;
    const spaceId = (req.params as { id: string }).id;
    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    if (!isAdmin(user)) return reply.status(403).send({ error: 'Forbidden' });

    const parsed = addMember.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });

    const member = await prisma.spaceMember.upsert({
      where: { spaceId_userId: { spaceId, userId: parsed.data.userId } },
      create: { spaceId, userId: parsed.data.userId, role: parsed.data.role },
      update: { role: parsed.data.role },
    });

    await audit('space.member', 'Space', spaceId, uid, { userId: parsed.data.userId, role: parsed.data.role });

    return { member };
  });

  app.delete('/api/v1/spaces/:id/members/:userId', { preHandler: [app.authenticate] }, async (req, reply) => {
    const uid = req.user.sub;
    const { id: spaceId, userId } = req.params as { id: string; userId: string };
    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    if (!isAdmin(user)) return reply.status(403).send({ error: 'Forbidden' });

    await prisma.spaceMember.delete({
      where: { spaceId_userId: { spaceId, userId } },
    });

    await audit('space.member_removed', 'Space', spaceId, uid, { userId });

    return { ok: true };
  });
}
