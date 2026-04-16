import { lazy, Suspense, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

const WikiBlockEditor = lazy(() =>
  import('../components/WikiBlockEditor').then((m) => ({ default: m.WikiBlockEditor })),
);

export function PublicPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<{
    page: { title: string; content: unknown };
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      try {
        const res = await api<{ page: { title: string; content: unknown } }>(`/api/v1/pub/${token}`);
        setData(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось загрузить страницу');
      }
    })();
  }, [token]);

  if (error) {
    return (
      <div className="main main--wide" style={{ paddingTop: '2rem' }}>
        <div className="empty-state">
          <h3>Страница недоступна</h3>
          <p style={{ color: '#ffb8b8', margin: 0 }}>{error}</p>
          <p className="muted" style={{ marginTop: '0.75rem' }}>
            Ссылка могла устареть или доступ к ней был отключён.
          </p>
        </div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="main main--wide" style={{ paddingTop: '2rem' }}>
        <div className="skeleton" style={{ height: 28, width: '60%', maxWidth: 400, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 200, borderRadius: 'var(--radius-lg)' }} />
      </div>
    );
  }

  return (
    <div className="main main--wide" style={{ paddingTop: '1.5rem' }}>
      <div className="pill pill--info" style={{ marginBottom: '1rem' }}>
        Публичная страница · только просмотр
      </div>
      <h1 className="page-title">{data.page.title}</h1>
      <Suspense fallback={<p className="muted">Загрузка содержимого…</p>}>
        <WikiBlockEditor content={data.page.content} documentKey={`pub-${token}`} editable={false} />
      </Suspense>
    </div>
  );
}
