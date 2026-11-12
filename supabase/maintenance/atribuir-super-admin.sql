-- Atribui o perfil super_admin a uma conta existente (o usuario ja precisa ter entrado no Auth).
-- Rodar no Supabase SQL Editor DEPOIS das migrations 20261112000013 e 20261112000014
-- (cada uma em uma execucao separada).
-- Troque o e-mail abaixo para atribuir a outra pessoa.
insert into public.profiles (id, name, role, active)
select u.id, coalesce(nullif(u.raw_user_meta_data ->> 'name', ''), split_part(u.email, '@', 1)), 'super_admin', true
from auth.users u
where lower(u.email) = lower('w.renato.menezes@gmail.com')
on conflict (id) do update set role = 'super_admin', active = true;

-- Conferir:
select u.email, p.name, p.role, p.active
from public.profiles p join auth.users u on u.id = p.id
where p.role = 'super_admin';
