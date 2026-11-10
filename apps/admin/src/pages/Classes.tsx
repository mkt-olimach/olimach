import { classInputSchema } from "@olimach/schemas";
import { Badge, Button, cn } from "@olimach/ui";
import { Plus, Search, Users } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { Field, Modal, PageHeader, dbErrorMessage, inputClass } from "../components/ui";
import { classStatusLabel, classStatusTone, formatPeriod } from "../lib/classes";
import type { ClassStatus } from "../lib/classes";
import { supabase } from "../lib/supabase";
import { useToast } from "../lib/toast";

export interface ClassFormData {
  id: string;
  course_id: string;
  start_date: string;
  end_date: string;
  location: string;
  status: ClassStatus;
  instructorIds: string[];
}

interface ClassRow {
  id: string;
  course_id: string;
  start_date: string;
  end_date: string;
  location: string;
  status: ClassStatus;
  course: { name: string; category: string } | null;
  class_instructors: Array<{ instructor_id: string; instructor: { name: string } | null }>;
  enrollments: Array<{ count: number }>;
}

interface Option {
  id: string;
  name: string;
}

const LIST_SELECT =
  "id, course_id, start_date, end_date, location, status, course:courses(name, category), class_instructors(instructor_id, instructor:instructors(name)), enrollments(count)";

