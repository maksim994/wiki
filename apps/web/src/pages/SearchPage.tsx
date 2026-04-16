import { useEffect, useState } from 'react';
import { Link, useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../api';

type Hit = {
  id: string;
  title: string;
  spaceId: string;
  slug: string;
  updatedAt: string;
  space?: { id: string; name: string; slug: string };
};

export function SearchPage() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const { spaceName } = useOutletContext<{ spaceName: string; reloadTree: () => Promise<void> }>();
  const [results, setResults] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await api<{ results: Hit[] }>(`/api/v1/search?q=${encodeURIComponent(q)}&space_id=${spaceId}`);
        if (!cancelled) setResults(res.results);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [q, spaceId]);

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Поиск{spaceName ? ` · ${spaceName}` : ''}</h2>
      {!q.trim() ? (
        <p className="muted">Введите запрос в поле слева и нажмите «Найти».</p>
      ) : loading ? (
        <p className="muted">Поиск…</p>
      ) : results.length === 0 ? (
        <p className="muted">Ничего не найдено.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {results.map((r) => (
            <li key={r.id} className="card" style={{ marginBottom: '0.5rem' }}>
              <Link to={`/spaces/${spaceId}/pages/${r.id}`}>
                <strong>{r.title}</strong>
              </Link>
              <div className="muted" style={{ fontSize: '0.85rem' }}>
                {r.space?.name ? `${r.space.name} · ` : ''}
                {r.slug} · {new Date(r.updatedAt).toLocaleString()}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
