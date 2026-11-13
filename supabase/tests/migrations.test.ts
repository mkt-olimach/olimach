import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN = "11111111-1111-4111-8111-111111111111";
const SECRETARIA = "22222222-2222-4222-8222-222222222222";
const SUPER = "33333333-3333-4333-8333-333333333333";

// Stubs minimos do ambiente Supabase (roles, auth, storage) para rodar as migrations em Postgres puro.
const SUPABASE_STUBS = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean default false);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema public to anon, authenticated;
`;

let db: PGlite;

async function as<T>(role: "anon" | "authenticated", uid: string | null, fn: () => Promise<T>): Promise<T> {
  await db.exec(`select set_config('request.jwt.claim.sub', '${uid ?? ""}', false); set role ${role};`);
  try {
    return await fn();
  } finally {
    await db.exec("reset role;");
  }
}

async function q<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]> {
  return (await db.query<T>(sql, params)).rows;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUBS);
  const dir = join(root, "migrations");
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, file), "utf8"));
  }
  await db.exec(readFileSync(join(root, "seed.sql"), "utf8"));
  // rodar o seed de novo prova que e idempotente
  await db.exec(readFileSync(join(root, "seed.sql"), "utf8"));

  await db.exec(`
    insert into auth.users (id) values ('${ADMIN}'), ('${SECRETARIA}');
    insert into public.profiles (id, name, role) values
      ('${ADMIN}', 'Admin Teste', 'admin'),
      ('${SECRETARIA}', 'Secretaria Teste', 'secretaria');
  `);
});

describe("seed", () => {
  it("cria 10 cursos que emitem certificado, sem parceria e sem CBSP/HUET", async () => {
    const rows = await q<{ name: string; category: string }>("select name, category from public.courses");
    expect(rows).toHaveLength(10);
    expect(rows.some((r) => r.category === "parceria")).toBe(false);
    expect(rows.some((r) => /CBSP|HUET/i.test(r.name))).toBe(false);
    const instructors = await q<{ name: string }>("select name from public.instructors");
    expect(instructors).toHaveLength(2);
    expect(instructors.every((i) => i.name.startsWith("[EXEMPLO]"))).toBe(true);
    expect(await q("select 1 from public.technical_leads")).toHaveLength(1);
  });
});

describe("constraints", () => {
  it("nr_code so existe para cursos NR", async () => {
    await expect(
      db.exec(`insert into public.courses (slug, name, category, nr_code, workload_hours)
               values ('x-ruim', 'Curso Ruim', 'profissionalizante', 'NR-10', 8)`),
    ).rejects.toThrow(/courses_nr_code_matches_category/);
  });
});

describe("emissao de certificados", () => {
  let nr10Enrollment: string;
  let partnerEnrollment: string;
  let notApprovedEnrollment: string;
  let techLead: string;
  let certId: string;
  let certCode: string;

  beforeAll(async () => {
    const [{ id: courseId }] = await q<{ id: string }>("select id from public.courses where slug = 'nr-10'");
    const [{ id: partnerCourse }] = await q<{ id: string }>(
      `insert into public.courses (slug, name, category, workload_hours)
       values ('curso-parceiro', 'Curso Parceiro', 'parceria', 8) returning id`,
    );
    const mkClass = async (course: string) =>
      (
        await q<{ id: string }>(
          `insert into public.classes (course_id, start_date, end_date, location)
           values ($1, '2026-01-05', '2026-01-09', 'Macaé') returning id`,
          [course],
        )
      )[0].id;
    const mkStudent = async (cpf: string, name: string) =>
      (await q<{ id: string }>(`insert into public.students (full_name, cpf) values ($2, $1) returning id`, [cpf, name]))[0].id;
    const mkEnrollment = async (cls: string, st: string, ok: boolean) =>
      (
        await q<{ id: string }>(
          `insert into public.enrollments (class_id, student_id, attendance_ok, approved)
           values ($1, $2, $3, $3) returning id`,
          [cls, st, ok],
        )
      )[0].id;

    const class1 = await mkClass(courseId);
    const class2 = await mkClass(partnerCourse);
    nr10Enrollment = await mkEnrollment(class1, await mkStudent("12345678901", "Aluno Um"), true);
    notApprovedEnrollment = await mkEnrollment(class1, await mkStudent("98765432100", "Aluno Dois"), false);
    partnerEnrollment = await mkEnrollment(class2, await mkStudent("11122233344", "Aluno Tres"), true);
    techLead = (await q<{ id: string }>("select id from public.technical_leads"))[0].id;
  });

  const insertCert = (enrollment: string) =>
    q<{ id: string; code: string; expires_at: string | null; issued_at: string }>(
      `insert into public.certificates (enrollment_id, technical_lead_id, pdf_path, pdf_sha256)
       values ($1, $2, 'certificates/x.pdf', repeat('a', 64)) returning id, code, issued_at, expires_at`,
      [enrollment, techLead],
    );

  it("bloqueia certificado para curso de parceria", async () => {
    await expect(insertCert(partnerEnrollment)).rejects.toThrow(/parceria/i);
  });

  it("exige presenca e aprovacao", async () => {
    await expect(insertCert(notApprovedEnrollment)).rejects.toThrow(/presenca/i);
  });

  it("emite com codigo aleatorio de 10 caracteres e validade derivada do curso", async () => {
    const [cert] = await insertCert(nr10Enrollment);
    certId = cert.id;
    certCode = cert.code;
    expect(certCode).toMatch(/^[2-9A-HJ-NP-Z]{10}$/);
    const diff = await q<{ months: number }>(
      "select (extract(year from age(expires_at, issued_at)) * 12 + extract(month from age(expires_at, issued_at)))::int as months from public.certificates where id = $1",
      [certId],
    );
    expect(diff[0].months).toBe(24);
  });

  it("nao permite dois certificados validos para a mesma matricula", async () => {
    await expect(insertCert(nr10Enrollment)).rejects.toThrow(/certificates_one_valid_per_enrollment/);
  });

  it("PDF e dados emitidos sao imutaveis; revogar funciona e e irreversivel", async () => {
    await expect(db.query("update public.certificates set pdf_path = 'outro.pdf' where id = $1", [certId])).rejects.toThrow(/imutavel/);
    await expect(db.query("update public.certificates set expires_at = now() where id = $1", [certId])).rejects.toThrow(/imutavel/);
    await expect(db.query("update public.certificates set status = 'revoked' where id = $1", [certId])).rejects.toThrow(
      /certificates_revocation_consistent/,
    );
    await db.query("update public.certificates set status = 'revoked', revoked_at = now(), revoked_reason = 'Erro de digitacao' where id = $1", [certId]);
    await expect(
      db.query("update public.certificates set status = 'valid', revoked_at = null, revoked_reason = null where id = $1", [certId]),
    ).rejects.toThrow(/revogado/);
    // apos revogar, e possivel reemitir
    const [again] = await insertCert(nr10Enrollment);
    expect(again.code).not.toBe(certCode);
  });

  it("curso com certificados nao vira parceria", async () => {
    await expect(db.query("update public.courses set category = 'parceria', nr_code = null where slug = 'nr-10'")).rejects.toThrow(
      /parceria/i,
    );
  });
});

describe("audit_log", () => {
  it("registra emissao e revogacao, sem dados pessoais de alunos", async () => {
    const actions = (await q<{ action: string }>("select distinct action from public.audit_log where entity = 'certificates'")).map(
      (r) => r.action,
    );
    expect(actions).toEqual(expect.arrayContaining(["emit", "revoke"]));

    await db.exec("update public.students set phone = '22999990000' where cpf = '12345678901'");
    const [row] = await q<{ payload: Record<string, unknown> }>(
      "select payload from public.audit_log where entity = 'students' and action = 'update' order by id desc limit 1",
    );
    expect(row.payload).toEqual({ changed_fields: ["phone"] });

    const inserts = await q<{ payload: Record<string, unknown> }>(
      "select payload from public.audit_log where entity = 'students' and action = 'insert'",
    );
    for (const i of inserts) expect(JSON.stringify(i.payload)).not.toMatch(/12345678901|cpf/);
  });

  it("e imutavel", async () => {
    await expect(db.exec("update public.audit_log set action = 'x'")).rejects.toThrow(/imutavel/);
    await expect(db.exec("delete from public.audit_log")).rejects.toThrow(/imutavel/);
  });
});

describe("RLS", () => {
  it("anon nao le nenhuma tabela", async () => {
    for (const t of ["students", "courses", "certificates", "audit_log", "profiles", "validation_rate_limit"]) {
      await expect(as("anon", null, () => q(`select * from public.${t}`)), t).rejects.toThrow(/permission denied/);
    }
  });

  it("anon lista so treinamentos ativos pelo RPC, sem SELECT na tabela e sem conteudo interno", async () => {
    await db.exec("update public.courses set active = false, description = 'Descricao publica' where slug = 'barbeiro'");
    try {
      const rows = await as("anon", null, () => q<Record<string, unknown>>("select * from public.public_courses()"));
      expect(rows.some((r) => r.slug === "barbeiro")).toBe(false);
      expect(Object.keys(rows[0] ?? {})).not.toContain("syllabus");
      expect(Object.keys(rows[0] ?? {})).toContain("cover_path");
      await db.exec("update public.courses set active = true where slug = 'barbeiro'");
      const again = await as("anon", null, () => q<{ slug: string; description: string }>("select slug, description from public.public_courses()"));
      expect(again.find((r) => r.slug === "barbeiro")?.description).toBe("Descricao publica");
    } finally {
      await db.exec("update public.courses set active = true, description = '' where slug = 'barbeiro'");
    }
  });

  it("carga horaria total e a soma da teorica e da pratica; a vitrine devolve a divisao", async () => {
    await q("insert into public.courses (slug, name, category, workload_hours, theory_hours, practice_hours) values ('split-ok', 'Split Ok', 'profissionalizante', 10, 6, 4)");
    await q("insert into public.courses (slug, name, category, workload_hours) values ('split-legado', 'Split Legado', 'profissionalizante', 7)");
    await expect(
      db.query("insert into public.courses (slug, name, category, workload_hours, theory_hours, practice_hours) values ('split-ruim', 'Split Ruim', 'profissionalizante', 10, 6, 3)"),
    ).rejects.toThrow(/courses_workload_is_sum/);
    const rows = await as("anon", null, () =>
      q<{ slug: string; workload_hours: number; theory_hours: number; practice_hours: number }>("select slug, workload_hours, theory_hours, practice_hours from public.public_courses() where slug like 'split-%'"),
    );
    const by = Object.fromEntries(rows.map((r) => [r.slug, r]));
    expect(by["split-ok"]).toMatchObject({ workload_hours: 10, theory_hours: 6, practice_hours: 4 });
    expect(by["split-legado"]).toMatchObject({ workload_hours: 7, theory_hours: 7, practice_hours: 0 });
  });

  it("super_admin: e admin, alem de unico a mexer em super_admin e nos dados da empresa", async () => {
    await db.exec(`insert into auth.users (id) values ('${SUPER}'); insert into public.profiles (id, name, role) values ('${SUPER}', 'Super Teste', 'super_admin');`);
    // is_admin() vale para super_admin; is_super_admin() so para ele
    expect((await as("authenticated", SUPER, () => q<{ a: boolean; s: boolean }>("select public.is_admin() as a, public.is_super_admin() as s")))[0]).toEqual({ a: true, s: true });
    expect((await as("authenticated", ADMIN, () => q<{ a: boolean; s: boolean }>("select public.is_admin() as a, public.is_super_admin() as s")))[0]).toEqual({ a: true, s: false });

    // dados da empresa: so o super_admin escreve; equipe le
    const company = "insert into public.company_settings (company_name, phone, address, number, complement, neighborhood) values ('Empresa Teste', '(22) 0000-0000', 'Rua A', '10', 'Sala 2', 'Centro') on conflict (singleton) do update set phone = excluded.phone";
    await expect(as("authenticated", ADMIN, () => db.query(company))).rejects.toThrow(/row-level security/);
    await expect(as("authenticated", SECRETARIA, () => db.query(company))).rejects.toThrow(/row-level security/);
    await as("authenticated", SUPER, () => db.query(company));
    expect(await as("authenticated", SECRETARIA, () => q("select 1 from public.company_settings"))).toHaveLength(1);
    expect(await as("anon", null, () => q("select 1 from public.company_settings").catch(() => "negado"))).toBe("negado");
    const pub = await as("anon", null, () => q<{ company_name: string; phone: string; number: string }>("select company_name, phone, number from public.public_company()"));
    expect(pub).toEqual([{ company_name: "Empresa Teste", phone: "(22) 0000-0000", number: "10" }]);

    // admin nao promove ninguem a super_admin nem mexe em um
    await expect(as("authenticated", ADMIN, () => db.query(`update public.profiles set role = 'super_admin' where id = '${SECRETARIA}'`))).rejects.toThrow(/super administrador/);
    await expect(as("authenticated", ADMIN, () => db.query(`update public.profiles set active = false where id = '${SUPER}'`))).rejects.toThrow(/super administrador/);
    await expect(as("authenticated", ADMIN, () => db.query(`delete from public.profiles where id = '${SUPER}'`))).rejects.toThrow(/super administrador/);
    // super_admin promove e rebaixa; sem sessao (SQL Editor) tambem pode
    await as("authenticated", SUPER, () => db.query(`update public.profiles set role = 'super_admin' where id = '${SECRETARIA}'`));
    await as("authenticated", SUPER, () => db.query(`update public.profiles set role = 'secretaria' where id = '${SECRETARIA}'`));
    expect(await q("select 1 from public.profiles where id = '" + SECRETARIA + "' and role = 'secretaria'")).toHaveLength(1);
    // limpeza: outros testes assumem que o admin e o unico administrador
    await db.exec(`delete from public.profiles where id = '${SUPER}'; delete from public.company_settings;`);
  });

  it("galeria: so admin escreve, equipe le e o site le so pela vitrine publica", async () => {
    const insert = "insert into public.gallery_images (path, title, width, height) values ('a.webp', 'Foto A', 800, 600), ('b.webp', 'Foto B', 600, 900)";
    await expect(as("authenticated", SECRETARIA, () => db.query(insert))).rejects.toThrow(/row-level security/);
    await as("authenticated", ADMIN, () => db.query(insert));
    expect(await as("authenticated", SECRETARIA, () => q("select 1 from public.gallery_images"))).toHaveLength(2);
    expect(await as("anon", null, () => q("select 1 from public.gallery_images").catch(() => "negado"))).toBe("negado");
    const pub = await as("anon", null, () => q<{ path: string; width: number; height: number }>("select path, width, height from public.public_gallery()"));
    expect(pub.map((r) => r.path).sort()).toEqual(["a.webp", "b.webp"]);
    await expect(as("authenticated", ADMIN, () => db.query("insert into public.gallery_images (path, width, height) values ('c.webp', 0, 10)"))).rejects.toThrow(/check/);
    // exclusao em massa pelo admin; secretaria nao exclui nada (a RLS filtra)
    expect(await as("authenticated", SECRETARIA, () => q("delete from public.gallery_images returning id"))).toHaveLength(0);
    expect(await as("authenticated", ADMIN, () => q("delete from public.gallery_images where path in ('a.webp', 'b.webp') returning id"))).toHaveLength(2);
    expect(await q("select 1 from public.gallery_images")).toHaveLength(0);
  });

  it("provas online: gabarito protegido, acesso por token + CPF + senha, correcao no servidor e limites", async () => {
    const [{ id: studentId, cpf }] = await q<{ id: string; cpf: string }>("select id, cpf from public.students order by cpf limit 1");
    const [{ id: courseId }] = await q<{ id: string }>("select id from public.courses where category <> 'parceria' limit 1");

    // so administrador cadastra provas; secretaria le
    const newExam = `insert into public.exams (course_id, title, passing_score, max_attempts) values ('${courseId}', 'Prova Teste', 70, 2) returning id`;
    await expect(as("authenticated", SECRETARIA, () => db.query(newExam))).rejects.toThrow(/row-level security/);
    const [{ id: examId }] = await as("authenticated", ADMIN, () => q<{ id: string }>(newExam));
    const questionIds: string[] = [];
    const correctIds: string[] = [];
    for (const [i, text] of ["Pergunta 1?", "Pergunta 2?"].entries()) {
      const [{ id }] = await as("authenticated", ADMIN, () => q<{ id: string }>("insert into public.exam_questions (exam_id, position, text) values ($1, $2, $3) returning id", [examId, i, text]));
      questionIds.push(id);
      const [{ id: right }] = await as("authenticated", ADMIN, () => q<{ id: string }>("insert into public.exam_options (question_id, position, text, is_correct) values ($1, 0, 'Certa', true) returning id", [id]));
      correctIds.push(right);
      await as("authenticated", ADMIN, () => db.query("insert into public.exam_options (question_id, position, text) values ($1, 1, 'Errada A'), ($1, 2, 'Errada B')", [id]));
      // no maximo uma correta por questao
      await expect(as("authenticated", ADMIN, () => db.query("insert into public.exam_options (question_id, position, text, is_correct) values ($1, 3, 'Outra certa', true)", [id]))).rejects.toThrow(/exam_options_one_correct/);
    }
    expect(await as("authenticated", SECRETARIA, () => q("select 1 from public.exam_options where is_correct"))).toHaveLength(2);

    // aplicacao: so a equipe, via RPC; anon nao cria
    await expect(as("anon", null, () => db.query("select * from public.create_exam_assignment($1, $2)", [examId, studentId]))).rejects.toThrow(/permission denied/);
    const [grant] = await as("authenticated", SECRETARIA, () => q<{ assignment_id: string; token: string; password: string }>("select * from public.create_exam_assignment($1, $2)", [examId, studentId]));
    expect(grant.token).toMatch(/^[0-9a-f]{64}$/);
    expect(grant.password).toMatch(/^[2-9A-HJ-NP-Z]{8}$/);

    // a equipe nao le hashes; o anon nao le nenhuma tabela
    await expect(as("authenticated", SECRETARIA, () => db.query("select token_hash from public.exam_assignments"))).rejects.toThrow(/permission denied/);
    await expect(as("authenticated", SECRETARIA, () => db.query("select key_hash from public.exam_attempts"))).rejects.toThrow(/permission denied/);
    for (const table of ["exams", "exam_questions", "exam_options", "exam_assignments", "exam_attempts"]) {
      await expect(as("anon", null, () => db.query(`select 1 from public.${table}`))).rejects.toThrow(/permission denied/);
    }

    const start = (token: string, cpfValue: string, password: string) =>
      as("anon", null, () => q<{ r: Record<string, unknown> }>("select public.exam_start($1, $2, $3) as r", [token, cpfValue, password])).then((rows) => rows[0].r);
    const submit = (key: string, answers: Record<string, string>) =>
      as("anon", null, () => q<{ r: Record<string, unknown> }>("select public.exam_submit($1, $2::jsonb) as r", [key, JSON.stringify(answers)])).then((rows) => rows[0].r);

    // credenciais erradas: resposta generica; apos 5 erros bloqueia
    expect((await start("0".repeat(64), cpf, grant.password)).status).toBe("invalid");
    for (let i = 0; i < 5; i++) expect((await start(grant.token, cpf, "ERRADA99")).status).toBe("invalid");
    expect((await start(grant.token, cpf, grant.password)).status).toBe("locked");
    await db.exec(`update public.exam_assignments set locked_until = null where id = '${grant.assignment_id}'`);

    // acesso correto (CPF com ou sem mascara, senha em qualquer caixa): questoes sem gabarito
    const first = await start(grant.token, `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`, grant.password.toLowerCase());
    expect(first.status).toBe("ok");
    expect(JSON.stringify(first)).not.toContain("is_correct");
    const questions = first.questions as Array<{ id: string; options: Array<{ id: string; text: string }> }>;
    expect(questions).toHaveLength(2);
    expect(questions.every((qn) => qn.options.length === 3 && qn.options.every((o) => Object.keys(o).sort().join() === "id,text"))).toBe(true);

    // 1 de 2 certa = 50 (reprovado, minimo 70); reenviar devolve o mesmo resultado
    const res1 = await submit(first.attempt_key as string, { [questionIds[0]]: correctIds[0], [questionIds[1]]: questions[1].options.find((o) => o.id !== correctIds[1])!.id });
    expect(res1).toMatchObject({ status: "ok", score: 50, passed: false, correct: 1, total: 2 });
    expect(await submit(first.attempt_key as string, { [questionIds[1]]: correctIds[1] })).toMatchObject({ score: 50 });

    // segunda tentativa: tudo certo = 100; terceira nao existe (max 2)
    const second = await start(grant.token, cpf, grant.password);
    expect(second.status).toBe("ok");
    expect(await submit(second.attempt_key as string, { [questionIds[0]]: correctIds[0], [questionIds[1]]: correctIds[1] })).toMatchObject({ score: 100, passed: true });
    expect((await start(grant.token, cpf, grant.password)).status).toBe("no_attempts");

    // acompanhamento da equipe
    const [row] = await as("authenticated", SECRETARIA, () => q<{ attempts_used: number; best_score: string; passed: boolean }>("select attempts_used, best_score, passed from public.exam_assignments_overview where id = $1", [grant.assignment_id]));
    expect(row).toMatchObject({ attempts_used: 2, passed: true });
    expect(Number(row.best_score)).toBe(100);

    // prazo: tentativa em andamento vencida e encerrada com nota 0; revogada nao abre
    const [grant2] = await as("authenticated", SECRETARIA, () => q<{ assignment_id: string; token: string; password: string }>("select * from public.create_exam_assignment($1, $2, null, 3)", [examId, studentId]));
    await db.exec("update public.exams set time_limit_minutes = 5 where id = '" + examId + "'");
    const timed = await start(grant2.token, cpf, grant2.password);
    expect(timed.status).toBe("ok");
    await db.exec(`update public.exam_attempts set deadline_at = now() - interval '5 minutes' where assignment_id = '${grant2.assignment_id}'`);
    expect(await submit(timed.attempt_key as string, { [questionIds[0]]: correctIds[0], [questionIds[1]]: correctIds[1] })).toMatchObject({ score: 0, passed: false, late: true });
    await as("authenticated", SECRETARIA, () => db.query("select public.revoke_exam_assignment($1)", [grant2.assignment_id]));
    expect((await start(grant2.token, cpf, grant2.password)).status).toBe("unavailable");
    expect((await q<{ n: number }>("select count(*)::int as n from public.audit_log where entity = 'exam_assignments'"))[0].n).toBe(3);

    // exclusao: so administrador; apaga a aplicacao e as tentativas, e o link deixa de existir
    await expect(as("authenticated", SECRETARIA, () => db.query("select public.delete_exam_assignment($1)", [grant.assignment_id]))).rejects.toThrow(/Somente administradores/);
    await as("authenticated", ADMIN, () => db.query("select public.delete_exam_assignment($1)", [grant.assignment_id]));
    expect(await q("select 1 from public.exam_assignments where id = '" + grant.assignment_id + "'")).toHaveLength(0);
    expect(await q("select 1 from public.exam_attempts where assignment_id = '" + grant.assignment_id + "'")).toHaveLength(0);
    expect((await start(grant.token, cpf, grant.password)).status).toBe("invalid");
    const [del] = await q<{ payload: { attempts_deleted: number } }>("select payload from public.audit_log where entity = 'exam_assignments' and action = 'delete'");
    expect(del.payload.attempts_deleted).toBe(2);
    await expect(as("authenticated", ADMIN, () => db.query("select public.delete_exam_assignment($1)", [grant.assignment_id]))).rejects.toThrow(/nao encontrada/);

    // prova sem questoes nao pode ser aplicada
    const [{ id: emptyId }] = await as("authenticated", ADMIN, () => q<{ id: string }>("insert into public.exams (course_id, title) values ($1, 'Prova vazia') returning id", [courseId]));
    await expect(as("authenticated", SECRETARIA, () => db.query("select * from public.create_exam_assignment($1, $2)", [emptyId, studentId]))).rejects.toThrow(/nao tem questoes/);
  });

  it("endurecimento: anon sem privilegio de tabela, URLs so http(s), IP confiavel no rate limit", async () => {
    // anon nao tem nem o privilegio de SELECT (antes herdado como padrao nas tabelas novas)
    for (const table of ["certificate_signers", "company_settings", "gallery_images", "exams", "exam_assignments"]) {
      await expect(as("anon", null, () => db.query(`select 1 from public.${table}`))).rejects.toThrow(/permission denied/);
    }

    // links da empresa: javascript:, data: e esquemas sem http(s) sao recusados pelo banco
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://x.com", "facebook.com/x"]) {
      await expect(db.query("insert into public.company_settings (company_name, facebook) values ('Empresa', $1)", [bad])).rejects.toThrow(/company_settings_urls_http/);
    }
    await db.query("insert into public.company_settings (company_name, facebook, website) values ('Empresa', 'https://facebook.com/x', 'http://x.com.br') on conflict (singleton) do update set facebook = excluded.facebook");
    await db.exec("delete from public.company_settings");

    // IP do cliente: cf-connecting-ip > x-real-ip > ULTIMO item do X-Forwarded-For (o primeiro e forjavel)
    const ipFor = async (headers: Record<string, string>) => {
      await db.exec(`select set_config('request.headers', '${JSON.stringify(headers)}', false)`);
      return (await q<{ ip: string }>("select public.request_client_ip() as ip"))[0].ip;
    };
    expect(await ipFor({ "x-forwarded-for": "9.9.9.9, 1.1.1.1, 2.2.2.2" })).toBe("2.2.2.2");
    expect(await ipFor({ "x-forwarded-for": "9.9.9.9", "x-real-ip": "3.3.3.3" })).toBe("3.3.3.3");
    expect(await ipFor({ "x-forwarded-for": "9.9.9.9", "cf-connecting-ip": "4.4.4.4", "x-real-ip": "3.3.3.3" })).toBe("4.4.4.4");
    expect(await ipFor({})).toBe("unknown");

    // forjar o primeiro item do X-Forwarded-For nao zera o rate limit da validacao publica
    await db.exec("delete from public.validation_rate_limit");
    const statuses: string[] = [];
    for (let i = 0; i < 22; i++) {
      await db.exec(`select set_config('request.headers', '${JSON.stringify({ "x-forwarded-for": `10.0.0.${i}, 8.8.8.8` })}', false)`);
      const rows = await as("anon", null, () => q<{ status: string }>("select * from public.validate_certificate('ABCDEFGHJK')"));
      if (rows[0]?.status === "rate_limited") statuses.push("limited");
    }
    expect(statuses.length).toBeGreaterThanOrEqual(1);
    await db.exec("select set_config('request.headers', '', false); delete from public.validation_rate_limit");
  });

  it("bucket de capas e publico; os demais continuam privados", async () => {
    const rows = await q<{ id: string; public: boolean }>("select id, public from storage.buckets order by id");
    expect(Object.fromEntries(rows.map((r) => [r.id, r.public]))).toEqual({ branding: true, certificates: false, "course-covers": true, gallery: true, signatures: false });
  });

  it("secretaria opera alunos mas nao revoga, nao edita catalogo e nao le auditoria", async () => {
    await as("authenticated", SECRETARIA, async () => {
      expect((await q("select 1 from public.students")).length).toBeGreaterThan(0);
      expect((await q("select 1 from public.audit_log")).length).toBe(0);
      expect((await q("update public.courses set active = false returning id")).length).toBe(0);
      expect((await q("update public.certificates set status = 'revoked' returning id")).length).toBe(0);
      await expect(
        db.query("insert into public.courses (slug, name, category, workload_hours) values ('z-z', 'Zzz Zzz', 'profissionalizante', 1)"),
      ).rejects.toThrow(/row-level security/);
    });
  });

  it("admin le a auditoria e edita o catalogo", async () => {
    await as("authenticated", ADMIN, async () => {
      expect((await q("select 1 from public.audit_log")).length).toBeGreaterThan(0);
      expect((await q("update public.courses set active = true where slug = 'nr-35' returning id")).length).toBe(1);
    });
  });

  it("ninguem exclui certificados", async () => {
    await as("authenticated", ADMIN, async () => {
      await expect(db.query("delete from public.certificates")).rejects.toThrow(/permission denied/);
    });
  });
});

describe("validacao publica", () => {
  it("anon valida por codigo exato e recebe so campos publicos com CPF mascarado", async () => {
    const [{ code }] = await q<{ code: string }>("select code from public.certificates where status = 'valid' limit 1");
    const rows = await as("anon", null, () => q<Record<string, unknown>>("select * from public.validate_certificate($1)", [code.toLowerCase()]));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: "valid", student_name: "Aluno Um", cpf_masked: "***.456.789-**" });
    expect(Object.keys(rows[0]).sort()).toEqual(
      ["cpf_masked", "course_name", "expires_at", "issued_at", "status", "student_name", "workload_hours"].sort(),
    );
  });

  it("codigo revogado aparece como revogado; codigo inexistente ou invalido nao devolve linha", async () => {
    const [{ code }] = await q<{ code: string }>("select code from public.certificates where status = 'revoked' limit 1");
    const [revoked] = await as("anon", null, () => q<{ status: string }>("select * from public.validate_certificate($1)", [code]));
    expect(revoked.status).toBe("revoked");
    expect(await as("anon", null, () => q("select * from public.validate_certificate('AAAAAAAAAA')"))).toHaveLength(0);
    expect(await as("anon", null, () => q("select * from public.validate_certificate('abc')"))).toHaveLength(0);
  });

  it("aplica rate limit por IP", async () => {
    let last: { status: string } | undefined;
    for (let i = 0; i < 25; i++) {
      const rows = await as("anon", null, () => q<{ status: string }>("select * from public.validate_certificate('AAAAAAAAAA')"));
      last = rows[0];
    }
    expect(last?.status).toBe("rate_limited");
  });
});

describe("perfis: ultimo administrador", () => {
  it("bloqueia rebaixar, desativar ou excluir o unico admin ativo", async () => {
    await expect(q(`update public.profiles set role = 'secretaria' where id = '${ADMIN}'`)).rejects.toThrow(/ao menos um administrador/);
    await expect(q(`update public.profiles set active = false where id = '${ADMIN}'`)).rejects.toThrow(/ao menos um administrador/);
    await expect(q(`delete from public.profiles where id = '${ADMIN}'`)).rejects.toThrow(/ao menos um administrador/);
  });

  it("permite quando existe outro admin ativo e nao afeta a secretaria", async () => {
    await q(`update public.profiles set role = 'admin' where id = '${SECRETARIA}'`);
    await q(`update public.profiles set active = false where id = '${ADMIN}'`);
    // agora a "secretaria" e a unica admin ativa: protegida
    await expect(q(`update public.profiles set active = false where id = '${SECRETARIA}'`)).rejects.toThrow(/ao menos um administrador/);
    // restaura o estado para os demais testes
    await q(`update public.profiles set active = true where id = '${ADMIN}'`);
    await q(`update public.profiles set role = 'secretaria' where id = '${SECRETARIA}'`);
    const rows = await q<{ role: string }>(`select role from public.profiles where id = '${SECRETARIA}'`);
    expect(rows[0]?.role).toBe("secretaria");
  });
});

describe("catalogo de treinamentos (supabase/catalog/treinamentos.sql)", () => {
  const catalogSql = () => readFileSync(join(root, "catalog", "treinamentos.sql"), "utf8");

  it("roda sobre o seed, e idempotente, respeita as constraints e preserva capa", async () => {
    await db.exec("update public.courses set cover_path = 'nr-35-capa.webp' where slug = 'nr-35'");
    await db.exec(catalogSql());
    await db.exec(catalogSql());
    const rows = await q<{ slug: string; category: string; workload_hours: number; validity_months: number | null; description: string; syllabus: string; active: boolean; cover_path: string | null }>(
      "select slug, category, workload_hours, validity_months, description, syllabus, active, cover_path from public.courses where slug = any($1)",
      [["nr-12", "nr-18", "nr-34", "nr-33", "nr-35", "nr-37", "movimentacao-de-cargas", "montador-de-andaime", "almoxarifado", "pintura-industrial-n1", "tecnicas-cozinheiro-offshore", "tecnicas-saloneiro-offshore", "tecnicas-taifeiro-offshore"]],
    );
    expect(rows).toHaveLength(13);
    expect(rows.every((r) => r.active && r.description.length > 20 && r.description.length <= 1000 && !r.syllabus.includes("[PENDENTE"))).toBe(true);
    expect(rows.some((r) => r.category === "parceria")).toBe(false);
    const by = Object.fromEntries(rows.map((r) => [r.slug, r]));
    expect(by["nr-35"]).toMatchObject({ workload_hours: 8, validity_months: 24, cover_path: "nr-35-capa.webp" });
    expect(by["nr-37"]).toMatchObject({ workload_hours: 6, validity_months: 60 });
    expect(by["pintura-industrial-n1"]?.workload_hours).toBe(200);
    expect(by["tecnicas-saloneiro-offshore"]?.validity_months).toBeNull();
    const split = await q<{ slug: string; theory_hours: number; practice_hours: number; workload_hours: number; technical_reference: string }>(
      "select slug, theory_hours, practice_hours, workload_hours, technical_reference from public.courses where active and slug in ('nr-12', 'nr-37', 'pintura-industrial-n1', 'movimentacao-de-cargas', 'nr-35')",
    );
    const sp = Object.fromEntries(split.map((r) => [r.slug, r]));
    expect(sp["nr-12"]).toMatchObject({ theory_hours: 6, practice_hours: 2, technical_reference: "NR 06; NR 10; NR 12 e NR 34" });
    expect(sp["nr-37"]).toMatchObject({ theory_hours: 6, practice_hours: 0 });
    expect(sp["pintura-industrial-n1"]).toMatchObject({ theory_hours: 160, practice_hours: 40 });
    expect(sp["movimentacao-de-cargas"]).toMatchObject({ theory_hours: 36, practice_hours: 4 });
    expect(sp["nr-35"]?.technical_reference).toBe("NR 06, NR 18, NR 34, NR 35");
    expect(split.every((r) => r.theory_hours + r.practice_hours === r.workload_hours)).toBe(true);
  });

  it("remove os treinamentos de exemplo sem turma e inativa os que tem turma", async () => {
    const left = await q<{ slug: string }>("select slug from public.courses where slug in ('cpso-primeiros-socorros', 'cuidador-de-idoso', 'barbeiro')");
    expect(left).toHaveLength(0);
    const nr10 = await q<{ active: boolean }>("select active from public.courses where slug = 'nr-10'");
    // nr-10 tem turma nos testes anteriores: nao pode ser apagado, so inativado
    expect(nr10.length === 0 || nr10[0]?.active === false).toBe(true);
  });
});
