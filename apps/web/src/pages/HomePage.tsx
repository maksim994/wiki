import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiJson } from '../api';
import { useAuth } from '../AuthContext';

type Space = { id: string; slug: string; name: string };

export function HomePage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');

  async function load() {
    const res = await api<{ spaces: Space[] }>('/api/v1/spaces');
    setSpaces(res.spaces);
  }

  useEffect(() => {
    void (async () => {
      try {
        await load();
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function submitGlobalSearch(e: FormEvent) {
    e.preventDefault();
    const q = globalSearch.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  }

  async function createSpace(e: FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const res = await apiJson<{ space: Space }>('/api/v1/spaces', { name: newName.trim() });
    setNewName('');
    await load();
    navigate(`/spaces/${res.space.id}`);
  }

  return (
    <div className="layout">
      <header className="topbar">
        <div className="brand">Wiki</div>
        <div className="row">
          <form className="row" style={{ marginRight: '0.5rem' }} onSubmit={submitGlobalSearch}>
            <input
              style={{ width: 200 }}
              placeholder="Поиск по wiki…"
              value={globalSearch}
              onChange={(e) => setGlobalSearch(e.target.value)}
            />
            <button className="btn" type="submit">
              Найти
            </button>
          </form>
          <span className="muted">{user?.email}</span>
          <span className="muted">{user?.role}</span>
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
      <main className="main">
        <h1 className="muted" style={{ fontSize: '1.1rem', fontWeight: 600 }}>
          Пространства
        </h1>
        {user?.role === 'ADMIN' && (
          <form className="card grid" onSubmit={createSpace} style={{ maxWidth: 480, marginBottom: '1rem' }}>
            <strong>Новое пространство</strong>
            <div className="row">
              <input
                style={{ flex: 1 }}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Название"
              />
              <button className="btn primary" type="submit">
                Создать
              </button>
            </div>
          </form>
        )}
        {loading ? (
          <p className="muted">Загрузка…</p>
        ) : spaces.length === 0 ? (
          <p className="muted">Нет доступных пространств. Администратор может создать пространство выше.</p>
        ) : (
          <ul className="grid" style={{ listStyle: 'none', padding: 0 }}>
            {spaces.map((s) => (
              <li key={s.id}>
                <Link className="card" to={`/spaces/${s.id}`} style={{ display: 'block' }}>
                  <strong>{s.name}</strong>
                  <div className="muted">/{s.slug}</div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
