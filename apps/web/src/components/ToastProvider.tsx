import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

type ToastVariant = 'default' | 'success' | 'error';

type ToastItem = { id: number; message: string; variant: ToastVariant };

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const DURATION_MS = 4200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setToasts((list) => list.filter((x) => x.id !== id));
  }, []);

  useEffect(() => {
    return () => {
      timers.current.forEach((t) => clearTimeout(t));
      timers.current.clear();
    };
  }, []);

  const showToast = useCallback(
    (message: string, variant: ToastVariant = 'default') => {
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, message, variant }]);
      const timer = setTimeout(() => dismiss(id), DURATION_MS);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite" aria-relevant="additions">
        {toasts.map((t) => (
          <button
            key={t.id}
            type="button"
            className={'toast toast--' + t.variant}
            onClick={() => dismiss(t.id)}
          >
            <span className="toast__text">{t.message}</span>
            <span className="toast__hint">Закрыть</span>
          </button>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
