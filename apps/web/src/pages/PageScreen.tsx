import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { api, apiJson, ApiError } from '../api';
import { useAuth } from '../AuthContext';
import { BlockView } from '../components/BlockView';

type PagePayload = {
  page: {
    id: string;
    spaceId: string;
    title: string;
    slug: string;
    visibility: 'PRIVATE' | 'INTERNAL' | 'PUBLIC';
    content: unknown;
    contentVersion: number;
    updatedAt: string;
    canEdit: boolean;
    canComment: boolean;
    publicShare?: { enabled: boolean; token: string } | null;
  };
};

export function PageScreen() {
  const { spaceId, pageId } = useParams<{ spaceId: string; pageId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { reloadTree } = useOutletContext<{ reloadTree: () => Promise<void> }>();
  const [data, setData] = useState<PagePayload | null>(null);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    if (!pageId) return;
    const res = await api<PagePayload>(`/api/v1/pages/${pageId}`);
    setData(res);
    setDraft(JSON.stringify(res.page.content ?? [], null, 2));
  }

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch {
        navigate(`/spaces/${spaceId}`);
      }
    })();
  }, [pageId, spaceId, navigate]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!data || !pageId) return;
    setError(null);
    let content: unknown;
    try {
      content = JSON.parse(draft);
    } catch {
      setError('Некорректный JSON');
      return;
    }
    try {
      await apiJson(`/api/v1/pages/${pageId}`, {
        content,
        contentVersion: data.page.contentVersion,
      }, 'PATCH');
      await load();
      await reloadTree();
      setEdit(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Конфликт версии. Перезагрузите страницу.');
      } else {
        setError(err instanceof Error ? err.message : 'Ошибка сохранения');
      }
    }
  }

  async function setVisibility(v: 'PRIVATE' | 'INTERNAL' | 'PUBLIC') {
    if (!pageId || !data) return;
    await apiJson(`/api/v1/pages/${pageId}`, { visibility: v }, 'PATCH');
    await load();
    await reloadTree();
  }

  async function togglePublic(enable: boolean) {
    if (!pageId) return;
    const confirm = enable ? window.confirm('Сделать страницу доступной по публичной ссылке?') : true;
    if (!confirm) return;
    const res = await apiJson<{ share: { publicUrl?: string; enabled: boolean } }>(
      `/api/v1/pages/${pageId}/public-share`,
      { enabled: enable, confirm: true },
      'POST',
    );
    await load();
    if (res.share.publicUrl) {
      void navigator.clipboard.writeText(res.share.publicUrl);
    }
  }

  if (!data) return <p className="muted">Загрузка…</p>;

  const p = data.page;

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div className="row">
          <Link className="muted" to={`/spaces/${spaceId}`}>
            ← Space
          </Link>
        </div>
        <div className="row">
          {p.canEdit && !edit && (
            <button className="btn primary" type="button" onClick={() => setEdit(true)}>
              Редактировать
            </button>
          )}
          {p.canEdit && edit && (
            <button className="btn" type="button" onClick={() => setEdit(false)}>
              Отмена
            </button>
          )}
        </div>
      </div>

      <h1 style={{ marginTop: 0 }}>{p.title}</h1>
      <div className="muted row" style={{ marginBottom: '1rem' }}>
        <span>slug: {p.slug}</span>
        <span>видимость: {p.visibility}</span>
        {user?.role === 'ADMIN' || p.canEdit ? (
          <label>
            <span className="muted"> сменить: </span>
            <select value={p.visibility} onChange={(e) => void setVisibility(e.target.value as 'PRIVATE' | 'INTERNAL' | 'PUBLIC')}>
              <option value="PRIVATE">PRIVATE</option>
              <option value="INTERNAL">INTERNAL</option>
              <option value="PUBLIC">PUBLIC</option>
            </select>
          </label>
        ) : null}
      </div>

      {p.canEdit && (
        <div className="row" style={{ marginBottom: '1rem' }}>
          <button className="btn" type="button" onClick={() => void togglePublic(true)}>
            Публичная ссылка (вкл)
          </button>
          <button className="btn" type="button" onClick={() => void togglePublic(false)}>
            Публичная ссылка (выкл)
          </button>
        </div>
      )}

      {edit ? (
        <form className="grid" onSubmit={save}>
          <p className="muted">Контент — JSON-массив блоков (MVP). См. документацию в репозитории или введите валидный JSON-массив.</p>
          <textarea className="block-editor" value={draft} onChange={(e) => setDraft(e.target.value)} rows={18} />
          {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
          <button className="btn primary" type="submit">
            Сохранить
          </button>
        </form>
      ) : (
        <div className="page-view">
          <BlockView content={p.content} />
        </div>
      )}

      <CommentsSection pageId={p.id} canComment={p.canComment} />
    </div>
  );
}

function CommentsSection({ pageId, canComment }: { pageId: string; canComment: boolean }) {
  const [comments, setComments] = useState<Array<{ id: string; body: string; author: { email: string } }>>([]);
  const [text, setText] = useState('');

  async function load() {
    const res = await api<{ comments: typeof comments }>(`/api/v1/pages/${pageId}/comments`);
    setComments(res.comments);
  }

  useEffect(() => {
    void load();
  }, [pageId]);

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    await apiJson(`/api/v1/pages/${pageId}/comments`, { body: text });
    setText('');
    await load();
  }

  return (
    <div style={{ marginTop: '2rem', borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
      <h3>Комментарии</h3>
      {!canComment ? (
        <p className="muted">Комментарии недоступны для этой страницы.</p>
      ) : (
        <>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {comments.map((c) => (
              <li key={c.id} className="card" style={{ marginBottom: '0.5rem' }}>
                <div className="muted">{c.author.email}</div>
                <div>{c.body}</div>
              </li>
            ))}
          </ul>
          <form className="row" onSubmit={send}>
            <input style={{ flex: 1 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Комментарий…" />
            <button className="btn primary" type="submit">
              Отправить
            </button>
          </form>
        </>
      )}
    </div>
  );
}
