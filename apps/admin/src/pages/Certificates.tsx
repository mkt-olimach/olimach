import { maskCpf, revokeCertificateSchema } from "@olimach/schemas";
import { Button, StatusBadge, cn } from "@olimach/ui";
import { ArrowDownToLine, Ban, FilePlus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Field, Modal, PageHeader, Pager, dbErrorMessage, inputClass } from "../components/ui";
import { useAuth } from "../lib/auth";
import { formatDate, initials, openCertificatePdf, useDashboardData } from "../lib/certificates";
import type { CertificateRow } from "../lib/certificates";
import { formatPeriod } from "../lib/classes";
import { supabase } from "../lib/supabase";
import { useToast } from "../lib/toast";

const PAGE_SIZE = 10;

interface Eligible {
  id: string;
  student: { full_name: string; cpf: string } | null;
  class: { start_date: string; end_date: string; course: { name: string; category: string } | null } | null;
  certificates: Array<{ status: "valid" | "revoked" }>;
}

/** Mensagem de erro da Edge Function (corpo JSON { error }) ou texto generico. */
async function functionError(error: unknown): Promise<string> {
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.json === "function") {
    try {
      const body = (await context.json()) as { error?: string };
      if (body.error) return body.error;
    } catch {
      /* corpo nao era JSON */
    }
  }
  return "Não foi possível emitir o certificado. Tente novamente.";
}

