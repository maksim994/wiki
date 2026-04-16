import type { BlockNoteEditor } from '@blocknote/core';
import { FormEvent, lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { api, apiJson, ApiError } from '../api';
import { PageVersionsPanel } from '../components/PageVersionsPanel';
import { useAuth } from '../AuthContext';
import { addRecentPage } from '../lib/recentPages';

const WikiBlockEditor = lazy(() =>
  import('../components/WikiBlockEditor').then((m) => ({ default: m.WikiBlockEditor })),
);

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

type PatchPage = {
  id: string;
  content: unknown;
  contentVersion: number;
  updatedAt: string;
};

export function PageScreen() {
  const { spaceId, pageId } = useParams<{ spaceId: string; pageId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { reloadTree, spaceName } = useOutletContext<{ reloadTree: () => Promise<void>; spaceName: string }>();
  const [data, setData] = useState<PagePayload | null>(null);
  const [edit, setEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Сброс редактора при смене страницы / отмене / выходе из режима правки / восстановлении версии */
  const [remountKey, setRemountKey] = useState(0);
  const [autosaveState, setAutosaveState] = useState<'idle' | 'saving' | 'saved' | 'err'>('idle');
  const editorRef = useRef<BlockNoteEditor | null>(null);
  const versionRef = useRef(0);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function load() {
    if (!pageId) return;
    const res = await api<PagePayload>(`/api/v1/pages/${pageId}`);
    setData(res);
    versionRef.current = res.page.contentVersion;
  }

  useEffect(() => {
    setRemountKey((k) => k + 1);
    void (async () => {
      try {
        await load();
      } catch {
        navigate(`/spaces/${spaceId}`);
      }
    })();
  }, [pageId, spaceId, navigate]);

  useEffect(() => {
    if (!pageId || !spaceId || !data?.page) return;
    addRecentPage({ id: pageId, spaceId, title: data.page.title });
  }, [pageId, spaceId, data?.page?.title]);

  useEffect(() => {
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, []);

  function scheduleAutosave() {
    if (!edit || !data?.page.canEdit) return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => void silentSave(), 2000);
  }

  async function silentSave() {
    if (!data || !pageId || !edit) return;
    const ed = editorRef.current;
    if (!ed) return;
    setAutosaveState('saving');
    setError(null);
    try {
      const content = ed.document;
      const res = await apiJson<{ page: PatchPage }>(
        `/api/v1/pages/${pageId}`,
        {
          content,
          contentVersion: versionRef.current,
        },
        'PATCH',
      );
      versionRef.current = res.page.contentVersion;
      setData((prev) =>
        prev
          ? {
              page: {
                ...prev.page,
                contentVersion: res.page.contentVersion,
                content: res.page.content,
                updatedAt: res.page.updatedAt,
              },
            }
          : prev,
      );
      setAutosaveState('saved');
      window.setTimeout(() => setAutosaveState('idle'), 1500);
    } catch (err) {
      setAutosaveState('err');
      if (err instanceof ApiError && err.status === 409) {
        setError('Версия изменилась. Сохраните вручную или перезагрузите страницу.');
      }
    }
  }

  async function save() {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
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
          contentVersion: versionRef.current,
        },
        'PATCH',
      );
      await load();
      await reloadTree();
      setEdit(false);
      setRemountKey((k) => k + 1);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Конфликт версии. Перезагрузите страницу.');
      } else {
        setError(err instanceof Error ? err.message : 'Ошибка сохранения');
      }
    }
  }

  async function cancelEdit() {
    setEdit(false);
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    await load();
    setRemountKey((k) => k + 1);
  }

  async function setVisibility(v: 'PRIVATE' | 'INTERNAL' | 'PUBLIC') {
    if (!pageId || !data) return;
    await apiJson(`/api/v1/pages/${pageId}`, { visibility: v }, 'PATCH');
    await load();
    await reloadTree();
    setRemountKey((k) => k + 1);
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
    setRemountKey((k) => k + 1);
  }

  if (!data) return <p className="muted">Загрузка…</p>;

  const p = data.page;
  const documentKey = `${pageId}-${remountKey}`;
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
          {edit && p.canEdit && (
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              {autosaveState === 'saving' && 'Сохранение…'}
              {autosaveState === 'saved' && 'Сохранено'}
              {autosaveState === 'err' && 'Ошибка автосохранения'}
            </span>
          )}
          {p.canEdit && !edit && (
            <button className="btn primary" type="button" onClick={() => setEdit(true)}>
              Редактировать
            </button>
          )}
          {p.canEdit && edit && (
            <>
              <button className="btn primary" type="button" onClick={() => void save()}>
                Сохранить и выйти
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

      <PageVersionsPanel
        pageId={p.id}
        canRestore={p.canEdit}
        onRestored={async () => {
          await load();
          await reloadTree();
          setEdit(false);
          setRemountKey((k) => k + 1);
        }}
      />

      {error && <div style={{ color: 'var(--danger)', marginBottom: '0.75rem' }}>{error}</div>}

      <Suspense fallback={<p className="muted">Загрузка редактора…</p>}>
        <WikiBlockEditor
          content={p.content}
          documentKey={documentKey}
          editable={editable}
          editorRef={p.canEdit ? editorRef : undefined}
          onDocumentChange={editable ? scheduleAutosave : undefined}
        />
      </Suspense>

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
