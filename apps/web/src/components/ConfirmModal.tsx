import { useEffect, useId } from 'react';

export function ConfirmModal({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = 'Отмена',
  variant = 'primary',
  busy,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: 'primary' | 'danger';
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

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
          {title}
        </h2>
        <div className="modal-body muted" style={{ marginBottom: '1rem', fontSize: '0.95rem', lineHeight: 1.5 }}>
          {children}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn" type="button" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </button>
          <button
            className={variant === 'danger' ? 'btn btn-danger-solid' : 'btn primary'}
            type="button"
            disabled={busy}
            onClick={() => void onConfirm()}
          >
            {busy ? '…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
