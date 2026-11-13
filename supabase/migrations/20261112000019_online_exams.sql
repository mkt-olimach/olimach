-- Provas online (MVP).
--
-- Fluxo: a equipe cadastra a prova de um treinamento (questoes de multipla escolha), "aplica" a prova a um
-- aluno e recebe UM link com token aleatorio + uma senha provisoria. O aluno abre o link, confirma o CPF
-- e a senha, faz a prova no tempo definido e o resultado fica registrado.
--
-- Seguranca:
--  * O gabarito (exam_options.is_correct) nunca sai do banco para o aluno: so a equipe le as tabelas (RLS) e o
--    aluno (anon) fala apenas com RPCs SECURITY DEFINER que devolvem questoes sem gabarito e corrigem NO SERVIDOR.
--  * Nenhum dado pessoal na URL: o link leva so um token de 244 bits; o CPF e digitado e conferido no servidor.
--  * Token e senha so existem em claro na resposta de create_exam_assignment (exibidos uma vez); o banco guarda hashes.
--  * Limites: rate limit por IP, bloqueio de 15 min apos 5 erros de CPF/senha, tentativas e prazo por aplicacao.

-- ---------------------------------------------------------------------------
-- Tabelas
-- ---------------------------------------------------------------------------
create table public.exams (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses (id) on delete restrict,
  title text not null check (length(trim(title)) between 3 and 160),
  instructions text not null default '' check (length(instructions) <= 2000),
  passing_score integer not null default 70 check (passing_score between 0 and 100),
  time_limit_minutes integer check (time_limit_minutes is null or time_limit_minutes between 1 and 480),
  max_attempts integer not null default 1 check (max_attempts between 1 and 10),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.exam_questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete cascade,
  position integer not null default 0,
  text text not null check (length(trim(text)) between 3 and 1000),
  created_at timestamptz not null default now()
);
create index exam_questions_exam_idx on public.exam_questions (exam_id, position);

create table public.exam_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.exam_questions (id) on delete cascade,
  position integer not null default 0,
  text text not null check (length(trim(text)) between 1 and 500),
  is_correct boolean not null default false
);
create index exam_options_question_idx on public.exam_options (question_id, position);
-- no maximo uma alternativa correta por questao (a UI exige exatamente uma)
create unique index exam_options_one_correct on public.exam_options (question_id) where is_correct;

create table public.exam_assignments (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  token_hash text not null unique,
  password_salt text not null,
  password_hash text not null,
  max_attempts integer not null check (max_attempts between 1 and 10),
  expires_at timestamptz,
  revoked boolean not null default false,
  failed_logins integer not null default 0,
  locked_until timestamptz,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);
create index exam_assignments_exam_idx on public.exam_assignments (exam_id);
create index exam_assignments_student_idx on public.exam_assignments (student_id);

create table public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.exam_assignments (id) on delete cascade,
  key_hash text not null,
  started_at timestamptz not null default now(),
  deadline_at timestamptz,
  finished_at timestamptz,
  score numeric(5, 1),
  passed boolean,
  correct_count integer,
  total_count integer,
  late boolean not null default false,
  answers jsonb not null default '{}'::jsonb
);
create index exam_attempts_assignment_idx on public.exam_attempts (assignment_id, started_at desc);
create index exam_attempts_key_idx on public.exam_attempts (key_hash);

-- ---------------------------------------------------------------------------
-- RLS e privilegios
-- ---------------------------------------------------------------------------
alter table public.exams enable row level security;
alter table public.exam_questions enable row level security;
alter table public.exam_options enable row level security;
alter table public.exam_assignments enable row level security;
alter table public.exam_attempts enable row level security;

revoke all on public.exams, public.exam_questions, public.exam_options, public.exam_assignments, public.exam_attempts
  from anon, authenticated;

-- catalogo de provas: equipe le, administrador escreve
grant select, insert, update, delete on public.exams, public.exam_questions, public.exam_options to authenticated;
create policy exams_select on public.exams for select to authenticated using ((select public.is_staff()));
create policy exams_write on public.exams for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy exam_questions_select on public.exam_questions for select to authenticated using ((select public.is_staff()));
create policy exam_questions_write on public.exam_questions for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy exam_options_select on public.exam_options for select to authenticated using ((select public.is_staff()));
create policy exam_options_write on public.exam_options for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- aplicacoes: a equipe so le colunas seguras (sem hashes); criar e revogar so pelas RPCs abaixo
grant select (id, exam_id, student_id, max_attempts, expires_at, revoked, failed_logins, locked_until, created_by, created_at)
  on public.exam_assignments to authenticated;
