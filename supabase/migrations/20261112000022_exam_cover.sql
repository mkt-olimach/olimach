-- A prova do aluno passa a exibir a capa do treinamento (bucket publico course-covers).
-- Recria exam_start so para incluir exam.cover_path; as permissoes (grant/revoke) permanecem.

create or replace function public.exam_start(p_token text, p_cpf text, p_password text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  a public.exam_assignments%rowtype;
  e public.exams%rowtype;
  s public.students%rowtype;
  att public.exam_attempts%rowtype;
  v_token_hash text := encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex');
  v_cpf text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  v_pass text := upper(btrim(coalesce(p_password, '')));
  v_key text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_used integer;
  v_total integer;
  v_questions jsonb;
  v_deadline timestamptz;
begin
  if public.exam_rate_limited() then
    return jsonb_build_object('status', 'rate_limited');
  end if;

  select * into a from public.exam_assignments where token_hash = v_token_hash;
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;
  if a.revoked or (a.expires_at is not null and a.expires_at < now()) then
    return jsonb_build_object('status', 'unavailable');
  end if;
  if a.locked_until is not null and a.locked_until > now() then
    return jsonb_build_object('status', 'locked');
  end if;

  select * into s from public.students where id = a.student_id;
  if s.cpf <> v_cpf or a.password_hash <> encode(sha256(convert_to(a.password_salt || v_pass, 'UTF8')), 'hex') then
    -- resposta generica: nao revela se foi o CPF ou a senha
    update public.exam_assignments
      set failed_logins = case when failed_logins + 1 >= 5 then 0 else failed_logins + 1 end,
          locked_until = case when failed_logins + 1 >= 5 then now() + interval '15 minutes' else locked_until end
      where id = a.id;
    return jsonb_build_object('status', 'invalid');
  end if;
  update public.exam_assignments set failed_logins = 0, locked_until = null where id = a.id;

  select * into e from public.exams where id = a.exam_id;
  select count(*) into v_total from public.exam_questions where exam_id = e.id;
  if not e.active or v_total = 0 then
    return jsonb_build_object('status', 'unavailable');
  end if;

  -- tentativa em andamento: retoma (gira a chave de envio) ou encerra se o prazo ja passou
  select * into att from public.exam_attempts
    where assignment_id = a.id and finished_at is null order by started_at desc limit 1;
  if found then
    if att.deadline_at is null or att.deadline_at + interval '30 seconds' > now() then
      update public.exam_attempts set key_hash = encode(sha256(convert_to(v_key, 'UTF8')), 'hex') where id = att.id;
      v_deadline := att.deadline_at;
    else
      update public.exam_attempts
        set finished_at = now(), score = 0, passed = false, correct_count = 0, total_count = v_total, late = true
        where id = att.id;
      att.id := null;
    end if;
  end if;

  if att.id is null then
    select count(*) into v_used from public.exam_attempts where assignment_id = a.id and finished_at is not null;
    if v_used >= a.max_attempts then
      return jsonb_build_object('status', 'no_attempts', 'student_name', s.full_name);
    end if;
    v_deadline := case when e.time_limit_minutes is null then null else now() + make_interval(mins => e.time_limit_minutes) end;
    insert into public.exam_attempts (assignment_id, key_hash, deadline_at)
    values (a.id, encode(sha256(convert_to(v_key, 'UTF8')), 'hex'), v_deadline);
  end if;

  select coalesce(jsonb_agg(
           jsonb_build_object(
             'id', q.id,
             'text', q.text,
             'options', (
               select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'text', o.text) order by random()), '[]'::jsonb)
               from public.exam_options o where o.question_id = q.id
             )
           ) order by q.position, q.created_at
         ), '[]'::jsonb)
    into v_questions
    from public.exam_questions q where q.exam_id = e.id;

  return jsonb_build_object(
    'status', 'ok',
    'attempt_key', v_key,
    'student_name', s.full_name,
    'exam', jsonb_build_object(
      'title', e.title,
      'cover_path', (select c.cover_path from public.courses c where c.id = e.course_id),
      'instructions', e.instructions,
      'passing_score', e.passing_score,
      'time_limit_minutes', e.time_limit_minutes,
      'max_attempts', a.max_attempts
    ),
    'deadline_at', v_deadline,
    'server_now', now(),
    'questions', v_questions
  );
end;
$$;