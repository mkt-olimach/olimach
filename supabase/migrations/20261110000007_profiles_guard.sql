-- Garante que sempre exista ao menos um administrador ativo.
-- Bloqueia rebaixar, desativar ou excluir o ultimo admin ativo (mesmo para service_role).
create function public.profiles_guard_last_admin()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.role = 'admin' and old.active
     and (tg_op = 'DELETE' or new.role <> 'admin' or not new.active)
     and not exists (
       select 1 from public.profiles p
       where p.id <> old.id and p.role = 'admin' and p.active
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

create trigger profiles_guard_last_admin
  before update or delete on public.profiles
  for each row execute function public.profiles_guard_last_admin();
