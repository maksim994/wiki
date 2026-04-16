import 'dotenv/config';
import './types.js';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import argon2 from 'argon2';
import { prisma } from './lib/prisma.js';
import type { JwtUser } from './types.js';
import { authRoutes } from './routes/auth.js';
import { usersRoutes } from './routes/users.js';
import { spacesRoutes } from './routes/spaces.js';
import { pagesRoutes } from './routes/pages.js';
import { commentsRoutes } from './routes/comments.js';
import { searchRoutes } from './routes/search.js';
import { publicRoutes } from './routes/public.js';
import { adminRoutes } from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function bootstrapAdmin() {
  const count = await prisma.user.count();
  if (count > 0) return;

  const email = process.env.ADMIN_EMAIL?.toLowerCase().trim();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('No users and ADMIN_EMAIL/ADMIN_PASSWORD not set — create first admin via env or SQL.');
    return;
  }

  await prisma.instanceSettings.upsert({
    where: { id: 1 },
    create: { id: 1 },
    update: {},
  });

  await prisma.user.create({
    data: {
      email,
      passwordHash: await argon2.hash(password),
      role: 'ADMIN',
    },
  });

  console.log(`Bootstrap: admin user ${email} created.`);
}

async function buildServer() {
  const app = Fastify({ logger: true });

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 16) {
    throw new Error('Set JWT_SECRET (min 16 chars) in environment.');
  }

  app.register(cookie);
  app.register(cors, {
    origin: (origin: string | undefined, cb: (err: Error | null, v: boolean) => void) => {
      const allowed = process.env.CORS_ORIGIN?.split(',').map((s: string) => s.trim()) ?? [
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ];
      if (!origin || allowed.includes(origin)) {
        cb(null, true);
        return;
      }
      cb(null, false);
    },
    credentials: true,
  });

  app.register(jwt, { secret: jwtSecret });

  app.decorate('authenticate', async function (request, reply) {
    const header = request.headers.authorization;
    const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined;
    const token = request.cookies.token ?? bearer;
    if (!token) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
    try {
      const payload = await app.jwt.verify<JwtUser>(token);
      request.user = payload;
    } catch {
      return reply.status(401).send({ error: 'Unauthorized' });
    }
  });

  app.get('/health', async () => ({ ok: true }));

  app.register(authRoutes);
  app.register(usersRoutes);
  app.register(spacesRoutes);
  app.register(pagesRoutes);
  app.register(commentsRoutes);
  app.register(searchRoutes);
  app.register(publicRoutes);
  app.register(adminRoutes);

  const staticRoot = path.join(__dirname, '../public');
  if (existsSync(staticRoot)) {
    await app.register(fastifyStatic, {
      root: staticRoot,
      prefix: '/',
      decorateReply: false,
    });

    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/api/')) {
        return reply.sendFile('index.html', staticRoot);
      }
      return reply.status(404).send({ error: 'Not found' });
    });
  }

  return app;
}

const app = await buildServer();

await bootstrapAdmin();

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

await app.listen({ port, host });
console.log(`Listening on http://${host}:${port}`);
