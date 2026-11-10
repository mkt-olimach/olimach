import { Button, Card, BrandLogo } from "@olimach/ui";
import { useState } from "react";
import type { FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function Login() {
  const { session, configured, signIn } = useAuth();
  const navigate = useNavigate();
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

  const field = "mt-1 w-full rounded-btn-admin border border-line bg-surface px-3 py-2.5 text-sm";

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6">
        <BrandLogo className="h-28 w-auto" />
        <h1 className="mt-6 text-2xl">Entrar</h1>
        <p className="mt-1 text-sm text-muted">Acesso restrito à equipe da Olimach.</p>

        {!configured && (
          <p role="alert" className="mt-4 rounded-btn-admin bg-safety/30 p-3 text-sm text-navy-900">
            [PENDENTE: configurar VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env]
          </p>
        )}

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-semibold text-navy-900">
              E-mail
            </label>
            <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={field} />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-semibold text-navy-900">
              Senha
            </label>
            <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" disabled={busy || !configured} className="w-full">
            {busy ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
