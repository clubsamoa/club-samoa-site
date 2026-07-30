"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

// Toaster mínimo para errores de API. Reemplaza los alert() y estados
// sueltos del admin viejo. Sin dependencias: el CSS vive en admin.css y usa
// las variables de marca.

type Toast = { id: number; message: string; tone: "error" | "success" };

type ToastContextValue = {
  toastError: (message: string) => void;
  toastSuccess: (message: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}

const DURATION_MS = 6000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((message: string, tone: Toast["tone"]) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      toastError: (message) => push(message, "error"),
      toastSuccess: (message) => push(message, "success"),
    }),
    [push],
  );

  useEffect(() => {
    if (toasts.length === 0) return;
    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, DURATION_MS);
    return () => clearTimeout(timer);
  }, [toasts]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="admin-toaster" role="region" aria-label="Notificaciones">
        {toasts.map((toast) => (
          <output
            key={toast.id}
            className={`admin-toast admin-toast--${toast.tone}`}
            aria-live={toast.tone === "error" ? "assertive" : "polite"}
          >
            <span>{toast.message}</span>
            <button
              type="button"
              className="admin-toast-close"
              aria-label="Cerrar notificación"
              onClick={() =>
                setToasts((prev) => prev.filter((t) => t.id !== toast.id))
              }
            >
              ×
            </button>
          </output>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
