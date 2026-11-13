import { maskCpf } from "@olimach/schemas";
import { Badge, Button, cn } from "@olimach/ui";
import { ClipboardList, Copy, Download, Eye, KeyRound, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ConfirmDialog, Field, Modal, PageHeader, dbErrorMessage, inputClass } from "../components/ui";
import { isAdminRole, useAuth } from "../lib/auth";
import { buildCsv } from "../lib/csv";
import { SITE_URL } from "../lib/site-url";
import { supabase } from "../lib/supabase";
import { useToast } from "../lib/toast";

interface ExamRow {
  id: string;
  course_id: string;
  title: string;
  instructions: string;
  passing_score: number;
  time_limit_minutes: number | null;
  max_attempts: number;
  active: boolean;
  courses: { name: string; cover_path: string | null } | null;
  exam_questions: Array<{ count: number }>;
}

interface OptionRow {
  id: string;
  position: number;
  text: string;
  is_correct: boolean;
}
interface QuestionRow {
  id: string;
  position: number;
  text: string;
  exam_options: OptionRow[];
}

interface OverviewRow {
  id: string;
  exam_id: string;
  exam_title: string;
  course_name: string;
  student_id: string;
  student_name: string;
  student_cpf: string;
  max_attempts: number;
  expires_at: string | null;
  revoked: boolean;
  locked_until: string | null;
  created_at: string;
  attempts_used: number;
  in_progress: boolean;
  best_score: number | null;
  passed: boolean | null;
  last_finished_at: string | null;
}

const EXAM_COLUMNS = "id, course_id, title, instructions, passing_score, time_limit_minutes, max_attempts, active, courses(name, cover_path), exam_questions(count)";
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "-");
const fmtDateTime = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "-");
const questionCount = (e: ExamRow) => e.exam_questions[0]?.count ?? 0;

/* ------------------------------------------------------------------ Provas */

