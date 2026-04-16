import { useEffect, useId } from 'react';

export function ShortcutsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
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

  const mod = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.userAgent) ? '⌘' : 'Ctrl';

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal-card card" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <h2 id={titleId} className="modal-title">
          Горячие клавиши
        </h2>
        <ul className="shortcuts-list">
          <li>
            <span className="shortcuts-list__keys">
              <kbd className="kbd">{mod}</kbd>
              <span className="muted">+</span>
              <kbd className="kbd">S</kbd>
            </span>
            <span>В режиме правки — сохранить страницу (как «Сохранить и выйти»)</span>
          </li>
          <li>
            <span className="shortcuts-list__keys">
              <kbd className="kbd">?</kbd>
            </span>
            <span>Открыть эту подсказку (когда курсор не в поле ввода)</span>
          </li>
          <li>
            <span className="shortcuts-list__keys">
              <kbd className="kbd">Esc</kbd>
            </span>
            <span>Закрыть это окно</span>
          </li>
        </ul>
        <button className="btn primary" type="button" onClick={onClose}>
          Понятно
        </button>
      </div>
    </div>
  );
}
