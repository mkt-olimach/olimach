-- Aprovacao na emissao de certificados: o perfil Secretaria apenas SOLICITA; so o Administrador
-- (admin ou super_admin) emite. Antes, qualquer usuario da equipe inseria em certificates.
--
-- Camadas: (1) a policy de insert em certificates e em storage.objects (bucket certificates) passa a
-- exigir is_admin(); (2) a Edge Function issue-certificate recusa quem nao e admin; (3) a secretaria
-- cria a solicitacao por RPC, que valida a matricula. O sino de notificacoes do admin lista as pendentes.

create table public.certificate_requests (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.enrollments (id) on delete cascade,
  requested_by uuid references public.profiles (id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  reject_reason text check (reject_reason is null or length(reject_reason) <= 500),
  decided_by uuid references public.profiles (id) on delete set null,
  decided_at timestamptz,
  certificate_id uuid references public.certificates (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint certificate_requests_decision_consistent check (
    (status = 'pending' and decided_at is null) or (status <> 'pending' and decided_at is not null)
  )
);

-- no maximo uma solicitacao pendente por matricula
create unique index certificate_requests_one_pending on public.certificate_requests (enrollment_id) where status = 'pending';
create index certificate_requests_status_created on public.certificate_requests (status, created_at desc);

alter table public.certificate_requests enable row level security;
create policy certificate_requests_select on public.certificate_requests
  for select to authenticated using ((select public.is_staff()));
-- sem policies de escrita: tudo passa pelas funcoes abaixo
grant select on public.certificate_requests to authenticated;

create trigger audit_certificate_requests
  after insert or update or delete on public.certificate_requests
  for each row execute function public.audit_row();

-- A emissao e so do administrador (banco e Storage).
drop policy certificates_insert on public.certificates;
create policy certificates_insert on public.certificates
  for insert to authenticated
  with check ((select public.is_admin()) and status = 'valid');

drop policy certificates_files_insert on storage.objects;
create policy certificates_files_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'certificates' and (select public.is_admin()));

-- Secretaria solicita a emissao.
create function public.request_certificate(p_enrollment_id uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  e record;
begin
  if not (select public.is_staff()) then
    raise exception 'sem permissao' using errcode = '42501';
  end if;
  if (select public.is_admin()) then
    raise exception 'administradores emitem diretamente, sem solicitacao' using errcode = '22023';
  end if;

  select en.attendance_ok, en.approved, c.category
    into e
    from public.enrollments en
    join public.classes cl on cl.id = en.class_id
    join public.courses c on c.id = cl.course_id
    where en.id = p_enrollment_id;
  if not found then
    raise exception 'matricula nao encontrada' using errcode = 'P0002';
  end if;
  if e.category = 'parceria' then
    raise exception 'cursos de parceria nao emitem certificado' using errcode = '22023';
  end if;
  if not (e.attendance_ok and e.approved) then
    raise exception 'o certificado exige presenca confirmada e aprovacao' using errcode = '22023';
  end if;
  if exists (select 1 from public.certificates where enrollment_id = p_enrollment_id and status = 'valid') then
    raise exception 'esta matricula ja tem certificado valido' using errcode = '22023';
  end if;

  insert into public.certificate_requests (enrollment_id, requested_by)
  values (p_enrollment_id, auth.uid())
  returning id into v_id;
  return v_id;
exception
  when unique_violation then
    raise exception 'ja existe uma solicitacao pendente para esta matricula' using errcode = '23505';
end;
$$;
revoke all on function public.request_certificate(uuid) from public, anon;
grant execute on function public.request_certificate(uuid) to authenticated;

-- Admin recusa (com motivo).
create function public.reject_certificate_request(p_id uuid, p_reason text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'somente administrador' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_reason, ''))) < 3 or length(p_reason) > 500 then
    raise exception 'informe o motivo da recusa' using errcode = '22023';
  end if;
  update public.certificate_requests
    set status = 'rejected', reject_reason = btrim(p_reason), decided_by = auth.uid(), decided_at = now()
    where id = p_id and status = 'pending';
  if not found then
    raise exception 'solicitacao nao encontrada ou ja decidida' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.reject_certificate_request(uuid, text) from public, anon;
grant execute on function public.reject_certificate_request(uuid, text) to authenticated;

-- Quem pediu (ou um admin) cancela uma solicitacao pendente.
create function public.cancel_certificate_request(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.certificate_requests
    set status = 'cancelled', decided_by = auth.uid(), decided_at = now()
    where id = p_id and status = 'pending'
      and ((select public.is_admin()) or (requested_by = auth.uid() and (select public.is_staff())));
  if not found then
    raise exception 'solicitacao nao encontrada, ja decidida ou sem permissao' using errcode = 'P0002';
  end if;
end;
$$;
revoke all on function public.cancel_certificate_request(uuid) from public, anon;
grant execute on function public.cancel_certificate_request(uuid) to authenticated;

-- Chamada pela Edge Function depois de emitir: marca como aprovada a solicitacao pendente da matricula.
create function public.complete_certificate_request(p_certificate_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not (select public.is_admin()) then
    raise exception 'somente administrador' using errcode = '42501';
  end if;
  update public.certificate_requests r
    set status = 'approved', decided_by = auth.uid(), decided_at = now(), certificate_id = p_certificate_id
    from public.certificates c
    where c.id = p_certificate_id and r.enrollment_id = c.enrollment_id and r.status = 'pending';
end;
$$;
revoke all on function public.complete_certificate_request(uuid) from public, anon;
grant execute on function public.complete_certificate_request(uuid) to authenticated;
