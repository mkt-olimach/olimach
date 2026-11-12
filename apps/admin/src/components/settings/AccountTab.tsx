import { newPasswordSchema } from "@olimach/schemas";
import { Button } from "@olimach/ui";
import { useState } from "react";
import type { FormEvent } from "react";
import { roleLabel, useAuth } from "../../lib/auth";
import { useToast } from "../../lib/toast";
import { Field, inputClass } from "../ui";

export function AccountTab() {
  const { profile, session, updatePassword } = useAuth();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = newPasswordSchema.safeParse(password);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Senha inválida.");
    if (password !== confirm) return setError("As senhas não conferem.");
    setError(null);
    setBusy(true);
    const message = await updatePassword(parsed.data);
    setBusy(false);
    if (message) return setError(message);
    setPassword("");
    setConfirm("");
    toast.success("Senha atualizada.");
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-[15px] border border-line bg-surface p-5 shadow-sm">
        <h2 className="text-base">Minha conta</h2>
        <dl className="mt-4 space-y-3 text-sm">
          <div>
            <dt className="text-xs text-muted">Nome</dt>
            <dd className="font-medium text-ink">{profile?.name ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">E-mail</dt>
            <dd className="font-medium text-ink">{session?.user.email ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Perfil</dt>
            <dd className="font-medium text-ink">{profile ? roleLabel[profile.role] : "Sem perfil ativo"}</dd>
          </div>
        </dl>
      </section>

      <section className="rounded-[15px] border border-line bg-surface p-5 shadow-sm">
        <h2 className="text-base">Alterar senha</h2>
        <form onSubmit={onSubmit} noValidate className="mt-4 space-y-4">
          <Field label="Nova senha" hint="Pelo menos 10 caracteres, com letras e números.">
            {(p) => <input {...p} type="password" autoComplete="new-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Field label="Confirmar nova senha" error={error ?? undefined}>
            {(p) => <input {...p} type="password" autoComplete="new-password" className={inputClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
          </Field>
          <Button type="submit" disabled={busy}>
            {busy ? "Salvando..." : "Salvar nova senha"}
          </Button>
        </form>
      </section>
    </div>
  );
}
