import { canIssueCertificate, maskCpf, onlyDigits } from "@olimach/schemas";
import type { CourseCategory } from "@olimach/schemas";
import { Badge, Button } from "@olimach/ui";
import { ArrowLeft, Pencil, Plus, Search, Trash2, UserMinus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ConfirmDialog, dbErrorMessage, useDebouncedValue } from "../components/ui";
import { classStatusLabel, classStatusTone, formatPeriod } from "../lib/classes";
import type { ClassStatus } from "../lib/classes";
import { isAdminRole, useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { useToast } from "../lib/toast";
import { ClassForm } from "./Classes";
import type { ClassFormData } from "./Classes";

interface EnrollmentRow {
  id: string;
  attendance_ok: boolean;
  approved: boolean;
  student: { id: string; full_name: string; cpf: string } | null;
  certificates: Array<{ code: string; status: "valid" | "revoked" }>;
}

interface ClassDetailData {
  id: string;
  course_id: string;
  start_date: string;
  end_date: string;
  location: string;
  status: ClassStatus;
  course: { name: string; category: CourseCategory; workload_hours: number } | null;
  class_instructors: Array<{ instructor_id: string; instructor: { name: string } | null }>;
  enrollments: EnrollmentRow[];
}

interface StudentOption {
  id: string;
  full_name: string;
  cpf: string;
}

const SELECT =
  "id, course_id, start_date, end_date, location, status, course:courses(name, category, workload_hours), class_instructors(instructor_id, instructor:instructors(name)), enrollments(id, attendance_ok, approved, student:students(id, full_name, cpf), certificates(code, status))";

function StudentPicker({ enrolledIds, onPick }: { enrolledIds: Set<string>; onPick: (student: StudentOption) => void }) {
  const [query, setQuery] = useState("");
  const search = useDebouncedValue(query.trim());
  const [results, setResults] = useState<StudentOption[]>([]);

  useEffect(() => {
    if (!supabase || search.length < 2) {
      setResults([]);
      return;
    }
    const text = search.replace(/[,()%*]/g, " ").trim();
    const digits = onlyDigits(search);
    const clauses = [`full_name.ilike.%${text}%`];
    if (digits.length >= 3) clauses.push(`cpf.ilike.%${digits}%`);
    let cancelled = false;
    void supabase
      .from("students")
      .select("id, full_name, cpf")
      .or(clauses.join(","))
      .order("full_name")
      .limit(8)
      .then(({ data }) => {
        if (!cancelled) setResults((data ?? []) as StudentOption[]);
      });
    return () => {
      cancelled = true;
    };
  }, [search]);

  const available = results.filter((s) => !enrolledIds.has(s.id));

  return (
    <div>
      <label className="flex h-10 items-center gap-2 rounded-[9px] border border-line px-3 text-muted">
        <Search size={15} aria-hidden />
        <span className="sr-only">Buscar aluno para matricular</span>
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar aluno por nome ou CPF para matricular..." className="w-full min-w-0 bg-transparent text-xs text-ink outline-none placeholder:text-[#a1adc0]" />
      </label>
      {search.length >= 2 && (
        <ul className="mt-2 divide-y divide-line rounded-btn-admin border border-line bg-surface">
          {available.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2 text-xs">
              <span>
                <span className="font-medium text-ink">{s.full_name}</span>
                <span className="ml-2 text-muted">{maskCpf(s.cpf)}</span>
              </span>
              <button type="button" onClick={() => onPick(s)} className="inline-flex items-center gap-1 rounded-lg bg-navy-900 px-2.5 py-1.5 font-semibold text-white hover:bg-navy-700">
                <Plus size={13} aria-hidden /> Matricular
              </button>
            </li>
          ))}
          {available.length === 0 && (
            <li className="px-3 py-3 text-xs text-muted">
              Nenhum aluno encontrado fora da turma. Cadastre em <Link to="/alunos" className="font-semibold text-brand-500 hover:underline">Alunos</Link>.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export function ClassDetail() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { profile } = useAuth();
  const isAdmin = isAdminRole(profile?.role);
  const [data, setData] = useState<ClassDetailData | null>(null);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState(false);
  const [editing, setEditing] = useState(false);
  const [removingClass, setRemovingClass] = useState(false);
  const [removingEnrollment, setRemovingEnrollment] = useState<EnrollmentRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data: row, error: err } = await supabase.from("classes").select(SELECT).eq("id", id).maybeSingle();
    if (err || !row) setError(true);
    else {
      setError(false);
      setData(row as unknown as ClassDetailData);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function enroll(student: StudentOption) {
    if (!supabase) return;
    const { error: err } = await supabase.from("enrollments").insert({ class_id: id, student_id: student.id });
    if (err) {
      toast.error(dbErrorMessage(err, { unique: "Este aluno já está matriculado nesta turma." }));
      return;
    }
    toast.success(`${student.full_name} matriculado.`);
    await load();
  }

  /** Aprovacao exige presenca: desmarcar a presenca desmarca a aprovacao. */
  async function update(row: EnrollmentRow, patch: { attendance_ok?: boolean; approved?: boolean }) {
    if (!supabase) return;
    const next = { ...patch };
    if (next.attendance_ok === false) next.approved = false;
    setData((cur) => (cur ? { ...cur, enrollments: cur.enrollments.map((e) => (e.id === row.id ? { ...e, ...next } : e)) } : cur));
    const { error: err } = await supabase.from("enrollments").update(next).eq("id", row.id);
    if (err) {
      toast.error(dbErrorMessage(err, {}));
      await load();
    }
  }

  async function removeEnrollment(row: EnrollmentRow) {
    if (!supabase) return;
    setBusy(true);
    const { error: err } = await supabase.from("enrollments").delete().eq("id", row.id);
    setBusy(false);
    if (err) {
      toast.error(dbErrorMessage(err, { inUse: "Este aluno já tem certificado emitido nesta turma e não pode ser desmatriculado." }));
      return;
    }
    toast.success("Matrícula removida.");
    setRemovingEnrollment(null);
    await load();
  }

  async function removeClass() {
    if (!supabase) return;
    setBusy(true);
    const { error: err } = await supabase.from("classes").delete().eq("id", id);
    setBusy(false);
    if (err) {
      toast.error(dbErrorMessage(err, { inUse: "Esta turma tem alunos matriculados. Remova as matrículas ou marque a turma como cancelada." }));
      return;
    }
    toast.success("Turma excluída.");
    navigate("/turmas", { replace: true });
  }

  if (loading) return <p className="text-sm text-muted">Carregando turma...</p>;
  if (error || !data) {
    return (
      <div>
        <Link to="/turmas" className="inline-flex items-center gap-2 text-sm font-semibold text-brand-500 hover:underline">
          <ArrowLeft size={16} aria-hidden /> Voltar para turmas
        </Link>
        <p className="mt-4 text-sm text-muted">Turma não encontrada ou sem acesso.</p>
      </div>
    );
  }

  const category = data.course?.category;
  const issues = category ? canIssueCertificate(category) : true;
  const enrolledIds = new Set(data.enrollments.map((e) => e.student?.id).filter((v): v is string => Boolean(v)));
  const formData: ClassFormData = {
    id: data.id,
    course_id: data.course_id,
    start_date: data.start_date,
    end_date: data.end_date,
    location: data.location,
    status: data.status,
    instructorIds: data.class_instructors.map((i) => i.instructor_id),
  };

  return (
    <div>
      <Link to="/turmas" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-brand-500 hover:underline">
        <ArrowLeft size={16} aria-hidden /> Turmas
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-[28px]">{data.course?.name ?? "Turma"}</h1>
          <p className="mt-1 text-sm text-muted">
            {formatPeriod(data.start_date, data.end_date)} · {data.location}
            {data.course ? ` · ${data.course.workload_hours} h` : ""}
          </p>
          <p className="mt-1 text-xs text-muted">Instrutores: {data.class_instructors.map((i) => i.instructor?.name).filter(Boolean).join(", ") || "nenhum vinculado"}</p>
          <div className="mt-2">
            <Badge tone={classStatusTone[data.status]}>{classStatusLabel[data.status]}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setEditing(true)}>
            <Pencil size={15} aria-hidden /> Editar
          </Button>
          {isAdmin && (
            <Button variant="secondary" onClick={() => setRemovingClass(true)} className="text-danger">
              <Trash2 size={15} aria-hidden /> Excluir
            </Button>
          )}
        </div>
      </div>

      {!issues && <p className="mb-4 rounded-btn-admin bg-canvas p-3 text-xs text-muted">Treinamento em parceria: esta turma não emite certificado.</p>}

      <section className="rounded-[15px] border border-line bg-surface p-4 shadow-sm md:p-5" aria-label="Alunos matriculados">
        <h2 className="mb-1 text-base">Alunos matriculados ({data.enrollments.length})</h2>
        <p className="mb-4 text-xs text-muted">A aprovação só pode ser marcada com presença. Os dois são requisitos para emitir o certificado.</p>

        <StudentPicker enrolledIds={enrolledIds} onPick={(s) => void enroll(s)} />

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead>
              <tr className="bg-canvas text-[10px] font-semibold text-[#253b57]">
                <th className="rounded-l-md border-y border-line px-2.5 py-3">Aluno</th>
                <th className="border-y border-line px-2.5 py-3">CPF</th>
                <th className="border-y border-line px-2.5 py-3">Presença</th>
                <th className="border-y border-line px-2.5 py-3">Aprovado</th>
                <th className="border-y border-line px-2.5 py-3">Certificado</th>
                <th className="rounded-r-md border-y border-line px-2.5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {data.enrollments.map((e) => {
                const cert = e.certificates.find((c) => c.status === "valid") ?? e.certificates[0];
                const locked = Boolean(cert);
                return (
                  <tr key={e.id} className="border-b border-line text-[11px] text-[#4b5b70]">
                    <td className="px-2.5 py-3 font-medium text-ink">{e.student?.full_name ?? "-"}</td>
                    <td className="whitespace-nowrap px-2.5 py-3">{e.student ? maskCpf(e.student.cpf) : "-"}</td>
                    <td className="px-2.5 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#0B1F4D]"
                        aria-label={`Presença de ${e.student?.full_name ?? "aluno"}`}
                        checked={e.attendance_ok}
                        disabled={locked}
                        title={locked ? "Certificado já emitido" : undefined}
                        onChange={(ev) => void update(e, { attendance_ok: ev.target.checked })}
                      />
                    </td>
                    <td className="px-2.5 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[#0B1F4D]"
                        aria-label={`Aprovação de ${e.student?.full_name ?? "aluno"}`}
                        checked={e.approved}
                        disabled={locked || !e.attendance_ok}
                        title={locked ? "Certificado já emitido" : !e.attendance_ok ? "Marque a presença primeiro" : undefined}
                        onChange={(ev) => void update(e, { approved: ev.target.checked })}
                      />
                    </td>
                    <td className="px-2.5 py-3">
                      {cert ? (
                        <Badge tone={cert.status === "valid" ? "success" : "danger"}>{cert.status === "valid" ? `Emitido ${cert.code}` : `Revogado ${cert.code}`}</Badge>
                      ) : !issues ? (
                        <span className="text-muted">Não se aplica</span>
                      ) : e.attendance_ok && e.approved ? (
                        <Link to={`/certificados?emitir=${e.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-navy-900 px-2.5 py-1.5 font-semibold text-white hover:bg-navy-700">
                          Emitir certificado
                        </Link>
                      ) : (
                        <span className="text-muted">Aguardando</span>
                      )}
                    </td>
                    <td className="px-2.5 py-3">
                      <div className="flex justify-end">
                        {isAdmin ? (
                          <button type="button" onClick={() => setRemovingEnrollment(e)} aria-label={`Remover matrícula de ${e.student?.full_name ?? "aluno"}`} title="Remover matrícula" className="rounded p-1.5 text-[#678099] hover:bg-canvas hover:text-danger">
                            <UserMinus size={16} aria-hidden />
                          </button>
                        ) : (
                          <span className="text-[10px] text-muted">-</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {data.enrollments.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-xs text-muted">
                    Nenhum aluno matriculado. Use a busca acima para matricular.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {editing && (
        <ClassForm
          initial={formData}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            void load();
          }}
        />
      )}
      {removingEnrollment && (
        <ConfirmDialog
          title="Remover matrícula"
          message={
            <>
              Remover <strong className="text-ink">{removingEnrollment.student?.full_name}</strong> desta turma? A presença e a aprovação registradas serão perdidas.
            </>
          }
          confirmLabel="Remover"
          busy={busy}
          onConfirm={() => void removeEnrollment(removingEnrollment)}
          onClose={() => setRemovingEnrollment(null)}
        />
      )}
      {removingClass && (
        <ConfirmDialog
          title="Excluir turma"
          message="Excluir esta turma? Esta ação não pode ser desfeita. Turmas com alunos matriculados não podem ser excluídas."
          confirmLabel="Excluir"
          busy={busy}
          onConfirm={() => void removeClass()}
          onClose={() => setRemovingClass(false)}
        />
      )}
    </div>
  );
}
