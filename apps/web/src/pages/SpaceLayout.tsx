import { FormEvent, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom';
import { api, apiJson } from '../api';
import { useAuth } from '../AuthContext';

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
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [spaceName, setSpaceName] = useState('');
  const [members, setMembers] = useState<Array<{ user: { id: string; email: string }; role: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [memberEmail, setMemberEmail] = useState('');
  const [searchInput, setSearchInput] = useState('');

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
    const usersRes = await api<{ users: Array<{ id: string; email: string }> }>('/api/v1/users');
    const u = usersRes.users.find((x) => x.email.toLowerCase() === memberEmail.trim().toLowerCase());
    if (!u) {
      window.alert('Пользователь не найден. Создайте его в админке.');
      return;
    }
    await apiJson(`/api/v1/spaces/${spaceId}/members`, { userId: u.id, role: 'CONTRIBUTOR' });
    setMemberEmail('');
    await load();
  }

  async function createPage(parentId: string | null) {
    if (!spaceId) return;
    const title = window.prompt('Заголовок страницы', 'Новая страница');
    if (!title) return;
    const res = await apiJson<{ page: { id: string } }>(`/api/v1/spaces/${spaceId}/pages`, {
      title,
      parentId,
    });
    await load();
    navigate(`/spaces/${spaceId}/pages/${res.page.id}`);
  }

  return (
    <div className="layout">
      <header className="topbar">
        <div className="row">
          <Link className="brand" to="/">
            Wiki
          </Link>
          <span className="muted">/</span>
          <span>{spaceName || '…'}</span>
        </div>
        <div className="row">
          <span className="muted">{user?.email}</span>
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
      <div className="main split">
        <aside className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <strong>Страницы</strong>
            <button className="btn primary" type="button" onClick={() => void createPage(null)}>
              + Страница
            </button>
          </div>
          {user?.role === 'ADMIN' && (
            <form className="grid" style={{ marginBottom: '1rem' }} onSubmit={addMember}>
              <div className="muted">Участники space</div>
              <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                {members.map((m) => (
                  <li key={m.user.id}>
                    {m.user.email} <span className="muted">({m.role})</span>
                  </li>
                ))}
              </ul>
              <div className="row">
                <input
                  style={{ flex: 1 }}
                  placeholder="email пользователя"
                  value={memberEmail}
                  onChange={(e) => setMemberEmail(e.target.value)}
                />
                <button className="btn" type="submit">
                  Добавить
                </button>
              </div>
            </form>
          )}
          <form
            className="row"
            style={{ marginBottom: '0.75rem' }}
            onSubmit={(e) => {
              e.preventDefault();
              const q = searchInput.trim();
              navigate(q ? `/spaces/${spaceId}/search?q=${encodeURIComponent(q)}` : `/spaces/${spaceId}/search`);
            }}
          >
            <input
              style={{ flex: 1 }}
              placeholder="Поиск в space…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <button className="btn" type="submit">
              Найти
            </button>
          </form>
          {loading ? (
            <p className="muted">Загрузка…</p>
          ) : (
            <TreeNav spaceId={spaceId!} nodes={tree} onCreateChild={createPage} />
          )}
        </aside>
        <section className="card" style={{ minHeight: 360 }}>
          <Outlet context={{ reloadTree: load, spaceName }} />
        </section>
      </div>
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
  onCreateChild: (parentId: string | null) => void;
}) {
  return (
    <ul className="tree">
      {nodes.map((n) => (
        <li key={n.id}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <NavLink to={`/spaces/${spaceId}/pages/${n.id}`}>{n.title}</NavLink>
            <button className="btn" type="button" title="Дочерняя страница" onClick={() => void onCreateChild(n.id)}>
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
      <h2 style={{ marginTop: 0 }}>Выберите страницу</h2>
      <p className="muted">Создайте страницу слева или откройте из дерева.</p>
      <p className="muted">
        <Link to="/">← К пространствам</Link>
      </p>
    </div>
  );
}
