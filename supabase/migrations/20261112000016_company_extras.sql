-- Horario de atendimento e logo em escala de cinza (marca d'agua do certificado, gerada no upload).
alter table public.company_settings
  add column business_hours text not null default '' check (length(business_hours) <= 160),
  add column logo_gray_path text check (logo_gray_path is null or length(logo_gray_path) <= 200);

-- O tipo de retorno muda (business_hours), entao recria a funcao publica.
drop function public.public_company();

create function public.public_company()
returns table (
  company_name text,
  legal_name text,
  cnpj text,
  phone text,
  whatsapp text,
  email text,
  website text,
  business_hours text,
  address text,
  number text,
  complement text,
  neighborhood text,
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
  select c.company_name, c.legal_name, c.cnpj, c.phone, c.whatsapp, c.email, c.website, c.business_hours,
         c.address, c.number, c.complement, c.neighborhood, c.city, c.state, c.postal_code,
         c.facebook, c.instagram, c.linkedin, c.youtube, c.logo_path, c.favicon_path
  from public.company_settings c;
$$;

revoke all on function public.public_company() from public;
grant execute on function public.public_company() to anon, authenticated;
