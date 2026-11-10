import type { CertificateDisplayStatus } from "@olimach/ui";
import { useEffect, useState } from "react";
import { supabase } from "./supabase";

export interface CertificateRow {
  id: string;
  code: string;
  issuedAt: string;
  expiresAt: string | null;
  status: CertificateDisplayStatus;
  hasPdf: boolean;
  studentName: string;
  studentCpf: string;
  courseName: string;
  workloadHours: number | null;
}

export interface DashboardStats {
  certificates: number | null;
  students: number | null;
  activeCourses: number | null;
}

interface RawCertificate {
  id: string;
  code: string;
  issued_at: string;
  expires_at: string | null;
  status: "valid" | "revoked";
  pdf_path: string | null;
  enrollment: {
    student: { full_name: string; cpf: string } | null;
    class: { course: { name: string; workload_hours: number | null } | null } | null;
  } | null;
}

/** "Vencido" e calculado a partir de expires_at, nunca gravado (regra do modelo de dados). */
function effectiveStatus(raw: RawCertificate): CertificateDisplayStatus {
  if (raw.status === "revoked") return "revoked";
  if (raw.expires_at && new Date(raw.expires_at).getTime() < Date.now()) return "expired";
  return "valid";
}

/** Limite de linhas carregadas de uma vez; a paginacao e o filtro rodam sobre elas. */
const LOAD_LIMIT = 500;

export function useDashboardData() {
  const [rows, setRows] = useState<CertificateRow[]>([]);
  const [stats, setStats] = useState<DashboardStats>({ certificates: null, students: null, activeCourses: null });
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;

    async function load() {
      const [list, certificates, students, courses] = await Promise.all([
        client
          .from("certificates")
          .select(
            "id, code, issued_at, expires_at, status, pdf_path, enrollment:enrollments(student:students(full_name, cpf), class:classes(course:courses(name, workload_hours)))",
          )
          .order("issued_at", { ascending: false })
          .limit(LOAD_LIMIT),
        client.from("certificates").select("id", { count: "exact", head: true }),
        client.from("students").select("id", { count: "exact", head: true }),
        client.from("courses").select("id", { count: "exact", head: true }).eq("active", true),
      ]);
      if (cancelled) return;

      if (list.error) {
        setError(true);
      } else {
        const raw = list.data as unknown as RawCertificate[];
        setRows(
          raw.map((r) => ({
            id: r.id,
            code: r.code,
            issuedAt: r.issued_at,
            expiresAt: r.expires_at,
            status: effectiveStatus(r),
            hasPdf: Boolean(r.pdf_path),
            studentName: r.enrollment?.student?.full_name ?? "-",
            studentCpf: r.enrollment?.student?.cpf ?? "",
            courseName: r.enrollment?.class?.course?.name ?? "-",
            workloadHours: r.enrollment?.class?.course?.workload_hours ?? null,
          })),
        );
      }
      setStats({
        certificates: certificates.count,
        students: students.count,
        activeCourses: courses.count,
      });
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return { rows, stats, loading, error };
}

export function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1] ?? "") : "";
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}
