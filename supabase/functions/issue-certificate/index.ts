// Edge Function: emite o certificado (gera o PDF, grava no Storage privado e cria o registro).
// Roda como o usuario que chamou (JWT repassado): RLS e triggers do banco continuam valendo, sem service_role.
// Segredos: SITE_URL, COMPANY_LEGAL_NAME, COMPANY_CNPJ (ver docs/OPERATIONS.md). SUPABASE_URL e SUPABASE_ANON_KEY
// ja existem no ambiente das Edge Functions.
import { createClient } from "@supabase/supabase-js";
import { addMonths, buildCertificatePdf, sha256Hex } from "../_shared/certificate-pdf.ts";
import type { Signer } from "../_shared/certificate-pdf.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respond(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const fail = (status: number, code: string, message: string) => respond(status, { error: message, code });

function maskCpf(value: string): string {
  const cpf = value.replace(/\D/g, "");
  return cpf.length === 11 ? `***.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-**` : "***.***.***-**";
}

type Client = ReturnType<typeof createClient>;

/** Baixa a imagem da assinatura (so PNG ou JPG; pdf-lib nao le WebP). Falha vira "sem assinatura". */
async function loadSignature(client: Client, path: string | null): Promise<Signer["signature"]> {
  if (!path) return null;
  const type = /\.png$/i.test(path) ? "png" : /\.jpe?g$/i.test(path) ? "jpg" : null;
  if (!type) return null;
  const { data, error } = await client.storage.from("signatures").download(path);
  if (error || !data) return null;
  return { bytes: new Uint8Array(await data.arrayBuffer()), type };
}

interface Person {
  name: string;
  qualification: string;
  registry: string;
  signature_path: string | null;
}

