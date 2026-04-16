import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { canViewPage, isAdmin } from '../lib/permissions.js';

export async function searchRoutes(app: FastifyInstance) {
  app.get('/api/v1/search', { preHandler: [app.authenticate] }, async (req, reply) => {
    const uid = req.user.sub;
    const q = typeof req.query === 'object' && req.query && 'q' in req.query ? String((req.query as { q?: string }).q ?? '') : '';
    const spaceIdParam =
      typeof req.query === 'object' && req.query && 'space_id' in req.query
        ? String((req.query as { space_id?: string }).space_id ?? '')
        : '';
    const mine =
      typeof req.query === 'object' && req.query && 'mine' in req.query
        ? String((req.query as { mine?: string }).mine ?? '') === '1' ||
          String((req.query as { mine?: string }).mine ?? '') === 'true'
        : false;

    if (!q.trim()) return { results: [] };

    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });

    let allowedSpaceIds: string[] | undefined;
    if (!isAdmin(user)) {
      const memberships = await prisma.spaceMember.findMany({
        where: { userId: uid },
        select: { spaceId: true },
      });
      allowedSpaceIds = memberships.map((m) => m.spaceId);
      if (allowedSpaceIds.length === 0) return { results: [] };
    }

    if (spaceIdParam) {
      if (allowedSpaceIds && !allowedSpaceIds.includes(spaceIdParam)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      if (isAdmin(user)) {
        allowedSpaceIds = [spaceIdParam];
      } else {
        allowedSpaceIds = [spaceIdParam];
      }
    }

    const where: import('@prisma/client').Prisma.PageWhereInput = {
      deletedAt: null,
      OR: [
        { title: { contains: q.trim(), mode: 'insensitive' } },
        { searchText: { contains: q.trim(), mode: 'insensitive' } },
      ],
    };

    if (allowedSpaceIds) where.spaceId = { in: allowedSpaceIds };
    if (mine) where.createdById = uid;

    const rows = await prisma.page.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 80,
      select: {
        id: true,
        title: true,
        spaceId: true,
        slug: true,
        updatedAt: true,
        visibility: true,
        space: { select: { id: true, name: true, slug: true } },
      },
    });

    const results = [];
    for (const row of rows) {
      if (isAdmin(user)) {
        results.push(row);
        continue;
      }
      const memberRole = await prisma.spaceMember.findUnique({
        where: { spaceId_userId: { spaceId: row.spaceId, userId: uid } },
      });
      if (!memberRole) continue;
      if (!canViewPage(user, memberRole.role, { visibility: row.visibility })) continue;
      results.push(row);
    }

    return { results: results.slice(0, 50) };
  });
}
