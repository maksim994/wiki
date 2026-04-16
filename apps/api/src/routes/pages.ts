import type { Prisma } from '@prisma/client';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { nanoid } from 'nanoid';
import { prisma } from '../lib/prisma.js';
import { blocksToSearchText } from '../lib/content.js';
import { audit } from '../lib/audit.js';
import {
  canCommentOnPage,
  canEditPage,
  canViewPage,
  canSetVisibility,
} from '../lib/permissions.js';
import { slugify } from '../lib/slug.js';
import { getSpaceMemberRole } from '../lib/space-access.js';

const createPage = z.object({
  parentId: z.string().uuid().nullable().optional(),
  title: z.string().min(1),
  slug: z.string().min(1).optional(),
  visibility: z.enum(['PRIVATE', 'INTERNAL', 'PUBLIC']).optional(),
});

const patchPage = z.object({
  title: z.string().min(1).optional(),
  slug: z.string().min(1).optional(),
  parentId: z.string().uuid().nullable().optional(),
  position: z.number().int().optional(),
  visibility: z.enum(['PRIVATE', 'INTERNAL', 'PUBLIC']).optional(),
  content: z.unknown().optional(),
  contentVersion: z.number().int().optional(),
});

const publicShareBody = z.object({
  enabled: z.boolean(),
  confirm: z.boolean().optional(),
  settings: z
    .object({
      noindex: z.boolean().optional(),
      comments_enabled: z.boolean().optional(),
      show_author: z.boolean().optional(),
      show_updated_at: z.boolean().optional(),
    })
    .optional(),
});

