-- Storage privado. Nenhum bucket e publico; acesso por URL assinada de curta duracao.
--   certificates: PDFs emitidos em certificates/<code>.pdf (staff le e grava; sem update/delete, PDF imutavel)
--   signatures:   assinaturas de instrutores e responsaveis tecnicos (staff le; admin escreve)

insert into storage.buckets (id, name, public)
values ('certificates', 'certificates', false), ('signatures', 'signatures', false)
on conflict (id) do update set public = false;

create policy certificates_files_select on storage.objects
  for select to authenticated
  using (bucket_id = 'certificates' and (select public.is_staff()));
create policy certificates_files_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'certificates' and (select public.is_staff()));

create policy signatures_files_select on storage.objects
  for select to authenticated
  using (bucket_id = 'signatures' and (select public.is_staff()));
create policy signatures_files_write on storage.objects
  for all to authenticated
  using (bucket_id = 'signatures' and (select public.is_admin()))
  with check (bucket_id = 'signatures' and (select public.is_admin()));
