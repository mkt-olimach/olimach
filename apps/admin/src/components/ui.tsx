import { Button, cn } from "@olimach/ui";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";

export const inputClass =
  "mt-1.5 w-full rounded-btn-admin border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none placeholder:text-[#a1adc0] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:bg-canvas disabled:text-muted";

/** Rotulo + campo + mensagem de erro, com ids ligados para leitores de tela. */
export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode;
  className?: string;
}) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={className}>
      <label htmlFor={id} className="text-sm font-semibold text-navy-900">
        {label}
      </label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Janela modal acessivel: foco no primeiro campo, Esc e clique fora fecham. */
export function Modal({
  title,
  description,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>("input:not([disabled]), select, textarea, button")?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previous?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/50 p-3 sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn("flex max-h-[calc(100dvh-1.5rem)] w-full flex-col rounded-2xl bg-surface shadow-xl sm:max-h-[calc(100dvh-2rem)]", wide ? "max-w-2xl" : "max-w-md")}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 pb-4 pt-5">
          <div>
            <h2 id={titleId} className="text-xl">
              {title}
            </h2>
            {description && <p className="mt-1 text-xs text-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-lg bg-canvas p-1.5 text-muted hover:text-navy-900">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-6 pt-5">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <div className="text-sm text-muted">{message}</div>
      <div className="mt-6 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose} disabled={busy}>
          Cancelar
        </Button>
        <Button onClick={onConfirm} disabled={busy} className="bg-danger hover:bg-danger/90">
          {busy ? "Aguarde..." : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}

export function Pager({
  page,
  pages,
  total,
  shown,
  onChange,
}: {
  page: number;
  pages: number;
  total: number;
  shown: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="mt-5 flex items-center justify-between gap-2 text-[11px] text-muted">
      <span>
        Mostrando {shown} de {total} resultados
      </span>
      <div className="flex items-center gap-2">
        <button type="button" aria-label="Página anterior" disabled={page <= 1} onClick={() => onChange(page - 1)} className="p-1 disabled:opacity-40">
          <ChevronLeft size={16} aria-hidden />
        </button>
        <span className="grid h-[30px] min-w-[30px] place-items-center rounded-lg bg-[#e9edf3] px-2 text-navy-900">
          {page} / {pages}
        </span>
        <button type="button" aria-label="Próxima página" disabled={page >= pages} onClick={() => onChange(page + 1)} className="p-1 disabled:opacity-40">
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl md:text-[28px]">{title}</h1>
        <p className="mt-1 max-w-xl text-sm text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

/** Traduz erros do Postgres/PostgREST (RLS, constraints) em mensagens para a equipe. */
export function dbErrorMessage(error: { code?: string; message?: string }, subject: { unique?: string; inUse?: string }): string {
  switch (error.code) {
    case "23505":
      return subject.unique ?? "Já existe um registro com estes dados.";
    case "23503":
      return subject.inUse ?? "Este registro está em uso e não pode ser excluído.";
    case "42501":
      return "Seu perfil não tem permissão para esta ação.";
    case "23514":
      if (error.message?.includes("parceria")) return "Curso com certificados emitidos não pode virar parceria.";
      if (error.message?.includes("administrador")) return "Deve existir ao menos um administrador ativo.";
      return "Os dados não respeitam as regras do cadastro.";
    default:
      return "Não foi possível concluir a operação. Tente novamente.";
  }
}

export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
