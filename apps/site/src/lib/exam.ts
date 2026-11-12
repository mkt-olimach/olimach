const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, "");
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export interface ExamOption {
  id: string;
  text: string;
}
export interface ExamQuestion {
  id: string;
  text: string;
  options: ExamOption[];
}
export interface ExamSession {
  attempt_key: string;
  student_name: string;
  exam: { title: string; instructions: string; passing_score: number; time_limit_minutes: number | null; max_attempts: number };
  deadline_at: string | null;
  server_now: string;
  questions: ExamQuestion[];
}
export type StartResult = { status: "ok" } & ExamSession | { status: "invalid" | "unavailable" | "locked" | "rate_limited" | "no_attempts"; student_name?: string };
export interface SubmitResult {
  status: "ok" | "invalid" | "rate_limited";
  score?: number;
  passed?: boolean;
  correct?: number;
  total?: number;
  passing_score?: number;
  late?: boolean;
}

async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  if (!url || !anonKey) throw new Error("not_configured");
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${name} ${response.status}`);
  return (await response.json()) as T;
}

/** Abre a prova: o servidor confere token, CPF e senha e devolve as questoes SEM gabarito. */
export const startExam = (token: string, cpf: string, password: string) => rpc<StartResult>("exam_start", { p_token: token, p_cpf: cpf, p_password: password });

/** Envia as respostas ({ idDaQuestao: idDaAlternativa }); a correcao e feita no servidor. */
export const submitExam = (attemptKey: string, answers: Record<string, string>) => rpc<SubmitResult>("exam_submit", { p_attempt_key: attemptKey, p_answers: answers });
