-- Exclusao de uma aplicacao de prova (apaga tambem as tentativas e resultados dela).
-- So administrador. Fica registrada no log de atividades, sem hashes.
create function public.delete_exam_assignment(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_assignment public.exam_assignments%rowtype;
  v_attempts integer;
begin
  if not (select public.is_admin()) then
    raise exception 'Somente administradores excluem aplicacoes de prova' using errcode = 'insufficient_privilege';
  end if;
  select * into v_assignment from public.exam_assignments where id = p_id;
  if not found then
    raise exception 'Aplicacao nao encontrada' using errcode = 'no_data_found';
  end if;
  select count(*) into v_attempts from public.exam_attempts where assignment_id = p_id;
  delete from public.exam_assignments where id = p_id; -- exam_attempts apaga em cascata
  insert into public.audit_log (actor_id, action, entity, entity_id, payload)
  values ((select auth.uid()), 'delete', 'exam_assignments', p_id,
          jsonb_build_object('exam_id', v_assignment.exam_id, 'student_id', v_assignment.student_id, 'attempts_deleted', v_attempts));
end;
$$;

revoke all on function public.delete_exam_assignment(uuid) from public, anon;
grant execute on function public.delete_exam_assignment(uuid) to authenticated;
