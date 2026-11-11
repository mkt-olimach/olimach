import { maskCpf } from "@olimach/schemas";
import { BrandLogo, Pending, StatusBadge, cn } from "@olimach/ui";
import {
  ArrowDownToLine,
  ArrowRight,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Copy,
  FilePlus,
  FileText,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CertificateActionsMenu } from "../components/CertificateActionsMenu";
import { useAuth } from "../lib/auth";
import { SITE_URL } from "../lib/site-url";
import { formatDate, initials, openCertificatePdf, useDashboardData } from "../lib/certificates";
import { RevokeDialog } from "./Certificates";
import type { CertificateRow } from "../lib/certificates";

const PAGE_SIZE = 6;

type Tab = "all" | "valid" | "expired" | "revoked";
const tabs: Array<{ id: Tab; label: string }> = [
  { id: "all", label: "Todos" },
  { id: "valid", label: "Válidos" },
  { id: "expired", label: "Vencidos" },
  { id: "revoked", label: "Revogados" },
];

function Metric({ icon: Icon, value, label }: { icon: LucideIcon; value: number | null; label: string }) {
  return (
    <div className="flex min-h-[90px] items-center gap-3.5 rounded-[14px] border border-line bg-surface p-4 shadow-sm">
      <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[13px] bg-canvas text-navy-900">
        <Icon size={22} aria-hidden />
      </span>
      <div>
        <p className="font-heading text-2xl font-extrabold leading-tight text-navy-900">{value ?? "-"}</p>
        <p className="mt-1 text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

function CertificatePreview({ row }: { row: CertificateRow }) {
  const link = SITE_URL ? `${SITE_URL}/validar/${row.code}` : null;
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setQr(null);
    setCopied(false);
    if (!link) return;
    let cancelled = false;
    // carregado sob demanda: o pacote so e necessario quando ha um certificado em pre-visualizacao
    import("qrcode")
      .then(({ default: QRCode }) => QRCode.toDataURL(link, { margin: 0, width: 160, color: { dark: "#0B1F4D", light: "#FFFFFF" } }))
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [link]);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* sem permissao de area de transferencia: o link continua visivel para copia manual */
    }
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-[11px] border border-line bg-white px-4 pb-4 pt-6 text-center">
        <BrandLogo className="mx-auto h-14 w-auto" />
        <p className="mb-3 mt-3 text-xs font-semibold tracking-[0.22em] text-navy-900">CERTIFICADO</p>
        <p className="text-[10px] text-muted">Certificamos que</p>
        <h3 className="my-1 text-lg">{row.studentName}</h3>
        <p className="text-[10px] text-muted">CPF {row.studentCpf ? maskCpf(row.studentCpf) : "-"}</p>
        <p className="mt-2 text-[10px] text-muted">concluiu com aproveitamento o treinamento de</p>
        <p className="mx-auto mt-1 max-w-[260px] text-[11px] font-semibold leading-snug text-ink">{row.courseName}</p>
        <p className="mt-1 text-[10px] text-muted">
          com carga horária de {row.workloadHours != null ? `${row.workloadHours} horas` : <Pending>carga horária</Pending>}
        </p>
        <div className="mt-4 flex justify-between gap-2 text-left text-[9px] text-muted">
          <span>
            Emissão <b className="block text-[10px] text-navy-700">{formatDate(row.issuedAt)}</b>
          </span>
          <span className="text-right">
            Validade <b className="block text-[10px] text-navy-700">{row.expiresAt ? formatDate(row.expiresAt) : "Sem validade"}</b>
          </span>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-line pt-3 text-left">
          <div className="flex items-center gap-2">
            {qr ? (
              <img src={qr} alt={`QR code de validação do certificado ${row.code}`} className="h-14 w-14" />
            ) : (
              <span className="grid h-14 w-14 place-items-center rounded bg-canvas text-[8px] text-muted">QR</span>
            )}
            <span className="text-[10px] font-bold text-navy-700">
              {row.code}
              <small className="block text-[8px] font-normal text-muted">Código de validação</small>
            </span>
          </div>
          <span className="text-center text-[8px] text-muted">
            <span className="mb-1 block h-px w-24 bg-line" />
            Responsável técnico
          </span>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-muted">Pré-visualização resumida. O PDF oficial tem frente e verso.</p>

      <p className="mb-2 mt-5 text-xs font-semibold text-navy-900">Link de validação</p>
      <div className="flex min-h-[42px] items-center justify-between gap-2 overflow-hidden rounded-[9px] border border-line bg-[#fcfdff] px-3 text-xs text-[#475d77]">
        <span className="truncate">{link ?? <Pending>VITE_SITE_URL (domínio do site)</Pending>}</span>
        <button
          type="button"
          onClick={() => void copy()}
          disabled={!link}
          aria-label="Copiar link de validação"
          className="rounded-md bg-canvas p-1.5 text-navy-700 disabled:opacity-50"
        >
          {copied ? <span className="px-1 text-[10px] font-semibold">Copiado</span> : <Copy size={15} aria-hidden />}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-w-[100px] flex-1 items-center justify-center rounded-[10px] bg-navy-900 px-3 py-3 text-xs font-semibold text-white hover:bg-navy-700"
          >
            Validar certificado
          </a>
        ) : (
          <span className="inline-flex min-w-[100px] flex-1 cursor-not-allowed items-center justify-center rounded-[10px] bg-navy-900/50 px-3 py-3 text-xs font-semibold text-white">
            Validar certificado
          </span>
        )}
        <button
          type="button"
          disabled={!row.hasPdf}
          onClick={() => {
            if (row.pdfPath) void openCertificatePdf(row.pdfPath);
          }}
          title={row.hasPdf ? "Abrir o PDF do certificado" : "PDF ainda não gerado"}
          className="inline-flex min-w-[100px] flex-1 items-center justify-center gap-2 rounded-[10px] border border-line bg-canvas px-3 py-3 text-xs font-semibold text-navy-900 hover:bg-line/40 disabled:opacity-60"
        >
          <ArrowDownToLine size={15} aria-hidden /> Baixar PDF
        </button>
      </div>
    </>
  );
}

