const JSON_HEADERS = { 'Content-Type': 'application/json' };

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers = new Headers(opts.headers);
  if (opts.body && !(opts.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(path, {
    ...opts,
    credentials: 'include',
    headers,
  });
  const text = await res.text();
  let data: unknown = undefined;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  if (!res.ok) {
    const msg =
      typeof data === 'object' && data && 'error' in data && typeof (data as { error: string }).error === 'string'
        ? (data as { error: string }).error
        : res.statusText;
    throw new ApiError(res.status, msg, data);
  }
  return data as T;
}

export function apiJson<T>(path: string, body: unknown, method = 'POST') {
  return api<T>(path, { method, body: JSON.stringify(body), headers: JSON_HEADERS });
}
