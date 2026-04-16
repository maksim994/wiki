import type { BlockNoteEditor } from '@blocknote/core';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { api, apiJson, ApiError } from '../api';
import { WikiBlockEditor } from '../components/WikiBlockEditor';
import { useAuth } from '../AuthContext';

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
  const { reloadTree, spaceName } = useOutletContext<{ reloadTree: () => Promise<void>; spaceName: string }>();
  const [data, setData] = useState<PagePayload | null>(null);
  const [edit, setEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discardTick, setDiscardTick] = useState(0);
  const editorRef = useRef<BlockNoteEditor | null>(null);

  async function load() {
    if (!pageId) return;
    const res = await api<PagePayload>(`/api/v1/pages/${pageId}`);
    setData(res);
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

  async function save() {
    if (!data || !pageId) return;
    setError(null);
    const ed = editorRef.current;
    if (!ed) {
      setError('Редактор не готов');
      return;
    }
    try {
      const content = ed.document;
      await apiJson(
        `/api/v1/pages/${pageId}`,
        {
          content,
          contentVersion: data.page.contentVersion,
        },
        'PATCH',
      );
      await load();
      await reloadTree();
      setEdit(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Конфикт версии. Перезагрузите страницу.');
      } else {
        setError(err instanceof Error ? err.message : 'Ошибка сохранения');
      }
    }
  }

  async function cancelEdit() {
    setEdit(false);
    setDiscardTick((t) => t + 1);
    await load();
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
  const documentKey = `${pageId}-${p.contentVersion}-${discardTick}`;
  const editable = p.canEdit && edit;

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div className="row">
          <Link className="muted" to={`/spaces/${spaceId}`}>
            ← {spaceName || 'Пространство'}
          </Link>
        </div>
        <div className="row">
          {p.canEdit && !edit && (
            <button className="btn primary" type="button" onClick={() => setEdit(true)}>
              Редактировать
            </button>
          )}
          {p.canEdit && edit && (
            <>
              <button className="btn primary" type="button" onClick={() => void save()}>
                Сохранить
              </button>
              <button className="btn" type="button" onClick={() => void cancelEdit()}>
                Отмена
              </button>
            </>
          )}
        </div>
      </div>

      <h1 style={{ marginTop: 0 }}>{p.title}</h1>
      <div className="muted row" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
        <span>{p.slug}</span>
        <span>·</span>
        <span>{p.visibility}</span>
        {user?.role === 'ADMIN' || p.canEdit ? (
          <label className="row" style={{ gap: '0.35rem' }}>
            <span className="muted">доступ:</span>
            <select
              value={p.visibility}
              onChange={(e) => void setVisibility(e.target.value as 'PRIVATE' | 'INTERNAL' | 'PUBLIC')}
            >
              <option value="PRIVATE">Только редакторам</option>
              <option value="INTERNAL">Всем в space</option>
              <option value="PUBLIC">Публично (с ссылкой)</option>
            </select>
          </label>
        ) : null}
      </div>

      {p.canEdit && (
        <div className="row" style={{ marginBottom: '1rem' }}>
          <button className="btn" type="button" onClick={() => void togglePublic(true)}>
            Включить публичную ссылку
          </button>
          <button className="btn" type="button" onClick={() => void togglePublic(false)}>
            Выключить публичную ссылку
          </button>
        </div>
      )}

      {error && <div style={{ color: 'var(--danger)', marginBottom: '0.75rem' }}>{error}</div>}

      <WikiBlockEditor
        content={p.content}
        documentKey={documentKey}
        editable={editable}
        editorRef={p.canEdit ? editorRef : undefined}
      />

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
