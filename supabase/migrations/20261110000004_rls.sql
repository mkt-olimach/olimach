-- RLS em todas as tabelas. Papeis: admin e secretaria (profiles.role). anon nao acessa nada.
--
-- Matriz:
--   profiles           admin: tudo | staff: le o proprio
--   courses            staff: le | admin: escreve
--   instructors        staff: le | admin: escreve
--   technical_leads    staff: le | admin: escreve
--   classes            staff: tudo (excluir: admin)
--   class_instructors  staff: tudo
--   students           staff: le/cria/edita | admin: exclui
--   enrollments        staff: le/cria/edita | admin: exclui
--   certificates       staff: le/emite | admin: revoga | ninguem exclui (nao ha policy)
--   audit_log          admin: le | ninguem escreve (so trigger)
-- Escrita de PDFs e assinaturas na Storage fica na migration 6.

-- ---------------------------------------------------------------------------
-- Funcoes auxiliares (SECURITY DEFINER para ler profiles sem recursao de RLS)
-- ---------------------------------------------------------------------------
create function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.active
  );
$$;

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active and p.role = 'admin'
  );
$$;

revoke all on function public.is_staff(), public.is_admin() from public, anon;
grant execute on function public.is_staff(), public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Privilegios de tabela: negar por padrao, liberar so ao que a RLS vai filtrar
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

grant select, insert, update, delete on
  public.profiles, public.courses, public.instructors, public.technical_leads,
  public.classes, public.class_instructors, public.students, public.enrollments
  to authenticated;
grant select, insert, update on public.certificates to authenticated;
grant select on public.certificates_with_status to authenticated;
grant select on public.audit_log to authenticated;

-- ---------------------------------------------------------------------------
-- Habilitar RLS (service_role segue com bypass nativo, so em Edge Functions)
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.instructors enable row level security;
alter table public.technical_leads enable row level security;
alter table public.classes enable row level security;
alter table public.class_instructors enable row level security;
alter table public.students enable row level security;
alter table public.enrollments enable row level security;
alter table public.certificates enable row level security;
alter table public.audit_log enable row level security;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check ((select public.is_admin()));
create policy profiles_update on public.profiles
  for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy profiles_delete on public.profiles
  for delete to authenticated
  using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Catalogo: staff le, admin escreve
-- ---------------------------------------------------------------------------
create policy courses_select on public.courses
  for select to authenticated using ((select public.is_staff()));
create policy courses_write on public.courses
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy instructors_select on public.instructors
  for select to authenticated using ((select public.is_staff()));
create policy instructors_write on public.instructors
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy technical_leads_select on public.technical_leads
  for select to authenticated using ((select public.is_staff()));
create policy technical_leads_write on public.technical_leads
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Operacao: turmas, alunos, matriculas
-- ---------------------------------------------------------------------------
create policy classes_select on public.classes
  for select to authenticated using ((select public.is_staff()));
create policy classes_insert on public.classes
  for insert to authenticated with check ((select public.is_staff()));
create policy classes_update on public.classes
  for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy classes_delete on public.classes
  for delete to authenticated using ((select public.is_admin()));

create policy class_instructors_all on public.class_instructors
  for all to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));

create policy students_select on public.students
  for select to authenticated using ((select public.is_staff()));
create policy students_insert on public.students
  for insert to authenticated with check ((select public.is_staff()));
create policy students_update on public.students
  for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy students_delete on public.students
  for delete to authenticated using ((select public.is_admin()));

create policy enrollments_select on public.enrollments
  for select to authenticated using ((select public.is_staff()));
create policy enrollments_insert on public.enrollments
  for insert to authenticated with check ((select public.is_staff()));
create policy enrollments_update on public.enrollments
  for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy enrollments_delete on public.enrollments
  for delete to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Certificados: staff le e emite; so admin revoga; ninguem exclui
-- ---------------------------------------------------------------------------
create policy certificates_select on public.certificates
  for select to authenticated using ((select public.is_staff()));
create policy certificates_insert on public.certificates
  for insert to authenticated
  with check ((select public.is_staff()) and status = 'valid');
create policy certificates_update on public.certificates
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- audit_log: so admin le; sem policy de escrita (apenas triggers SECURITY DEFINER escrevem)
-- ---------------------------------------------------------------------------
create policy audit_log_select on public.audit_log
  for select to authenticated using ((select public.is_admin()));
