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
      setError(err instanceof Error ? err.message : 'Не удалось войти. Проверьте email и пароль.');
    }
  }

  return (
    <div className="layout login-shell">
      <main className="login-card card">
        <h1 style={{ marginTop: 0 }}>С возвращением</h1>
        <p className="page-lead" style={{ marginBottom: '1.25rem' }}>
          Войдите, чтобы открывать пространства и редактировать страницы.
        </p>
        <form className="grid" onSubmit={onSubmit}>
          <label>
            <span className="field-label">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="username" />
          </label>
          <label>
            <span className="field-label">Пароль</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          {error && (
            <div
              role="alert"
              style={{
                padding: '0.65rem 0.75rem',
                borderRadius: 'var(--radius)',
                background: 'rgba(240, 128, 128, 0.12)',
                border: '1px solid rgba(240, 128, 128, 0.35)',
                color: '#ffb8b8',
                fontSize: '0.9rem',
              }}
            >
              {error}
            </div>
          )}
          <button className="btn primary" type="submit" style={{ justifySelf: 'start' }}>
            Войти
          </button>
        </form>
        <p className="muted" style={{ marginTop: '1.25rem', marginBottom: 0, fontSize: '0.88rem' }}>
          Нет аккаунта? Попросите администратора создать пользователя в разделе «Пользователи».
        </p>
      </main>
    </div>
  );
}
