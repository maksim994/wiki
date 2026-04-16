import type { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma.js';

export async function publicRoutes(app: FastifyInstance) {
  app.get('/api/v1/pub/:token', async (req, reply) => {
    const token = (req.params as { token: string }).token;

    const share = await prisma.publicShare.findUnique({
      where: { token },
      include: {
        page: {
          include: {
            space: { select: { slug: true, name: true } },
            createdBy: { select: { id: true, email: true } },
            updatedBy: { select: { id: true, email: true } },
          },
        },
      },
    });

    if (!share || !share.enabled || share.page.deletedAt) {
      return reply.status(404).send({ error: 'Not found' });
    }

    const settings = (share.settings ?? {}) as {
      noindex?: boolean;
      comments_enabled?: boolean;
      show_author?: boolean;
      show_updated_at?: boolean;
    };

    return {
      page: {
        id: share.page.id,
        title: share.page.title,
        content: share.page.content,
        space: share.page.space,
        updatedAt: share.page.updatedAt,
        createdBy: settings.show_author === false ? undefined : share.page.createdBy,
        updatedBy: settings.show_updated_at === false ? undefined : share.page.updatedBy,
      },
      settings: {
        noindex: settings.noindex !== false,
        comments_enabled: settings.comments_enabled === true,
      },
    };
  });
}
