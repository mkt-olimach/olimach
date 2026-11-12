-- White label: perfil super_admin e dados da empresa configuraveis (logo, favicon, nome, contatos).
--
-- * super_admin e um admin com poderes extras: administra o modulo White Label e e o unico que
--   cria, altera, desativa ou exclui outro super_admin. Todas as regras de admin valem para ele.
-- * company_settings tem uma unica linha (singleton). Leitura: equipe. Escrita: so super_admin.
-- * A landing le apenas os campos de divulgacao via public.public_company() (anon nao le a tabela).
-- * Logo e favicon ficam no bucket publico "branding" (imagens de marca, sem dado pessoal).

create function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active and p.role = 'super_admin'
  );
$$;

revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated;

-- super_admin tambem e administrador (catalogo, equipe, revogacao, assinaturas...).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.active and p.role in ('admin', 'super_admin')
  );
$$;

-- Sempre deve existir ao menos um administrador ativo (admin ou super_admin).
create or replace function public.profiles_guard_last_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role in ('admin', 'super_admin') and old.active
     and (tg_op = 'DELETE' or new.role not in ('admin', 'super_admin') or not new.active)
     and not exists (
       select 1 from public.profiles p
       where p.id <> old.id and p.role in ('admin', 'super_admin') and p.active
     ) then
    raise exception 'Deve existir ao menos um administrador ativo'
      using errcode = 'check_violation';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

-- So um super_admin mexe em super_admin. Sem sessao (SQL Editor, scripts de manutencao) passa.
create function public.profiles_guard_super_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or (select public.is_super_admin()) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;
  if (tg_op = 'INSERT' and new.role = 'super_admin')
     or (tg_op = 'UPDATE' and (old.role = 'super_admin' or new.role = 'super_admin'))
     or (tg_op = 'DELETE' and old.role = 'super_admin') then
    raise exception 'Somente o super administrador altera um super administrador'
      using errcode = 'insufficient_privilege';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger profiles_guard_super_admin
  before insert or update or delete on public.profiles
  for each row execute function public.profiles_guard_super_admin();

-- Dados da empresa (uma linha so). Sem coluna "id": a auditoria grava entity_id nulo.
create table public.company_settings (
  singleton boolean primary key default true check (singleton),
  company_name text not null check (length(trim(company_name)) >= 2 and length(company_name) <= 120),
  legal_name text not null default '' check (length(legal_name) <= 160),
  cnpj text not null default '' check (length(cnpj) <= 24),
  phone text not null default '' check (length(phone) <= 40),
  whatsapp text not null default '' check (length(whatsapp) <= 40),
  email text not null default '' check (length(email) <= 160),
  website text not null default '' check (length(website) <= 200),
  address text not null default '' check (length(address) <= 200),
  city text not null default '' check (length(city) <= 80),
  state text not null default '' check (length(state) <= 40),
  postal_code text not null default '' check (length(postal_code) <= 20),
  facebook text not null default '' check (length(facebook) <= 200),
  instagram text not null default '' check (length(instagram) <= 200),
  linkedin text not null default '' check (length(linkedin) <= 200),
  youtube text not null default '' check (length(youtube) <= 200),
  logo_path text check (logo_path is null or length(logo_path) <= 200),
  favicon_path text check (favicon_path is null or length(favicon_path) <= 200),
  updated_at timestamptz not null default now()
);

alter table public.company_settings enable row level security;

create policy company_settings_select on public.company_settings
  for select to authenticated using ((select public.is_staff()));
create policy company_settings_write on public.company_settings
  for all to authenticated
  using ((select public.is_super_admin())) with check ((select public.is_super_admin()));

grant select, insert, update on public.company_settings to authenticated;

create trigger audit_company_settings
  after insert or update or delete on public.company_settings
  for each row execute function public.audit_row();

-- Vitrine publica dos dados da empresa (landing, rodape, contatos).
create function public.public_company()
returns table (
  company_name text,
  legal_name text,
  cnpj text,
  phone text,
  whatsapp text,
  email text,
  website text,
  address text,
  city text,
  state text,
  postal_code text,
  facebook text,
  instagram text,
  linkedin text,
  youtube text,
  logo_path text,
  favicon_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.company_name, c.legal_name, c.cnpj, c.phone, c.whatsapp, c.email, c.website, c.address, c.city,
         c.state, c.postal_code, c.facebook, c.instagram, c.linkedin, c.youtube, c.logo_path, c.favicon_path
  from public.company_settings c;
$$;

revoke all on function public.public_company() from public;
grant execute on function public.public_company() to anon, authenticated;

-- Marca: bucket publico; escrita so do super_admin.
insert into storage.buckets (id, name, public)
values ('branding', 'branding', true)
on conflict (id) do update set public = true;

create policy branding_select on storage.objects
  for select to authenticated
  using (bucket_id = 'branding' and (select public.is_staff()));
create policy branding_write on storage.objects
  for all to authenticated
  using (bucket_id = 'branding' and (select public.is_super_admin()))
  with check (bucket_id = 'branding' and (select public.is_super_admin()));
