-- Galeria de imagens do site (pagina /galeria), administrada no painel.
--
-- * Imagens ficam no bucket PUBLICO "gallery" (fotos de divulgacao, sem dado pessoal).
-- * Leitura: equipe. Escrita (enviar, editar, excluir): administradores.
-- * O site le so via public.public_gallery() (o anon nao le a tabela).

create table public.gallery_images (
  id uuid primary key default gen_random_uuid(),
  path text not null unique check (length(path) between 1 and 200),
  title text not null default '' check (length(title) <= 120),
  description text not null default '' check (length(description) <= 300),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create index gallery_images_created_at_idx on public.gallery_images (created_at desc);

alter table public.gallery_images enable row level security;

create policy gallery_images_select on public.gallery_images
  for select to authenticated using ((select public.is_staff()));
create policy gallery_images_write on public.gallery_images
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

grant select, insert, update, delete on public.gallery_images to authenticated;

create trigger audit_gallery_images
  after insert or update or delete on public.gallery_images
  for each row execute function public.audit_row();

create function public.public_gallery()
returns table (id uuid, path text, title text, description text, width integer, height integer)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.path, g.title, g.description, g.width, g.height
  from public.gallery_images g
  order by g.created_at desc, g.id;
$$;

revoke all on function public.public_gallery() from public;
grant execute on function public.public_gallery() to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('gallery', 'gallery', true)
on conflict (id) do update set public = true;

create policy gallery_files_select on storage.objects
  for select to authenticated
  using (bucket_id = 'gallery' and (select public.is_staff()));
create policy gallery_files_write on storage.objects
  for all to authenticated
  using (bucket_id = 'gallery' and (select public.is_admin()))
  with check (bucket_id = 'gallery' and (select public.is_admin()));
