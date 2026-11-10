import { formatCpf, maskCpf, onlyDigits, studentInputSchema } from "@olimach/schemas";
import { Button } from "@olimach/ui";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ConfirmDialog, Field, Modal, PageHeader, Pager, dbErrorMessage, inputClass, useDebouncedValue } from "../components/ui";
import { useAuth } from "../lib/auth";
import { initials } from "../lib/certificates";
import { supabase } from "../lib/supabase";
import { useToast } from "../lib/toast";

interface StudentRow {
  id: string;
  full_name: string;
  cpf: string;
  birth_date: string | null;
  phone: string | null;
  email: string | null;
  company: string | null;
}

const PAGE_SIZE = 10;
const COLUMNS = "id, full_name, cpf, birth_date, phone, email, company";

interface FormState {
  full_name: string;
  cpf: string;
  birth_date: string;
  phone: string;
  email: string;
  company: string;
}

const blank: FormState = { full_name: "", cpf: "", birth_date: "", phone: "", email: "", company: "" };
const fromRow = (s: StudentRow): FormState => ({
  full_name: s.full_name,
  cpf: formatCpf(s.cpf),
  birth_date: s.birth_date ?? "",
  phone: s.phone ?? "",
  email: s.email ?? "",
  company: s.company ?? "",
});
const emptyToNull = (value: string) => (value.trim() === "" ? null : value.trim());

