-- Cor de destaque do site (substitui o laranja padrao), escolhida no modulo White Label.
alter table public.company_settings
  add column accent_color text check (accent_color is null or accent_color ~ '^#[0-9a-fA-F]{6}$');

-- O tipo de retorno muda (accent_color), entao recria a funcao publica.
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
  favicon_path text,
  accent_color text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.company_name, c.legal_name, c.cnpj, c.phone, c.whatsapp, c.email, c.website, c.business_hours,
         c.address, c.number, c.complement, c.neighborhood, c.city, c.state, c.postal_code,
         c.facebook, c.instagram, c.linkedin, c.youtube, c.logo_path, c.favicon_path, c.accent_color
  from public.company_settings c;
$$;

revoke all on function public.public_company() from public;
grant execute on function public.public_company() to anon, authenticated;
