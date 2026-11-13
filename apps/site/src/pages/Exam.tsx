import { formatCpf } from "@olimach/schemas";
import { buttonClasses } from "@olimach/ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useParams } from "react-router-dom";
import { examCoverUrl, startExam, submitExam } from "../lib/exam";
import type { ExamSession, SubmitResult } from "../lib/exam";

const inputClass = "mt-1.5 w-full rounded-xl border border-line bg-surface px-3.5 py-3 text-sm text-ink outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";

const messages: Record<string, string> = {
  invalid: "Não foi possível entrar. Confira o CPF e a senha, ou peça um novo acesso à equipe.",
  unavailable: "Esta prova não está mais disponível. Fale com a equipe.",
  locked: "Acesso bloqueado por alguns minutos após erros seguidos. Tente novamente mais tarde.",
  rate_limited: "Muitas tentativas em pouco tempo. Aguarde um minuto e tente de novo.",
  no_attempts: "Você já usou todas as tentativas desta prova.",
};

function formatTime(seconds: number): string {
  const s = Math.max(0, seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h > 0 ? `${h}:` : ""}${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/** Pagina da prova do aluno (/prova/:token). Nao indexada; nenhum dado pessoal na URL. */
export function Exam() {
  const { token = "" } = useParams();
  const storageKey = `prova:${token.slice(0, 16)}`;
  const [cpf, setCpf] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<ExamSession | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const offset = useRef(0);
  const submitted = useRef(false);

  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  // retoma a prova se a pagina for recarregada (so nesta aba)
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (!saved) return;
      const data = JSON.parse(saved) as { session: ExamSession; answers: Record<string, string> };
      offset.current = new Date(data.session.server_now).getTime() - Date.now();
      setSession(data.session);
      setAnswers(data.answers ?? {});
    } catch {
      /* sem armazenamento: o aluno entra de novo */
    }
  }, [storageKey]);

  useEffect(() => {
    if (!session) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify({ session, answers }));
    } catch {
      /* ignorar */
    }
  }, [session, answers, storageKey]);

  const finish = useCallback(
    async (current: ExamSession, given: Record<string, string>) => {
      if (submitted.current) return;
      submitted.current = true;
      setBusy(true);
      setError(null);
      try {
        const res = await submitExam(current.attempt_key, given);
        if (res.status === "ok") {
          setResult(res);
          setSession(null);
          try {
            sessionStorage.removeItem(storageKey);
          } catch {
            /* ignorar */
          }
        } else {
          submitted.current = false;
          setError(res.status === "rate_limited" ? messages.rate_limited : "Não foi possível enviar a prova. Tente de novo.");
        }
      } catch {
        submitted.current = false;
        setError("Sem conexão. Verifique a internet e clique em Enviar de novo; suas respostas estão guardadas.");
      } finally {
        setBusy(false);
        setConfirming(false);
      }
    },
    [storageKey],
  );

  // cronometro pelo relogio do servidor; ao zerar, envia sozinho
  const deadline = session?.deadline_at ? new Date(session.deadline_at).getTime() : null;
  useEffect(() => {
    if (!session || deadline === null) return setRemaining(null);
    const tick = () => {
      const left = Math.round((deadline - (Date.now() + offset.current)) / 1000);
      setRemaining(left);
      if (left <= 0) void finish(session, answers);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, deadline]);

  async function onLogin(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (cpf.replace(/\D/g, "").length !== 11 || password.trim().length < 4) return setError("Informe o CPF completo e a senha.");
    setBusy(true);
    try {
      const res = await startExam(token, cpf, password);
      if (res.status === "ok") {
        offset.current = new Date(res.server_now).getTime() - Date.now();
        submitted.current = false;
        setAnswers({});
        setSession(res);
      } else {
        setError(messages[res.status] ?? messages.invalid);
      }
    } catch {
      setError("Não foi possível conectar. Tente novamente em instantes.");
    } finally {
      setBusy(false);
    }
  }

  const answered = useMemo(() => Object.keys(answers).length, [answers]);

  /* ------------------------------------------------------------- resultado */
  if (result) {
    return (
      <section className="mx-auto max-w-xl px-5 py-16 text-center">
        <h1 className="text-3xl text-navy-900">{result.passed ? "Aprovado!" : "Não foi dessa vez"}</h1>
        <p className="mt-4 text-5xl font-extrabold text-navy-900" aria-label={`Nota ${result.score} por cento`}>
          {result.score}%
        </p>
        <p className="mt-3 text-sm text-muted">
          {result.correct} de {result.total} questões corretas. Nota mínima: {result.passing_score}%.
        </p>
        {result.late && <p className="mt-3 text-sm text-danger">O tempo da prova terminou antes do envio.</p>}
        <p className="mt-6 text-sm text-muted">O resultado foi registrado. Você já pode fechar esta página.</p>
      </section>
    );
  }

  /* ----------------------------------------------------------------- prova */
  if (session) {
    const low = remaining !== null && remaining <= 60;
    const cover = examCoverUrl(session.exam.cover_path);
    return (
      <section className="mx-auto max-w-3xl px-5 py-10">
        {cover && (
          <div className="mb-6 aspect-[16/7] overflow-hidden rounded-2xl border border-line bg-canvas">
            <img src={cover} alt={`Capa do treinamento: ${session.exam.title}`} className="h-full w-full object-cover" />
          </div>
        )}
        <div className="sticky top-[74px] z-20 -mx-2 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-sm backdrop-blur">
          <div>
            <h1 className="text-lg text-navy-900">{session.exam.title}</h1>
            <p className="text-xs text-muted">
              {session.student_name} · {answered}/{session.questions.length} respondidas · nota mínima {session.exam.passing_score}%
            </p>
          </div>
          {remaining !== null && (
            <p className={`rounded-full px-4 py-1.5 text-sm font-extrabold tabular-nums ${low ? "bg-danger/10 text-danger" : "bg-canvas text-navy-900"}`} role="timer" aria-label="Tempo restante">
              {formatTime(remaining)}
            </p>
          )}
        </div>

        {session.exam.instructions && <p className="mb-6 whitespace-pre-line rounded-2xl bg-canvas p-4 text-sm text-muted">{session.exam.instructions}</p>}

        <ol className="space-y-5">
          {session.questions.map((q, index) => (
            <li key={q.id}>
              <fieldset className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
                <legend className="px-1 text-sm font-bold text-navy-900">
                  {index + 1}. {q.text}
                </legend>
                <div className="mt-2 space-y-2">
                  {q.options.map((o) => (
                    <label key={o.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm ${answers[q.id] === o.id ? "border-navy-900 bg-canvas" : "border-line hover:bg-canvas"}`}>
                      <input type="radio" name={q.id} value={o.id} checked={answers[q.id] === o.id} onChange={() => setAnswers((a) => ({ ...a, [q.id]: o.id }))} className="mt-0.5 h-4 w-4 shrink-0 accent-navy-900" />
                      <span>{o.text}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </li>
          ))}
        </ol>

        {error && (
          <p role="alert" className="mt-5 rounded-xl bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">{answered < session.questions.length ? `Faltam ${session.questions.length - answered} questão(ões) sem resposta.` : "Todas as questões respondidas."}</p>
          {confirming ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-ink">Enviar agora? Não dá para alterar depois.</span>
              <button type="button" className={buttonClasses("secondary", "landing")} onClick={() => setConfirming(false)} disabled={busy}>
                Voltar
              </button>
              <button type="button" className={buttonClasses("accent", "landing")} onClick={() => void finish(session, answers)} disabled={busy}>
                {busy ? "Enviando..." : "Confirmar envio"}
              </button>
            </div>
          ) : (
            <button type="button" className={buttonClasses("accent", "landing")} onClick={() => setConfirming(true)} disabled={busy}>
              Enviar prova
            </button>
          )}
        </div>
      </section>
    );
  }

  /* ----------------------------------------------------------------- acesso */
  return (
    <section className="mx-auto max-w-md px-5 py-16">
      <h1 className="text-3xl text-navy-900">Prova online</h1>
      <p className="mt-2 text-sm text-muted">Entre com o seu CPF e a senha que você recebeu junto com este link.</p>
      <form onSubmit={onLogin} noValidate className="mt-6 space-y-4 rounded-2xl border border-line bg-surface p-6 shadow-sm">
        <div>
          <label htmlFor="exam-cpf" className="text-sm font-semibold text-navy-900">
            CPF
          </label>
          <input id="exam-cpf" inputMode="numeric" autoComplete="off" placeholder="000.000.000-00" className={inputClass} value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} />
        </div>
        <div>
          <label htmlFor="exam-password" className="text-sm font-semibold text-navy-900">
            Senha
          </label>
          <input id="exam-password" type="password" autoComplete="off" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">
            {error}
          </p>
        )}
        <button type="submit" className={`${buttonClasses("accent", "landing")} w-full justify-center`} disabled={busy}>
          {busy ? "Verificando..." : "Entrar na prova"}
        </button>
        <p className="text-center text-[11px] text-muted">Se a prova tiver tempo limite, o cronômetro começa ao entrar.</p>
      </form>
    </section>
  );
}
