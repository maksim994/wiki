import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiJson } from '../api';

type U = { id: string; email: string; role: string; disabled: boolean; createdAt: string };

const ROLE_LABEL: Record<string, string> = {
  VIEWER: 'Читатель',
  EDITOR: 'Редактор',
  ADMIN: 'Администратор',
};

export function AdminUsersPage() {
  const [users, setUsers] = useState<U[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'VIEWER' | 'EDITOR' | 'ADMIN'>('VIEWER');

  async function load() {
    const res = await api<{ users: U[] }>('/api/v1/users');
    setUsers(res.users);
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    await apiJson('/api/v1/users', {
      email,
      password: password || undefined,
      role,
    });
    setEmail('');
    setPassword('');
    await load();
  }

  return (
    <div className="layout">
      <header className="topbar">
        <div className="breadcrumb">
          <Link className="brand" to="/">
            Wiki
          </Link>
          <span className="muted">/</span>
          <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Пользователи</span>
        </div>
        <Link className="btn" to="/">
          На главную
        </Link>
      </header>
      <main className="main">
        <div className="page-hero">
          <h1 className="page-title page-title--sm">Пользователи</h1>
          <p className="page-lead">Создавайте учётные записи и назначайте роли. Пароль можно не указывать — сервер сгенерирует его.</p>
        </div>
        <form className="card grid" onSubmit={create} style={{ maxWidth: 520 }}>
          <div>
            <div className="section-title">Новый пользователь</div>
            <div className="grid" style={{ gap: '0.75rem', marginTop: '0.5rem' }}>
              <label>
                <span className="field-label">Email</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
              </label>
              <label>
                <span className="field-label">Пароль (необязательно)</span>
                <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Оставьте пустым для автогенерации" />
              </label>
              <label>
                <span className="field-label">Роль</span>
                <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
                  <option value="VIEWER">{ROLE_LABEL.VIEWER}</option>
                  <option value="EDITOR">{ROLE_LABEL.EDITOR}</option>
                  <option value="ADMIN">{ROLE_LABEL.ADMIN}</option>
                </select>
              </label>
            </div>
          </div>
          <button className="btn primary" type="submit" style={{ justifySelf: 'start' }}>
            Создать
          </button>
        </form>

        <div className="card" style={{ marginTop: '1.25rem', overflow: 'auto' }}>
          <div className="section-title" style={{ marginBottom: '0.65rem' }}>
            Все пользователи
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.35rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontWeight: 600 }}>
                  Email
                </th>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.35rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontWeight: 600 }}>
                  Роль
                </th>
                <th style={{ textAlign: 'left', padding: '0.5rem 0.35rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)', fontWeight: 600 }}>
                  Статус
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ padding: '0.5rem 0.35rem', borderBottom: '1px solid var(--border)' }}>{u.email}</td>
                  <td style={{ padding: '0.5rem 0.35rem', borderBottom: '1px solid var(--border)' }}>{ROLE_LABEL[u.role] ?? u.role}</td>
                  <td style={{ padding: '0.5rem 0.35rem', borderBottom: '1px solid var(--border)' }}>
                    {u.disabled ? <span className="pill pill--warn">заблокирован</span> : <span className="pill pill--success">активен</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
