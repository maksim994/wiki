import { randomBytes } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import argon2 from 'argon2';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { audit } from '../lib/audit.js';

const createUser = z.object({
  email: z.string().email(),
  password: z.string().min(8).optional(),
  role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']),
});

const patchUser = z.object({
  role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']).optional(),
  disabled: z.boolean().optional(),
});

export async function usersRoutes(app: FastifyInstance) {
  app.get('/api/v1/users', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (req.user.role !== 'ADMIN') return reply.status(403).send({ error: 'Forbidden' });

    const users = await prisma.user.findMany({
      orderBy: { email: 'asc' },
      select: { id: true, email: true, role: true, disabled: true, createdAt: true },
    });
    return { users };
  });

  app.post('/api/v1/users', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (req.user.role !== 'ADMIN') return reply.status(403).send({ error: 'Forbidden' });

    const parsed = createUser.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });

    const email = parsed.data.email.toLowerCase();
    const password = parsed.data.password ?? cryptoRandomPassword();
    const passwordHash = await argon2.hash(password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: parsed.data.role,
      },
      select: { id: true, email: true, role: true, disabled: true, createdAt: true },
    });

    await audit('user.created', 'User', user.id, req.user.sub, { email });

    return { user, temporaryPassword: parsed.data.password ? undefined : password };
  });

  app.patch('/api/v1/users/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    if (req.user.role !== 'ADMIN') return reply.status(403).send({ error: 'Forbidden' });

    const parsed = patchUser.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });

    const id = (req.params as { id: string }).id;
    const user = await prisma.user.update({
      where: { id },
      data: parsed.data,
      select: { id: true, email: true, role: true, disabled: true, createdAt: true },
    });

    await audit('user.updated', 'User', user.id, req.user.sub, parsed.data);

    return { user };
  });
}

function cryptoRandomPassword(): string {
  return randomBytes(12).toString('base64url');
}
