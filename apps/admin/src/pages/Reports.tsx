import { Button } from "@olimach/ui";
import { Download } from "lucide-react";
import { useMemo } from "react";
import { PageHeader } from "../components/ui";
import { formatDate, useDashboardData } from "../lib/certificates";
import { buildCsv } from "../lib/csv";
import type { CertificateRow } from "../lib/certificates";

function toCsv(rows: CertificateRow[]): string {
  const statusLabel = { valid: "Válido", expired: "Vencido", revoked: "Revogado" } as const;
  const header = ["Código", "Aluno", "Treinamento", "Emissão", "Validade", "Situação"];
  const lines = rows.map((r) => [r.code, r.studentName, r.courseName, formatDate(r.issuedAt), r.expiresAt ? formatDate(r.expiresAt) : "Sem validade", statusLabel[r.status]]);
  return buildCsv(header, lines);
}

function downloadCsv(rows: CertificateRow[]) {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `certificados-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

const MONTHS = 12;
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export function Reports() {
  const { rows, loading, error } = useDashboardData();

  const data = useMemo(() => {
    const now = new Date();
    const months = Array.from({ length: MONTHS }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1 - i), 1);
      return { key: monthKey(d), label: d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", ""), count: 0 };
    });
    const byCourse = new Map<string, number>();
    const expiring: CertificateRow[] = [];
    const limit = now.getTime() + 90 * 86_400_000;
    for (const r of rows) {
      if (r.status === "revoked") continue;
      const slot = months.find((m) => m.key === monthKey(new Date(r.issuedAt)));
      if (slot) slot.count++;
      byCourse.set(r.courseName, (byCourse.get(r.courseName) ?? 0) + 1);
      if (r.status === "valid" && r.expiresAt && new Date(r.expiresAt).getTime() <= limit) expiring.push(r);
    }
    expiring.sort((a, b) => new Date(a.expiresAt!).getTime() - new Date(b.expiresAt!).getTime());
    return {
      months,
      max: Math.max(1, ...months.map((m) => m.count)),
      courses: [...byCourse.entries()].sort((a, b) => b[1] - a[1]),
      expiring,
      valid: rows.filter((r) => r.status === "valid").length,
      expired: rows.filter((r) => r.status === "expired").length,
      revoked: rows.filter((r) => r.status === "revoked").length,
    };
  }, [rows]);

  return (
    <div>
      <PageHeader
        title="Relatórios"
        description="Visão dos certificados emitidos. Os números vêm direto do banco; não há valores de exemplo."
        action={
          <Button variant="secondary" onClick={() => downloadCsv(rows)} disabled={rows.length === 0}>
            <Download size={16} aria-hidden /> Exportar CSV
          </Button>
        }
      />

      {loading ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : error ? (
        <p className="text-sm text-muted">Não foi possível carregar os dados.</p>
      ) : (
        <div className="space-y-5">
          <section aria-label="Situação" className="grid gap-3 sm:grid-cols-3">
            {[
              ["Válidos", data.valid],
              ["Vencidos", data.expired],
              ["Revogados", data.revoked],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-[14px] border border-line bg-surface p-4 shadow-sm">
                <p className="font-heading text-2xl font-extrabold text-navy-900">{value}</p>
                <p className="mt-1 text-xs text-muted">{label}</p>
              </div>
            ))}
          </section>

          <section className="rounded-[15px] border border-line bg-surface p-5 shadow-sm" aria-label="Emissões por mês">
            <h2 className="text-base">Emissões por mês (últimos 12 meses)</h2>
            <div className="mt-5 flex h-44 items-end gap-2" role="img" aria-label={data.months.map((m) => `${m.label}: ${m.count}`).join(", ")}>
              {data.months.map((m) => (
                <div key={m.key} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-[10px] font-semibold text-navy-900">{m.count || ""}</span>
                  <div className="w-full rounded-t-md bg-orange-500" style={{ height: `${(m.count / data.max) * 100}%`, minHeight: m.count ? 4 : 0 }} />
                  <span className="text-[10px] text-muted">{m.label}</span>
                </div>
              ))}
            </div>
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            <section className="rounded-[15px] border border-line bg-surface p-5 shadow-sm">
              <h2 className="text-base">Certificados por treinamento</h2>
              <ul className="mt-4 divide-y divide-line text-sm">
                {data.courses.map(([name, count]) => (
                  <li key={name} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="truncate text-ink">{name}</span>
                    <span className="font-semibold text-navy-900">{count}</span>
                  </li>
                ))}
                {data.courses.length === 0 && <li className="py-6 text-center text-xs text-muted">Nenhum certificado emitido ainda.</li>}
              </ul>
            </section>

            <section className="rounded-[15px] border border-line bg-surface p-5 shadow-sm">
              <h2 className="text-base">Vencendo em 90 dias</h2>
              <ul className="mt-4 divide-y divide-line text-sm">
                {data.expiring.slice(0, 10).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="block truncate text-ink">{r.studentName}</span>
                      <span className="block truncate text-xs text-muted">{r.courseName}</span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-orange-600">{formatDate(r.expiresAt)}</span>
                  </li>
                ))}
                {data.expiring.length === 0 && <li className="py-6 text-center text-xs text-muted">Nenhum certificado vence nos próximos 90 dias.</li>}
              </ul>
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