create policy exam_assignments_select on public.exam_assignments for select to authenticated using ((select public.is_staff()));

grant select (id, assignment_id, started_at, deadline_at, finished_at, score, passed, correct_count, total_count, late, answers)
  on public.exam_attempts to authenticated;
create policy exam_attempts_select on public.exam_attempts for select to authenticated using ((select public.is_staff()));

-- auditoria das provas e questoes (aplicacoes e revogacoes sao auditadas dentro das RPCs, sem hashes)
create trigger audit_exams after insert or update or delete on public.exams
  for each row execute function public.audit_row();
create trigger audit_exam_questions after insert or update or delete on public.exam_questions
  for each row execute function public.audit_row();

-- ---------------------------------------------------------------------------
-- Painel de acompanhamento (uma linha por aplicacao)
-- ---------------------------------------------------------------------------
create view public.exam_assignments_overview
with (security_invoker = true) as
select
  a.id,
  a.exam_id,
  e.title as exam_title,
  c.name as course_name,
  a.student_id,
  s.full_name as student_name,
  s.cpf as student_cpf,
  a.max_attempts,
  a.expires_at,
  a.revoked,
  a.locked_until,
  a.created_at,
  count(t.id) filter (where t.finished_at is not null)::integer as attempts_used,
  coalesce(bool_or(t.finished_at is null), false) as in_progress,
  max(t.score) as best_score,
  bool_or(t.passed) as passed,
  max(t.finished_at) as last_finished_at
from public.exam_assignments a
join public.exams e on e.id = a.exam_id
join public.courses c on c.id = e.course_id
join public.students s on s.id = a.student_id
left join public.exam_attempts t on t.assignment_id = a.id
group by a.id, e.title, c.name, s.id;

grant select on public.exam_assignments_overview to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs da equipe
-- ---------------------------------------------------------------------------
create function public.create_exam_assignment(
  p_exam_id uuid,
  p_student_id uuid,
  p_expires_at timestamptz default null,
  p_max_attempts integer default null
)
returns table (assignment_id uuid, token text, password text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_exam public.exams%rowtype;
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_salt text := replace(gen_random_uuid()::text, '-', '');
  v_alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  v_bytes bytea := decode(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16), 'hex');
  v_password text := '';
  v_id uuid;
  i integer;
begin
  if not (select public.is_staff()) then
    raise exception 'Sem permissao' using errcode = 'insufficient_privilege';
  end if;
  select * into v_exam from public.exams where id = p_exam_id and active;
  if not found then
    raise exception 'Prova nao encontrada ou inativa' using errcode = 'no_data_found';
  end if;
  if not exists (select 1 from public.exam_questions where exam_id = p_exam_id) then
    raise exception 'A prova ainda nao tem questoes' using errcode = 'check_violation';
  end if;
  if not exists (select 1 from public.students where id = p_student_id) then
    raise exception 'Aluno nao encontrado' using errcode = 'no_data_found';
  end if;
  for i in 0..7 loop
    v_password := v_password || substr(v_alphabet, (get_byte(v_bytes, i) % 32) + 1, 1);
  end loop;

  insert into public.exam_assignments (exam_id, student_id, token_hash, password_salt, password_hash, max_attempts, expires_at)
  values (
    p_exam_id,
    p_student_id,
    encode(sha256(convert_to(v_token, 'UTF8')), 'hex'),
    v_salt,
    encode(sha256(convert_to(v_salt || v_password, 'UTF8')), 'hex'),
    coalesce(p_max_attempts, v_exam.max_attempts),
    p_expires_at
  )
  returning id into v_id;

  insert into public.audit_log (actor_id, action, entity, entity_id, payload)
  values ((select auth.uid()), 'insert', 'exam_assignments', v_id,
          jsonb_build_object('exam_id', p_exam_id, 'student_id', p_student_id, 'expires_at', p_expires_at));

  return query select v_id, v_token, v_password;
end;
$$;

