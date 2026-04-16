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
      <div className="page-hero">
        <h1 className="page-title page-title--sm">Поиск{spaceName ? ` · ${spaceName}` : ''}</h1>
        <p className="page-lead">Результаты только в этом пространстве. Запрос можно изменить в поле слева.</p>
      </div>
      {!q.trim() ? (
        <div className="empty-state" style={{ textAlign: 'left', padding: '1.25rem' }}>
          <p className="muted" style={{ margin: 0 }}>
            Введите запрос в боковой панели и нажмите «Найти».
          </p>
        </div>
      ) : loading ? (
        <div style={{ maxWidth: 520 }}>
          <div className="skeleton" style={{ height: 56, borderRadius: 'var(--radius-lg)', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 56, borderRadius: 'var(--radius-lg)' }} />
        </div>
      ) : results.length === 0 ? (
        <div className="empty-state">
          <h3>Ничего не нашли</h3>
          <p className="muted">Попробуйте укоротить фразу или другие слова.</p>
        </div>
      ) : (
        <ul className="result-list">
          {results.map((r) => (
            <li key={r.id} className="result-item">
              <Link className="card card--interactive" to={`/spaces/${spaceId}/pages/${r.id}`} style={{ display: 'block' }}>
                <strong>{r.title}</strong>
                <div className="muted" style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                  {r.space?.name ? `${r.space.name} · ` : ''}
                  {r.slug} · {new Date(r.updatedAt).toLocaleString()}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
