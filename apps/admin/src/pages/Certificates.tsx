import { maskCpf, revokeCertificateSchema } from "@olimach/schemas";
import { Button, StatusBadge, cn } from "@olimach/ui";
import { ArrowDownToLine, Ban, Check, FilePlus, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Field, Modal, PageHeader, Pager, dbErrorMessage, inputClass } from "../components/ui";
import { isAdminRole, useAuth } from "../lib/auth";
import { notifyRequestsChanged, requestStatusLabel, timeAgo, useCertificateRequests } from "../lib/certificate-requests";
import type { CertificateRequest } from "../lib/certificate-requests";
import { formatDate, initials, certificateFileName, openCertificatePdf, useDashboardData } from "../lib/certificates";
import type { CertificateRow } from "../lib/certificates";
import { formatPeriod } from "../lib/classes";
import { functionErrorMessage } from "../lib/functions";
import { supabase } from "../lib/supabase";
import { useToast } from "../lib/toast";

const PAGE_SIZE = 10;

interface Eligible {
  id: string;
  student: { full_name: string; cpf: string } | null;
  class: { start_date: string; end_date: string; course: { name: string; category: string } | null } | null;
  certificates: Array<{ status: "valid" | "revoked" }>;
  certificate_requests: Array<{ status: string }>;
}

const todayIso = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/** Campo de data de emissao: ate hoje e nao antes do fim da turma. Compartilhado pela emissao e pela aprovacao. */
function IssueDateField({ value, min, onChange }: { value: string; min?: string; onChange: (v: string) => void }) {
  return (
    <Field label="Data de emissão" hint="Padrão: hoje. Para certificados de treinamentos já realizados, informe a data passada (não pode ser anterior ao fim da turma nem futura).">
      {(p) => <input {...p} type="date" className={inputClass} value={value} min={min} max={todayIso()} onChange={(e) => onChange(e.target.value)} />}
    </Field>
  );
}

