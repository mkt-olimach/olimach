// Edge Function: convida um novo usuario da equipe (somente administrador).
// Unico ponto do projeto que usa service_role: criar contas no Auth exige a chave privada, que nunca vai ao navegador.
// O chamador e validado com o JWT dele (is_admin); o perfil e gravado com o JWT do chamador (RLS + auditoria).
// Segredo: ADMIN_URL (endereco do painel, ex.: https://admin.olimach.com.br). SUPABASE_URL, SUPABASE_ANON_KEY e
// SUPABASE_SERVICE_ROLE_KEY ja existem no ambiente das Edge Functions.
import { createClient } from "@supabase/supabase-js";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ["admin", "secretaria"] as const;

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const respond = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const fail = (status: number, code: string, message: string) => respond(status, { error: message, code });

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");

  const authorization = request.headers.get("Authorization");
  if (!authorization) return fail(401, "unauthorized", "Sessão ausente. Entre novamente.");

  const adminUrl = (Deno.env.get("ADMIN_URL") ?? "").replace(/\/$/, "");
  if (!adminUrl) return fail(422, "not_configured", "Configure o segredo ADMIN_URL na função antes de convidar.");

  let body: { email?: string; name?: string; role?: string };
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_body", "Corpo da requisição inválido.");
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const name = (body.name ?? "").trim();
  const role = body.role as (typeof ROLES)[number];
  if (!EMAIL.test(email) || email.length > 254) return fail(400, "invalid_email", "Informe um e-mail válido.");
  if (name.length < 2 || name.length > 120) return fail(400, "invalid_name", "Informe o nome (2 a 120 caracteres).");
  if (!ROLES.includes(role)) return fail(400, "invalid_role", "Papel inválido.");

  const url = Deno.env.get("SUPABASE_URL")!;
  const asCaller = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  const { data: isAdmin, error: adminError } = await asCaller.rpc("is_admin");
  if (adminError) return fail(500, "check_failed", "Não foi possível verificar a permissão.");
  if (isAdmin !== true) return fail(403, "forbidden", "Somente administradores convidam usuários.");

  const service = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: invited, error: inviteError } = await service.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${adminUrl}/redefinir-senha`,
    data: { name },
  });
  if (inviteError || !invited.user) {
    const taken = /already|registered|exists/i.test(inviteError?.message ?? "");
    return fail(taken ? 409 : 502, taken ? "already_registered" : "invite_failed", taken ? "Este e-mail já tem conta." : "Não foi possível enviar o convite. Verifique o SMTP do Supabase.");
  }

  // Perfil gravado com o JWT do chamador: a RLS exige admin e o audit_log registra quem convidou.
  const { error: profileError } = await asCaller.from("profiles").insert({ id: invited.user.id, name, role });
  if (profileError) {
    // Convite enviado sem perfil: remove a conta para nao deixar usuario sem acesso e sem registro.
    await service.auth.admin.deleteUser(invited.user.id);
    return fail(500, "profile_failed", "Não foi possível criar o perfil. Nada foi enviado.");
  }

  return respond(200, { id: invited.user.id, email, role });
});
