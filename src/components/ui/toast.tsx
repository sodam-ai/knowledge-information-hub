"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, XCircle, AlertTriangle, Info, X } from "lucide-react";

// ── 타입 ───────────────────────────────────────────────────────────────────

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastCtx {
  addToast: (message: string, type?: ToastType) => void;
}

// ── 스타일 맵 ──────────────────────────────────────────────────────────────

const STYLES: Record<ToastType, { bg: string; Icon: React.FC<{ className?: string }> }> = {
  success: { bg: "bg-zinc-900 text-white", Icon: CheckCircle2 },
  error:   { bg: "bg-red-600 text-white",  Icon: XCircle },
  warning: { bg: "bg-amber-500 text-white", Icon: AlertTriangle },
  info:    { bg: "bg-blue-600 text-white",  Icon: Info },
};

const AUTO_DISMISS_MS = 3500;

// ── Context ────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastCtx | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "success") => {
    const id = Math.random().toString(36).slice(2, 10);
    // 최대 5개 유지
    setToasts((prev) => [...prev.slice(-4), { id, type, message }]);
  }, []);

  const remove = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <ToastContainer toasts={toasts} onRemove={remove} />
    </ToastContext.Provider>
  );
}

// ── Container (portal) ────────────────────────────────────────────────────

function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted || toasts.length === 0) return null;

  return createPortal(
    <div
      className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 items-end pointer-events-none"
      aria-live="polite"
      aria-atomic="false"
    >
      {toasts.map((t) => (
        <ToastBubble key={t.id} toast={t} onRemove={onRemove} />
      ))}
    </div>,
    document.body
  );
}

// ── 개별 토스트 ────────────────────────────────────────────────────────────

function ToastBubble({
  toast,
  onRemove,
}: {
  toast: ToastItem;
  onRemove: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  const { bg, Icon } = STYLES[toast.type];

  const dismiss = useCallback(() => {
    setVisible(false);
    setTimeout(() => onRemove(toast.id), 200);
  }, [toast.id, onRemove]);

  useEffect(() => {
    // 다음 프레임에서 visible=true → CSS transition 트리거
    const raf = requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
  }, [dismiss]);

  return (
    <div
      className={`
        pointer-events-auto flex items-center gap-2.5 pl-3.5 pr-2 py-2.5
        rounded-xl shadow-lg text-sm font-medium min-w-[200px] max-w-xs
        transition-all duration-200 ease-out
        ${bg}
        ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}
      `}
      role="status"
    >
      <Icon className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1 truncate">{toast.message}</span>
      <button
        onClick={dismiss}
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity p-0.5 rounded"
        aria-label="닫기"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast는 ToastProvider 내부에서만 사용할 수 있습니다.");
  return {
    toast:   (msg: string) => ctx.addToast(msg, "success"),
    success: (msg: string) => ctx.addToast(msg, "success"),
    error:   (msg: string) => ctx.addToast(msg, "error"),
    warning: (msg: string) => ctx.addToast(msg, "warning"),
    info:    (msg: string) => ctx.addToast(msg, "info"),
  };
}
