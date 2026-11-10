import { Badge } from "@olimach/ui";
import type { BadgeTone } from "@olimach/ui";
import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";
import { Field, Pager, inputClass } from "../ui";

interface AuditRow {
  id: number;
  actor_id: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

const PAGE_SIZE = 20;

const actionLabel: Record<string, { label: string; tone: BadgeTone }> = {
  insert: { label: "Criado", tone: "success" },
  update: { label: "Editado", tone: "neutral" },
  delete: { label: "Excluído", tone: "danger" },
  emit: { label: "Emitido", tone: "success" },
  revoke: { label: "Revogado", tone: "danger" },
};

const entityLabel: Record<string, string> = {
  courses: "Treinamento",
  students: "Aluno",
  certificates: "Certificado",
  classes: "Turma",
  class_instructors: "Instrutor da turma",
  enrollments: "Matrícula",
  instructors: "Instrutor",
  technical_leads: "Responsável técnico",
  profiles: "Usuário",
};

/** Resumo legivel do evento. Alunos nunca trazem dados pessoais no payload (so o nome dos campos). */
function describe(row: AuditRow): string {
  const p = row.payload;
  const text = (key: string) => (typeof p[key] === "string" ? (p[key] as string) : null);
  if (row.action === "update" && Array.isArray(p.changed_fields)) return `Campos: ${(p.changed_fields as string[]).join(", ")}`;
  if (row.action === "revoke") {
    const reason = (p.new as Record<string, unknown> | undefined)?.revoked_reason;
    return typeof reason === "string" ? `Motivo: ${reason}` : "Certificado revogado";
  }
  return text("name") ?? text("full_name") ?? text("code") ?? text("slug") ?? text("location") ?? "";
}

const formatDateTime = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function ActivityTab() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [actors, setActors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from("profiles")
      .select("id, name")
      .then(({ data }) => setActors(Object.fromEntries((data ?? []).map((p) => [(p as { id: string }).id, (p as { name: string }).name]))));
  }, []);

  useEffect(() => setPage(1), [entity, action, from, to]);

  useEffect(() => {
    if (!supabase) return;
    const client = supabase;
    let cancelled = false;
    async function load() {
      let query = client.from("audit_log").select("id, actor_id, action, entity, entity_id, payload, created_at", { count: "exact" });
      if (entity) query = query.eq("entity", entity);
      if (action) query = query.eq("action", action);
      if (from) query = query.gte("created_at", `${from}T00:00:00`);
      if (to) query = query.lte("created_at", `${to}T23:59:59`);
      const start = (page - 1) * PAGE_SIZE;
      const { data, count, error: err } = await query.order("created_at", { ascending: false }).range(start, start + PAGE_SIZE - 1);
      if (cancelled) return;
      if (err) setError(true);
      else {
        setError(false);
        setRows(data as AuditRow[]);
        setTotal(count ?? 0);
      }
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [entity, action, from, to, page]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="rounded-[15px] border border-line bg-surface p-4 shadow-sm md:p-5">
      <p className="mb-4 text-xs text-muted">Registro imutável de criação, edição, emissão, revogação e exclusão. Dados pessoais de alunos nunca são gravados aqui.</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Field label="Tipo">
          {(p) => (
            <select {...p} className={inputClass} value={entity} onChange={(e) => setEntity(e.target.value)}>
              <option value="">Todos</option>
              {Object.entries(entityLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Ação">
          {(p) => (
            <select {...p} className={inputClass} value={action} onChange={(e) => setAction(e.target.value)}>
              <option value="">Todas</option>
              {Object.entries(actionLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="De">{(p) => <input {...p} type="date" className={inputClass} value={from} onChange={(e) => setFrom(e.target.value)} />}</Field>
        <Field label="Até">{(p) => <input {...p} type="date" className={inputClass} value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />}</Field>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse text-left">
          <thead>
            <tr className="bg-canvas text-[10px] font-semibold text-[#253b57]">
              <th className="rounded-l-md border-y border-line px-2.5 py-3">Data e hora</th>
              <th className="border-y border-line px-2.5 py-3">Quem</th>
              <th className="border-y border-line px-2.5 py-3">Ação</th>
              <th className="border-y border-line px-2.5 py-3">Tipo</th>
              <th className="rounded-r-md border-y border-line px-2.5 py-3">Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const a = actionLabel[r.action] ?? { label: r.action, tone: "neutral" as BadgeTone };
              return (
                <tr key={r.id} className="border-b border-line text-[11px] text-[#4b5b70]">
                  <td className="whitespace-nowrap px-2.5 py-3">{formatDateTime(r.created_at)}</td>
                  <td className="px-2.5 py-3">{r.actor_id ? (actors[r.actor_id] ?? "Usuário removido") : "Sistema"}</td>
                  <td className="px-2.5 py-3">
                    <Badge tone={a.tone}>{a.label}</Badge>
                  </td>
                  <td className="px-2.5 py-3">{entityLabel[r.entity] ?? r.entity}</td>
                  <td className="px-2.5 py-3">
                    <span className="block max-w-[320px] truncate" title={describe(r)}>
                      {describe(r) || "-"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-xs text-muted">
                  {loading ? "Carregando atividades..." : error ? "Não foi possível carregar o log." : "Nenhuma atividade encontrada."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Pager page={Math.min(page, pages)} pages={pages} total={total} shown={rows.length} onChange={setPage} />
    </section>
  );
}
