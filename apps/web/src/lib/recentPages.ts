const STORAGE_KEY = 'wiki_recent_v1';
const MAX = 25;

export type RecentPage = {
  id: string;
  spaceId: string;
  title: string;
  at: number;
};

function read(): RecentPage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is RecentPage =>
        x != null &&
        typeof x === 'object' &&
        typeof (x as RecentPage).id === 'string' &&
        typeof (x as RecentPage).spaceId === 'string' &&
        typeof (x as RecentPage).title === 'string',
    );
  } catch {
    return [];
  }
}

function write(rows: RecentPage[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rows.slice(0, MAX)));
}

export function addRecentPage(entry: { id: string; spaceId: string; title: string }) {
  const now = Date.now();
  const rows = read().filter((r) => !(r.id === entry.id && r.spaceId === entry.spaceId));
  rows.unshift({ ...entry, at: now });
  write(rows);
}

/** Последние страницы; при `spaceId` — только в этом space. */
export function getRecentPages(spaceId?: string): RecentPage[] {
  const rows = read();
  const filtered = spaceId ? rows.filter((r) => r.spaceId === spaceId) : rows;
  return filtered.slice(0, 12);
}