create function public.revoke_exam_assignment(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not (select public.is_staff()) then
    raise exception 'Sem permissao' using errcode = 'insufficient_privilege';
  end if;
  update public.exam_assignments set revoked = true where id = p_id and not revoked;
  if found then
    insert into public.audit_log (actor_id, action, entity, entity_id, payload)
    values ((select auth.uid()), 'revoke', 'exam_assignments', p_id, '{}'::jsonb);
  end if;
end;
$$;

revoke all on function public.create_exam_assignment(uuid, uuid, timestamptz, integer) from public, anon;
revoke all on function public.revoke_exam_assignment(uuid) from public, anon;
grant execute on function public.create_exam_assignment(uuid, uuid, timestamptz, integer) to authenticated;
grant execute on function public.revoke_exam_assignment(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPCs do aluno (anon): iniciar e enviar a prova
-- ---------------------------------------------------------------------------
-- IP do cliente para rate limit. O primeiro item de X-Forwarded-For pode ser forjado pelo cliente; usa-se o IP
-- que o proxy de borda informa (cf-connecting-ip / x-real-ip) e, na falta, o ULTIMO item do X-Forwarded-For
-- (o acrescentado pelo proxy mais proximo do servidor).
create function public.request_client_ip()
returns text
language plpgsql
stable
set search_path = ''
as $$
declare
  v_headers json;
  v_xff text;
begin
  begin
    v_headers := pg_catalog.current_setting('request.headers', true)::json;
  exception when others then
    v_headers := null;
  end;
  v_xff := v_headers ->> 'x-forwarded-for';
  return pg_catalog.btrim(coalesce(
    nullif(v_headers ->> 'cf-connecting-ip', ''),
    nullif(v_headers ->> 'x-real-ip', ''),
    nullif((pg_catalog.string_to_array(coalesce(v_xff, ''), ','))[pg_catalog.array_length(pg_catalog.string_to_array(coalesce(v_xff, ''), ','), 1)], ''),
    'unknown'
  ));
end;
$$;
revoke all on function public.request_client_ip() from public, anon, authenticated;

create function public.exam_rate_limited()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_hits integer;
begin
  delete from public.validation_rate_limit where window_start < now() - interval '1 hour';
  insert into public.validation_rate_limit as r (ip_hash, window_start, hits)
  values (encode(sha256(convert_to('exam:' || public.request_client_ip(), 'UTF8')), 'hex'), date_trunc('minute', now()), 1)
  on conflict (ip_hash, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  return v_hits > 40; -- 40 chamadas por IP por minuto
end;
$$;
revoke all on function public.exam_rate_limited() from public, anon, authenticated;

create function public.exam_start(p_token text, p_cpf text, p_password text)
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

create function public.exam_submit(p_attempt_key text, p_answers jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  att public.exam_attempts%rowtype;
  a public.exam_assignments%rowtype;
  e public.exams%rowtype;
  v_total integer;
  v_correct integer := 0;
  v_score numeric(5, 1);
  v_late boolean;
  v_answers jsonb := case when jsonb_typeof(p_answers) = 'object' then p_answers else '{}'::jsonb end;
begin
  if public.exam_rate_limited() then
    return jsonb_build_object('status', 'rate_limited');
  end if;
  -- limite de tamanho: um aluno nao grava um payload arbitrariamente grande
  if pg_column_size(v_answers) > 65536 then
    return jsonb_build_object('status', 'invalid');
  end if;
  select * into att from public.exam_attempts
    where key_hash = encode(sha256(convert_to(coalesce(p_attempt_key, ''), 'UTF8')), 'hex');
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;
  select * into a from public.exam_assignments where id = att.assignment_id;
  select * into e from public.exams where id = a.exam_id;

  -- ja enviada: devolve o resultado gravado (idempotente)
  if att.finished_at is not null then
    return jsonb_build_object('status', 'ok', 'score', att.score, 'passed', att.passed, 'correct', att.correct_count,
                              'total', att.total_count, 'passing_score', e.passing_score, 'late', att.late);
  end if;

  select count(*) into v_total from public.exam_questions where exam_id = e.id;
  v_late := att.deadline_at is not null and now() > att.deadline_at + interval '30 seconds';
  if not v_late then
    select count(*) into v_correct
    from public.exam_questions q
    join public.exam_options o on o.question_id = q.id and o.is_correct
    where q.exam_id = e.id and (v_answers ->> q.id::text) = o.id::text;
  end if;
  v_score := case when v_total = 0 then 0 else round(100.0 * v_correct / v_total, 1) end;

  update public.exam_attempts
    set finished_at = now(), score = v_score, passed = (v_score >= e.passing_score),
        correct_count = v_correct, total_count = v_total, late = v_late, answers = v_answers
    where id = att.id;

  return jsonb_build_object('status', 'ok', 'score', v_score, 'passed', v_score >= e.passing_score, 'correct', v_correct,
                            'total', v_total, 'passing_score', e.passing_score, 'late', v_late);
end;
$$;

revoke all on function public.exam_start(text, text, text) from public;
revoke all on function public.exam_submit(text, jsonb) from public;
grant execute on function public.exam_start(text, text, text) to anon, authenticated;
grant execute on function public.exam_submit(text, jsonb) to anon, authenticated;
