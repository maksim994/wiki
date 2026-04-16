import { useFocusTrap } from '@mantine/hooks';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { api, apiJson } from '../api';
import { useAuth } from '../AuthContext';
import { CreatePageModal } from '../components/CreatePageModal';
import { useToast } from '../components/ToastProvider';
import { getRecentPages, RECENT_PAGES_STORAGE_KEY } from '../lib/recentPages';

type TreeNode = {
  id: string;
  title: string;
  slug: string;
  visibility: string;
  children: TreeNode[];
};

export function SpaceLayout() {
  const { spaceId } = useParams<{ spaceId: string }>();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { showToast } = useToast();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [spaceName, setSpaceName] = useState('');
  const [members, setMembers] = useState<Array<{ user: { id: string; email: string }; role: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [memberEmail, setMemberEmail] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [recentTick, setRecentTick] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mobileDrawer, setMobileDrawer] = useState(false);

  const sidebarFocusTrapRef = useFocusTrap(sidebarOpen && mobileDrawer);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const sync = () => setMobileDrawer(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!sidebarOpen || !mobileDrawer) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [sidebarOpen, mobileDrawer]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === RECENT_PAGES_STORAGE_KEY || e.key === null) setRecentTick((t) => t + 1);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const recentInSpace = useMemo(
    () => (spaceId ? getRecentPages(spaceId) : []),
    [spaceId, recentTick],
  );

  async function load() {
    if (!spaceId) return;
    const [tRes, sRes] = await Promise.all([
      api<{ tree: TreeNode[] }>(`/api/v1/spaces/${spaceId}/pages/tree`),
      api<{
        space: {
          name: string;
          members: Array<{ role: string; user: { id: string; email: string } }>;
        };
      }>(`/api/v1/spaces/${spaceId}`),
    ]);
    setTree(tRes.tree);
    setSpaceName(sRes.space.name);
    setMembers(sRes.space.members ?? []);
  }

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } catch {
        navigate('/');
      } finally {
        setLoading(false);
      }
    })();
  }, [spaceId, navigate]);

  async function addMember(e: FormEvent) {
    e.preventDefault();
    if (!spaceId || !memberEmail.trim()) return;
    try {
      const usersRes = await api<{ users: Array<{ id: string; email: string }> }>('/api/v1/users');
      const u = usersRes.users.find((x) => x.email.toLowerCase() === memberEmail.trim().toLowerCase());
      if (!u) {
        showToast('Такого пользователя нет. Сначала создайте его в разделе «Пользователи».', 'error');
        return;
      }
      await apiJson(`/api/v1/spaces/${spaceId}/members`, { userId: u.id, role: 'CONTRIBUTOR' });
      setMemberEmail('');
      await load();
      showToast(`${u.email} добавлен в это пространство`, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Не удалось добавить участника', 'error');
    }
  }

  async function createPage(parentId: string | null, title: string) {
    if (!spaceId) return;
    const res = await apiJson<{ page: { id: string } }>(`/api/v1/spaces/${spaceId}/pages`, {
      title,
      parentId,
    });
    await load();
    navigate(`/spaces/${spaceId}/pages/${res.page.id}`);
  }

  function openCreateRoot() {
    setCreateParentId(null);
    setCreateOpen(true);
  }

  function openCreateChild(parentId: string) {
    setCreateParentId(parentId);
    setCreateOpen(true);
  }

  return (
    <div className={'layout space-shell' + (sidebarOpen ? ' space-shell--sidebar-open' : '')}>
      <header className="topbar topbar-wrap">
        <div className="row" style={{ alignItems: 'center', gap: '0.5rem', flex: '1 1 auto', minWidth: 0 }}>
          <button
            type="button"
            className="btn btn-sm space-menu-toggle"
            aria-expanded={sidebarOpen}
            aria-controls="space-sidebar"
            onClick={() => setSidebarOpen((o) => !o)}
          >
            {sidebarOpen ? '✕' : '☰'} <span className="muted" style={{ fontSize: '0.8rem', marginLeft: 2 }}>Страницы</span>
          </button>
          <div className="breadcrumb" style={{ minWidth: 0 }}>
          <Link className="brand" to="/">
            Wiki
          </Link>
          <span className="muted">/</span>
          <Link to="/" className="muted">
            Пространства
          </Link>
          <span className="muted">/</span>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{spaceName || '…'}</span>
          </div>
        </div>
        <div className="row">
          <Link className="btn btn-ghost" to="/search">
            Поиск по wiki
          </Link>
          <span className="user-chip" title={user?.email}>
            {user?.email}
          </span>
          {user?.role === 'ADMIN' && (
            <Link className="btn" to="/admin/users">
              Пользователи
            </Link>
          )}
          <button className="btn" type="button" onClick={() => void logout()}>
            Выйти
          </button>
        </div>
      </header>
      <button
        type="button"
        className="space-sidebar-backdrop"
        aria-label="Закрыть меню страниц"
        tabIndex={-1}
        onClick={() => setSidebarOpen(false)}
      />
      <div className="main space-split">
        <aside
          id="space-sidebar"
          ref={sidebarFocusTrapRef}
          className="card space-sidebar"
          role={mobileDrawer ? 'dialog' : undefined}
          aria-modal={mobileDrawer && sidebarOpen ? true : undefined}
          aria-label={mobileDrawer ? 'Страницы пространства' : undefined}
        >
          <div className="row" style={{ justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span className="section-title" style={{ margin: 0 }}>
              Страницы
            </span>
            <button className="btn primary btn-sm" type="button" onClick={openCreateRoot}>
              + Страница
            </button>
          </div>

          {user?.role === 'ADMIN' && (
            <div className="sidebar-section">
              <div className="section-title">Участники</div>
              <form className="grid" style={{ gap: '0.65rem' }} onSubmit={addMember}>
                <ul style={{ margin: 0, paddingLeft: '1.1rem', fontSize: '0.9rem' }}>
                  {members.map((m) => (
                    <li key={m.user.id}>
                      {m.user.email} <span className="muted">({m.role})</span>
                    </li>
                  ))}
                </ul>
                <div className="search-field">
                  <input
                    placeholder="email коллеги"
                    value={memberEmail}
                    onChange={(e) => setMemberEmail(e.target.value)}
                  />
                  <button className="btn btn-sm" type="submit">
                    Добавить
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="sidebar-section">
            <div className="section-title">В этом пространстве</div>
            <form
              className="search-field"
              onSubmit={(e) => {
                e.preventDefault();
                const q = searchInput.trim();
                navigate(q ? `/spaces/${spaceId}/search?q=${encodeURIComponent(q)}` : `/spaces/${spaceId}/search`);
              }}
            >
              <input
                placeholder="Поиск по страницам…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <button className="btn btn-sm primary" type="submit">
                Найти
              </button>
            </form>
          </div>

          {recentInSpace.length > 0 && (
            <div className="sidebar-section">
              <div className="section-title">Недавно открытые</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {recentInSpace.map((r) => (
                  <li key={r.id} style={{ marginBottom: '0.2rem' }}>
                    <NavLink
                      className={({ isActive }) => 'nav-link' + (isActive ? ' nav-link--active' : '')}
                      to={`/spaces/${r.spaceId}/pages/${r.id}`}
                    >
                      {r.title}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {loading ? (
            <p className="muted">Загрузка дерева…</p>
          ) : tree.length === 0 ? (
            <div className="empty-state" style={{ padding: '1.25rem 0.75rem' }}>
              <p className="muted" style={{ margin: 0, fontSize: '0.9rem' }}>
                Дерева пока нет. Нажмите «+ Страница», чтобы создать первую.
              </p>
            </div>
          ) : (
            <TreeNav spaceId={spaceId!} nodes={tree} onCreateChild={openCreateChild} />
          )}
        </aside>
        <section className="card space-content">
          <Outlet context={{ reloadTree: load, spaceName }} />
        </section>
      </div>

      <CreatePageModal
        open={createOpen}
        defaultTitle="Новая страница"
        submitLabel="Создать"
        onClose={() => setCreateOpen(false)}
        onConfirm={async (title) => {
          await createPage(createParentId, title);
          setCreateOpen(false);
        }}
      />
    </div>
  );
}

function TreeNav({
  spaceId,
  nodes,
  onCreateChild,
}: {
  spaceId: string;
  nodes: TreeNode[];
  onCreateChild: (parentId: string) => void;
}) {
  return (
    <ul className="tree">
      {nodes.map((n) => (
        <li key={n.id}>
          <div className="row" style={{ justifyContent: 'space-between', gap: '0.35rem' }}>
            <NavLink
              className={({ isActive }) => 'nav-link' + (isActive ? ' nav-link--active' : '')}
              to={`/spaces/${spaceId}/pages/${n.id}`}
              style={{ flex: 1, minWidth: 0 }}
            >
              <span style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
            </NavLink>
            <button
              className="btn btn-sm btn-ghost"
              type="button"
              title="Дочерняя страница"
              onClick={() => onCreateChild(n.id)}
            >
              +
            </button>
          </div>
          {n.children?.length ? (
            <TreeNav spaceId={spaceId} nodes={n.children} onCreateChild={onCreateChild} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function SpaceIndex() {
  return (
    <div>
      <h1 className="page-title page-title--sm" style={{ marginBottom: '0.5rem' }}>
        Добро пожаловать
      </h1>
      <p className="page-lead" style={{ marginBottom: '1rem' }}>
        Выберите страницу в списке (кнопка «Страницы» на телефоне) или создайте новую — она появится в дереве и в поиске.
      </p>
      <p className="muted">
        <Link to="/">← Все пространства</Link>
      </p>
    </div>
  );
}
