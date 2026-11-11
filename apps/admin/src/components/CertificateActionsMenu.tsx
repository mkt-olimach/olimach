import { Ban, Copy, Download, ExternalLink, MoreVertical } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { openCertificatePdf } from "../lib/certificates";
import type { CertificateRow } from "../lib/certificates";
import { useToast } from "../lib/toast";

const MENU_WIDTH = 224;

interface Props {
  row: CertificateRow;
  /** Dominio publico do site; sem ele as acoes de validacao ficam desabilitadas. */
  siteUrl: string;
  canRevoke: boolean;
  onRevoke: (row: CertificateRow) => void;
}

/** Menu de tres pontos com as acoes de um certificado. Posicao fixa para nao ser cortado pela rolagem da tabela. */
export function CertificateActionsMenu({ row, siteUrl, canRevoke, onRevoke }: Props) {
  const toast = useToast();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const link = siteUrl ? `${siteUrl}/validar/${row.code}` : null;

  useEffect(() => {
    if (!pos) return;
    const close = () => setPos(null);
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return;
      close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    menuRef.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [pos]);

  function toggle(event: React.MouseEvent) {
    event.stopPropagation();
    if (pos) return setPos(null);
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    const openUp = rect.bottom + 190 > window.innerHeight;
    setPos({ top: openUp ? Math.max(8, rect.top - 186) : rect.bottom + 4, left });
  }

  async function download() {
    setPos(null);
    if (!row.pdfPath) return;
    const message = await openCertificatePdf(row.pdfPath);
    if (message) toast.error(message);
  }

  async function copy() {
    setPos(null);
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link de validação copiado.");
    } catch {
      toast.error("Não foi possível copiar. Copie o link pela pré-visualização.");
    }
  }

  function openValidation() {
    setPos(null);
    if (link) window.open(link, "_blank", "noopener,noreferrer");
  }

  const items: Array<{ key: string; label: string; icon: LucideIcon; onClick: () => void; disabled?: boolean; danger?: boolean }> = [
    { key: "pdf", label: "Baixar PDF", icon: Download, onClick: () => void download(), disabled: !row.hasPdf },
    { key: "open", label: "Abrir validação pública", icon: ExternalLink, onClick: openValidation, disabled: !link },
    { key: "copy", label: "Copiar link de validação", icon: Copy, onClick: () => void copy(), disabled: !link },
  ];
  if (canRevoke && row.status !== "revoked") {
    items.push({
      key: "revoke",
      label: "Revogar certificado",
      icon: Ban,
      danger: true,
      onClick: () => {
        setPos(null);
        onRevoke(row);
      },
    });
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={pos !== null}
        aria-label={`Ações do certificado de ${row.studentName}`}
        className="rounded p-1 text-[#678099] hover:bg-canvas hover:text-navy-900"
      >
        <MoreVertical size={16} aria-hidden />
      </button>
      {pos && (
        <div
          ref={menuRef}
          role="menu"
          style={{ top: pos.top, left: pos.left, width: MENU_WIDTH }}
          onClick={(e) => e.stopPropagation()}
          className="fixed z-50 rounded-[11px] border border-line bg-surface py-1.5 text-left shadow-lg"
        >
          {items.map(({ key, label, icon: Icon, onClick, disabled, danger }) => (
            <button
              key={key}
              type="button"
              role="menuitem"
              onClick={onClick}
              disabled={disabled}
              title={disabled && key === "pdf" ? "PDF ainda não gerado" : disabled ? "Configure VITE_SITE_URL (domínio do site)" : undefined}
              className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-xs hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40 ${danger ? "text-danger" : "text-ink"}`}
            >
              <Icon size={15} aria-hidden /> {label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
