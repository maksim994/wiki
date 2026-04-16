import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

type Hit = {
  id: string;
  title: string;
  spaceId: string;
  slug: string;
  updatedAt: string;
  space?: { id: string; name: string; slug: string };
};

export function GlobalSearchPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [q, setQ] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [results, setResults] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const urlQ = searchParams.get('q') ?? '';
    setQ(urlQ);
    setSubmitted(urlQ.trim());
  }, [searchParams]);

  useEffect(() => {
    if (!submitted.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await api<{ results: Hit[] }>(`/api/v1/search?q=${encodeURIComponent(submitted)}`);
        if (!cancelled) setResults(res.results);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [submitted]);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const next = q.trim();
    navigate(next ? `/search?q=${encodeURIComponent(next)}` : '/search');
  }

  return (
    <div className="layout">
      <header className="topbar">
        <div className="breadcrumb">
          <Link className="brand" to="/">
            Wiki
          </Link>
          <span className="muted">/</span>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Поиск</span>
        </div>
        <div className="row">
          <span className="user-chip" title={user?.email}>
            {user?.email}
          </span>
          <Link className="btn" to="/">
            Пространства
          </Link>
          <button className="btn" type="button" onClick={() => void logout()}>
            Выйти
          </button>
        </div>
      </header>
      <main className="main">
        <div className="page-hero">
          <h1 className="page-title page-title--sm">Поиск по wiki</h1>
          <p className="page-lead">Ищем по заголовкам и тексту страниц во всех пространствах, к которым у вас есть доступ.</p>
        </div>
        <form className="search-field" style={{ marginBottom: '1.25rem', maxWidth: 560 }} onSubmit={onSubmit}>
          <input placeholder="Слова или фраза…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <button className="btn primary" type="submit">
            Найти
          </button>
        </form>
        {!submitted.trim() ? (
          <div className="empty-state" style={{ textAlign: 'left' }}>
            <p className="muted" style={{ margin: 0 }}>
              Введите запрос выше — покажем до 50 подходящих страниц, новые сверху.
            </p>
          </div>
        ) : loading ? (
          <div className="space-grid" style={{ maxWidth: 560 }}>
            <div className="skeleton" style={{ height: 56, borderRadius: 'var(--radius-lg)' }} />
            <div className="skeleton" style={{ height: 56, borderRadius: 'var(--radius-lg)' }} />
          </div>
        ) : results.length === 0 ? (
          <div className="empty-state">
            <h3>Ничего не нашли</h3>
            <p className="muted">Попробуйте другие слова или поиск внутри конкретного пространства слева в боковой панели.</p>
          </div>
        ) : (
          <ul className="result-list">
            {results.map((r) => (
              <li key={r.id} className="result-item">
                <Link className="card card--interactive" to={`/spaces/${r.spaceId}/pages/${r.id}`} style={{ display: 'block' }}>
                  <strong>{r.title}</strong>
                  <div className="muted" style={{ fontSize: '0.85rem', marginTop: '0.35rem' }}>
                    {r.space?.name ?? 'Пространство'} · {r.slug} · обновлено {new Date(r.updatedAt).toLocaleString()}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
