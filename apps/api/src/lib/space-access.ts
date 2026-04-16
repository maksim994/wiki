import type { User } from '@prisma/client';
import { prisma } from './prisma.js';
import { isAdmin } from './permissions.js';

export async function getSpaceMemberRole(user: User, spaceId: string) {
  if (isAdmin(user)) return 'OWNER' as const;
  const m = await prisma.spaceMember.findUnique({
    where: { spaceId_userId: { spaceId, userId: user.id } },
  });
  return m?.role ?? null;
}

export async function requireSpaceMember(user: User, spaceId: string) {
  const role = await getSpaceMemberRole(user, spaceId);
  if (!role) return null;
  return role;
}
