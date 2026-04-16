import type { FastifyInstance } from 'fastify';
import argon2 from 'argon2';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/v1/auth/login', async (req, reply) => {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });

    const user = await prisma.user.findUnique({ where: { email: parsed.data.email.toLowerCase() } });
    if (!user || user.disabled) {
      return reply.status(401).send({ error: 'Invalid credentials' });
    }
    const ok = await argon2.verify(user.passwordHash, parsed.data.password);
    if (!ok) return reply.status(401).send({ error: 'Invalid credentials' });

    const token = app.jwt.sign({ sub: user.id, role: user.role });
    reply.setCookie('token', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  });

  app.post('/api/v1/auth/logout', async (_req, reply) => {
    reply.clearCookie('token', { path: '/' });
    return { ok: true };
  });

  app.get('/api/v1/me', { preHandler: [app.authenticate] }, async (req, reply) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { id: true, email: true, role: true, disabled: true },
    });
    if (!user || user.disabled) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    return { user };
  });
}
