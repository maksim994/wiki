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
        setError(e instanceof Error ? e.message : 'Ошибка');
      }
    })();
  }, [token]);

  if (error) {
    return (
      <div className="main">
        <p style={{ color: 'var(--danger)' }}>{error}</p>
      </div>
    );
  }
  if (!data) return <div className="main muted">Загрузка…</div>;

  return (
    <div className="main">
      <div className="muted" style={{ marginBottom: '1rem' }}>
        Публичная страница
      </div>
      <h1 style={{ marginTop: 0 }}>{data.page.title}</h1>
      <Suspense fallback={<p className="muted">Загрузка…</p>}>
        <WikiBlockEditor content={data.page.content} documentKey={`pub-${token}`} editable={false} />
      </Suspense>
    </div>
  );
}
