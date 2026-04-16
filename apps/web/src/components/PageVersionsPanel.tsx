import { useEffect, useState } from 'react';
import { api, apiJson } from '../api';
import { ConfirmModal } from './ConfirmModal';
import { TextDiff } from './TextDiff';
import { useToast } from './ToastProvider';

type Ver = {
  version: number;
  title: string;
  createdAt: string;
  editedBy: { email: string };
};

type ComparePayload = {
  from: { version: number; title: string; plainText: string };
  to: { version: number; title: string; plainText: string };
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
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<Ver[]>([]);
  const [loading, setLoading] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [fromV, setFromV] = useState<number>(0);
  const [toV, setToV] = useState<number>(0);
  const [compareData, setCompareData] = useState<ComparePayload | null>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [restoreVersion, setRestoreVersion] = useState<number | null>(null);
  const [restoreBusy, setRestoreBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const res = await api<{ versions: Ver[] }>(`/api/v1/pages/${pageId}/versions`);
        if (!cancelled) {
          setVersions(res.versions);
          if (res.versions.length >= 2) {
            const sorted = [...res.versions].sort((a, b) => a.version - b.version);
            setFromV(sorted[0]!.version);
            setToV(sorted[sorted.length - 1]!.version);
          } else if (res.versions.length === 1) {
            setFromV(res.versions[0]!.version);
            setToV(res.versions[0]!.version);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, pageId]);

  async function confirmRestore() {
    if (!canRestore || restoreVersion == null) return;
    setRestoreBusy(true);
    try {
      await apiJson(`/api/v1/pages/${pageId}/versions/${restoreVersion}/restore`, {}, 'POST');
      onRestored();
      setOpen(false);
      setCompareOpen(false);
      setCompareData(null);
      setRestoreVersion(null);
      showToast('Страница откатана к выбранной версии', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Не удалось восстановить версию', 'error');
    } finally {
      setRestoreBusy(false);
    }
  }

  async function loadCompare() {
    if (!fromV || !toV) return;
    setCompareLoading(true);
    setCompareData(null);
    try {
      const res = await api<ComparePayload>(
        `/api/v1/pages/${pageId}/versions/compare?from=${fromV}&to=${toV}`,
      );
      setCompareData(res);
    } finally {
      setCompareLoading(false);
    }
  }

  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <div className="section-title" style={{ marginBottom: '0.5rem' }}>
        История
      </div>
      <p className="muted" style={{ margin: '0 0 0.65rem', fontSize: '0.88rem' }}>
        Каждое сохранение создаёт версию. Можно откатиться или сравнить текст двух версий.
      </p>
      <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
        <button className="btn btn-sm" type="button" onClick={() => setOpen((o) => !o)}>
          {open ? 'Скрыть список' : 'Показать версии'}
        </button>
        {open && versions.length >= 2 && (
          <button className="btn btn-sm" type="button" onClick={() => setCompareOpen((c) => !c)}>
            {compareOpen ? 'Скрыть сравнение' : 'Сравнить две версии'}
          </button>
        )}
      </div>
      {open && compareOpen && versions.length >= 2 && (
        <div className="card" style={{ marginTop: '0.75rem' }}>
          <div className="row" style={{ flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
            <span className="muted">От</span>
            <select value={fromV} onChange={(e) => setFromV(Number(e.target.value))} style={{ width: 'auto', minWidth: 180 }}>
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  v{v.version} — {new Date(v.createdAt).toLocaleString()}
                </option>
              ))}
            </select>
            <span className="muted">к</span>
            <select value={toV} onChange={(e) => setToV(Number(e.target.value))} style={{ width: 'auto', minWidth: 180 }}>
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  v{v.version} — {new Date(v.createdAt).toLocaleString()}
                </option>
              ))}
            </select>
            <button className="btn primary btn-sm" type="button" onClick={() => void loadCompare()}>
              Показать отличия
            </button>
          </div>
          {compareLoading && <p className="muted">Загрузка…</p>}
          {compareData && (
            <div style={{ marginTop: '0.75rem' }}>
              <TextDiff
                a={compareData.from.plainText}
                b={compareData.to.plainText}
                titleA={compareData.from.title}
                titleB={compareData.to.title}
              />
            </div>
          )}
        </div>
      )}
      {open && (
        <div className="card" style={{ marginTop: '0.75rem', maxHeight: 280, overflow: 'auto' }}>
          {loading ? (
            <p className="muted">Загрузка…</p>
          ) : versions.length === 0 ? (
            <p className="muted">Пока одна версия — сохраните страницу ещё раз, чтобы появилась история.</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.35rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>№</th>
                  <th style={{ textAlign: 'left', padding: '0.35rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Когда</th>
                  <th style={{ textAlign: 'left', padding: '0.35rem', borderBottom: '1px solid var(--border)', color: 'var(--muted)' }}>Кто правил</th>
                  {canRestore ? <th style={{ borderBottom: '1px solid var(--border)' }} /> : null}
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.version}>
                    <td style={{ padding: '0.4rem 0.35rem', borderBottom: '1px solid var(--border)' }}>{v.version}</td>
                    <td style={{ padding: '0.4rem 0.35rem', borderBottom: '1px solid var(--border)' }}>{new Date(v.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '0.4rem 0.35rem', borderBottom: '1px solid var(--border)' }} className="muted">
                      {v.editedBy.email}
                    </td>
                    {canRestore ? (
                      <td style={{ padding: '0.4rem 0.35rem', borderBottom: '1px solid var(--border)' }}>
                        <button className="btn btn-sm" type="button" onClick={() => setRestoreVersion(v.version)}>
                          Откатить сюда
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

      <ConfirmModal
        open={restoreVersion != null}
        title={restoreVersion != null ? `Откатить к версии ${restoreVersion}?` : ''}
        confirmLabel="Откатить"
        variant="danger"
        busy={restoreBusy}
        onClose={() => !restoreBusy && setRestoreVersion(null)}
        onConfirm={confirmRestore}
      >
        <>
          Текущее содержимое страницы останется в истории как новая версия. Вы сможете вернуться к нему позже.
        </>
      </ConfirmModal>
    </div>
  );
}
