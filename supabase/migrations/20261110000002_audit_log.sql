-- audit_log: append-only, alimentado por trigger em emitir, editar, revogar e excluir.

create table public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_entity_idx on public.audit_log (entity, entity_id);
create index audit_log_created_at_idx on public.audit_log (created_at desc);

-- Imutabilidade: nem service_role altera ou apaga o log (triggers disparam para todos).
create function public.audit_log_block_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'audit_log e imutavel' using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_log_no_update_delete
  before update or delete on public.audit_log
  for each row execute function public.audit_log_block_mutation();

-- Trigger generica de auditoria.
-- Dados pessoais de students (cpf, nascimento, telefone, e-mail) nunca entram no payload:
-- em edicoes registra-se apenas o nome dos campos alterados.
create function public.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  sensitive constant text[] := array['cpf', 'birth_date', 'phone', 'email'];
  v_old jsonb;
  v_new jsonb;
  v_changed text[];
  v_action text;
  v_payload jsonb;
  v_row jsonb;
begin
  if tg_op = 'INSERT' then
    v_new := pg_catalog.to_jsonb(new);
    v_row := v_new;
    v_action := case when tg_table_name = 'certificates' then 'emit' else 'insert' end;
    v_payload := case when tg_table_name = 'students' then v_new - sensitive else v_new end;

  elsif tg_op = 'UPDATE' then
    v_old := pg_catalog.to_jsonb(old);
    v_new := pg_catalog.to_jsonb(new);
    v_row := v_new;
    select pg_catalog.array_agg(n.key order by n.key)
      into v_changed
      from pg_catalog.jsonb_each(v_new) n
      where n.value is distinct from v_old -> n.key;

    if v_changed is null then
      return new; -- nada mudou
    end if;

    v_action := case
      when tg_table_name = 'certificates'
        and v_old ->> 'status' = 'valid' and v_new ->> 'status' = 'revoked' then 'revoke'
      else 'update'
    end;

    if tg_table_name = 'students' then
      v_payload := pg_catalog.jsonb_build_object('changed_fields', v_changed);
    else
      v_payload := pg_catalog.jsonb_build_object(
        'changed_fields', v_changed,
        'old', (select pg_catalog.jsonb_object_agg(k, v_old -> k) from pg_catalog.unnest(v_changed) k),
        'new', (select pg_catalog.jsonb_object_agg(k, v_new -> k) from pg_catalog.unnest(v_changed) k)
      );
    end if;

  else -- DELETE
    v_old := pg_catalog.to_jsonb(old);
    v_row := v_old;
    v_action := 'delete';
    v_payload := case when tg_table_name = 'students' then v_old - sensitive else v_old end;
  end if;

  insert into public.audit_log (actor_id, action, entity, entity_id, payload)
  values (
    auth.uid(),
    v_action,
    tg_table_name,
    (v_row ->> 'id')::uuid, -- class_instructors nao tem id: fica null
    v_payload
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'courses', 'instructors', 'technical_leads', 'classes',
    'class_instructors', 'students', 'enrollments', 'certificates'
  ] loop
    execute pg_catalog.format(
      'create trigger %I after insert or update or delete on public.%I
         for each row execute function public.audit_row()',
      'audit_' || t, t
    );
  end loop;
end;
$$;
