-- Vitrine publica de treinamentos: descricao, imagem de capa e RPC para a landing.
--
-- Capas ficam em bucket PUBLICO (course-covers): sao imagens de divulgacao, sem dado pessoal.
-- Os demais buckets continuam privados. Escrita nas capas: somente administrador.
-- A landing nunca le a tabela: o anon so executa public.public_courses(), que devolve
-- apenas treinamentos ativos e apenas campos de divulgacao (sem conteudo programatico interno).

alter table public.courses
  add column description text not null default '' check (length(description) <= 1000),
  add column cover_path text check (cover_path is null or length(cover_path) <= 200);

insert into storage.buckets (id, name, public)
values ('course-covers', 'course-covers', true)
on conflict (id) do update set public = true;

create policy course_covers_select on storage.objects
  for select to authenticated
  using (bucket_id = 'course-covers' and (select public.is_staff()));
create policy course_covers_write on storage.objects
  for all to authenticated
  using (bucket_id = 'course-covers' and (select public.is_admin()))
  with check (bucket_id = 'course-covers' and (select public.is_admin()));

create function public.public_courses()
returns table (
  slug text,
  name text,
  category public.course_category,
  nr_code text,
  workload_hours integer,
  modality text,
  description text,
  cover_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.slug, c.name, c.category, c.nr_code, c.workload_hours, c.modality, c.description, c.cover_path
  from public.courses c
  where c.active
  order by c.name;
$$;

revoke all on function public.public_courses() from public;
grant execute on function public.public_courses() to anon, authenticated;
