import { newPasswordSchema } from "@olimach/schemas";
import { BrandLogo, Button, Card } from "@olimach/ui";
import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCompany } from "../lib/company";
import { useAuth } from "../lib/auth";

/** Destino do link de recuperacao enviado por e-mail. O supabase-js troca o token do link por uma sessao. */
export function ResetPassword() {
  const { company } = useCompany();
  const { loading, session, configured, updatePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    const parsed = newPasswordSchema.safeParse(password);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Senha inválida.");
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setBusy(true);
    const message = await updatePassword(parsed.data);
    if (message) {
      setBusy(false);
      setError(message);
      return;
    }
    // Encerra a sessao do link e exige entrar com a nova senha.
    await signOut();
    navigate("/login", { replace: true, state: { notice: "Senha atualizada. Entre com a nova senha." } });
  }

  const field = "mt-1 w-full rounded-btn-admin border border-line bg-surface px-3 py-2.5 text-sm";

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6">
        <BrandLogo src={company.logoUrl ?? undefined} name={company.name} className="h-28 w-auto" />
        <h1 className="mt-6 text-2xl">Nova senha</h1>

        {loading ? (
          <p className="mt-4 text-sm text-muted">Validando o link...</p>
        ) : !configured || !session ? (
          <div className="mt-4 space-y-4">
            <p role="alert" className="rounded-btn-admin bg-danger/10 p-3 text-sm text-danger">
              Link inválido ou expirado. Peça um novo link de redefinição.
            </p>
            <Link to="/login" className="block text-center text-sm font-semibold text-brand-500 hover:underline">
              Voltar para o login
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <p className="text-sm text-muted">Use pelo menos 10 caracteres, com letras e números.</p>
            <div>
              <label htmlFor="new-password" className="text-sm font-semibold text-navy-900">
                Nova senha
              </label>
              <input id="new-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={field} />
            </div>
            <div>
              <label htmlFor="confirm-password" className="text-sm font-semibold text-navy-900">
                Confirmar nova senha
              </label>
              <input id="confirm-password" type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={field} />
            </div>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Salvando..." : "Salvar nova senha"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
