import { useEffect, useState } from 'react';
import { api, apiJson } from '../api';

type Ver = {
  version: number;
  title: string;
  createdAt: string;
  editedBy: { email: string };
};

export function PageVersionsPanel({
  pageId,
  canRestore,
  onRestored,
}: {
  pageId: string;
  canRestore: boolean;
  onRestored: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<Ver[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await api<{ versions: Ver[] }>(`/api/v1/pages/${pageId}/versions`);
        if (!cancelled) setVersions(res.versions);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, pageId]);

  async function restore(version: number) {
    if (!canRestore) return;
    if (!window.confirm(`Восстановить версию ${version}? Текущее содержимое станет новой версией в истории.`)) return;
    await apiJson(`/api/v1/pages/${pageId}/versions/${version}/restore`, {}, 'POST');
    onRestored();
    setOpen(false);
  }

  return (
    <div style={{ marginBottom: '1rem' }}>
      <button className="btn" type="button" onClick={() => setOpen((o) => !o)}>
        {open ? 'Скрыть историю' : 'История версий'}
      </button>
      {open && (
        <div className="card" style={{ marginTop: '0.75rem', maxHeight: 280, overflow: 'auto' }}>
          {loading ? (
            <p className="muted">Загрузка…</p>
          ) : versions.length === 0 ? (
            <p className="muted">Нет версий.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.25rem' }}>№</th>
                  <th style={{ textAlign: 'left', padding: '0.25rem' }}>Когда</th>
                  <th style={{ textAlign: 'left', padding: '0.25rem' }}>Автор</th>
                  {canRestore ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.version}>
                    <td style={{ padding: '0.25rem' }}>{v.version}</td>
                    <td style={{ padding: '0.25rem' }}>{new Date(v.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '0.25rem' }} className="muted">
                      {v.editedBy.email}
                    </td>
                    {canRestore ? (
                      <td style={{ padding: '0.25rem' }}>
                        <button className="btn" type="button" onClick={() => void restore(v.version)}>
                          Восстановить
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
