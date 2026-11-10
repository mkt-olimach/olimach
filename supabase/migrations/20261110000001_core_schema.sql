-- Olimach: schema principal.
-- Aplicar via Supabase CLI (supabase db push) ou SQL Editor, sempre em ordem.
-- Migrations sao aditivas: nunca editar uma ja aplicada, criar uma nova.

-- ---------------------------------------------------------------------------
-- Tipos
-- ---------------------------------------------------------------------------
create type public.course_category as enum ('nr', 'profissionalizante', 'parceria');
create type public.class_status as enum ('planned', 'ongoing', 'completed', 'cancelled');
create type public.certificate_status as enum ('valid', 'revoked');
create type public.profile_role as enum ('admin', 'secretaria');

-- ---------------------------------------------------------------------------
-- profiles (1:1 com auth.users). Sem cadastro publico: so admin cria perfis.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (length(trim(name)) >= 2),
  role public.profile_role not null default 'secretaria',
  active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- Catalogo
-- ---------------------------------------------------------------------------
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (length(trim(name)) >= 3),
  category public.course_category not null,
  nr_code text check (nr_code ~ '^NR-[0-9]{1,2}$'),
  workload_hours integer not null check (workload_hours > 0),
  syllabus text not null default '',
  modality text not null default 'presencial' check (modality in ('presencial', 'online', 'hibrido')),
  validity_months integer check (validity_months > 0),
  active boolean not null default true,
  -- nr_code obrigatorio para NR e proibido para as demais categorias
  constraint courses_nr_code_matches_category check ((category = 'nr') = (nr_code is not null))
);

create table public.instructors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) >= 3),
  qualification text not null,
  registry text not null,
  signature_path text
);

create table public.technical_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) >= 3),
  qualification text not null,
  registry text not null,
  signature_path text
);

-- ---------------------------------------------------------------------------
-- Turmas, alunos e matriculas
-- ---------------------------------------------------------------------------
create table public.classes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  start_date date not null,
  end_date date not null,
  location text not null,
  status public.class_status not null default 'planned',
  constraint classes_dates_ordered check (end_date >= start_date)
);
create index classes_course_id_idx on public.classes (course_id);

create table public.class_instructors (
  class_id uuid not null references public.classes (id) on delete cascade,
  instructor_id uuid not null references public.instructors (id) on delete restrict,
  primary key (class_id, instructor_id)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  full_name text not null check (length(trim(full_name)) >= 3),
  -- somente os 11 digitos; a mascara e aplicada na saida
  cpf text not null unique check (cpf ~ '^[0-9]{11}$'),
  birth_date date,
  phone text,
  email text,
  company text
);

create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  attendance_ok boolean not null default false,
  approved boolean not null default false,
  unique (class_id, student_id)
);
create index enrollments_student_id_idx on public.enrollments (student_id);

-- ---------------------------------------------------------------------------
-- Certificados
-- ---------------------------------------------------------------------------

-- Codigo publico de 10 caracteres, aleatorio (sem sequencia), alfabeto de 32 simbolos
-- sem ambiguos (sem 0, 1, I, O). 256 mod 32 = 0, entao nao ha vies de modulo.
-- Usa gen_random_uuid() (aleatorio criptografico, nativo) e descarta os bytes de versao/variante.
create function public.generate_certificate_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  raw bytea := pg_catalog.decode(pg_catalog.replace(gen_random_uuid()::text, '-', ''), 'hex');
  result text := '';
  idx integer;
  picks integer[] := array[0, 1, 2, 3, 4, 9, 10, 11, 12, 13];
begin
  foreach idx in array picks loop
    result := result || pg_catalog.substr(alphabet, (pg_catalog.get_byte(raw, idx) % 32) + 1, 1);
  end loop;
  return result;
end;
$$;

create table public.certificates (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete restrict,
  code text not null unique default public.generate_certificate_code()
    check (code ~ '^[2-9A-HJ-NP-Z]{10}$'),
  issued_at timestamptz not null default now(),
  -- preenchido por trigger a partir de courses.validity_months; null = sem validade
  expires_at timestamptz,
  technical_lead_id uuid not null references public.technical_leads (id) on delete restrict,
  pdf_path text not null,
  pdf_sha256 text not null check (pdf_sha256 ~ '^[0-9a-f]{64}$'),
  status public.certificate_status not null default 'valid',
  revoked_reason text,
  revoked_at timestamptz,
  constraint certificates_revocation_consistent check (
    (status = 'valid' and revoked_at is null and revoked_reason is null)
    or (status = 'revoked' and revoked_at is not null and revoked_reason is not null)
  )
);
-- correcao = revogar + reemitir: so um certificado valido por matricula
create unique index certificates_one_valid_per_enrollment
  on public.certificates (enrollment_id) where status = 'valid';

-- Status "vencido" e calculado, nunca gravado.
create view public.certificates_with_status
with (security_invoker = true) as
select
  c.*,
  case
    when c.status = 'revoked' then 'revoked'
    when c.expires_at is not null and c.expires_at < now() then 'expired'
    else 'valid'
  end as effective_status
from public.certificates c;
