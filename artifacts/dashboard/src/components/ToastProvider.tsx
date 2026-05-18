import React, { createContext, useContext, useState, useCallback } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  message: string;
  type: ToastType;
}

interface ToastCtx {
  showToast(message: string, type?: ToastType): void;
}

const ToastContext = createContext<ToastCtx | null>(null);

export function useToast(): ToastCtx {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be inside ToastProvider');
  return ctx;
}

let _nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = ++_nextId;
    setToasts(c => [...c, { id, message, type }]);
    setTimeout(() => setToasts(c => c.filter(t => t.id !== id)), 5000);
  }, []);

  function dismiss(id: number) {
    setToasts(c => c.filter(t => t.id !== id));
  }

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-stack" role="region" aria-live="polite" aria-label="Notifications">
          {toasts.map(t => (
            <div key={t.id} className={`toast toast--${t.type}`}>
              <span className="toast-icon" aria-hidden="true">
                {t.type === 'success' ? '✓' : t.type === 'error' ? '⚠' : 'ℹ'}
              </span>
              <span className="toast-msg">{t.message}</span>
              <button
                className="toast-close"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