function ExamForm({ exam, onSaved, onClose }: { exam: ExamRow | null; onSaved: () => void; onClose: () => void }) {
  const toast = useToast();
  const [courses, setCourses] = useState<Array<{ id: string; name: string }>>([]);
  const [values, setValues] = useState({
    course_id: exam?.course_id ?? "",
    title: exam?.title ?? "",
    instructions: exam?.instructions ?? "",
    passing_score: String(exam?.passing_score ?? 70),
    time_limit_minutes: exam?.time_limit_minutes != null ? String(exam.time_limit_minutes) : "",
    max_attempts: String(exam?.max_attempts ?? 1),
    active: exam?.active ?? true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void supabase
      ?.from("courses")
      .select("id, name")
      .neq("category", "parceria")
      .order("name")
      .then(({ data }) => setCourses((data ?? []) as Array<{ id: string; name: string }>));
  }, []);

  const set = (key: keyof typeof values, value: string | boolean) => setValues((v) => ({ ...v, [key]: value }));

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    const next: Record<string, string> = {};
    const score = Number(values.passing_score);
    const attempts = Number(values.max_attempts);
    const minutes = values.time_limit_minutes === "" ? null : Number(values.time_limit_minutes);
    if (!values.course_id) next.course_id = "Escolha o treinamento.";
    if (values.title.trim().length < 3) next.title = "Informe o título da prova.";
    if (!Number.isInteger(score) || score < 0 || score > 100) next.passing_score = "Use um valor de 0 a 100.";
    if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10) next.max_attempts = "Use de 1 a 10 tentativas.";
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 480)) next.time_limit_minutes = "Use de 1 a 480 minutos.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setBusy(true);
    const payload = {
      course_id: values.course_id,
      title: values.title.trim(),
      instructions: values.instructions.trim(),
      passing_score: score,
      time_limit_minutes: minutes,
      max_attempts: attempts,
      active: values.active,
    };
    const { error } = exam ? await supabase.from("exams").update(payload).eq("id", exam.id) : await supabase.from("exams").insert(payload);
    setBusy(false);
    if (error) return void toast.error(dbErrorMessage(error, {}));
    toast.success(exam ? "Prova atualizada." : "Prova criada. Cadastre as questões.");
    onSaved();
  }

  return (
    <Modal wide title={exam ? "Editar prova" : "Nova prova"} onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Treinamento" error={errors.course_id}>
          {(p) => (
            <select {...p} className={inputClass} value={values.course_id} onChange={(e) => set("course_id", e.target.value)}>
              <option value="">Selecione...</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Título da prova" error={errors.title}>
          {(p) => <input {...p} className={inputClass} maxLength={160} value={values.title} onChange={(e) => set("title", e.target.value)} />}
        </Field>
        <Field label="Instruções ao aluno" hint="Opcional. Aparecem antes da prova.">
          {(p) => <textarea {...p} rows={3} maxLength={2000} className={cn(inputClass, "resize-y")} value={values.instructions} onChange={(e) => set("instructions", e.target.value)} />}
        </Field>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nota mínima (%)" error={errors.passing_score}>
            {(p) => <input {...p} type="number" min={0} max={100} inputMode="numeric" className={inputClass} value={values.passing_score} onChange={(e) => set("passing_score", e.target.value)} />}
          </Field>
          <Field label="Tempo (minutos)" error={errors.time_limit_minutes} hint="Vazio = sem limite.">
            {(p) => <input {...p} type="number" min={1} max={480} inputMode="numeric" className={inputClass} value={values.time_limit_minutes} onChange={(e) => set("time_limit_minutes", e.target.value)} />}
          </Field>
          <Field label="Tentativas" error={errors.max_attempts}>
            {(p) => <input {...p} type="number" min={1} max={10} inputMode="numeric" className={inputClass} value={values.max_attempts} onChange={(e) => set("max_attempts", e.target.value)} />}
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={values.active} onChange={(e) => set("active", e.target.checked)} className="h-4 w-4 accent-navy-900" /> Prova ativa (pode ser aplicada)
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

function QuestionForm({ examId, question, nextPosition, onSaved, onClose }: { examId: string; question: QuestionRow | null; nextPosition: number; onSaved: () => void; onClose: () => void }) {
  const toast = useToast();
  const initial = question ? [...question.exam_options].sort((a, b) => a.position - b.position) : [];
  const [text, setText] = useState(question?.text ?? "");
  const [options, setOptions] = useState<Array<{ text: string; correct: boolean }>>(
    initial.length > 0 ? initial.map((o) => ({ text: o.text, correct: o.is_correct })) : [{ text: "", correct: true }, { text: "", correct: false }, { text: "", correct: false }, { text: "", correct: false }],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    const filled = options.filter((o) => o.text.trim() !== "");
    if (text.trim().length < 3) return setError("Escreva o enunciado da questão.");
    if (filled.length < 2) return setError("Informe pelo menos 2 alternativas.");
    if (filled.filter((o) => o.correct).length !== 1) return setError("Marque exatamente uma alternativa correta (entre as preenchidas).");
    setError(null);
    setBusy(true);

    let questionId = question?.id ?? "";
    if (question) {
      const { error: updateError } = await supabase.from("exam_questions").update({ text: text.trim() }).eq("id", question.id);
      if (updateError) {
        setBusy(false);
        return void toast.error(dbErrorMessage(updateError, {}));
      }
      const { error: clearError } = await supabase.from("exam_options").delete().eq("question_id", question.id);
      if (clearError) {
        setBusy(false);
        return void toast.error(dbErrorMessage(clearError, {}));
      }
    } else {
      const { data, error: insertError } = await supabase.from("exam_questions").insert({ exam_id: examId, position: nextPosition, text: text.trim() }).select("id").single();
      if (insertError || !data) {
        setBusy(false);
        return void toast.error(dbErrorMessage(insertError ?? {}, {}));
      }
      questionId = (data as { id: string }).id;
    }
    const { error: optionsError } = await supabase.from("exam_options").insert(filled.map((o, i) => ({ question_id: questionId, position: i, text: o.text.trim(), is_correct: o.correct })));
    setBusy(false);
    if (optionsError) return void toast.error(dbErrorMessage(optionsError, {}));
    toast.success(question ? "Questão atualizada." : "Questão adicionada.");
    onSaved();
  }

  return (
    <Modal wide title={question ? "Editar questão" : "Nova questão"} description="Múltipla escolha com uma alternativa correta. As alternativas aparecem embaralhadas para o aluno." onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Enunciado">
          {(p) => <textarea {...p} rows={3} maxLength={1000} className={cn(inputClass, "resize-y")} value={text} onChange={(e) => setText(e.target.value)} />}
        </Field>
        <fieldset>
          <legend className="text-sm font-semibold text-navy-900">Alternativas</legend>
          <p className="mb-2 text-xs text-muted">Marque a correta. Deixe em branco as que não usar (mínimo 2).</p>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="correct"
                  checked={o.correct}
                  onChange={() => setOptions((list) => list.map((x, j) => ({ ...x, correct: i === j })))}
                  aria-label={`Alternativa ${i + 1} é a correta`}
                  className="h-4 w-4 shrink-0 accent-success"
                />
                <input
                  className={cn(inputClass, "!mt-0")}
                  maxLength={500}
                  placeholder={`Alternativa ${i + 1}`}
                  aria-label={`Texto da alternativa ${i + 1}`}
                  value={o.text}
                  onChange={(e) => setOptions((list) => list.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                />
              </div>
            ))}
          </div>
          {options.length < 6 && (
            <button type="button" className="mt-2 text-xs font-semibold text-navy-900 hover:underline" onClick={() => setOptions((list) => [...list, { text: "", correct: false }])}>
              + Adicionar alternativa
            </button>
          )}
        </fieldset>
        {error && (
          <p role="alert" className="rounded-btn-admin bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Salvando..." : "Salvar questão"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function QuestionsDialog({ exam, canEdit, onChanged, onClose }: { exam: ExamRow; canEdit: boolean; onChanged: () => void; onClose: () => void }) {
  const toast = useToast();
  const [questions, setQuestions] = useState<QuestionRow[] | null>(null);
  const [editing, setEditing] = useState<QuestionRow | "new" | null>(null);
  const [removing, setRemoving] = useState<QuestionRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("exam_questions").select("id, position, text, exam_options(id, position, text, is_correct)").eq("exam_id", exam.id).order("position").order("created_at");
    if (error) {
      toast.error("Não foi possível carregar as questões.");
      return setQuestions([]);
    }
    setQuestions((data ?? []) as unknown as QuestionRow[]);
  }, [exam.id, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove() {
    if (!supabase || !removing) return;
    setBusy(true);
    const { error } = await supabase.from("exam_questions").delete().eq("id", removing.id);
    setBusy(false);
    setRemoving(null);
    if (error) return void toast.error(dbErrorMessage(error, {}));
    toast.success("Questão excluída.");
    await load();
    onChanged();
  }

  const nextPosition = (questions ?? []).reduce((max, q) => Math.max(max, q.position + 1), 0);

  return (
    <Modal wide title={`Questões: ${exam.title}`} description={`${questions?.length ?? 0} questão(ões). Nota mínima ${exam.passing_score}%.`} onClose={onClose}>
      {canEdit && (
        <div className="mb-4">
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} aria-hidden /> Adicionar questão
          </Button>
        </div>
      )}
      {questions === null ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : questions.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma questão ainda. Sem questões a prova não pode ser aplicada.</p>
      ) : (
        <ol className="space-y-3">
          {questions.map((q, index) => (
            <li key={q.id} className="rounded-[12px] border border-line p-3.5">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-ink">
                  {index + 1}. {q.text}
                </p>
                {canEdit && (
                  <span className="flex shrink-0 gap-1">
                    <button type="button" onClick={() => setEditing(q)} className="rounded p-1 text-muted hover:bg-canvas hover:text-navy-900" aria-label={`Editar questão ${index + 1}`}>
                      <Pencil size={15} aria-hidden />
                    </button>
                    <button type="button" onClick={() => setRemoving(q)} className="rounded p-1 text-muted hover:bg-canvas hover:text-danger" aria-label={`Excluir questão ${index + 1}`}>
                      <Trash2 size={15} aria-hidden />
                    </button>
                  </span>
                )}
              </div>
              <ul className="mt-2 space-y-1 text-xs">
                {[...q.exam_options]
                  .sort((a, b) => a.position - b.position)
                  .map((o) => (
                    <li key={o.id} className={o.is_correct ? "font-semibold text-success" : "text-muted"}>
                      {o.is_correct ? "✓ " : "• "}
                      {o.text}
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ol>
      )}
      {editing && (
        <QuestionForm
          examId={exam.id}
          question={editing === "new" ? null : editing}
          nextPosition={nextPosition}
          onSaved={() => {
            setEditing(null);
            void load();
            onChanged();
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {removing && <ConfirmDialog title="Excluir questão?" message="A questão e suas alternativas serão apagadas da prova." confirmLabel="Excluir" busy={busy} onConfirm={() => void remove()} onClose={() => !busy && setRemoving(null)} />}
    </Modal>
  );
}

/** Previa da prova como o aluno a ve. Nada e gravado: a correcao e simulada aqui, so para o admin conferir. */
function ExamPreviewDialog({ exam, onClose }: { exam: ExamRow; onClose: () => void }) {
  const toast = useToast();
  const [questions, setQuestions] = useState<QuestionRow[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showKey, setShowKey] = useState(false);
  const [result, setResult] = useState<{ correct: number; total: number; score: number; passed: boolean } | null>(null);
  const [remaining, setRemaining] = useState<number | null>(exam.time_limit_minutes ? exam.time_limit_minutes * 60 : null);

  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from("exam_questions")
      .select("id, position, text, exam_options(id, position, text, is_correct)")
      .eq("exam_id", exam.id)
      .order("position")
      .then(({ data, error }) => {
        if (error) toast.error("Não foi possível carregar as questões.");
        setQuestions(((data ?? []) as unknown as QuestionRow[]).map((q) => ({ ...q, exam_options: [...q.exam_options].sort((a, b) => a.position - b.position) })));
      });
  }, [exam.id, toast]);

  useEffect(() => {
    if (remaining === null || result) return;
    const timer = setInterval(() => setRemaining((r) => (r === null ? r : Math.max(0, r - 1))), 1000);
    return () => clearInterval(timer);
  }, [remaining === null, result]); // eslint-disable-line react-hooks/exhaustive-deps

  function submit() {
    if (!questions) return;
    const correct = questions.filter((q) => q.exam_options.find((o) => o.id === answers[q.id])?.is_correct).length;
    const score = questions.length ? Math.round((correct / questions.length) * 100) : 0;
    setResult({ correct, total: questions.length, score, passed: score >= exam.passing_score });
  }

  const fmt = (sec: number) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
  const answered = Object.keys(answers).length;
  const cover = exam.courses?.cover_path && supabase ? supabase.storage.from("course-covers").getPublicUrl(exam.courses.cover_path).data.publicUrl : null;

  return (
    <Modal title={`Prévia: ${exam.title}`} description="É assim que o aluno vê a prova. Nada é salvo e o resultado é apenas uma simulação." onClose={onClose} wide>
      {questions === null ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : questions.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Esta prova ainda não tem questões.</p>
      ) : result ? (
        <div className="py-6 text-center">
          <h3 className="text-2xl text-navy-900">{result.passed ? "Aprovado!" : "Não foi dessa vez"}</h3>
          <p className="mt-3 text-4xl font-extrabold text-navy-900">{result.score}%</p>
          <p className="mt-2 text-sm text-muted">
            {result.correct} de {result.total} questões corretas. Nota mínima: {exam.passing_score}%.
          </p>
          <p className="mt-4 text-xs text-muted">Simulação: nenhuma tentativa foi registrada.</p>
          <Button className="mt-5" onClick={() => { setResult(null); setAnswers({}); setRemaining(exam.time_limit_minutes ? exam.time_limit_minutes * 60 : null); }}>
            Refazer prévia
          </Button>
        </div>
      ) : (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-canvas px-4 py-3">
            <p className="text-xs text-muted">
              Aluno exemplo · {answered}/{questions.length} respondidas · nota mínima {exam.passing_score}%
            </p>
            <div className="flex items-center gap-3">
              {remaining !== null && <span className="rounded-full bg-surface px-3 py-1 text-sm font-extrabold tabular-nums text-navy-900">{fmt(remaining)}</span>}
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" checked={showKey} onChange={(e) => setShowKey(e.target.checked)} /> Mostrar gabarito
              </label>
            </div>
          </div>
          {cover && (
            <div className="mb-4 aspect-[16/7] overflow-hidden rounded-2xl border border-line bg-canvas">
              <img src={cover} alt={`Capa do treinamento: ${exam.courses?.name ?? exam.title}`} className="h-full w-full object-cover" />
            </div>
          )}
          {exam.instructions && <p className="mb-4 whitespace-pre-line rounded-2xl bg-canvas p-4 text-sm text-muted">{exam.instructions}</p>}
          <ol className="space-y-4">
            {questions.map((q, index) => (
              <li key={q.id}>
                <fieldset className="rounded-2xl border border-line bg-surface p-4">
                  <legend className="px-1 text-sm font-bold text-navy-900">
                    {index + 1}. {q.text}
                  </legend>
                  <div className="mt-2 space-y-2">
                    {q.exam_options.map((o) => (
                      <label key={o.id} className={cn("flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm", answers[q.id] === o.id ? "border-navy-900 bg-canvas" : "border-line hover:bg-canvas", showKey && o.is_correct && "border-success bg-success/10")}>
                        <input type="radio" name={`prev-${q.id}`} checked={answers[q.id] === o.id} onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))} className="mt-0.5 h-4 w-4 shrink-0 accent-navy-900" />
                        <span>{o.text}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex justify-end">
            <Button onClick={submit}>Enviar prova (simulação)</Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ExamsTab({ canEdit }: { canEdit: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<ExamRow[] | null>(null);
  const [editing, setEditing] = useState<ExamRow | "new" | null>(null);
  const [questionsOf, setQuestionsOf] = useState<ExamRow | null>(null);
  const [previewOf, setPreviewOf] = useState<ExamRow | null>(null);
  const [removing, setRemoving] = useState<ExamRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("exams").select(EXAM_COLUMNS).order("created_at", { ascending: false });
    if (error) {
      toast.error("Não foi possível carregar as provas. Verifique se a migração das provas foi aplicada.");
      return setRows([]);
    }
    setRows((data ?? []) as unknown as ExamRow[]);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function remove() {
    if (!supabase || !removing) return;
    setBusy(true);
    const { error } = await supabase.from("exams").delete().eq("id", removing.id);
    setBusy(false);
    setRemoving(null);
    if (error) return void toast.error(dbErrorMessage(error, { inUse: "Esta prova já foi aplicada a alunos e não pode ser excluída. Desative-a." }));
    toast.success("Prova excluída.");
    await load();
  }

  return (
    <section className="rounded-[15px] border border-line bg-surface p-4 shadow-sm md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">Uma prova por treinamento (pode haver versões). Questões de múltipla escolha, corrigidas automaticamente.</p>
        {canEdit && (
          <Button onClick={() => setEditing("new")}>
            <Plus size={16} aria-hidden /> Nova prova
          </Button>
        )}
      </div>
      {rows === null ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nenhuma prova cadastrada ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <thead>
              <tr className="bg-canvas text-[10px] font-semibold text-[#253b57]">
                <th className="rounded-l-lg px-2.5 py-3">Prova</th>
                <th className="px-2.5 py-3">Treinamento</th>
                <th className="px-2.5 py-3">Questões</th>
                <th className="px-2.5 py-3">Nota mín.</th>
                <th className="px-2.5 py-3">Tempo</th>
                <th className="px-2.5 py-3">Tentativas</th>
                <th className="px-2.5 py-3">Situação</th>
                <th className="rounded-r-lg px-2.5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr key={e.id} className="border-b border-line text-[11px] text-[#4b5b70]">
                  <td className="px-2.5 py-3 font-medium text-ink">{e.title}</td>
                  <td className="px-2.5 py-3">{e.courses?.name ?? "-"}</td>
                  <td className="px-2.5 py-3">{questionCount(e)}</td>
                  <td className="px-2.5 py-3">{e.passing_score}%</td>
                  <td className="px-2.5 py-3">{e.time_limit_minutes ? `${e.time_limit_minutes} min` : "Sem limite"}</td>
                  <td className="px-2.5 py-3">{e.max_attempts}</td>
                  <td className="px-2.5 py-3">
                    <Badge tone={e.active ? "success" : "neutral"}>{e.active ? "Ativa" : "Inativa"}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-2.5 py-3 text-right">
                    <button type="button" onClick={() => setPreviewOf(e)} className="mr-1 inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-navy-900 hover:bg-canvas">
                      <Eye size={14} aria-hidden /> Visualizar
                    </button>
                    <button type="button" onClick={() => setQuestionsOf(e)} className="mr-1 inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] font-semibold text-navy-900 hover:bg-canvas">
                      <ListChecks size={14} aria-hidden /> Questões
                    </button>
                    {canEdit && (
                      <>
                        <button type="button" onClick={() => setEditing(e)} className="rounded p-1.5 text-muted hover:bg-canvas hover:text-navy-900" aria-label={`Editar ${e.title}`}>
                          <Pencil size={14} aria-hidden />
                        </button>
                        <button type="button" onClick={() => setRemoving(e)} className="rounded p-1.5 text-muted hover:bg-canvas hover:text-danger" aria-label={`Excluir ${e.title}`}>
                          <Trash2 size={14} aria-hidden />
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && (
        <ExamForm
          exam={editing === "new" ? null : editing}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
          onClose={() => setEditing(null)}
        />
      )}
      {previewOf && <ExamPreviewDialog exam={previewOf} onClose={() => setPreviewOf(null)} />}
      {questionsOf && <QuestionsDialog exam={questionsOf} canEdit={canEdit} onChanged={() => void load()} onClose={() => setQuestionsOf(null)} />}
      {removing && <ConfirmDialog title="Excluir prova?" message={`A prova "${removing.title}" e todas as suas questões serão apagadas.`} confirmLabel="Excluir" busy={busy} onConfirm={() => void remove()} onClose={() => !busy && setRemoving(null)} />}
    </section>
  );
}

/* -------------------------------------------------------------- Aplicações */

function CredentialsDialog({ studentName, token, password, onClose }: { studentName: string; token: string; password: string; onClose: () => void }) {
  const toast = useToast();
  const link = SITE_URL ? `${SITE_URL}/prova/${token}` : `/prova/${token}`;
  const message = `Olá, ${studentName.split(" ")[0]}! Seu acesso à prova online:\nLink: ${link}\nUse o seu CPF e a senha: ${password}`;

  async function copy(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${label} copiado.`);
    } catch {
      toast.error("Não foi possível copiar. Selecione o texto e copie manualmente.");
    }
  }

  return (
    <Modal wide title="Acesso gerado" description={`Prova aplicada a ${studentName}.`} onClose={onClose}>
      <p role="alert" className="mb-4 rounded-btn-admin bg-warning/15 p-3 text-xs text-ink">
        Copie agora: o link e a senha aparecem <strong>somente desta vez</strong>. Se perder, revogue esta aplicação e gere outra. O aluno entra com o link, o CPF e a senha.
      </p>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-xs text-muted">Link</dt>
          <dd className="mt-1 flex items-center gap-2">
            <code className="min-w-0 flex-1 break-all rounded-btn-admin bg-canvas px-3 py-2 text-xs">{link}</code>
            <Button variant="secondary" onClick={() => void copy(link, "Link")}>
              <Copy size={14} aria-hidden /> Copiar
            </Button>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted">Senha provisória</dt>
          <dd className="mt-1 flex items-center gap-2">
            <code className="rounded-btn-admin bg-canvas px-3 py-2 font-mono text-base font-bold tracking-widest">{password}</code>
            <Button variant="secondary" onClick={() => void copy(password, "Senha")}>
              <Copy size={14} aria-hidden /> Copiar
            </Button>
          </dd>
        </div>
      </dl>
      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <Button variant="secondary" onClick={() => void copy(message, "Mensagem")}>
          <Copy size={14} aria-hidden /> Copiar mensagem pronta (WhatsApp)
        </Button>
        <Button onClick={onClose}>Concluir</Button>
      </div>
    </Modal>
  );
}

function AssignDialog({ onCreated, onClose }: { onCreated: (result: { studentName: string; token: string; password: string }) => void; onClose: () => void }) {
  const toast = useToast();
  const [exams, setExams] = useState<ExamRow[]>([]);
  const [students, setStudents] = useState<Array<{ id: string; full_name: string; cpf: string }>>([]);
  const [filter, setFilter] = useState("");
  const [examId, setExamId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [expires, setExpires] = useState("");
  const [attempts, setAttempts] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!supabase) return;
    void supabase
      .from("exams")
      .select(EXAM_COLUMNS)
      .eq("active", true)
      .order("title")
      .then(({ data }) => setExams(((data ?? []) as unknown as ExamRow[]).filter((e) => questionCount(e) > 0)));
    void supabase
      .from("students")
      .select("id, full_name, cpf")
      .order("full_name")
      .limit(1000)
      .then(({ data }) => setStudents((data ?? []) as Array<{ id: string; full_name: string; cpf: string }>));
  }, []);

  const shown = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return students.filter((s) => !term || s.full_name.toLowerCase().includes(term) || s.cpf.includes(term.replace(/\D/g, "") || "x"));
  }, [students, filter]);
  const exam = exams.find((e) => e.id === examId);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    if (!examId) return setError("Escolha a prova.");
    if (!studentId) return setError("Escolha o aluno.");
    const max = attempts === "" ? null : Number(attempts);
    if (max !== null && (!Number.isInteger(max) || max < 1 || max > 10)) return setError("Tentativas: use de 1 a 10.");
    setError(null);
    setBusy(true);
    const { data, error: rpcError } = await supabase.rpc("create_exam_assignment", {
      p_exam_id: examId,
      p_student_id: studentId,
      p_expires_at: expires ? new Date(`${expires}T23:59:59`).toISOString() : null,
      p_max_attempts: max,
    });
    setBusy(false);
    const row = Array.isArray(data) ? (data[0] as { token: string; password: string } | undefined) : undefined;
    if (rpcError || !row) {
      toast.error(rpcError?.message?.includes("questoes") ? "A prova ainda não tem questões." : dbErrorMessage(rpcError ?? {}, {}));
      return;
    }
    onCreated({ studentName: students.find((s) => s.id === studentId)?.full_name ?? "", token: row.token, password: row.password });
  }

  return (
    <Modal wide title="Aplicar prova" description="Gera um link único e uma senha provisória para o aluno." onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Prova" hint={exams.length === 0 ? "Nenhuma prova ativa com questões." : undefined}>
          {(p) => (
            <select
              {...p}
              className={inputClass}
              value={examId}
              onChange={(e) => {
                setExamId(e.target.value);
                setAttempts("");
              }}
            >
              <option value="">Selecione...</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} ({e.courses?.name})
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field label="Aluno" hint={`${shown.length} aluno(s). Filtre por nome ou CPF.`}>
          {(p) => (
            <>
              <input {...p} className={inputClass} placeholder="Filtrar..." value={filter} onChange={(e) => setFilter(e.target.value)} />
              <select aria-label="Aluno" size={5} className={cn(inputClass, "!mt-2")} value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                {shown.slice(0, 200).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} ({maskCpf(s.cpf)})
                  </option>
                ))}
              </select>
            </>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Válida até" hint="Opcional. Vazio = sem prazo.">
            {(p) => <input {...p} type="date" className={inputClass} value={expires} onChange={(e) => setExpires(e.target.value)} />}
          </Field>
          <Field label="Tentativas" hint={exam ? `Padrão da prova: ${exam.max_attempts}.` : undefined}>
            {(p) => <input {...p} type="number" min={1} max={10} inputMode="numeric" className={inputClass} placeholder={exam ? String(exam.max_attempts) : ""} value={attempts} onChange={(e) => setAttempts(e.target.value)} />}
          </Field>
        </div>
        {error && (
          <p role="alert" className="rounded-btn-admin bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            <KeyRound size={15} aria-hidden /> {busy ? "Gerando..." : "Gerar acesso"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function resultOf(r: OverviewRow): { label: string; tone: "success" | "warning" | "danger" | "neutral" } {
  if (r.revoked) return { label: "Revogada", tone: "neutral" };
  if (r.passed) return { label: "Aprovado", tone: "success" };
  if (r.attempts_used > 0 && r.attempts_used >= r.max_attempts) return { label: "Reprovado", tone: "danger" };
  if (r.expires_at && new Date(r.expires_at) < new Date() && r.attempts_used === 0) return { label: "Expirada", tone: "neutral" };
  if (r.in_progress) return { label: "Em andamento", tone: "warning" };
  if (r.attempts_used > 0) return { label: "Reprovado (restam tentativas)", tone: "warning" };
  return { label: "Aguardando", tone: "neutral" };
}

function AssignmentsTab({ canAssign, canDelete }: { canAssign: boolean; canDelete: boolean }) {
  const toast = useToast();
  const [rows, setRows] = useState<OverviewRow[] | null>(null);
  const [query, setQuery] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [credentials, setCredentials] = useState<{ studentName: string; token: string; password: string } | null>(null);
  const [revoking, setRevoking] = useState<OverviewRow | null>(null);
  const [deleting, setDeleting] = useState<OverviewRow | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase.from("exam_assignments_overview").select("*").order("created_at", { ascending: false }).limit(500);
    if (error) {
      toast.error("Não foi possível carregar as aplicações. Verifique se a migração das provas foi aplicada.");
      return setRows([]);
    }
    setRows((data ?? []) as OverviewRow[]);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const shown = useMemo(() => {
    const term = query.trim().toLowerCase();
    return (rows ?? []).filter((r) => !term || `${r.student_name} ${r.exam_title} ${r.course_name}`.toLowerCase().includes(term));
  }, [rows, query]);

  async function revoke() {
    if (!supabase || !revoking) return;
    setBusy(true);
    const { error } = await supabase.rpc("revoke_exam_assignment", { p_id: revoking.id });
    setBusy(false);
    setRevoking(null);
    if (error) return void toast.error(dbErrorMessage(error, {}));
    toast.success("Acesso revogado.");
    await load();
  }

  async function remove() {
    if (!supabase || !deleting) return;
    setBusy(true);
    const { error } = await supabase.rpc("delete_exam_assignment", { p_id: deleting.id });
    setBusy(false);
    setDeleting(null);
    if (error) return void toast.error(dbErrorMessage(error, {}));
    toast.success("Aplicação excluída.");
    await load();
  }

  function exportCsv() {
    const csv = buildCsv(
      ["Aluno", "CPF", "Prova", "Treinamento", "Situação", "Tentativas usadas", "Tentativas permitidas", "Melhor nota (%)", "Última conclusão", "Prazo", "Criada em"],
      shown.map((r) => [r.student_name, maskCpf(r.student_cpf), r.exam_title, r.course_name, resultOf(r).label, String(r.attempts_used), String(r.max_attempts), r.best_score != null ? String(r.best_score).replace(".", ",") : "", fmtDateTime(r.last_finished_at), fmtDate(r.expires_at), fmtDate(r.created_at)]),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `resultados-provas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="rounded-[15px] border border-line bg-surface p-4 shadow-sm md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-[9px] border border-line px-3 text-muted sm:max-w-sm">
          <span className="sr-only">Filtrar aplicações</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar por aluno, prova ou treinamento..." className="w-full min-w-0 bg-transparent text-xs text-ink outline-none placeholder:text-[#a1adc0]" />
        </label>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportCsv} disabled={shown.length === 0}>
            <Download size={15} aria-hidden /> Exportar CSV
          </Button>
          {canAssign && (
            <Button onClick={() => setAssigning(true)}>
              <Plus size={16} aria-hidden /> Aplicar prova
            </Button>
          )}
        </div>
      </div>
      {rows === null ? (
        <p className="text-sm text-muted">Carregando...</p>
      ) : shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Nenhuma aplicação ainda. Use "Aplicar prova" para matricular um aluno.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left">
            <thead>
              <tr className="bg-canvas text-[10px] font-semibold text-[#253b57]">
                <th className="rounded-l-lg px-2.5 py-3">Aluno</th>
                <th className="px-2.5 py-3">Prova</th>
                <th className="px-2.5 py-3">Situação</th>
                <th className="px-2.5 py-3">Tentativas</th>
                <th className="px-2.5 py-3">Melhor nota</th>
                <th className="px-2.5 py-3">Concluída em</th>
                <th className="px-2.5 py-3">Prazo</th>
                <th className="rounded-r-lg px-2.5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const status = resultOf(r);
                const locked = r.locked_until && new Date(r.locked_until) > new Date();
                return (
                  <tr key={r.id} className="border-b border-line text-[11px] text-[#4b5b70]">
                    <td className="px-2.5 py-3">
                      <span className="font-medium text-ink">{r.student_name}</span>
                      <span className="block text-[10px] text-muted">{maskCpf(r.student_cpf)}</span>
                    </td>
                    <td className="px-2.5 py-3">
                      {r.exam_title}
                      <span className="block text-[10px] text-muted">{r.course_name}</span>
                    </td>
                    <td className="px-2.5 py-3">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {locked && <span className="mt-1 block text-[10px] text-danger">Bloqueado (erros de acesso)</span>}
                    </td>
                    <td className="px-2.5 py-3">
                      {r.attempts_used}/{r.max_attempts}
                    </td>
                    <td className="px-2.5 py-3 font-semibold text-ink">{r.best_score != null ? `${r.best_score}%` : "-"}</td>
                    <td className="px-2.5 py-3">{fmtDateTime(r.last_finished_at)}</td>
                    <td className="px-2.5 py-3">{fmtDate(r.expires_at)}</td>
                    <td className="px-2.5 py-3 text-right">
                      {!r.revoked && canAssign && (
                        <button type="button" onClick={() => setRevoking(r)} className="mr-2 text-[11px] font-semibold text-danger hover:underline">
                          Revogar
                        </button>
                      )}
                      {canDelete && (
                        <button type="button" onClick={() => setDeleting(r)} className="inline-flex rounded p-1.5 align-middle text-muted hover:bg-canvas hover:text-danger" aria-label={`Excluir aplicação de ${r.student_name}`}>
                          <Trash2 size={14} aria-hidden />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {assigning && (
        <AssignDialog
          onCreated={(result) => {
            setAssigning(false);
            setCredentials(result);
            void load();
          }}
          onClose={() => setAssigning(false)}
        />
      )}
      {credentials && <CredentialsDialog {...credentials} onClose={() => setCredentials(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Excluir aplicação?"
          message={`A aplicação de "${deleting.exam_title}" para ${deleting.student_name} será apagada${deleting.attempts_used > 0 ? `, junto com ${deleting.attempts_used} resultado(s) registrado(s)` : ""}. O link deixa de funcionar. Não dá para desfazer.`}
          confirmLabel="Excluir"
          busy={busy}
          onConfirm={() => void remove()}
          onClose={() => !busy && setDeleting(null)}
        />
      )}
      {revoking && (
        <ConfirmDialog
          title="Revogar acesso?"
          message={`${revoking.student_name} deixa de poder abrir "${revoking.exam_title}" com este link. Resultados já registrados são mantidos.`}
          confirmLabel="Revogar"
          busy={busy}
          onConfirm={() => void revoke()}
          onClose={() => !busy && setRevoking(null)}
        />
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ Página */

type Tab = "applications" | "exams";

export function Exams() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>("applications");
  const isAdmin = isAdminRole(profile?.role);
  const tabs: Array<{ id: Tab; label: string; icon: typeof ClipboardList }> = [
    { id: "applications", label: "Aplicações e resultados", icon: ClipboardList },
    { id: "exams", label: "Provas e questões", icon: ListChecks },
  ];

  return (
    <div>
      <PageHeader title="Provas" description="Aplique provas online aos alunos por link e senha e acompanhe os resultados." />
      <div role="tablist" aria-label="Provas" className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={cn("inline-flex items-center gap-1.5 rounded-lg border px-3.5 py-2 text-xs", tab === t.id ? "border-navy-900 bg-navy-900 font-bold text-white" : "border-line bg-surface text-muted hover:bg-canvas")}
          >
            <t.icon size={14} aria-hidden /> {t.label}
          </button>
        ))}
      </div>
      {tab === "applications" ? <AssignmentsTab canAssign canDelete={isAdmin} /> : <ExamsTab canEdit={isAdmin} />}
    </div>
  );
}