function StudentForm({ student, onSaved, onClose }: { student: StudentRow | null; onSaved: () => void; onClose: () => void }) {
  const toast = useToast();
  const [values, setValues] = useState<FormState>(student ? fromRow(student) : blank);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setValues((v) => ({ ...v, [key]: value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    const parsed = studentInputSchema.safeParse({
      full_name: values.full_name,
      cpf: values.cpf,
      birth_date: emptyToNull(values.birth_date),
      phone: emptyToNull(values.phone),
      email: emptyToNull(values.email),
      company: emptyToNull(values.company),
    });
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
      setErrors(next);
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = student
      ? await supabase.from("students").update(parsed.data).eq("id", student.id)
      : await supabase.from("students").insert(parsed.data);
    setBusy(false);
    if (error) {
      if (error.code === "23505") setErrors({ cpf: "Já existe um aluno com este CPF." });
      else toast.error(dbErrorMessage(error, {}));
      return;
    }
    toast.success(student ? "Aluno atualizado." : "Aluno cadastrado.");
    onSaved();
  }

  return (
    <Modal wide title={student ? "Editar aluno" : "Novo aluno"} description="O CPF é validado e aparece mascarado nas listas e na validação pública." onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Nome completo" error={errors.full_name}>
          {(p) => <input {...p} className={inputClass} autoComplete="off" value={values.full_name} onChange={(e) => set("full_name", e.target.value)} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="CPF" error={errors.cpf}>
            {(p) => (
              <input
                {...p}
                className={inputClass}
                inputMode="numeric"
                autoComplete="off"
                placeholder="000.000.000-00"
                value={values.cpf}
                onChange={(e) => set("cpf", formatCpf(e.target.value))}
              />
            )}
          </Field>
          <Field label="Data de nascimento" error={errors.birth_date}>
            {(p) => <input {...p} type="date" className={inputClass} value={values.birth_date} onChange={(e) => set("birth_date", e.target.value)} />}
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="E-mail" error={errors.email}>
            {(p) => <input {...p} type="email" className={inputClass} autoComplete="off" value={values.email} onChange={(e) => set("email", e.target.value)} />}
          </Field>
          <Field label="Telefone" error={errors.phone}>
            {(p) => <input {...p} type="tel" className={inputClass} autoComplete="off" value={values.phone} onChange={(e) => set("phone", e.target.value)} />}
          </Field>
        </div>
        <Field label="Empresa" error={errors.company} hint="Opcional.">
          {(p) => <input {...p} className={inputClass} autoComplete="off" value={values.company} onChange={(e) => set("company", e.target.value)} />}
        </Field>
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

export function Students() {
  const { profile } = useAuth();
  const toast = useToast();
  const isAdmin = profile?.role === "admin";
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query.trim());
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState<StudentRow | "new" | null>(null);
  const [removing, setRemoving] = useState<StudentRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    let request = supabase.from("students").select(COLUMNS, { count: "exact" });
    if (search) {
      // Busca por nome, e-mail ou CPF (so digitos). Virgulas e parenteses sairiam do filtro do PostgREST.
      const text = search.replace(/[,()%*]/g, " ").trim();
      const digits = onlyDigits(search);
      const clauses = [`full_name.ilike.%${text}%`, `email.ilike.%${text}%`];
      if (digits.length >= 3) clauses.push(`cpf.ilike.%${digits}%`);
      request = request.or(clauses.join(","));
    }
    const from = (page - 1) * PAGE_SIZE;
    const { data, count, error: err } = await request.order("full_name").range(from, from + PAGE_SIZE - 1);
    if (err) setError(true);
    else {
      setError(false);
      setRows(data as StudentRow[]);
      setTotal(count ?? 0);
    }
    setLoading(false);
  }, [search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => setPage(1), [search]);

  async function remove(student: StudentRow) {
    if (!supabase) return;
    setBusy(true);
    const { error: err } = await supabase.from("students").delete().eq("id", student.id);
    setBusy(false);
    if (err) {
      toast.error(dbErrorMessage(err, { inUse: "Este aluno tem matrículas ou certificados e não pode ser excluído." }));
      return;
    }
    toast.success("Aluno excluído.");
    setRemoving(null);
    await load();
  }

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Alunos"
        description="Cadastro de alunos. O CPF fica mascarado nas listas e só aparece completo na edição."
        action={
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} aria-hidden /> Novo aluno
          </Button>
        }
      />

      <div className="rounded-[15px] border border-line bg-surface p-4 shadow-sm md:p-5">
        <label className="flex h-9 items-center gap-2 rounded-[9px] border border-line px-2.5 text-muted md:max-w-sm">
          <Search size={15} aria-hidden />
          <span className="sr-only">Buscar aluno</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, e-mail ou CPF..." className="w-full min-w-0 bg-transparent text-xs text-ink outline-none placeholder:text-[#a1adc0]" />
        </label>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="bg-canvas text-[10px] font-semibold text-[#253b57]">
                <th className="rounded-l-md border-y border-line px-2.5 py-3">Aluno</th>
                <th className="border-y border-line px-2.5 py-3">CPF</th>
                <th className="border-y border-line px-2.5 py-3">E-mail</th>
                <th className="border-y border-line px-2.5 py-3">Telefone</th>
                <th className="border-y border-line px-2.5 py-3">Empresa</th>
                <th className="rounded-r-md border-y border-line px-2.5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-line text-[11px] text-[#4b5b70]">
                  <td className="px-2.5 py-3">
                    <span className="flex items-center gap-2.5 font-medium text-ink">
                      <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[#e9edf3] text-[11px] text-navy-700" aria-hidden>
                        {initials(s.full_name)}
                      </span>
                      <span className="max-w-[200px] truncate">{s.full_name}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-3">{maskCpf(s.cpf)}</td>
                  <td className="px-2.5 py-3">
                    <span className="block max-w-[200px] truncate">{s.email ?? "-"}</span>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-3">{s.phone ?? "-"}</td>
                  <td className="px-2.5 py-3">
                    <span className="block max-w-[160px] truncate">{s.company ?? "-"}</span>
                  </td>
                  <td className="px-2.5 py-3">
                    <div className="flex justify-end gap-1">
                      <button type="button" onClick={() => setEditing(s)} aria-label={`Editar ${s.full_name}`} title="Editar" className="rounded p-1.5 text-[#678099] hover:bg-canvas hover:text-navy-900">
                        <Pencil size={16} aria-hidden />
                      </button>
                      {isAdmin && (
                        <button type="button" onClick={() => setRemoving(s)} aria-label={`Excluir ${s.full_name}`} title="Excluir" className="rounded p-1.5 text-[#678099] hover:bg-canvas hover:text-danger">
                          <Trash2 size={16} aria-hidden />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-muted">
                    {loading ? "Carregando alunos..." : error ? "Não foi possível carregar os alunos." : search ? "Nenhum aluno encontrado." : "Nenhum aluno cadastrado ainda."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pager page={Math.min(page, pages)} pages={pages} total={total} shown={rows.length} onChange={setPage} />
      </div>

      {editing && (
        <StudentForm
          student={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
        />
      )}
      {removing && (
        <ConfirmDialog
          title="Excluir aluno"
          message={
            <>
              Excluir <strong className="text-ink">{removing.full_name}</strong>? Esta ação não pode ser desfeita. Alunos com matrícula ou certificado não podem ser excluídos.
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
