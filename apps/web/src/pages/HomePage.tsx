import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, apiJson } from '../api';
import { useAuth } from '../AuthContext';

type Space = { id: string; slug: string; name: string };

function roleLabel(role: string) {
  switch (role) {
    case 'ADMIN':
      return 'Администратор';
    case 'EDITOR':
      return 'Редактор';
    case 'VIEWER':
      return 'Читатель';
    default:
      return role;
  }
}

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

  const firstName = user?.email?.split('@')[0] ?? '';

  return (
    <div className="layout">
      <header className="topbar">
        <div className="breadcrumb">
          <Link className="brand" to="/">
            Wiki
          </Link>
        </div>
        <div className="row">
          <form className="search-field" style={{ minWidth: 0, maxWidth: 320, flex: '1 1 200px' }} onSubmit={submitGlobalSearch}>
            <input placeholder="Поиск по всем пространствам…" value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} />
            <button className="btn primary" type="submit">
              Найти
            </button>
          </form>
          <span className="user-chip" title={user?.email}>
            {user?.email}
          </span>
          <span className="pill pill--neutral">{roleLabel(user?.role ?? '')}</span>
          <Link className="btn btn-ghost" to="/search">
            Поиск
          </Link>
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
        <div className="page-hero">
          <h1 className="page-title">Пространства</h1>
          <p className="page-lead">
            {firstName ? (
              <>
                Привет, <strong style={{ color: 'var(--text-secondary)' }}>{firstName}</strong>. Откройте раздел команды или создайте новый — всё знание команды в одном месте.
              </>
            ) : (
              <>Откройте раздел команды или создайте новый — база знаний в одном месте.</>
            )}
          </p>
        </div>

        {user?.role === 'ADMIN' && (
          <form className="card grid" onSubmit={createSpace} style={{ maxWidth: 520, marginBottom: '1.35rem' }}>
            <div>
              <div className="section-title">Новое пространство</div>
              <p className="muted" style={{ margin: '0 0 0.75rem' }}>
                Например: «Продукт», «Поддержка» или имя команды — внутри будут страницы и дерево.
              </p>
              <div className="row">
                <input style={{ flex: 1 }} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Название пространства" />
                <button className="btn primary" type="submit">
                  Создать
                </button>
              </div>
            </div>
          </form>
        )}

        {loading ? (
          <div className="space-grid" aria-hidden>
            {[1, 2, 3].map((i) => (
              <div key={i} className="card" style={{ height: 96 }}>
                <div className="skeleton" style={{ height: 18, width: '70%', marginBottom: 10 }} />
                <div className="skeleton" style={{ height: 14, width: '40%' }} />
              </div>
            ))}
          </div>
        ) : spaces.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon" aria-hidden>
              📂
            </div>
            <h3>Пока нет пространств</h3>
            <p>
              {user?.role === 'ADMIN'
                ? 'Создайте первое пространство выше — после этого здесь появятся карточки разделов.'
                : 'Попросите администратора добавить вас в пространство или создать новое.'}{' '}
              Можно также воспользоваться{' '}
              <Link to="/search">глобальным поиском</Link>, если страницы уже есть.
            </p>
          </div>
        ) : (
          <ul className="space-grid" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {spaces.map((s) => (
              <li key={s.id}>
                <Link className="card card--interactive" to={`/spaces/${s.id}`} style={{ display: 'block', height: '100%' }}>
                  <strong style={{ fontSize: '1.05rem' }}>{s.name}</strong>
                  <div className="muted" style={{ marginTop: '0.35rem' }}>
                    /{s.slug}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
