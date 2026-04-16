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
        <div className="row">
          <Link className="brand" to="/">
            Wiki
          </Link>
          <span className="muted">/</span>
          <span>Поиск</span>
        </div>
        <div className="row">
          <span className="muted">{user?.email}</span>
          <Link className="btn" to="/">
            Пространства
          </Link>
          <button className="btn" type="button" onClick={() => void logout()}>
            Выйти
          </button>
        </div>
      </header>
      <main className="main">
        <h1 style={{ marginTop: 0, fontSize: '1.15rem' }}>Поиск по всем доступным пространствам</h1>
        <form className="row" style={{ marginBottom: '1rem', maxWidth: 520 }} onSubmit={onSubmit}>
          <input
            style={{ flex: 1 }}
            placeholder="Запрос…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
          />
          <button className="btn primary" type="submit">
            Найти
          </button>
        </form>
        {!submitted.trim() ? (
          <p className="muted">Введите запрос и нажмите «Найти».</p>
        ) : loading ? (
          <p className="muted">Поиск…</p>
        ) : results.length === 0 ? (
          <p className="muted">Ничего не найдено.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {results.map((r) => (
              <li key={r.id} className="card" style={{ marginBottom: '0.5rem' }}>
                <Link to={`/spaces/${r.spaceId}/pages/${r.id}`}>
                  <strong>{r.title}</strong>
                </Link>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {r.space?.name ?? r.spaceId} · {r.slug} · {new Date(r.updatedAt).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
