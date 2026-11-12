-- Endereco da empresa em campos separados: "address" passa a ser so o logradouro (rua/avenida);
-- numero, complemento e bairro ganham colunas proprias. O formulario preenche logradouro, bairro,
-- cidade e estado a partir do CEP.
alter table public.company_settings
  add column number text not null default '' check (length(number) <= 20),
  add column complement text not null default '' check (length(complement) <= 80),
  add column neighborhood text not null default '' check (length(neighborhood) <= 80);

-- O tipo de retorno muda, entao recria a funcao publica.
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
  select c.company_name, c.legal_name, c.cnpj, c.phone, c.whatsapp, c.email, c.website, c.address,
         c.number, c.complement, c.neighborhood, c.city, c.state, c.postal_code,
         c.facebook, c.instagram, c.linkedin, c.youtube, c.logo_path, c.favicon_path
  from public.company_settings c;
$$;

revoke all on function public.public_company() from public;
grant execute on function public.public_company() to anon, authenticated;
