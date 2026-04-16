import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, apiJson } from '../api';

type U = { id: string; email: string; role: string; disabled: boolean; createdAt: string };

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
        <Link className="brand" to="/">
          Wiki
        </Link>
        <Link className="btn" to="/">
          На главную
        </Link>
      </header>
      <main className="main">
        <h1>Пользователи</h1>
        <form className="card grid" onSubmit={create} style={{ maxWidth: 520 }}>
          <h3 style={{ marginTop: 0 }}>Создать</h3>
          <label>
            <div className="muted">Email</div>
            <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required />
          </label>
          <label>
            <div className="muted">Пароль (необязательно — будет сгенерирован)</div>
            <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
          </label>
          <label>
            <div className="muted">Роль</div>
            <select value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
              <option value="VIEWER">VIEWER</option>
              <option value="EDITOR">EDITOR</option>
              <option value="ADMIN">ADMIN</option>
            </select>
          </label>
          <button className="btn primary" type="submit">
            Создать
          </button>
        </form>

        <div className="card" style={{ marginTop: '1rem' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '0.35rem' }}>Email</th>
                <th style={{ textAlign: 'left', padding: '0.35rem' }}>Роль</th>
                <th style={{ textAlign: 'left', padding: '0.35rem' }}>Статус</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td style={{ padding: '0.35rem' }}>{u.email}</td>
                  <td style={{ padding: '0.35rem' }}>{u.role}</td>
                  <td style={{ padding: '0.35rem' }}>{u.disabled ? 'заблокирован' : 'активен'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}
