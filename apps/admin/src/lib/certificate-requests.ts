import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

export type RequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface CertificateRequest {
  id: string;
  enrollmentId: string;
  status: RequestStatus;
  rejectReason: string | null;
  createdAt: string;
  decidedAt: string | null;
  requestedBy: string | null;
  requesterName: string;
  studentName: string;
  courseName: string;
}

interface Raw {
  id: string;
  enrollment_id: string;
  status: RequestStatus;
  reject_reason: string | null;
  created_at: string;
  decided_at: string | null;
  requested_by: string | null;
  requester: { name: string } | null;
  enrollment: { student: { full_name: string } | null; class: { course: { name: string } | null } | null } | null;
}

const EVENT = "certificate-requests-changed";
const POLL_MS = 30_000;

/** Avisa o sino e a lista de que algo mudou (nova solicitacao, aprovacao, recusa). */
export const notifyRequestsChanged = () => window.dispatchEvent(new Event(EVENT));

export const requestStatusLabel: Record<RequestStatus, string> = {
  pending: "Aguardando aprovação",
  approved: "Aprovada",
  rejected: "Recusada",
  cancelled: "Cancelada",
};

/** Solicitacoes de emissao (RLS: so a equipe le). Atualiza a cada 30 s, ao voltar para a aba e apos qualquer acao. */
export function useCertificateRequests(enabled = true) {
  const [rows, setRows] = useState<CertificateRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!supabase || !enabled) return setLoading(false);
    const { data, error } = await supabase
      .from("certificate_requests")
      .select(
        "id, enrollment_id, status, reject_reason, created_at, decided_at, requested_by, requester:profiles!requested_by(name), enrollment:enrollments(student:students(full_name), class:classes(course:courses(name)))",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (!error) {
      setRows(
        (data as unknown as Raw[]).map((r) => ({
          id: r.id,
          enrollmentId: r.enrollment_id,
          status: r.status,
          rejectReason: r.reject_reason,
          createdAt: r.created_at,
          decidedAt: r.decided_at,
          requestedBy: r.requested_by,
          requesterName: r.requester?.name ?? "Secretaria",
          studentName: r.enrollment?.student?.full_name ?? "-",
          courseName: r.enrollment?.class?.course?.name ?? "-",
        })),
      );
    }
    setLoading(false);
  }, [enabled]);

  useEffect(() => {
    void reload();
    if (!enabled) return;
    const onChange = () => void reload();
    const onVisible = () => document.visibilityState === "visible" && void reload();
    const timer = setInterval(onVisible, POLL_MS);
    window.addEventListener(EVENT, onChange);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener(EVENT, onChange);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, reload]);

  return { rows, loading, reload };
}

/** "há 5 min", "há 3 h", "há 2 d". */
export function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} d`;
}
