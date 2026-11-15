import { emailSchema, newPasswordSchema } from "@olimach/schemas";
import { Badge, Button } from "@olimach/ui";
import { Dices, UserPlus } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { roleLabel, useAuth } from "../../lib/auth";
import { functionErrorMessage } from "../../lib/functions";
import { supabase } from "../../lib/supabase";
import { useToast } from "../../lib/toast";
import { Field, Modal, dbErrorMessage, inputClass } from "../ui";

type Role = "super_admin" | "admin" | "secretaria";
interface Member {
  id: string;
  name: string;
  role: Role;
  active: boolean;
}



/** Senha provisoria aleatoria (sem caracteres ambiguos), com letras e numeros. */
function generatePassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  const raw = Array.from(bytes, (b) => chars[b % chars.length]).join("");
  return `${raw.slice(0, 12)}${2 + (bytes[0]! % 8)}${chars[bytes[1]! % 24]}`;
}

function InviteDialog({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const toast = useToast();
  const [values, setValues] = useState({ name: "", email: "", role: "secretaria" as Role, password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!supabase) return;
    const next: Record<string, string> = {};
    if (values.name.trim().length < 2) next.name = "Informe o nome.";
    const email = emailSchema.safeParse(values.email);
    if (!email.success) next.email = email.error.issues[0]?.message ?? "Informe um e-mail válido.";
    const password = values.password.trim() === "" ? null : newPasswordSchema.safeParse(values.password);
    if (password && !password.success) next.password = password.error.issues[0]?.message ?? "Senha inválida.";
    setErrors(next);
    if (Object.keys(next).length > 0 || !email.success) return;
    setBusy(true);
    const { error } = await supabase.functions.invoke("invite-user", {
      body: { name: values.name.trim(), email: email.data, role: values.role, ...(password?.success ? { password: password.data } : {}) },
    });
    setBusy(false);
    if (error) {
      toast.error(await functionErrorMessage(error, "Não foi possível enviar o convite."));
      return;
    }
    toast.success(values.password.trim() ? `Conta criada para ${email.data}. A senha deve ser repassada ao usuário.` : `Convite enviado para ${email.data}.`);
    onDone();
  }

  return (
    <Modal title="Convidar usuário" description="Sem senha, a pessoa recebe um e-mail para definir a própria. Com senha provisória, ela troca no primeiro acesso." onClose={onClose}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <Field label="Nome" error={errors.name}>
          {(p) => <input {...p} className={inputClass} autoComplete="off" value={values.name} onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))} />}
        </Field>
        <Field label="E-mail" error={errors.email}>
          {(p) => <input {...p} type="email" className={inputClass} autoComplete="off" value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} />}
        </Field>
        <Field label="Senha provisória" error={errors.password} hint="Opcional. Mínimo de 10 caracteres, com letras e números. O usuário será obrigado a trocar no primeiro acesso; repasse a senha por um canal seguro.">
          {(p) => (
            <div className="mt-1.5 flex gap-2">
              <input {...p} type="text" className={`${inputClass} !mt-0 min-w-0 flex-1 font-mono`} autoComplete="off" spellCheck={false} value={values.password} onChange={(e) => setValues((v) => ({ ...v, password: e.target.value }))} />
              <Button variant="secondary" onClick={() => setValues((v) => ({ ...v, password: generatePassword() }))}>
                <Dices size={14} aria-hidden /> Gerar
              </Button>
            </div>
          )}
        </Field>
        <Field label="Perfil" hint="Administradores gerenciam catálogo, equipe e revogações. Secretaria opera alunos, turmas e emissão.">
          {(p) => (
            <select {...p} className={inputClass} value={values.role} onChange={(e) => setValues((v) => ({ ...v, role: e.target.value as Role }))}>
              <option value="secretaria">Secretaria</option>
              <option value="admin">Administrador</option>
            </select>
          )}
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button type="submit" disabled={busy}>
            {busy ? "Salvando..." : values.password.trim() ? "Criar conta" : "Enviar convite"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function TeamTab() {
  const { session } = useAuth();
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState(false);
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    if (!supabase) return;
    const { data, error: err } = await supabase.from("profiles").select("id, name, role, active").order("name");
    if (err) setError(true);
    else {
      setError(false);
      setMembers(data as Member[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function patch(member: Member, change: Partial<Pick<Member, "role" | "active">>) {
    if (!supabase) return;
    const { error: err } = await supabase.from("profiles").update(change).eq("id", member.id);
    if (err) toast.error(dbErrorMessage(err, {}));
    else toast.success("Perfil atualizado.");
    await load();
  }

  return (
    <section className="rounded-[15px] border border-line bg-surface p-4 shadow-sm md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">Usuários com acesso ao painel. Não existe cadastro público: contas só nascem por convite de um administrador.</p>
        <Button onClick={() => setInviting(true)}>
          <UserPlus size={16} aria-hidden /> Convidar usuário
        </Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-left">
          <thead>
            <tr className="bg-canvas text-[10px] font-semibold text-[#253b57]">
              <th className="rounded-l-md border-y border-line px-2.5 py-3">Nome</th>
              <th className="border-y border-line px-2.5 py-3">Perfil</th>
              <th className="border-y border-line px-2.5 py-3">Situação</th>
              <th className="rounded-r-md border-y border-line px-2.5 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => {
              const self = m.id === session?.user.id;
              return (
                <tr key={m.id} className="border-b border-line text-[11px] text-[#4b5b70]">
                  <td className="px-2.5 py-3 font-medium text-ink">
                    {m.name} {self && <span className="ml-1 text-[10px] font-normal text-muted">(você)</span>}
                  </td>
                  <td className="px-2.5 py-3">
                    {self || m.role === "super_admin" ? (
                      roleLabel[m.role]
                    ) : (
                      <select aria-label={`Perfil de ${m.name}`} value={m.role} onChange={(e) => void patch(m, { role: e.target.value as Role })} className="rounded-lg border border-line bg-surface px-2 py-1.5 text-[11px]">
                        <option value="secretaria">Secretaria</option>
                        <option value="admin">Administrador</option>
                      </select>
                    )}
                  </td>
                  <td className="px-2.5 py-3">
                    <Badge tone={m.active ? "success" : "neutral"}>{m.active ? "Ativo" : "Inativo"}</Badge>
                  </td>
                  <td className="px-2.5 py-3 text-right">
                    {self || m.role === "super_admin" ? (
                      <span className="text-[10px] text-muted">-</span>
                    ) : (
                      <button type="button" onClick={() => void patch(m, { active: !m.active })} className="rounded-lg border border-line px-2.5 py-1.5 text-[11px] font-semibold text-navy-900 hover:bg-canvas">
                        {m.active ? "Desativar" : "Reativar"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {members.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-xs text-muted">
                  {loading ? "Carregando equipe..." : error ? "Não foi possível carregar a equipe." : "Nenhum usuário cadastrado."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-[11px] text-muted">Você não altera o próprio perfil, e o sistema sempre mantém ao menos um administrador ativo.</p>
      {inviting && (
        <InviteDialog
          onClose={() => setInviting(false)}
          onDone={() => {
            setInviting(false);
            void load();
          }}
        />
      )}
    </section>
  );
}
