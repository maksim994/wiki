import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { canCommentOnPage } from '../lib/permissions.js';
import { getSpaceMemberRole } from '../lib/space-access.js';

const createComment = z.object({
  body: z.string().min(1).max(20000),
  parentId: z.string().uuid().nullable().optional(),
});

export async function commentsRoutes(app: FastifyInstance) {
  app.get('/api/v1/pages/:id/comments', { preHandler: [app.authenticate] }, async (req, reply) => {
    const uid = req.user.sub;
    const pageId = (req.params as { id: string }).id;

    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    const page = await prisma.page.findFirst({ where: { id: pageId, deletedAt: null } });
    if (!page) return reply.status(404).send({ error: 'Not found' });

    const memberRole = await getSpaceMemberRole(user, page.spaceId);
    if (!memberRole || !canCommentOnPage(user, memberRole, page)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const comments = await prisma.comment.findMany({
      where: { pageId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      include: { author: { select: { id: true, email: true } } },
    });

    return { comments };
  });

  app.post('/api/v1/pages/:id/comments', { preHandler: [app.authenticate] }, async (req, reply) => {
    const uid = req.user.sub;
    const pageId = (req.params as { id: string }).id;

    const parsed = createComment.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    const page = await prisma.page.findFirst({ where: { id: pageId, deletedAt: null } });
    if (!page) return reply.status(404).send({ error: 'Not found' });

    const memberRole = await getSpaceMemberRole(user, page.spaceId);
    if (!memberRole || !canCommentOnPage(user, memberRole, page)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const comment = await prisma.comment.create({
      data: {
        pageId,
        parentId: parsed.data.parentId ?? null,
        body: parsed.data.body,
        authorId: uid,
      },
      include: { author: { select: { id: true, email: true } } },
    });

    return { comment };
  });

  app.delete('/api/v1/comments/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const uid = req.user.sub;
    const id = (req.params as { id: string }).id;

    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    const comment = await prisma.comment.findUnique({ where: { id } });
    if (!comment || comment.deletedAt) return reply.status(404).send({ error: 'Not found' });

    if (user.role !== 'ADMIN' && comment.authorId !== uid) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    await prisma.comment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { ok: true };
  });
}
