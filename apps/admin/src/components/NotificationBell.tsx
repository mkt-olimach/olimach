import { Bell, CheckCircle2, FileClock, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isAdminRole, useAuth } from "../lib/auth";
import { requestStatusLabel, timeAgo, useCertificateRequests } from "../lib/certificate-requests";

/** Sino do topo. Admin: solicitacoes de certificado aguardando aprovacao (com contador). Secretaria: andamento das suas. */
export function NotificationBell() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = isAdminRole(profile?.role);
  const { rows } = useCertificateRequests(Boolean(profile));
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pending = rows.filter((r) => r.status === "pending");
  const mine = rows.filter((r) => r.requestedBy === profile?.id);
  const recentMine = mine.filter((r) => r.status === "pending" || (r.decidedAt && Date.now() - new Date(r.decidedAt).getTime() < 7 * 86400000)).slice(0, 8);
  const items = isAdmin ? pending.slice(0, 8) : recentMine;
  const badge = isAdmin ? pending.length : 0;

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={badge > 0 ? `Notificações: ${badge} solicitação(ões) de certificado pendente(s)` : "Notificações"}
        aria-expanded={open}
        className="relative grid h-10 w-10 place-items-center rounded-btn-admin text-[#172944] hover:bg-canvas"
      >
        <Bell size={20} aria-hidden />
        {badge > 0 && (
          <span className="absolute right-1 top-1 grid min-h-[16px] min-w-[16px] place-items-center rounded-full bg-danger px-1 text-[9px] font-bold leading-none text-white">{badge > 9 ? "9+" : badge}</span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-[min(340px,calc(100vw-2rem))] overflow-hidden rounded-[14px] border border-line bg-surface shadow-xl">
          <p className="border-b border-line px-4 py-3 text-xs font-bold text-navy-900">{isAdmin ? "Certificados aguardando aprovação" : "Suas solicitações de certificado"}</p>
          {items.length === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-muted">Nenhuma notificação.</p>
          ) : (
            <ul className="max-h-[360px] divide-y divide-line overflow-y-auto">
              {items.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      navigate("/certificados?aba=solicitacoes");
                    }}
                    className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-canvas"
                  >
                    {r.status === "approved" ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" aria-hidden /> : r.status === "rejected" ? <XCircle size={18} className="mt-0.5 shrink-0 text-danger" aria-hidden /> : <FileClock size={18} className="mt-0.5 shrink-0 text-orange-600" aria-hidden />}
                    <span className="min-w-0 text-xs">
                      <strong className="block truncate text-ink">{r.studentName}</strong>
                      <span className="block truncate text-muted">{r.courseName}</span>
                      <span className="mt-0.5 block text-[11px] text-[#7d90a7]">
                        {isAdmin ? `${r.requesterName} solicitou ${timeAgo(r.createdAt)}` : `${requestStatusLabel[r.status]} · ${timeAgo(r.decidedAt ?? r.createdAt)}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate("/certificados?aba=solicitacoes");
            }}
            className="w-full border-t border-line px-4 py-2.5 text-center text-xs font-bold text-navy-700 hover:bg-canvas"
          >
            Ver todas as solicitações
          </button>
        </div>
      )}
    </div>
  );
}
