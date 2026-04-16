import { prisma } from './prisma.js';

export async function audit(
  action: string,
  entityType: string,
  entityId: string | null,
  userId: string | null,
  meta?: Record<string, unknown>,
) {
  await prisma.auditLog.create({
    data: {
      action,
      entityType,
      entityId,
      userId,
      meta: meta as object | undefined,
    },
  });
}