export function Dashboard() {
  const [params, setParams] = useSearchParams();
  const { profile } = useAuth();
  const { rows, stats, loading, error, reload } = useDashboardData();
  const [revoking, setRevoking] = useState<CertificateRow | null>(null);
  const [tab, setTab] = useState<Tab>("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const q = (params.get("q") ?? "").trim().toLowerCase();

  const counts = useMemo(
    () => ({
      all: rows.length,
      valid: rows.filter((r) => r.status === "valid").length,
      expired: rows.filter((r) => r.status === "expired").length,
      revoked: rows.filter((r) => r.status === "revoked").length,
    }),
    [rows],
  );

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          (tab === "all" || r.status === tab) &&
          (!q || `${r.studentName} ${r.courseName} ${r.code}`.toLowerCase().includes(q)),
      ),
    [rows, tab, q],
  );

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const selected = filtered.find((r) => r.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => setPage(1), [tab, q]);

  return (
    <div>
      {/* HERO */}
      <section className="mb-5 grid items-start gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(290px,0.95fr)]">
        <div className="py-2">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.16em] text-[#6389b9]">
            Olimach consultoria e treinamentos offshore
          </p>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h1 className="max-w-[500px] text-2xl leading-tight md:text-[34px]">Gerencie seus certificados de forma simples e segura.</h1>
            <Link
              to="/certificados"
              className="inline-flex shrink-0 items-center gap-2 rounded-btn-admin bg-navy-900 px-4 py-3 text-xs font-semibold text-white shadow-sm hover:bg-navy-700"
            >
              <Plus size={16} aria-hidden /> Emitir certificado
            </Link>
          </div>
          <p className="mt-3 max-w-xl text-sm text-muted">
            Emita, organize e valide certificados dos seus treinamentos com agilidade e total confiabilidade.
          </p>
        </div>
        <div className="relative hidden h-[207px] overflow-hidden rounded-[14px] lg:block">
          <img src="/assets/images/platform-card.webp" alt="Plataforma offshore ao entardecer" className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-r from-navy-900/20 to-navy-900/10" aria-hidden />
          <p className="absolute bottom-5 left-6 text-lg font-medium leading-snug text-white [text-shadow:0_2px_11px_#071c3a80]">
            Formação hoje.
            <br />
            Profissionais mais
            <br />
            preparados amanhã.
          </p>
        </div>
      </section>

      {/* METRICAS (contagens reais do banco; sem variacoes inventadas) */}
      <section aria-label="Indicadores" className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4">
        <Metric icon={FileText} value={stats.certificates} label="Certificados emitidos" />
        <Metric icon={UsersRound} value={stats.students} label="Alunos cadastrados" />
        <div className="col-span-2 md:col-span-1">
          <Metric icon={BookOpen} value={stats.activeCourses} label="Treinamentos ativos" />
        </div>
      </section>

      <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.86fr)_minmax(310px,0.96fr)]">
        {/* TABELA */}
        <div className="min-w-0 rounded-[15px] border border-line bg-surface p-4 shadow-sm md:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base">Certificados</h2>
            <div className="flex gap-2">
              <label className="flex h-9 flex-1 items-center gap-2 rounded-[9px] border border-line px-2.5 text-muted sm:flex-none">
                <Search size={15} aria-hidden />
                <span className="sr-only">Buscar certificado</span>
                <input
                  value={params.get("q") ?? ""}
                  onChange={(e) => {
                    const next = new URLSearchParams(params);
                    if (e.target.value) next.set("q", e.target.value);
                    else next.delete("q");
                    setParams(next, { replace: true });
                  }}
                  placeholder="Buscar certificado..."
                  className="w-full min-w-0 bg-transparent text-xs text-ink outline-none placeholder:text-[#a1adc0] sm:w-40"
                />
              </label>
            </div>
          </div>

          <div role="tablist" aria-label="Situação do certificado" className="my-4 flex gap-1.5 overflow-x-auto pb-0.5">
            {tabs.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-2 text-[11px]",
                  tab === id ? "bg-[#f0f3f7] font-bold text-navy-900" : "text-muted hover:bg-canvas",
                )}
              >
                {label} ({counts[id]})
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left">
              <thead>
                <tr className="bg-canvas text-[10px] font-semibold text-[#253b57]">
                  <th className="rounded-l-md border-y border-line px-2.5 py-3">Aluno</th>
                  <th className="border-y border-line px-2.5 py-3">Treinamento</th>
                  <th className="border-y border-line px-2.5 py-3">Data de emissão</th>
                  <th className="border-y border-line px-2.5 py-3">Validade</th>
                  <th className="border-y border-line px-2.5 py-3">Status</th>
                  <th className="rounded-r-md border-y border-line px-2.5 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className={cn("cursor-pointer border-b border-line text-[11px] text-[#4b5b70] hover:bg-canvas/60", selected?.id === r.id && "bg-canvas/70")}
                  >
                    <td className="px-2.5 py-3">
                      <span className="flex items-center gap-2.5 font-medium text-ink">
                        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[#e9edf3] text-[11px] text-navy-700">
                          {initials(r.studentName)}
                        </span>
                        <span className="max-w-[130px] truncate">{r.studentName}</span>
                      </span>
                    </td>
                    <td className="px-2.5 py-3">
                      <span className="block max-w-[170px] truncate text-navy-700">{r.courseName}</span>
                    </td>
                    <td className="whitespace-nowrap px-2.5 py-3">{formatDate(r.issuedAt)}</td>
                    <td className="whitespace-nowrap px-2.5 py-3">{r.expiresAt ? formatDate(r.expiresAt) : "Sem validade"}</td>
                    <td className="px-2.5 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-2.5 py-3 text-right">
                      <CertificateActionsMenu row={r} siteUrl={SITE_URL} canRevoke={profile?.role === "admin"} onRevoke={setRevoking} />
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-xs text-muted">
                      {loading
                        ? "Carregando certificados..."
                        : error
                          ? "Não foi possível carregar os certificados."
                          : rows.length === 0
                            ? "Nenhum certificado emitido ainda."
                            : "Nenhum certificado encontrado."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex items-center justify-between gap-2 text-[11px] text-muted">
            <span>
              Mostrando {visible.length} de {filtered.length} resultados
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label="Página anterior"
                disabled={current <= 1}
                onClick={() => setPage(current - 1)}
                className="p-1 disabled:opacity-40"
              >
                <ChevronLeft size={16} aria-hidden />
              </button>
              <span className="grid h-[30px] min-w-[30px] place-items-center rounded-lg bg-[#e9edf3] px-2 text-navy-900">
                {current} / {pages}
              </span>
              <button
                type="button"
                aria-label="Próxima página"
                disabled={current >= pages}
                onClick={() => setPage(current + 1)}
                className="p-1 disabled:opacity-40"
              >
                <ChevronRight size={16} aria-hidden />
              </button>
            </div>
          </div>
        </div>

        {/* PRE-VISUALIZACAO */}
        <aside className="rounded-[15px] border border-line bg-surface p-4 shadow-sm md:p-5" aria-label="Visualizar certificado">
          <h2 className="mb-4 text-base">Visualizar certificado</h2>
          {selected ? (
            <CertificatePreview row={selected} />
          ) : (
            <div className="flex min-h-[310px] flex-col items-center justify-center text-center text-[#a1b0c1]">
              <FilePlus size={34} aria-hidden />
              <h3 className="mt-3 text-base text-[#4a5c72]">Nenhum certificado selecionado</h3>
              <p className="mt-1 text-xs">Os certificados emitidos aparecem aqui.</p>
              <Link to="/certificados" className="mt-4 inline-flex items-center gap-2 text-xs font-bold text-navy-700 hover:underline">
                Emitir certificado <ArrowRight size={14} aria-hidden />
              </Link>
            </div>
          )}
        </aside>
      </section>

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
