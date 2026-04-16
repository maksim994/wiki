import type { BlockNoteEditor } from '@blocknote/core';
import { FormEvent, Fragment, lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { api, apiJson, ApiError } from '../api';
import { ConfirmModal } from '../components/ConfirmModal';
import { PageVersionsPanel } from '../components/PageVersionsPanel';
import { useToast } from '../components/ToastProvider';
import { useAuth } from '../AuthContext';
import { addRecentPage } from '../lib/recentPages';

const WikiBlockEditor = lazy(() =>
  import('../components/WikiBlockEditor').then((m) => ({ default: m.WikiBlockEditor })),
);

type PagePayload = {
  page: {
    id: string;
    spaceId: string;
    parentId: string | null;
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
  breadcrumb: Array<{ id: string; title: string }>;
};

type PatchPage = {
  id: string;
  content: unknown;
  contentVersion: number;
  updatedAt: string;
};

const VISIBILITY: Record<
  'PRIVATE' | 'INTERNAL' | 'PUBLIC',
  { pill: string; short: string }
> = {
  PRIVATE: { pill: 'pill pill--neutral', short: 'Только редакторы' },
  INTERNAL: { pill: 'pill pill--info', short: 'Участники space' },
  PUBLIC: { pill: 'pill pill--success', short: 'Публично по ссылке' },
};

export function PageScreen() {
  const { spaceId, pageId } = useParams<{ spaceId: string; pageId: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
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
  const [publicModal, setPublicModal] = useState<'enable' | 'disable' | null>(null);
  const [publicBusy, setPublicBusy] = useState(false);

  const load = useCallback(async () => {
    if (!pageId) return;
    const res = await api<PagePayload>(`/api/v1/pages/${pageId}`);
    setData(res);
    versionRef.current = res.page.contentVersion;
  }, [pageId]);

  useEffect(() => {
    setRemountKey((k) => k + 1);
    void (async () => {
      try {
        await load();
      } catch {
        navigate(`/spaces/${spaceId}`);
      }
    })();
  }, [pageId, spaceId, navigate, load]);

  useEffect(() => {
    if (!pageId || !spaceId || !data?.page) return;
    addRecentPage({ id: pageId, spaceId, title: data.page.title });
  }, [pageId, spaceId, data?.page?.title]);

  useEffect(() => {
    if (!data?.page.title) return;
    const t = `${data.page.title} · Wiki`;
    document.title = t;
    return () => {
      document.title = 'Wiki';
    };
  }, [data?.page.title]);

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
              ...prev,
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

  const save = useCallback(async () => {
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
  }, [data, pageId, load, reloadTree]);

  useEffect(() => {
    if (!edit || !data?.page.canEdit) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [edit, data?.page.canEdit, save]);

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

  function requestTogglePublic(enable: boolean) {
    setPublicModal(enable ? 'enable' : 'disable');
  }

  async function confirmPublicModal() {
    if (!pageId || !publicModal) return;
    const enable = publicModal === 'enable';
    setPublicBusy(true);
    try {
      const res = await apiJson<{ share: { publicUrl?: string; enabled: boolean } }>(
        `/api/v1/pages/${pageId}/public-share`,
        { enabled: enable, confirm: true },
        'POST',
      );
      await load();
      if (res.share.publicUrl) {
        void navigator.clipboard.writeText(res.share.publicUrl);
        showToast('Публичная ссылка скопирована в буфер обмена', 'success');
      } else if (enable) {
        showToast('Публичный доступ включён', 'success');
      } else {
        showToast('Публичная ссылка отключена', 'success');
      }
      setRemountKey((k) => k + 1);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Не удалось изменить публичную ссылку', 'error');
    } finally {
      setPublicBusy(false);
      setPublicModal(null);
    }
  }

  if (!data) return <p className="muted">Загрузка…</p>;

  const p = data.page;
  const crumbs = data.breadcrumb ?? [];
  const documentKey = `${pageId}-${remountKey}`;
  const editable = p.canEdit && edit;

  const vis = VISIBILITY[p.visibility];

  return (
    <div>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <nav className="breadcrumb" aria-label="Навигация по страницам" style={{ flexWrap: 'wrap', rowGap: '0.2rem' }}>
          <Link to="/" className="muted">
            Пространства
          </Link>
          <span className="muted" aria-hidden>
            /
          </span>
          <Link to={`/spaces/${spaceId}`} className="muted">
            {spaceName || 'Пространство'}
          </Link>
          {crumbs.map((c) => (
            <Fragment key={c.id}>
              <span className="muted" aria-hidden>
                /
              </span>
              <Link to={`/spaces/${spaceId}/pages/${c.id}`} className="muted">
                {c.title}
              </Link>
            </Fragment>
          ))}
          <span className="muted" aria-hidden>
            /
          </span>
          <span className="muted" style={{ fontSize: '0.9rem' }}>
            {p.slug}
          </span>
        </nav>
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
              <span
                className="muted"
                style={{ fontSize: '0.78rem' }}
                title="Быстрое сохранение того же действия, без выхода из режима правки"
              >
                {typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent) ? '⌘S' : 'Ctrl+S'}
              </span>
              <button className="btn" type="button" onClick={() => void cancelEdit()}>
                Отмена
              </button>
            </>
          )}
        </div>
      </div>

      <h1 className="page-title" style={{ marginBottom: '0.65rem' }}>
        {p.title}
      </h1>
      <div className="row" style={{ marginBottom: '1rem', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
        <span className={vis.pill}>{vis.short}</span>
        <span className="muted" style={{ fontSize: '0.85rem' }}>
          {p.slug}
        </span>
        {user?.role === 'ADMIN' || p.canEdit ? (
          <label className="row" style={{ gap: '0.4rem', marginLeft: 'auto' }}>
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              Кто видит страницу
            </span>
            <select
              value={p.visibility}
              onChange={(e) => void setVisibility(e.target.value as 'PRIVATE' | 'INTERNAL' | 'PUBLIC')}
              style={{ width: 'auto', minWidth: 200 }}
            >
              <option value="PRIVATE">Только редакторы</option>
              <option value="INTERNAL">Все участники пространства</option>
              <option value="PUBLIC">Все по ссылке (публично)</option>
            </select>
          </label>
        ) : null}
      </div>

      {p.canEdit && (
        <div className="row" style={{ marginBottom: '1rem' }}>
          <button className="btn" type="button" onClick={() => requestTogglePublic(true)}>
            Включить публичную ссылку
          </button>
          <button className="btn" type="button" onClick={() => requestTogglePublic(false)}>
            Выключить публичную ссылку
          </button>
        </div>
      )}

      <ConfirmModal
        open={publicModal === 'enable'}
        title="Включить публичную ссылку?"
        confirmLabel="Включить доступ"
        busy={publicBusy}
        onClose={() => !publicBusy && setPublicModal(null)}
        onConfirm={confirmPublicModal}
      >
        <>
          По ссылке страницу сможет открыть <strong>любой человек</strong> — без входа в Wiki. Не публикуйте конфиденциальные
          данные. После включения ссылка будет скопирована в буфер обмена.
        </>
      </ConfirmModal>
      <ConfirmModal
        open={publicModal === 'disable'}
        title="Отключить публичную ссылку?"
        confirmLabel="Отключить"
        variant="danger"
        busy={publicBusy}
        onClose={() => !publicBusy && setPublicModal(null)}
        onConfirm={confirmPublicModal}
      >
        <>
          Старые ссылки перестанут работать. Участники пространства по-прежнему смогут открыть страницу после{' '}
          <strong>входа в аккаунт</strong>.
        </>
      </ConfirmModal>

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

      {error && (
        <div
          role="alert"
          style={{
            marginBottom: '0.75rem',
            padding: '0.65rem 0.85rem',
            borderRadius: 'var(--radius)',
            background: 'rgba(240, 128, 128, 0.1)',
            border: '1px solid rgba(240, 128, 128, 0.35)',
            color: '#ffb8b8',
            fontSize: '0.92rem',
          }}
        >
          {error}
        </div>
      )}

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
    <div className="comments-section">
      <h3>Комментарии</h3>
      {!canComment ? (
        <p className="muted">Комментарии недоступны для этой страницы.</p>
      ) : (
        <>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {comments.map((c) => (
              <li key={c.id} className="card" style={{ marginBottom: '0.5rem' }}>
                <div className="muted" style={{ fontSize: '0.85rem' }}>
                  {c.author.email}
                </div>
                <div style={{ marginTop: '0.35rem' }}>{c.body}</div>
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