export async function pagesRoutes(app: FastifyInstance) {
  app.get('/api/v1/spaces/:spaceId/pages/tree', { preHandler: [app.authenticate] }, async (req, reply) => {
    const uid = req.user.sub;
    const spaceId = (req.params as { spaceId: string }).spaceId;

    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    const role = await getSpaceMemberRole(user, spaceId);
    if (!role) return reply.status(403).send({ error: 'Forbidden' });

    const pages = await prisma.page.findMany({
      where: { spaceId, deletedAt: null },
      orderBy: [{ parentId: 'asc' }, { position: 'asc' }],
      select: {
        id: true,
        parentId: true,
        position: true,
        title: true,
        slug: true,
        visibility: true,
        updatedAt: true,
      },
    });

    return { tree: buildTree(pages) };
  });

  app.post('/api/v1/spaces/:spaceId/pages', { preHandler: [app.authenticate] }, async (req, reply) => {
    const uid = req.user.sub;
    const spaceId = (req.params as { spaceId: string }).spaceId;

    const parsed = createPage.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    const role = await getSpaceMemberRole(user, spaceId);
    if (!canEditPage(user, role)) return reply.status(403).send({ error: 'Forbidden' });

    const baseSlug = slugify(parsed.data.slug ?? parsed.data.title);
    const slug = await uniquePageSlug(spaceId, baseSlug);

    const visibility = parsed.data.visibility ?? 'INTERNAL';
    if (!canSetVisibility(user, role, visibility)) {
      return reply.status(403).send({ error: 'Cannot set visibility' });
    }

    const content: unknown[] = [];
    const jsonContent = content as Prisma.InputJsonValue;
    const page = await prisma.page.create({
      data: {
        spaceId,
        parentId: parsed.data.parentId ?? null,
        title: parsed.data.title,
        slug,
        visibility,
        content: jsonContent,
        searchText: '',
        createdById: uid,
        updatedById: uid,
      },
    });

    await prisma.pageVersion.create({
      data: {
        pageId: page.id,
        version: 1,
        title: page.title,
        content: jsonContent,
        editedById: uid,
      },
    });

    await audit('page.created', 'Page', page.id, uid, { spaceId });

    return { page };
  });

  app.get('/api/v1/pages/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const uid = req.user.sub;
    const id = (req.params as { id: string }).id;

    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    const page = await prisma.page.findFirst({
      where: { id, deletedAt: null },
      include: {
        space: true,
        publicShare: true,
        createdBy: { select: { id: true, email: true } },
        updatedBy: { select: { id: true, email: true } },
      },
    });
    if (!page) return reply.status(404).send({ error: 'Not found' });

    const memberRole = await getSpaceMemberRole(user, page.spaceId);
    if (!memberRole) return reply.status(403).send({ error: 'Forbidden' });
    if (!canViewPage(user, memberRole, page)) return reply.status(403).send({ error: 'Forbidden' });

    const breadcrumb = await pageAncestorChain(page.spaceId, page.parentId);

    return {
      page: {
        id: page.id,
        spaceId: page.spaceId,
        parentId: page.parentId,
        position: page.position,
        title: page.title,
        slug: page.slug,
        visibility: page.visibility,
        content: page.content,
        contentVersion: page.contentVersion,
        createdAt: page.createdAt,
        updatedAt: page.updatedAt,
        createdBy: page.createdBy,
        updatedBy: page.updatedBy,
        publicShare: page.publicShare,
        canEdit: canEditPage(user, memberRole),
        canComment: canCommentOnPage(user, memberRole, page),
      },
      breadcrumb,
    };
  });

  app.patch('/api/v1/pages/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const uid = req.user.sub;
    const id = (req.params as { id: string }).id;

    const parsed = patchPage.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    const existing = await prisma.page.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });

    const memberRole = await getSpaceMemberRole(user, existing.spaceId);
    if (!canEditPage(user, memberRole)) return reply.status(403).send({ error: 'Forbidden' });

    if (parsed.data.visibility && !canSetVisibility(user, memberRole, parsed.data.visibility)) {
      return reply.status(403).send({ error: 'Cannot set visibility' });
    }

    if (parsed.data.contentVersion != null && parsed.data.contentVersion !== existing.contentVersion) {
      return reply.status(409).send({ error: 'Conflict', currentVersion: existing.contentVersion });
    }

    let newSlug = existing.slug;
    if (parsed.data.slug) {
      newSlug = await uniquePageSlug(existing.spaceId, slugify(parsed.data.slug), id);
    }

    let nextContent: Prisma.InputJsonValue = existing.content as Prisma.InputJsonValue;
    let searchText = existing.searchText;
    if (parsed.data.content !== undefined) {
      nextContent = parsed.data.content as Prisma.InputJsonValue;
      searchText = blocksToSearchText(parsed.data.content);
    }

    const data: Record<string, unknown> = {
      updatedById: uid,
    };
    if (parsed.data.title) data.title = parsed.data.title;
    if (parsed.data.slug) data.slug = newSlug;
    if (parsed.data.parentId !== undefined) data.parentId = parsed.data.parentId;
    if (parsed.data.position !== undefined) data.position = parsed.data.position;
    if (parsed.data.visibility) data.visibility = parsed.data.visibility;
    if (parsed.data.content !== undefined) {
      data.content = nextContent;
      data.searchText = searchText;
      data.contentVersion = existing.contentVersion + 1;
    }

    const page = await prisma.page.update({
      where: { id },
      data: data as Prisma.PageUpdateInput,
    });

    if (parsed.data.content !== undefined) {
      const latest = await prisma.pageVersion.findFirst({
        where: { pageId: id },
        orderBy: { version: 'desc' },
      });
      const nextV = (latest?.version ?? 0) + 1;
      await prisma.pageVersion.create({
        data: {
          pageId: id,
          version: nextV,
          title: page.title,
          content: page.content as Prisma.InputJsonValue,
          editedById: uid,
        },
      });
    }

    await audit('page.updated', 'Page', id, uid, {});

    return { page };
  });

  app.delete('/api/v1/pages/:id', { preHandler: [app.authenticate] }, async (req, reply) => {
    const uid = req.user.sub;
    const id = (req.params as { id: string }).id;

    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    const existing = await prisma.page.findFirst({ where: { id, deletedAt: null } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });

    const memberRole = await getSpaceMemberRole(user, existing.spaceId);
    if (!canEditPage(user, memberRole)) return reply.status(403).send({ error: 'Forbidden' });

    await prisma.page.update({
      where: { id },
      data: { deletedAt: new Date(), updatedById: uid },
    });

    await audit('page.deleted', 'Page', id, uid, {});

    return { ok: true };
  });

  app.get('/api/v1/pages/:id/versions', { preHandler: [app.authenticate] }, async (req, reply) => {
    const uid = req.user.sub;
    const id = (req.params as { id: string }).id;

    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    const page = await prisma.page.findFirst({ where: { id, deletedAt: null } });
    if (!page) return reply.status(404).send({ error: 'Not found' });

    const memberRole = await getSpaceMemberRole(user, page.spaceId);
    if (!memberRole || !canViewPage(user, memberRole, page)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const versions = await prisma.pageVersion.findMany({
      where: { pageId: id },
      orderBy: { version: 'desc' },
      select: {
        version: true,
        title: true,
        createdAt: true,
        editedBy: { select: { id: true, email: true } },
      },
    });

    return { versions };
  });

  app.get('/api/v1/pages/:id/versions/compare', { preHandler: [app.authenticate] }, async (req, reply) => {
    const uid = req.user.sub;
    const id = (req.params as { id: string }).id;
    const q = req.query as { from?: string; to?: string };
    const from = Number(q.from);
    const to = Number(q.to);
    if (!Number.isFinite(from) || !Number.isFinite(to)) {
      return reply.status(400).send({ error: 'Query from and to must be numbers' });
    }

    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    const page = await prisma.page.findFirst({ where: { id, deletedAt: null } });
    if (!page) return reply.status(404).send({ error: 'Not found' });

    const memberRole = await getSpaceMemberRole(user, page.spaceId);
    if (!memberRole || !canViewPage(user, memberRole, page)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const [a, b] = await Promise.all([
      prisma.pageVersion.findUnique({ where: { pageId_version: { pageId: id, version: from } } }),
      prisma.pageVersion.findUnique({ where: { pageId_version: { pageId: id, version: to } } }),
    ]);
    if (!a || !b) return reply.status(404).send({ error: 'Version not found' });

    return {
      from: {
        version: from,
        title: a.title,
        plainText: blocksToSearchText(a.content),
      },
      to: {
        version: to,
        title: b.title,
        plainText: blocksToSearchText(b.content),
      },
    };
  });

  app.get('/api/v1/pages/:id/versions/:version', { preHandler: [app.authenticate] }, async (req, reply) => {
    const uid = req.user.sub;
    const { id, version: v } = req.params as { id: string; version: string };
    const version = Number(v);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    const page = await prisma.page.findFirst({ where: { id, deletedAt: null } });
    if (!page) return reply.status(404).send({ error: 'Not found' });

    const memberRole = await getSpaceMemberRole(user, page.spaceId);
    if (!memberRole || !canViewPage(user, memberRole, page)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }

    const snap = await prisma.pageVersion.findUnique({
      where: { pageId_version: { pageId: id, version } },
    });
    if (!snap) return reply.status(404).send({ error: 'Not found' });

    return { version: snap };
  });

  app.post('/api/v1/pages/:id/versions/:version/restore', { preHandler: [app.authenticate] }, async (req, reply) => {
    const uid = req.user.sub;
    const { id, version: v } = req.params as { id: string; version: string };
    const version = Number(v);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    const page = await prisma.page.findFirst({ where: { id, deletedAt: null } });
    if (!page) return reply.status(404).send({ error: 'Not found' });

    const memberRole = await getSpaceMemberRole(user, page.spaceId);
    if (!canEditPage(user, memberRole)) return reply.status(403).send({ error: 'Forbidden' });

    const snap = await prisma.pageVersion.findUnique({
      where: { pageId_version: { pageId: id, version } },
    });
    if (!snap) return reply.status(404).send({ error: 'Not found' });

    const searchText = blocksToSearchText(snap.content);

    const updated = await prisma.page.update({
      where: { id },
      data: {
        title: snap.title,
        content: (snap.content ?? []) as Prisma.InputJsonValue,
        searchText,
        contentVersion: page.contentVersion + 1,
        updatedById: uid,
      },
    });

    const latest = await prisma.pageVersion.findFirst({
      where: { pageId: id },
      orderBy: { version: 'desc' },
    });
    const nextV = (latest?.version ?? 0) + 1;
    await prisma.pageVersion.create({
      data: {
        pageId: id,
        version: nextV,
        title: updated.title,
        content: updated.content as Prisma.InputJsonValue,
        editedById: uid,
      },
    });

    await audit('page.restored', 'Page', id, uid, { fromVersion: version });

    return { page: updated };
  });

  app.post('/api/v1/pages/:id/public-share', { preHandler: [app.authenticate] }, async (req, reply) => {
    const uid = req.user.sub;
    const id = (req.params as { id: string }).id;

    const parsed = publicShareBody.safeParse(req.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid body' });

    const user = await prisma.user.findUniqueOrThrow({ where: { id: uid } });
    const page = await prisma.page.findFirst({ where: { id, deletedAt: null } });
    if (!page) return reply.status(404).send({ error: 'Not found' });

    const memberRole = await getSpaceMemberRole(user, page.spaceId);
    if (!canEditPage(user, memberRole)) return reply.status(403).send({ error: 'Forbidden' });

    if (parsed.data.enabled && parsed.data.confirm !== true) {
      return reply.status(400).send({ error: 'Confirmation required' });
    }

    const token = nanoid(32);
    const settings = {
      noindex: true,
      comments_enabled: false,
      show_author: true,
      show_updated_at: true,
      ...parsed.data.settings,
    };

    const share = await prisma.publicShare.upsert({
      where: { pageId: id },
      create: {
        pageId: id,
        token,
        enabled: parsed.data.enabled,
        settings,
        createdById: uid,
      },
      update: {
        enabled: parsed.data.enabled,
        settings,
      },
    });

    await prisma.page.update({
      where: { id },
      data: {
        visibility: parsed.data.enabled ? 'PUBLIC' : 'INTERNAL',
        updatedById: uid,
      },
    });

    await audit('page.public_share', 'Page', id, uid, { enabled: parsed.data.enabled });

    const base = process.env.APP_URL ?? '';
    return {
      share: {
        ...share,
        publicUrl: `${base}/pub/${share.token}`,
      },
    };
  });
}

type PageNode = {
  id: string;
  parentId: string | null;
  position: number;
  title: string;
  slug: string;
  visibility: string;
  updatedAt: Date;
  children: PageNode[];
};

/** Цепочка от корня до прямого родителя (сама страница не входит). */
async function pageAncestorChain(
  spaceId: string,
  parentId: string | null,
): Promise<Array<{ id: string; title: string }>> {
  const ancestors: Array<{ id: string; title: string }> = [];
  let pid: string | null = parentId;
  for (let depth = 0; depth < 64 && pid; depth++) {
    const row = await prisma.page.findFirst({
      where: { id: pid, spaceId, deletedAt: null },
      select: { id: true, title: true, parentId: true },
    });
    if (!row) break;
    ancestors.unshift({ id: row.id, title: row.title });
    pid = row.parentId;
  }
  return ancestors;
}

function buildTree(
  pages: Array<{
    id: string;
    parentId: string | null;
    position: number;
    title: string;
    slug: string;
    visibility: string;
    updatedAt: Date;
  }>,
): PageNode[] {
  const map = new Map<string, PageNode>();
  for (const p of pages) {
    map.set(p.id, { ...p, children: [] });
  }
  const roots: PageNode[] = [];
  for (const p of pages) {
    const node = map.get(p.id)!;
    if (p.parentId && map.has(p.parentId)) {
      map.get(p.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  function sort(nodes: PageNode[]) {
    nodes.sort((a, b) => a.position - b.position);
    for (const n of nodes) sort(n.children);
  }
  sort(roots);
  return roots;
}

async function uniquePageSlug(spaceId: string, base: string, excludeId?: string): Promise<string> {
  let slug = base;
  let n = 0;
  for (;;) {
    const clash = await prisma.page.findFirst({
      where: {
        spaceId,
        slug,
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
    if (!clash) return slug;
    n += 1;
    slug = `${base}-${n}`;
  }
}
