-- Convite com senha provisoria: a conta nasce com uma senha definida pelo administrador e o usuario
-- troca no primeiro acesso. O painel bloqueia a navegacao ate a troca (must_change_password).
-- E uma trava de fluxo, nao de seguranca: o usuario so limpa o proprio marcador, pela funcao abaixo.

alter table public.profiles add column must_change_password boolean not null default false;

create function public.clear_must_change_password()
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.profiles set must_change_password = false where id = auth.uid() and must_change_password;
$$;
revoke all on function public.clear_must_change_password() from public, anon;
grant execute on function public.clear_must_change_password() to authenticated;
