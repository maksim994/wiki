import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { apiJson } from '../api';
import { useAuth } from '../AuthContext';

export function LoginPage() {
  const { user, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiJson('/api/v1/auth/login', { email, password });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    }
  }

  return (
    <div className="layout">
      <div className="main" style={{ maxWidth: 420 }}>
        <div className="card">
          <h1 style={{ marginTop: 0 }}>Вход</h1>
          <form className="grid" onSubmit={onSubmit}>
            <label>
              <div className="muted">Email</div>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
            </label>
            <label>
              <div className="muted">Пароль</div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </label>
            {error && <div style={{ color: 'var(--danger)' }}>{error}</div>}
            <button className="btn primary" type="submit">
              Войти
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
