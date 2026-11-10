import { courseInputSchema, slugify } from "@olimach/schemas";
import type { CourseCategory } from "@olimach/schemas";
import { Badge, Button, cn } from "@olimach/ui";
import { Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ConfirmDialog, Field, Modal, PageHeader, dbErrorMessage, inputClass } from "../components/ui";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useToast } from "../lib/toast";

interface CourseRow {
  id: string;
  slug: string;
  name: string;
  category: CourseCategory;
  nr_code: string | null;
  workload_hours: number;
  syllabus: string;
  modality: "presencial" | "online" | "hibrido";
  validity_months: number | null;
  active: boolean;
}

const categoryLabel: Record<CourseCategory, string> = {
  nr: "Norma Regulamentadora",
  profissionalizante: "Profissionalizante",
  parceria: "Parceria",
};
const modalityLabel = { presencial: "Presencial", online: "Online", hibrido: "Híbrido" } as const;
const COLUMNS = "id, slug, name, category, nr_code, workload_hours, syllabus, modality, validity_months, active";

interface FormState {
  name: string;
  slug: string;
  category: CourseCategory;
  nr_code: string;
  workload_hours: string;
  modality: CourseRow["modality"];
  validity_months: string;
  syllabus: string;
  active: boolean;
}

const blank: FormState = {
  name: "",
  slug: "",
  category: "nr",
  nr_code: "",
  workload_hours: "",
  modality: "presencial",
  validity_months: "",
  syllabus: "",
  active: true,
};

const fromRow = (c: CourseRow): FormState => ({
  name: c.name,
  slug: c.slug,
  category: c.category,
  nr_code: c.nr_code ?? "",
  workload_hours: String(c.workload_hours),
  modality: c.modality,
  validity_months: c.validity_months != null ? String(c.validity_months) : "",
  syllabus: c.syllabus,
  active: c.active,
});