async function toSigner(client: Client, person: Person): Promise<Signer> {
  return {
    name: person.name,
    qualification: person.qualification,
    registry: person.registry,
    signature: await loadSignature(client, person.signature_path),
  };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return fail(405, "method_not_allowed", "Use POST.");

  const authorization = request.headers.get("Authorization");
  if (!authorization) return fail(401, "unauthorized", "Sessão ausente. Entre novamente.");

  const siteUrl = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
  const companyName = Deno.env.get("COMPANY_LEGAL_NAME") ?? "";
  const companyCnpj = Deno.env.get("COMPANY_CNPJ") ?? "";
  if (!siteUrl || !companyName || !companyCnpj) {
    return fail(422, "not_configured", "Configure SITE_URL, COMPANY_LEGAL_NAME e COMPANY_CNPJ nos segredos da função antes de emitir.");
  }

  let body: { enrollment_id?: string };
  try {
    body = await request.json();
  } catch {
    return fail(400, "invalid_body", "Corpo da requisição inválido.");
  }
  if (!body.enrollment_id || !UUID.test(body.enrollment_id)) {
    return fail(400, "invalid_body", "Informe a matrícula.");
  }

  const client = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });

  // Matricula com turma, curso, aluno e instrutores. A RLS so devolve dados para a equipe.
  const { data: enrollment, error: enrollmentError } = await client
    .from("enrollments")
    .select(
      "id, attendance_ok, approved, student:students(full_name, cpf), class:classes(start_date, end_date, location, course:courses(name, category, workload_hours, theory_hours, practice_hours, technical_reference, syllabus, validity_months))",
    )
    .eq("id", body.enrollment_id)
    .maybeSingle();
  if (enrollmentError) return fail(500, "lookup_failed", "Não foi possível consultar a matrícula.");
  if (!enrollment) return fail(404, "not_found", "Matrícula não encontrada ou sem permissão.");

  const row = enrollment as unknown as {
    attendance_ok: boolean;
    approved: boolean;
    student: { full_name: string; cpf: string } | null;
    class: {
      start_date: string;
      end_date: string;
      location: string;
      course: { name: string; category: string; workload_hours: number; theory_hours: number; practice_hours: number; technical_reference: string | null; syllabus: string | null; validity_months: number | null } | null;
    } | null;
  };
  const student = row.student;
  const klass = row.class;
  const course = klass?.course;
  if (!student || !klass || !course) return fail(404, "not_found", "Dados da matrícula incompletos.");
  if (course.category === "parceria") return fail(422, "partnership", "Cursos de parceria não emitem certificado.");
  if (!row.attendance_ok || !row.approved) return fail(422, "not_eligible", "O certificado exige presença confirmada e aprovação.");

  const { data: existing } = await client.from("certificates").select("id").eq("enrollment_id", body.enrollment_id).eq("status", "valid").limit(1);
  if (existing && existing.length > 0) return fail(409, "already_issued", "Esta matrícula já tem um certificado válido. Revogue-o para reemitir.");

  // Assinaturas padrao (Configuracoes): engenheiro tecnico, diretoria e tecnico em seguranca.
  const { data: signerRows, error: signerError } = await client.from("certificate_signers").select("role, name, qualification, registry, signature_path");
  if (signerError) return fail(500, "signers_failed", "Não foi possível consultar as assinaturas padrão.");
  const byRole = new Map((signerRows ?? []).map((r) => [r.role as string, r as Person]));
  const ROLES: Array<[string, string]> = [
    ["engineer", "Engenheiro técnico"],
    ["director", "Diretoria"],
    ["safety_technician", "Técnico em segurança"],
  ];
  const missing = ROLES.filter(([role]) => !byRole.has(role)).map(([, label]) => label);
  if (missing.length > 0) {
    return fail(422, "signers_missing", `Configure as assinaturas padrão em Configurações antes de emitir. Faltam: ${missing.join(", ")}.`);
  }
  const signers: Array<{ role: string; signer: Signer }> = [];
  for (const [role, label] of ROLES) signers.push({ role: label, signer: await toSigner(client, byRole.get(role)!) });

  const { data: code, error: codeError } = await client.rpc("generate_certificate_code");
  if (codeError || typeof code !== "string") return fail(500, "code_failed", "Não foi possível gerar o código do certificado.");

  const issuedAt = new Date();
  const expiresAt = course.validity_months ? addMonths(issuedAt, course.validity_months) : null;

  let pdf: Uint8Array;
  try {
    pdf = await buildCertificatePdf({
      code,
      studentName: student.full_name,
      cpfMasked: maskCpf(student.cpf),
      courseName: course.name,
      workloadHours: course.workload_hours,
      theoryHours: course.theory_hours,
      practiceHours: course.practice_hours,
      technicalReference: course.technical_reference ?? "",
      startDate: klass.start_date,
      endDate: klass.end_date,
      location: klass.location,
      issuedAt,
      expiresAt,
      syllabus: course.syllabus ?? "",
      signers,
      companyName,
      companyCnpj,
      validationUrl: `${siteUrl}/validar/${code}`,
    });
  } catch (error) {
    console.error("pdf generation failed", error);
    return fail(500, "pdf_failed", "Não foi possível gerar o PDF.");
  }

  const pdfPath = `${code}.pdf`;
  const { error: uploadError } = await client.storage.from("certificates").upload(pdfPath, pdf, { contentType: "application/pdf", upsert: false });
  if (uploadError) return fail(500, "upload_failed", "Não foi possível salvar o PDF.");

  const { data: certificate, error: insertError } = await client
    .from("certificates")
    .insert({
      enrollment_id: body.enrollment_id,
      code,
      issued_at: issuedAt.toISOString(),
      pdf_path: pdfPath,
      pdf_sha256: await sha256Hex(pdf),
    })
    .select("id, code, expires_at")
    .single();
  if (insertError || !certificate) {
    // O PDF ja subiu: o Storage nao permite excluir (imutavel), entao fica um arquivo sem registro. Inofensivo (codigo unico).
    console.error("certificate insert failed", insertError);
    return fail(insertError?.code === "23505" ? 409 : 422, "insert_failed", insertError?.message ?? "Não foi possível registrar o certificado.");
  }

  return respond(200, { id: certificate.id, code: certificate.code, pdf_path: pdfPath });
});
