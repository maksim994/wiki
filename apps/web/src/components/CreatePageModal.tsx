import { FormEvent, useEffect, useId, useState } from 'react';

export function CreatePageModal({
  open,
  defaultTitle = 'Новая страница',
  submitLabel = 'Создать страницу',
  onClose,
  onConfirm,
}: {
  open: boolean;
  defaultTitle?: string;
  submitLabel?: string;
  onClose: () => void;
  onConfirm: (title: string) => void | Promise<void>;
}) {
  const titleId = useId();
  const [title, setTitle] = useState(defaultTitle);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setTitle(defaultTitle);
  }, [open, defaultTitle]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  async function submit(e: FormEvent) {
    e.preventDefault();
    const t = title.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await onConfirm(t);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-card card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="modal-title">
          Новая страница
        </h2>
        <p className="muted modal-lead">Задайте заголовок — его всегда можно изменить позже.</p>
        <form className="grid" style={{ gap: '0.75rem' }} onSubmit={(e) => void submit(e)}>
          <label>
            <span className="field-label">Заголовок</span>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: Онбординг команды"
            />
          </label>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: '0.25rem' }}>
            <button className="btn" type="button" onClick={onClose}>
              Отмена
            </button>
            <button className="btn primary" type="submit" disabled={busy || !title.trim()}>
              {busy ? 'Создаём…' : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