function CourseForm({
  course,
  existingSlugs,
  onSaved,
  onClose,
}: {
  course: CourseRow | null;
  existingSlugs: Set<string>;
  onSaved: () => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [values, setValues] = useState<FormState>(course ? fromRow(course) : blank);
  const [slugTouched, setSlugTouched] = useState(Boolean(course));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setValues((v) => ({ ...v, [key]: value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    const parsed = courseInputSchema.safeParse({
      slug: values.slug.trim(),
      name: values.name,
      category: values.category,
      nr_code: values.category === "nr" ? values.nr_code.trim().toUpperCase() || null : null,
      workload_hours: values.workload_hours === "" ? Number.NaN : Number(values.workload_hours),
      syllabus: values.syllabus,
      modality: values.modality,
      validity_months: values.validity_months === "" ? null : Number(values.validity_months),
      active: values.active,
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    if (!course && existingSlugs.has(parsed.data.slug)) {
      setErrors({ slug: "Já existe um treinamento com este identificador." });
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = course
      ? await supabase.from("courses").update(parsed.data).eq("id", course.id)
      : await supabase.from("courses").insert(parsed.data);
    setBusy(false);
    if (error) {
      toast.error(dbErrorMessage(error, { unique: "Já existe um treinamento com este identificador." }));
      return;
    }
    toast.success(course ? "Treinamento atualizado." : "Treinamento cadastrado.");
    onSaved();
  }

  return (
    <Modal
      wide
      title={course ? "Editar treinamento" : "Novo treinamento"}
      description="Conteúdo programático e carga horária aparecem no certificado."
      onClose={onClose}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Nome do treinamento" error={errors.name}>
          {(p) => (
            <input
              {...p}
              className={inputClass}
              value={values.name}
              onChange={(e) => {
                set("name", e.target.value);
                if (!slugTouched) set("slug", slugify(e.target.value));
              }}
              placeholder="Ex.: NR-35 Trabalho em Altura"
            />
          )}
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Categoria" error={errors.category}>
            {(p) => (
              <select {...p} className={inputClass} value={values.category} onChange={(e) => set("category", e.target.value as CourseCategory)}>
                <option value="nr">Norma Regulamentadora</option>
                <option value="profissionalizante">Profissionalizante</option>
                <option value="parceria">Parceria (não emite certificado)</option>
              </select>
            )}
          </Field>
          <Field label="Modalidade" error={errors.modality}>
            {(p) => (
              <select {...p} className={inputClass} value={values.modality} onChange={(e) => set("modality", e.target.value as FormState["modality"])}>
                {Object.entries(modalityLabel).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        {values.category === "nr" && (
          <Field label="Código da NR" error={errors.nr_code} hint="Formato NR-35.">
            {(p) => <input {...p} className={inputClass} value={values.nr_code} onChange={(e) => set("nr_code", e.target.value)} placeholder="NR-35" />}
          </Field>
        )}

        {values.category === "parceria" && (
          <p className="rounded-btn-admin bg-canvas p-3 text-xs text-muted">
            Cursos em parceria aparecem no cadastro, mas o sistema não emite certificado para eles.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Carga horária (horas)" error={errors.workload_hours} hint="Confirme com a Olimach antes de publicar.">
            {(p) => (
              <input {...p} type="number" min={1} step={1} inputMode="numeric" className={inputClass} value={values.workload_hours} onChange={(e) => set("workload_hours", e.target.value)} />
            )}
          </Field>
          <Field label="Validade do certificado (meses)" error={errors.validity_months} hint="Deixe vazio para certificado sem validade.">
            {(p) => (
              <input {...p} type="number" min={1} step={1} inputMode="numeric" className={inputClass} value={values.validity_months} onChange={(e) => set("validity_months", e.target.value)} />
            )}
          </Field>
        </div>

        <Field
          label="Identificador (slug)"
          error={errors.slug}
          hint={course ? "O identificador não muda depois de criado." : "Gerado a partir do nome. Usado em endereços e no seed."}
        >
          {(p) => (
            <input
              {...p}
              className={inputClass}
              value={values.slug}
              disabled={Boolean(course)}
              onChange={(e) => {
                setSlugTouched(true);
                set("slug", e.target.value);
              }}
            />
          )}
        </Field>

        <Field label="Conteúdo programático" error={errors.syllabus} hint="Impresso no verso do certificado.">
          {(p) => <textarea {...p} rows={6} className={cn(inputClass, "resize-y")} value={values.syllabus} onChange={(e) => set("syllabus", e.target.value)} />}
        </Field>

        <label className="flex items-center gap-2.5 text-sm text-ink">
          <input type="checkbox" className="h-4 w-4 accent-[#0B1F4D]" checked={values.active} onChange={(e) => set("active", e.target.checked)} />
          Treinamento ativo (disponível para novas turmas)
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

type Filter = "all" | CourseCategory;

export function Courses() {
  const { profile } = useAuth();
  const toast = useToast();
  const isAdmin = profile?.role === "admin";
  const [rows, setRows] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [editing, setEditing] = useState<CourseRow | "new" | null>(null);
  const [removing, setRemoving] = useState<CourseRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error: err } = await supabase.from("courses").select(COLUMNS).order("name");
    if (err) setError(true);
    else {
      setError(false);
      setRows(data as CourseRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((c) => (filter === "all" || c.category === filter) && (!q || `${c.name} ${c.nr_code ?? ""}`.toLowerCase().includes(q)));
  }, [rows, query, filter]);

  async function toggleActive(course: CourseRow) {
    if (!supabase) return;
    const { error: err } = await supabase.from("courses").update({ active: !course.active }).eq("id", course.id);
    if (err) toast.error(dbErrorMessage(err, {}));
    else {
      toast.success(course.active ? "Treinamento inativado." : "Treinamento ativado.");
      await load();
    }
  }

  async function remove(course: CourseRow) {
    if (!supabase) return;
    setBusy(true);
    const { error: err } = await supabase.from("courses").delete().eq("id", course.id);
    setBusy(false);
    if (err) {
      toast.error(
        dbErrorMessage(err, { inUse: "Este treinamento tem turmas cadastradas e não pode ser excluído. Inative-o para tirá-lo de uso." }),
      );
      return;
    }
    toast.success("Treinamento excluído.");
    setRemoving(null);
    await load();
  }

  const filters: Array<{ id: Filter; label: string }> = [
    { id: "all", label: "Todos" },
    { id: "nr", label: "NR" },
    { id: "profissionalizante", label: "Profissionalizantes" },
    { id: "parceria", label: "Parceria" },
  ];

  return (
    <div>
      <PageHeader
        title="Treinamentos"
        description="Catálogo de cursos da Olimach. Carga horária, validade e conteúdo programático alimentam o certificado."
        action={
          isAdmin && (
            <Button onClick={() => setEditing("new")}>
              <Plus size={16} aria-hidden /> Novo treinamento
            </Button>
          )
        }
      />

      <div className="rounded-[15px] border border-line bg-surface p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div role="group" aria-label="Filtrar por categoria" className="flex flex-wrap gap-1.5">
            {filters.map((f) => (
              <button
                key={f.id}
                type="button"
                aria-pressed={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn("rounded-lg px-3 py-2 text-[11px]", filter === f.id ? "bg-[#f0f3f7] font-bold text-navy-900" : "text-muted hover:bg-canvas")}
              >
                {f.label}
              </button>
            ))}
          </div>
          <label className="flex h-9 items-center gap-2 rounded-[9px] border border-line px-2.5 text-muted">
            <Search size={15} aria-hidden />
            <span className="sr-only">Buscar treinamento</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar treinamento..." className="w-full min-w-0 bg-transparent text-xs text-ink outline-none placeholder:text-[#a1adc0] md:w-52" />
          </label>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="bg-canvas text-[10px] font-semibold text-[#253b57]">
                <th className="rounded-l-md border-y border-line px-2.5 py-3">Treinamento</th>
                <th className="border-y border-line px-2.5 py-3">Categoria</th>
                <th className="border-y border-line px-2.5 py-3">Carga horária</th>
                <th className="border-y border-line px-2.5 py-3">Modalidade</th>
                <th className="border-y border-line px-2.5 py-3">Validade</th>
                <th className="border-y border-line px-2.5 py-3">Situação</th>
                <th className="rounded-r-md border-y border-line px-2.5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id} className="border-b border-line text-[11px] text-[#4b5b70]">
                  <td className="px-2.5 py-3">
                    <span className="block max-w-[280px] font-medium text-ink">{c.name}</span>
                    {c.nr_code && <span className="text-[10px] text-muted">{c.nr_code}</span>}
                  </td>
                  <td className="px-2.5 py-3">
                    <Badge tone={c.category === "parceria" ? "warning" : "neutral"}>{categoryLabel[c.category]}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-3">{c.workload_hours} h</td>
                  <td className="px-2.5 py-3">{modalityLabel[c.modality]}</td>
                  <td className="whitespace-nowrap px-2.5 py-3">{c.validity_months ? `${c.validity_months} meses` : "Sem validade"}</td>
                  <td className="px-2.5 py-3">
                    <Badge tone={c.active ? "success" : "neutral"}>{c.active ? "Ativo" : "Inativo"}</Badge>
                  </td>
                  <td className="px-2.5 py-3">
                    <div className="flex justify-end gap-1">
                      {isAdmin ? (
                        <>
                          <button type="button" onClick={() => setEditing(c)} aria-label={`Editar ${c.name}`} title="Editar" className="rounded p-1.5 text-[#678099] hover:bg-canvas hover:text-navy-900">
                            <Pencil size={16} aria-hidden />
                          </button>
                          <button type="button" onClick={() => void toggleActive(c)} aria-label={`${c.active ? "Inativar" : "Ativar"} ${c.name}`} title={c.active ? "Inativar" : "Ativar"} className="rounded p-1.5 text-[#678099] hover:bg-canvas hover:text-navy-900">
                            <Power size={16} aria-hidden />
                          </button>
                          <button type="button" onClick={() => setRemoving(c)} aria-label={`Excluir ${c.name}`} title="Excluir" className="rounded p-1.5 text-[#678099] hover:bg-canvas hover:text-danger">
                            <Trash2 size={16} aria-hidden />
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] text-muted">Somente leitura</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-xs text-muted">
                    {loading ? "Carregando treinamentos..." : error ? "Não foi possível carregar os treinamentos." : rows.length === 0 ? "Nenhum treinamento cadastrado ainda." : "Nenhum treinamento encontrado."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[11px] text-muted">{visible.length} de {rows.length} treinamentos.{!isAdmin && " Somente administradores editam o catálogo."}</p>
      </div>

      {editing && (
        <CourseForm
          course={editing === "new" ? null : editing}
          existingSlugs={new Set(rows.map((r) => r.slug))}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Excluir treinamento"
          message={
            <>
              Excluir <strong className="text-ink">{removing.name}</strong>? Esta ação não pode ser desfeita. Se houver turmas, prefira inativar o treinamento.
            </>
          }
          confirmLabel="Excluir"
          busy={busy}
          onConfirm={() => void remove(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}
