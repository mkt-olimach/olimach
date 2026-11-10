import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ADMIN = "11111111-1111-4111-8111-111111111111";
const SECRETARIA = "22222222-2222-4222-8222-222222222222";

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