function IssueDialog({ presetEnrollment, onIssued, onClose }: { presetEnrollment: string | null; onIssued: () => void; onClose: () => void }) {
  const toast = useToast();
  const [eligible, setEligible] = useState<Eligible[] | null>(null);
  const [leads, setLeads] = useState<Array<{ id: string; name: string; registry: string }>>([]);
  const [enrollmentId, setEnrollmentId] = useState(presetEnrollment ?? "");
  const [leadId, setLeadId] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from("enrollments")
      .select("id, student:students(full_name, cpf), class:classes(start_date, end_date, course:courses(name, category)), certificates(status)")
      .eq("attendance_ok", true)
      .eq("approved", true)
      .limit(500)
      .then(({ data, error: err }) => {
        if (err) {
          setEligible([]);
          setError("Não foi possível carregar as matrículas aptas.");
          return;
        }
        const rows = (data as unknown as Eligible[]).filter((e) => e.class?.course?.category !== "parceria" && !e.certificates.some((c) => c.status === "valid"));
        setEligible(rows);
      });
    void supabase
      .from("technical_leads")
      .select("id, name, registry")
      .order("name")
      .then(({ data }) => {
        const list = (data ?? []) as typeof leads;
        setLeads(list);
        if (list.length === 1 && list[0]) setLeadId(list[0].id);
      });
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (eligible ?? []).filter((e) => !q || `${e.student?.full_name ?? ""} ${e.class?.course?.name ?? ""}`.toLowerCase().includes(q));
  }, [eligible, query]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    if (!enrollmentId) return setError("Escolha o aluno e a turma.");
    if (!leadId) return setError("Escolha o responsável técnico.");
    setError(null);
    setBusy(true);
    const { data, error: err } = await supabase.functions.invoke<{ code: string }>("issue-certificate", {
      body: { enrollment_id: enrollmentId, technical_lead_id: leadId },
    });
    setBusy(false);
    if (err || !data) {
      setError(await functionError(err));
      return;
    }
    toast.success(`Certificado ${data.code} emitido.`);
    onIssued();
  }

  return (
    <Modal wide title="Emitir certificado" description="Só aparecem matrículas com presença e aprovação, em treinamentos que emitem certificado." onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <label className="flex h-10 items-center gap-2 rounded-[9px] border border-line px-3 text-muted">
          <Search size={15} aria-hidden />
          <span className="sr-only">Filtrar matrículas</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar por aluno ou treinamento..." className="w-full min-w-0 bg-transparent text-xs text-ink outline-none placeholder:text-[#a1adc0]" />
        </label>

        <Field label="Aluno e turma">
          {(p) => (
            <select {...p} size={Math.min(6, Math.max(3, visible.length))} className={cn(inputClass, "h-auto")} value={enrollmentId} onChange={(e) => setEnrollmentId(e.target.value)}>
              {eligible === null && <option disabled>Carregando...</option>}
              {eligible !== null && visible.length === 0 && <option disabled>Nenhuma matrícula apta para emitir.</option>}
              {visible.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.student?.full_name} ({e.student ? maskCpf(e.student.cpf) : "-"}) · {e.class?.course?.name} · {e.class ? formatPeriod(e.class.start_date, e.class.end_date) : ""}
                </option>
              ))}
            </select>
          )}
        </Field>

        <Field label="Responsável técnico" hint="Nome e registro saem no certificado.">
          {(p) => (
            <select {...p} className={inputClass} value={leadId} onChange={(e) => setLeadId(e.target.value)}>
              <option value="">Selecione...</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} ({l.registry})
                </option>
              ))}
            </select>
          )}
        </Field>

        {error && (
          <p role="alert" className="rounded-btn-admin bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        )}
        <p className="text-xs text-muted">O PDF é gerado e guardado de forma definitiva. Para corrigir um erro, revogue o certificado e emita outro.</p>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Gerando PDF..." : "Emitir certificado"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RevokeDialog({ row, onDone, onClose }: { row: CertificateRow; onDone: () => void; onClose: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    const parsed = revokeCertificateSchema.safeParse({ reason });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Informe o motivo.");
    setError(null);
    setBusy(true);
    const { error: err } = await supabase
      .from("certificates")
      .update({ status: "revoked", revoked_reason: parsed.data.reason, revoked_at: new Date().toISOString() })
      .eq("id", row.id);
    setBusy(false);
    if (err) {
      toast.error(dbErrorMessage(err, {}));
      return;
    }
    toast.success(`Certificado ${row.code} revogado.`);
    onDone();
  }

  return (
    <Modal title="Revogar certificado" description={`${row.studentName} · ${row.courseName} · ${row.code}`} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <p className="rounded-btn-admin bg-danger/10 p-3 text-xs text-danger">A revogação é definitiva e não pode ser desfeita. A validação pública passa a mostrar o certificado como revogado. Depois, é possível emitir um novo.</p>
        <Field label="Motivo da revogação" error={error ?? undefined}>
          {(p) => <textarea {...p} rows={4} className={cn(inputClass, "resize-y")} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: erro no nome do aluno." />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy} className="bg-danger hover:bg-danger/90">
            {busy ? "Revogando..." : "Revogar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

type Tab = "all" | "valid" | "expired" | "revoked";
const tabs: Array<{ id: Tab; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "valid", label: "Válidos" },
  { id: "expired", label: "Vencidos" },
  { id: "revoked", label: "Revogados" },
];

export function Certificates() {
  const { profile } = useAuth();
  const toast = useToast();
  const isAdmin = profile?.role === "admin";
  const { rows, loading, error, reload } = useDashboardData();
  const [params, setParams] = useSearchParams();
  const preset = params.get("emitir");
  const [issuing, setIssuing] = useState(Boolean(preset));
  const [revoking, setRevoking] = useState<CertificateRow | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const counts = useMemo(
    () => ({
      all: rows.length,
      valid: rows.filter((r) => r.status === "valid").length,
      expired: rows.filter((r) => r.status === "expired").length,
      revoked: rows.filter((r) => r.status === "revoked").length,
    }),
    [rows],
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (tab === "all" || r.status === tab) && (!q || `${r.studentName} ${r.courseName} ${r.code}`.toLowerCase().includes(q)));
  }, [rows, tab, query]);

  useEffect(() => setPage(1), [tab, query]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);

  function closeIssue() {
    setIssuing(false);
    if (preset) {
      const next = new URLSearchParams(params);
      next.delete("emitir");
      setParams(next, { replace: true });
    }
  }

  async function download(row: CertificateRow) {
    if (!row.pdfPath) return;
    const message = await openCertificatePdf(row.pdfPath);
    if (message) toast.error(message);
  }

  return (
    <div>
      <PageHeader
        title="Certificados"
        description="Emissão, download e revogação. O PDF tem frente e verso, QR code e código de validação pública."
        action={
          <Button onClick={() => setIssuing(true)}>
            <FilePlus size={16} aria-hidden /> Emitir certificado
          </Button>
        }
      />

      <div className="rounded-[15px] border border-line bg-surface p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div role="tablist" aria-label="Situação do certificado" className="flex gap-1.5 overflow-x-auto">
            {tabs.map(({ id, label }) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-[11px]", tab === id ? "bg-[#f0f3f7] font-bold text-navy-900" : "text-muted hover:bg-canvas")}>
                {label} ({counts[id]})
              </button>
            ))}
          </div>
          <label className="flex h-9 items-center gap-2 rounded-[9px] border border-line px-2.5 text-muted">
            <Search size={15} aria-hidden />
            <span className="sr-only">Buscar certificado</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Aluno, curso ou código..." className="w-full min-w-0 bg-transparent text-xs text-ink outline-none placeholder:text-[#a1adc0] md:w-52" />
          </label>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[780px] border-collapse text-left">
            <thead>
              <tr className="bg-canvas text-[10px] font-semibold text-[#253b57]">
                <th className="rounded-l-md border-y border-line px-2.5 py-3">Aluno</th>
                <th className="border-y border-line px-2.5 py-3">Treinamento</th>
                <th className="border-y border-line px-2.5 py-3">Código</th>
                <th className="border-y border-line px-2.5 py-3">Emissão</th>
                <th className="border-y border-line px-2.5 py-3">Validade</th>
                <th className="border-y border-line px-2.5 py-3">Situação</th>
                <th className="rounded-r-md border-y border-line px-2.5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((r) => (
                <tr key={r.id} className="border-b border-line text-[11px] text-[#4b5b70]">
                  <td className="px-2.5 py-3">
                    <span className="flex items-center gap-2.5 font-medium text-ink">
                      <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[#e9edf3] text-[11px] text-navy-700" aria-hidden>
                        {initials(r.studentName)}
                      </span>
                      <span className="max-w-[150px] truncate">{r.studentName}</span>
                    </span>
                  </td>
                  <td className="px-2.5 py-3">
                    <span className="block max-w-[200px] truncate text-navy-700">{r.courseName}</span>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-3 font-mono">{r.code}</td>
                  <td className="whitespace-nowrap px-2.5 py-3">{formatDate(r.issuedAt)}</td>
                  <td className="whitespace-nowrap px-2.5 py-3">{r.expiresAt ? formatDate(r.expiresAt) : "Sem validade"}</td>
                  <td className="px-2.5 py-3" title={r.revokedReason ?? undefined}>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-2.5 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => void download(r)} disabled={!r.hasPdf} aria-label={`Baixar PDF de ${r.studentName}`} title="Baixar PDF" className="rounded p-1.5 text-[#678099] hover:bg-canvas hover:text-navy-900 disabled:opacity-40">
                        <ArrowDownToLine size={16} aria-hidden />
                      </button>
                      {isAdmin && r.status !== "revoked" && (
                        <button type="button" onClick={() => setRevoking(r)} aria-label={`Revogar certificado de ${r.studentName}`} title="Revogar" className="rounded p-1.5 text-[#678099] hover:bg-canvas hover:text-danger">
                          <Ban size={16} aria-hidden />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xs text-muted">
                    {loading ? "Carregando certificados..." : error ? "Não foi possível carregar os certificados." : rows.length === 0 ? "Nenhum certificado emitido ainda." : "Nenhum certificado encontrado."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <Pager page={current} pages={pages} total={filtered.length} shown={visible.length} onChange={setPage} />
        {!isAdmin && <p className="mt-3 text-[11px] text-muted">Somente administradores revogam certificados.</p>}
      </div>

      {issuing && (
        <IssueDialog
          presetEnrollment={preset}
          onClose={closeIssue}
          onIssued={() => {
            closeIssue();
            reload();
          }}
        />
      )}
      {revoking && (
        <RevokeDialog
          row={revoking}
          onClose={() => setRevoking(null)}
          onDone={() => {
            setRevoking(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