function IssueDialog({ presetEnrollment, isAdmin, onIssued, onClose }: { presetEnrollment: string | null; isAdmin: boolean; onIssued: () => void; onClose: () => void }) {
  const toast = useToast();
  const [eligible, setEligible] = useState<Eligible[] | null>(null);
  const [enrollmentId, setEnrollmentId] = useState(presetEnrollment ?? "");
  const [issuedOn, setIssuedOn] = useState(todayIso());
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from("enrollments")
      .select("id, student:students(full_name, cpf), class:classes(start_date, end_date, course:courses(name, category)), certificates(status), certificate_requests(status)")
      .eq("attendance_ok", true)
      .eq("approved", true)
      .limit(500)
      .then(({ data, error: err }) => {
        if (err) {
          setEligible([]);
          setError("Não foi possível carregar as matrículas aptas.");
          return;
        }
        const rows = (data as unknown as Eligible[]).filter(
          (e) => e.class?.course?.category !== "parceria" && !e.certificates.some((c) => c.status === "valid") && !e.certificate_requests.some((r) => r.status === "pending"),
        );
        setEligible(rows);
      });
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (eligible ?? []).filter((e) => !q || `${e.student?.full_name ?? ""} ${e.class?.course?.name ?? ""}`.toLowerCase().includes(q));
  }, [eligible, query]);

  // Uma unica opcao visivel e nada escolhido: seleciona (evita o erro "escolha o aluno" depois de filtrar).
  useEffect(() => {
    if (!enrollmentId && visible.length === 1 && visible[0]) setEnrollmentId(visible[0].id);
  }, [visible, enrollmentId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    if (!enrollmentId) return setError("Escolha o aluno e a turma.");
    setError(null);
    setBusy(true);
    if (!isAdmin) {
      // secretaria: apenas solicita; o administrador aprova e emite
      const { error: requestError } = await supabase.rpc("request_certificate", { p_enrollment_id: enrollmentId });
      setBusy(false);
      if (requestError) {
        setError(requestError.message.includes("pendente") ? "Já existe uma solicitação pendente para esta matrícula." : dbErrorMessage(requestError, {}));
        return;
      }
      toast.success("Solicitação enviada. Um administrador será notificado para aprovar.");
      notifyRequestsChanged();
      onIssued();
      return;
    }
    const chosen = (eligible ?? []).find((e) => e.id === enrollmentId);
    if (!issuedOn || issuedOn > todayIso() || (chosen?.class && issuedOn < chosen.class.end_date)) {
      setBusy(false);
      return setError("Data de emissão inválida: use uma data entre o fim da turma e hoje.");
    }
    const { data, error: err } = await supabase.functions.invoke<{ code: string }>("issue-certificate", {
      body: { enrollment_id: enrollmentId, issued_on: issuedOn },
    });
    setBusy(false);
    if (err || !data) {
      setError(await functionErrorMessage(err, "Não foi possível emitir o certificado. Tente novamente."));
      return;
    }
    toast.success(`Certificado ${data.code} emitido.`);
    onIssued();
  }

  return (
    <Modal wide title={isAdmin ? "Emitir certificado" : "Solicitar certificado"} description="Só aparecem matrículas com presença e aprovação, em treinamentos que emitem certificado." onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <label className="flex h-10 items-center gap-2 rounded-[9px] border border-line px-3 text-muted">
          <Search size={15} aria-hidden />
          <span className="sr-only">Filtrar matrículas</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar por aluno ou treinamento..." className="w-full min-w-0 bg-transparent text-xs text-ink outline-none placeholder:text-[#a1adc0]" />
        </label>

        <Field label="Aluno e turma" hint={enrollmentId ? undefined : "Clique em uma linha para selecionar."}>
          {(p) => (
            <div id={p.id} role="listbox" aria-label="Matrículas aptas" aria-describedby={p["aria-describedby"]} className="mt-1.5 max-h-56 divide-y divide-line overflow-y-auto rounded-btn-admin border border-line">
              {eligible === null && <p className="px-3 py-3 text-xs text-muted">Carregando...</p>}
              {eligible !== null && visible.length === 0 && <p className="px-3 py-3 text-xs text-muted">Nenhuma matrícula apta para emitir.</p>}
              {visible.map((e) => {
                const selected = e.id === enrollmentId;
                return (
                  <button
                    key={e.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setEnrollmentId(e.id);
                      setError(null);
                    }}
                    className={cn("flex w-full flex-col items-start gap-0.5 px-3 py-2.5 text-left text-xs hover:bg-canvas", selected && "bg-navy-900 text-white hover:bg-navy-900")}
                  >
                    <span className="font-semibold">
                      {e.student?.full_name} <span className={cn("font-normal", selected ? "text-white/70" : "text-muted")}>({e.student ? maskCpf(e.student.cpf) : "-"})</span>
                    </span>
                    <span className={selected ? "text-white/80" : "text-muted"}>
                      {e.class?.course?.name} · {e.class ? formatPeriod(e.class.start_date, e.class.end_date) : ""}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </Field>

        {isAdmin && <IssueDateField value={issuedOn} min={(eligible ?? []).find((e) => e.id === enrollmentId)?.class?.end_date} onChange={setIssuedOn} />}
        {!isAdmin && (
          <p className="rounded-btn-admin bg-warning/15 p-3 text-xs text-ink">O certificado só é gerado depois que um <strong>administrador aprovar</strong> a solicitação. Você acompanha o andamento na aba Solicitações.</p>
        )}
        <p className="rounded-btn-admin bg-canvas p-3 text-xs text-muted">
          O certificado sai com o campo de assinatura do aluno e as assinaturas padrão (engenheiro técnico, diretoria e técnico em segurança), configuradas em Configurações.
        </p>

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
            {isAdmin ? (busy ? "Gerando PDF..." : "Emitir certificado") : busy ? "Enviando..." : "Enviar solicitação"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function RevokeDialog({ row, onDone, onClose }: { row: CertificateRow; onDone: () => void; onClose: () => void }) {
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


function RejectRequestDialog({ request, onDone, onClose }: { request: CertificateRequest; onDone: () => void; onClose: () => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    if (reason.trim().length < 3) return setError("Informe o motivo da recusa.");
    setBusy(true);
    const { error: err } = await supabase.rpc("reject_certificate_request", { p_id: request.id, p_reason: reason });
    setBusy(false);
    if (err) return setError(dbErrorMessage(err, {}));
    toast.success("Solicitação recusada.");
    onDone();
  }

  return (
    <Modal title="Recusar solicitação" description={`${request.studentName} · ${request.courseName}`} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Motivo da recusa" error={error ?? undefined} hint="A secretaria verá este motivo.">
          {(p) => <textarea {...p} rows={4} maxLength={500} className={cn(inputClass, "resize-y")} value={reason} onChange={(e) => setReason(e.target.value)} />}
        </Field>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy} className="bg-danger hover:bg-danger/90">
            {busy ? "Recusando..." : "Recusar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function ApproveRequestDialog({ request, onDone, onClose }: { request: CertificateRequest; onDone: () => void; onClose: () => void }) {
  const toast = useToast();
  const [issuedOn, setIssuedOn] = useState(todayIso());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    if (!issuedOn || issuedOn > todayIso()) return setError("A data de emissão não pode ser futura.");
    setError(null);
    setBusy(true);
    const { data, error: err } = await supabase.functions.invoke<{ code: string }>("issue-certificate", { body: { enrollment_id: request.enrollmentId, issued_on: issuedOn } });
    setBusy(false);
    if (err || !data) return setError(await functionErrorMessage(err, "Não foi possível emitir o certificado. A solicitação continua pendente."));
    toast.success(`Solicitação aprovada: certificado ${data.code} emitido.`);
    onDone();
  }

  return (
    <Modal title="Aprovar e emitir" description={`${request.studentName} · ${request.courseName}`} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <IssueDateField value={issuedOn} onChange={setIssuedOn} />
        {error && (
          <p role="alert" className="rounded-btn-admin bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        )}
        <p className="text-xs text-muted">O PDF é gerado e guardado de forma definitiva, com a data escolhida.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Gerando PDF..." : "Aprovar e emitir"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RequestsPanel({ isAdmin, userId, onIssued }: { isAdmin: boolean; userId: string | undefined; onIssued: () => void }) {
  const toast = useToast();
  const { rows, loading, reload } = useCertificateRequests();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<CertificateRequest | null>(null);
  const [approving, setApproving] = useState<CertificateRequest | null>(null);

  async function cancel(request: CertificateRequest) {
    if (!supabase) return;
    setBusyId(request.id);
    const { error: err } = await supabase.rpc("cancel_certificate_request", { p_id: request.id });
    setBusyId(null);
    if (err) return void toast.error(dbErrorMessage(err, {}));
    toast.success("Solicitação cancelada.");
    notifyRequestsChanged();
  }

  const tone: Record<CertificateRequest["status"], string> = {
    pending: "bg-warning/15 text-[#8a6500]",
    approved: "bg-success/10 text-success",
    rejected: "bg-danger/10 text-danger",
    cancelled: "bg-canvas text-muted",
  };

  return (
    <div className="mt-4 overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="bg-canvas text-[10px] font-semibold text-[#253b57]">
            <th className="rounded-l-md border-y border-line px-2.5 py-3">Aluno</th>
            <th className="border-y border-line px-2.5 py-3">Treinamento</th>
            <th className="border-y border-line px-2.5 py-3">Solicitado por</th>
            <th className="border-y border-line px-2.5 py-3">Situação</th>
            <th className="rounded-r-md border-y border-line px-2.5 py-3 text-right">Ações</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-line text-[11px] text-[#4b5b70]">
              <td className="px-2.5 py-3 font-medium text-ink">{r.studentName}</td>
              <td className="px-2.5 py-3">
                <span className="block max-w-[220px] truncate">{r.courseName}</span>
              </td>
              <td className="px-2.5 py-3">
                {r.requesterName}
                <span className="block text-[10px] text-[#7d90a7]">{timeAgo(r.createdAt)}</span>
              </td>
              <td className="px-2.5 py-3">
                <span className={cn("inline-block rounded-full px-2.5 py-1 text-[10px] font-semibold", tone[r.status])}>{requestStatusLabel[r.status]}</span>
                {r.status === "rejected" && r.rejectReason && <span className="mt-1 block max-w-[220px] text-[10px] text-muted">Motivo: {r.rejectReason}</span>}
              </td>
              <td className="px-2.5 py-3">
                <div className="flex justify-end gap-1.5">
                  {r.status === "pending" && isAdmin && (
                    <>
                      <Button onClick={() => setApproving(r)} disabled={busyId === r.id}>
                        <Check size={14} aria-hidden /> Aprovar e emitir
                      </Button>
                      <Button variant="secondary" onClick={() => setRejecting(r)} disabled={busyId === r.id}>
                        <X size={14} aria-hidden /> Recusar
                      </Button>
                    </>
                  )}
                  {r.status === "pending" && !isAdmin && r.requestedBy === userId && (
                    <Button variant="secondary" onClick={() => void cancel(r)} disabled={busyId === r.id}>
                      Cancelar
                    </Button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={5} className="p-8 text-center text-xs text-muted">
                {loading ? "Carregando solicitações..." : "Nenhuma solicitação de certificado."}
              </td>
            </tr>
          )}
        </tbody>
      </table>
      {approving && (
        <ApproveRequestDialog
          request={approving}
          onClose={() => setApproving(null)}
          onDone={() => {
            setApproving(null);
            notifyRequestsChanged();
            onIssued();
          }}
        />
      )}
      {rejecting && (
        <RejectRequestDialog
          request={rejecting}
          onClose={() => setRejecting(null)}
          onDone={() => {
            setRejecting(null);
            notifyRequestsChanged();
            void reload();
          }}
        />
      )}
    </div>
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
  const isAdmin = isAdminRole(profile?.role);
  const { rows, loading, error, reload } = useDashboardData();
  const [params, setParams] = useSearchParams();
  const preset = params.get("emitir");
  const view = params.get("aba") === "solicitacoes" ? "requests" : "list";
  const { rows: requestRows } = useCertificateRequests();
  const pendingRequests = requestRows.filter((r) => r.status === "pending").length;
  const setView = (next: "list" | "requests") => {
    const p = new URLSearchParams(params);
    if (next === "requests") p.set("aba", "solicitacoes");
    else p.delete("aba");
    setParams(p, { replace: true });
  };
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
    const message = await openCertificatePdf(row.pdfPath, certificateFileName(row));
    if (message) toast.error(message);
  }

  return (
    <div>
      <PageHeader
        title="Certificados"
        description="Emissão, download e revogação. O PDF tem frente e verso, QR code e código de validação pública."
        action={
          <Button onClick={() => setIssuing(true)}>
            <FilePlus size={16} aria-hidden /> {isAdmin ? "Emitir certificado" : "Solicitar certificado"}
          </Button>
        }
      />

      <div className="rounded-[15px] border border-line bg-surface p-4 shadow-sm md:p-5">
        <div role="tablist" aria-label="Seção" className="mb-4 flex gap-1.5 border-b border-line pb-3">
          {([["list", "Certificados"], ["requests", "Solicitações"]] as const).map(([id, label]) => (
            <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={cn("whitespace-nowrap rounded-lg px-3.5 py-2 text-xs", view === id ? "bg-navy-900 font-bold text-white" : "text-muted hover:bg-canvas")}>
              {label}
              {id === "requests" && pendingRequests > 0 && <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold", view === id ? "bg-white/20" : "bg-danger text-white")}>{pendingRequests}</span>}
            </button>
          ))}
        </div>
        {view === "requests" ? (
          <RequestsPanel isAdmin={isAdmin} userId={profile?.id} onIssued={reload} />
        ) : (
          <>
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
        {!isAdmin && <p className="mt-3 text-[11px] text-muted">Somente administradores emitem e revogam certificados. Você pode solicitar a emissão.</p>}
          </>
        )}
      </div>

      {issuing && (
        <IssueDialog
          presetEnrollment={preset}
          isAdmin={isAdmin}
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
