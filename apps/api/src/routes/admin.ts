import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const settingsPatch = z.object({
  siteName: z.string().min(1).optional(),
  publicSignupEnabled: z.boolean().optional(),
});

export async function adminRoutes(app: FastifyInstance) {
  app.get('/api/v1/admin/settings', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (req.user.role !== 'ADMIN') return reply.status(403).send({ error: 'Forbidden' });

    let settings = await prisma.instanceSettings.findUnique({ where: { id: 1 } });
    if (!settings) {
      settings = await prisma.instanceSettings.create({ data: { id: 1 } });
    }
    return { settings };
  });

  app.patch('/api/v1/admin/settings', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (req.user.role !== 'ADMIN') return reply.status(403).send({ error: 'Forbidden' });

    const parsed = settingsPatch.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });

    const settings = await prisma.instanceSettings.upsert({
      where: { id: 1 },
      create: { id: 1, ...parsed.data },
      update: parsed.data,
    });

    return { settings };
  });

  app.get('/api/v1/admin/audit', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (req.user.role !== 'ADMIN') return reply.status(403).send({ error: 'Forbidden' });

    const take = 100;
    const logs = await prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take,
      include: { user: { select: { email: true } } },
    });

    return { logs };
  });
}
