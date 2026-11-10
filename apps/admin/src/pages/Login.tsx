import { emailSchema } from "@olimach/schemas";
import { BrandLogo, Button } from "@olimach/ui";
import { LogIn, Mail } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { AuroraBackground } from "../components/AuroraBackground";
import { useAuth } from "../lib/auth";

/* three.js so e baixado quando o crachá aparece (telas largas). */
const Lanyard = lazy(() => import("../components/Lanyard/Lanyard"));

export function Login() {
  const { session, configured, signIn, requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const notice = (useLocation().state as { notice?: string } | null)?.notice ?? null;
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/" replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const message = await signIn(email.trim(), password);
    setBusy(false);
    if (message) setError(message);
    else navigate("/", { replace: true });
  }

  async function onForgot(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Informe um e-mail válido.");
      return;
    }
    setBusy(true);
    const message = await requestPasswordReset(parsed.data);
    setBusy(false);
    if (message) setError(message);
    else setSent(true);
  }

  function switchMode(next: "login" | "forgot") {
    setMode(next);
    setError(null);
    setSent(false);
  }

  const field =
    "mt-1.5 w-full rounded-btn-admin border border-line bg-surface px-3 py-2.5 text-sm text-ink outline-none placeholder:text-[#a1adc0] focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20";
  const label = "text-sm font-semibold text-navy-900";

  return (
    <div className="relative isolate flex min-h-screen items-center overflow-hidden bg-surface p-4 lg:pl-[clamp(2rem,9vw,9rem)] lg:pr-10">
      {/* Aurora em tons de laranja da marca (canvas desfocado) */}
      <AuroraBackground className="pointer-events-none absolute inset-0 -z-10 h-full w-full blur-[16px]" />

      {/* Crachá interativo com a logo da empresa: arraste, estique, solte ou clique para virar. Só em telas largas. */}
      <div className="absolute inset-y-0 left-[calc(clamp(2rem,9vw,9rem)+27rem)] right-0 hidden lg:block" role="img" aria-label="Crachá da Olimach pendurado em uma fita. Arraste para movimentar.">
        <Suspense fallback={null}>
          <Lanyard
            frontImage="/assets/brand/card-front.png"
            backImage="/assets/brand/card-front.png"
            strapImage="/assets/brand/strap.svg"
            imageFit="cover"
            cardColor="#ffffff"
            finish="glossy"
            metal="silver"
            strapWidth={0.8}
            size={0.62}
            anchor="center"
          />
        </Suspense>
      </div>

      <main className="relative z-10 w-full max-w-[26rem] overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
        <header className="px-6 pb-5 pt-6">
          <BrandLogo className="h-20 w-auto" />
          <p className="mt-4 text-[11px] font-extrabold uppercase tracking-[0.2em] text-brand-500">Administração</p>
          <h1 className="mt-2 text-2xl">{mode === "login" ? "Entrar no Olimach Admin" : "Recuperar senha"}</h1>
          <p className="mt-2 text-sm text-muted">
            {mode === "login"
              ? "Informe suas credenciais para acessar o painel."
              : "Informe o e-mail da sua conta para receber o link de redefinição."}
          </p>
        </header>

        <div className="border-t border-line px-6 pb-6 pt-5">
          {notice && mode === "login" && (
            <p role="status" className="mb-4 rounded-btn-admin bg-success/10 p-3 text-sm text-success">
              {notice}
            </p>
          )}
          {!configured && (
            <p role="alert" className="mb-4 rounded-btn-admin bg-safety/30 p-3 text-sm text-navy-900">
              [PENDENTE: configurar VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env]
            </p>
          )}

          {mode === "login" ? (
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label htmlFor="email" className={label}>
                  E-mail
                </label>
                <input id="email" type="email" autoComplete="username" required placeholder="voce@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className={label}>
                    Senha
                  </label>
                  <button type="button" onClick={() => switchMode("forgot")} className="text-xs font-semibold text-brand-500 hover:underline">
                    Esqueci minha senha
                  </button>
                </div>
                <input id="password" type="password" autoComplete="current-password" required placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
              </div>
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy || !configured} className="w-full gap-2">
                <LogIn size={16} aria-hidden /> {busy ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          ) : sent ? (
            <div className="space-y-4">
              <p role="status" className="rounded-btn-admin bg-success/10 p-3 text-sm text-success">
                Se este e-mail tiver acesso ao painel, enviamos um link para redefinir a senha. Confira também a caixa de spam.
              </p>
              <Button type="button" className="w-full" onClick={() => switchMode("login")}>
                Voltar para o login
              </Button>
            </div>
          ) : (
            <form onSubmit={onForgot} className="space-y-4">
              <div>
                <label htmlFor="forgot-email" className={label}>
                  E-mail
                </label>
                <input id="forgot-email" type="email" autoComplete="username" required placeholder="voce@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
              </div>
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
              <Button type="submit" disabled={busy || !configured} className="w-full gap-2">
                <Mail size={16} aria-hidden /> {busy ? "Enviando..." : "Enviar link de redefinição"}
              </Button>
              <button type="button" onClick={() => switchMode("login")} className="w-full text-center text-sm font-semibold text-brand-500 hover:underline">
                Voltar para o login
              </button>
            </form>
          )}

          <p className="mt-5 text-xs text-muted">Acesso interno apenas para usuários autorizados.</p>
        </div>
      </main>
    </div>
  );
}