/** Formulario de turma (usado na lista e no detalhe). */
export function ClassForm({ initial, onSaved, onClose }: { initial: ClassFormData | null; onSaved: (id: string) => void; onClose: () => void }) {
  const toast = useToast();
  const [courses, setCourses] = useState<Array<Option & { active: boolean; category: string }>>([]);
  const [instructors, setInstructors] = useState<Option[]>([]);
  const [values, setValues] = useState({
    course_id: initial?.course_id ?? "",
    start_date: initial?.start_date ?? "",
    end_date: initial?.end_date ?? "",
    location: initial?.location ?? "",
    status: (initial?.status ?? "planned") as ClassStatus,
  });
  const [selected, setSelected] = useState<Set<string>>(new Set(initial?.instructorIds ?? []));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from("courses")
      .select("id, name, active, category")
      .order("name")
      .then(({ data }) => setCourses((data ?? []) as typeof courses));
    void supabase
      .from("instructors")
      .select("id, name")
      .order("name")
      .then(({ data }) => setInstructors((data ?? []) as Option[]));
  }, []);

  const course = courses.find((c) => c.id === values.course_id);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    const parsed = classInputSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);

    let id = initial?.id ?? "";
    if (initial) {
      const { error } = await supabase.from("classes").update(parsed.data).eq("id", initial.id);
      if (error) {
        setBusy(false);
        toast.error(dbErrorMessage(error, {}));
        return;
      }
    } else {
      const { data, error } = await supabase.from("classes").insert(parsed.data).select("id").single();
      if (error || !data) {
        setBusy(false);
        toast.error(dbErrorMessage(error ?? {}, {}));
        return;
      }
      id = (data as { id: string }).id;
    }

    // Sincroniza instrutores: remove os desmarcados e insere os novos.
    const before = new Set(initial?.instructorIds ?? []);
    const toRemove = [...before].filter((i) => !selected.has(i));
    const toAdd = [...selected].filter((i) => !before.has(i));
    if (toRemove.length) await supabase.from("class_instructors").delete().eq("class_id", id).in("instructor_id", toRemove);
    if (toAdd.length) {
      const { error } = await supabase.from("class_instructors").insert(toAdd.map((instructor_id) => ({ class_id: id, instructor_id })));
      if (error) toast.error("A turma foi salva, mas os instrutores não puderam ser vinculados.");
    }

    setBusy(false);
    toast.success(initial ? "Turma atualizada." : "Turma cadastrada.");
    onSaved(id);
  }

  return (
    <Modal wide title={initial ? "Editar turma" : "Nova turma"} description="A turma reúne treinamento, período, local, instrutores e alunos matriculados." onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Treinamento" error={errors.course_id}>
          {(p) => (
            <select {...p} className={inputClass} value={values.course_id} onChange={(e) => setValues((v) => ({ ...v, course_id: e.target.value }))}>
              <option value="">Selecione...</option>
              {courses
                .filter((c) => c.active || c.id === initial?.course_id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {!c.active ? " (inativo)" : ""}
                  </option>
                ))}
            </select>
          )}
        </Field>
        {course?.category === "parceria" && (
          <p className="rounded-btn-admin bg-canvas p-3 text-xs text-muted">Treinamento em parceria: a turma pode ser cadastrada, mas o sistema não emite certificado para ela.</p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Início" error={errors.start_date}>
            {(p) => <input {...p} type="date" className={inputClass} value={values.start_date} onChange={(e) => setValues((v) => ({ ...v, start_date: e.target.value, end_date: v.end_date || e.target.value }))} />}
          </Field>
          <Field label="Término" error={errors.end_date}>
            {(p) => <input {...p} type="date" className={inputClass} value={values.end_date} min={values.start_date || undefined} onChange={(e) => setValues((v) => ({ ...v, end_date: e.target.value }))} />}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Local" error={errors.location} hint="Aparece no certificado.">
            {(p) => <input {...p} className={inputClass} value={values.location} onChange={(e) => setValues((v) => ({ ...v, location: e.target.value }))} placeholder="Macaé, RJ" />}
          </Field>
          <Field label="Situação" error={errors.status}>
            {(p) => (
              <select {...p} className={inputClass} value={values.status} onChange={(e) => setValues((v) => ({ ...v, status: e.target.value as ClassStatus }))}>
                {(Object.keys(classStatusLabel) as ClassStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {classStatusLabel[s]}
                  </option>
                ))}
              </select>
            )}
          </Field>
        </div>

        <fieldset>
          <legend className="text-sm font-semibold text-navy-900">Instrutores</legend>
          {instructors.length === 0 ? (
            <p className="mt-1.5 text-xs text-muted">Nenhum instrutor cadastrado. Cadastre em Instrutores para vincular à turma.</p>
          ) : (
            <div className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
              {instructors.map((i) => (
                <label key={i.id} className="flex items-center gap-2.5 rounded-btn-admin border border-line px-3 py-2 text-sm text-ink">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#0B1F4D]"
                    checked={selected.has(i.id)}
                    onChange={(e) =>
                      setSelected((cur) => {
                        const next = new Set(cur);
                        if (e.target.checked) next.add(i.id);
                        else next.delete(i.id);
                        return next;
                      })
                    }
                  />
                  {i.name}
                </label>
              ))}
            </div>
          )}
        </fieldset>

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

type Filter = "all" | ClassStatus;

export function Classes() {
  const [rows, setRows] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error: err } = await supabase.from("classes").select(LIST_SELECT).order("start_date", { ascending: false });
    if (err) setError(true);
    else {
      setError(false);
      setRows(data as unknown as ClassRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((c) => (filter === "all" || c.status === filter) && (!q || `${c.course?.name ?? ""} ${c.location}`.toLowerCase().includes(q)));
  }, [rows, filter, query]);

  const filters: Array<{ id: Filter; label: string }> = [{ id: "all", label: "Todas" }, ...(Object.keys(classStatusLabel) as ClassStatus[]).map((s) => ({ id: s, label: classStatusLabel[s] }))];

  return (
    <div>
      <PageHeader
        title="Turmas"
        description="Turmas por treinamento, com período, local, instrutores e alunos matriculados."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden /> Nova turma
          </Button>
        }
      />

      <div className="rounded-[15px] border border-line bg-surface p-4 shadow-sm md:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div role="group" aria-label="Filtrar por situação" className="flex flex-wrap gap-1.5">
            {filters.map((f) => (
              <button key={f.id} type="button" aria-pressed={filter === f.id} onClick={() => setFilter(f.id)} className={cn("rounded-lg px-3 py-2 text-[11px]", filter === f.id ? "bg-[#f0f3f7] font-bold text-navy-900" : "text-muted hover:bg-canvas")}>
                {f.label}
              </button>
            ))}
          </div>
          <label className="flex h-9 items-center gap-2 rounded-[9px] border border-line px-2.5 text-muted">
            <Search size={15} aria-hidden />
            <span className="sr-only">Buscar turma</span>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar treinamento ou local..." className="w-full min-w-0 bg-transparent text-xs text-ink outline-none placeholder:text-[#a1adc0] md:w-56" />
          </label>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <thead>
              <tr className="bg-canvas text-[10px] font-semibold text-[#253b57]">
                <th className="rounded-l-md border-y border-line px-2.5 py-3">Treinamento</th>
                <th className="border-y border-line px-2.5 py-3">Período</th>
                <th className="border-y border-line px-2.5 py-3">Local</th>
                <th className="border-y border-line px-2.5 py-3">Instrutores</th>
                <th className="border-y border-line px-2.5 py-3">Alunos</th>
                <th className="rounded-r-md border-y border-line px-2.5 py-3">Situação</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => (
                <tr key={c.id} className="border-b border-line text-[11px] text-[#4b5b70] hover:bg-canvas/60">
                  <td className="px-2.5 py-3">
                    <Link to={`/turmas/${c.id}`} className="block max-w-[260px] font-medium text-navy-700 hover:underline">
                      {c.course?.name ?? "-"}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-3">{formatPeriod(c.start_date, c.end_date)}</td>
                  <td className="px-2.5 py-3">{c.location}</td>
                  <td className="px-2.5 py-3">
                    <span className="block max-w-[200px] truncate">{c.class_instructors.map((i) => i.instructor?.name).filter(Boolean).join(", ") || "-"}</span>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-3">
                    <span className="inline-flex items-center gap-1.5">
                      <Users size={14} aria-hidden /> {c.enrollments[0]?.count ?? 0}
                    </span>
                  </td>
                  <td className="px-2.5 py-3">
                    <Badge tone={classStatusTone[c.status]}>{classStatusLabel[c.status]}</Badge>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-muted">
                    {loading ? "Carregando turmas..." : error ? "Não foi possível carregar as turmas." : rows.length === 0 ? "Nenhuma turma cadastrada ainda." : "Nenhuma turma encontrada."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-[11px] text-muted">Abra uma turma para matricular alunos e registrar presença e aprovação.</p>
      </div>

      {creating && (
        <ClassForm
          initial={null}
          onClose={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            void load();
          }}
        />
      )}
    </div>
  );
}
