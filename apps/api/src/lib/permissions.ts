import type { Page, PageVisibility, SpaceMember, SpaceMemberRole, User, UserRole } from '@prisma/client';

export function isAdmin(user: Pick<User, 'role'>): boolean {
  return user.role === 'ADMIN';
}

export function memberCanContribute(m: SpaceMemberRole | undefined): boolean {
  return m === 'OWNER' || m === 'CONTRIBUTOR';
}

export function memberCanRead(m: SpaceMemberRole | undefined): boolean {
  return m === 'OWNER' || m === 'CONTRIBUTOR' || m === 'READER';
}

/** Может ли пользователь видеть страницу с учётом видимости и роли в space. */
export function canViewPage(
  user: User,
  memberRole: SpaceMemberRole | null,
  page: Pick<Page, 'visibility'>,
): boolean {
  if (isAdmin(user)) return true;
  if (!memberRole || !memberCanRead(memberRole)) return false;

  switch (page.visibility) {
    case 'INTERNAL':
      return true;
    case 'PRIVATE':
      return memberCanContribute(memberRole);
    case 'PUBLIC':
      return true;
    default:
      return false;
  }
}

/** Редактирование контента страницы */
export function canEditPage(user: User, memberRole: SpaceMemberRole | null): boolean {
  if (isAdmin(user)) return true;
  if (user.role !== 'EDITOR') return false;
  return memberRole != null && memberCanContribute(memberRole);
}

/** Комментарии: Viewer+ в space для internal; для private — contributor+ */
export function canCommentOnPage(
  user: User,
  memberRole: SpaceMemberRole | null,
  page: Pick<Page, 'visibility'>,
): boolean {
  if (isAdmin(user)) return true;
  if (!memberRole || !memberCanRead(memberRole)) return false;
  if (page.visibility === 'PRIVATE') return memberCanContribute(memberRole);
  return true;
}

export function canSetVisibility(
  user: User,
  memberRole: SpaceMemberRole | null,
  v: PageVisibility,
): boolean {
  if (!canEditPage(user, memberRole)) return false;
  if (v === 'PUBLIC' && user.role === 'VIEWER') return false;
  return true;
}
