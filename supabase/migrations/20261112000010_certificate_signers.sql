-- Assinaturas padrao do certificado: engenheiro tecnico, diretoria e tecnico em seguranca.
-- Sao tres funcoes fixas (uma linha por funcao), configuradas em Configuracoes. O certificado
-- sai com quatro campos: aluno (em branco, para assinar) e estes tres.
-- O responsavel tecnico escolhido na emissao deixa de existir: a coluna fica opcional
-- (certificados antigos mantem o vinculo).

create table public.certificate_signers (
  role text primary key check (role in ('engineer', 'director', 'safety_technician')),
  name text not null check (length(trim(name)) >= 3),
  qualification text not null default '',
  registry text not null default '',
  signature_path text check (signature_path is null or length(signature_path) <= 200),
  updated_at timestamptz not null default now()
);

alter table public.certificate_signers enable row level security;

create policy certificate_signers_select on public.certificate_signers
  for select to authenticated using ((select public.is_staff()));
create policy certificate_signers_write on public.certificate_signers
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

grant select, insert, update, delete on public.certificate_signers to authenticated;

create trigger audit_certificate_signers
  after insert or update or delete on public.certificate_signers
  for each row execute function public.audit_row();

alter table public.certificates alter column technical_lead_id drop not null;
