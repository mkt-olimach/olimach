-- Regras de negocio dos certificados, aplicadas no banco (a UI valida tambem, mas nao e a fonte).

-- 1) Emissao: bloqueia parceria, exige aprovacao e presenca, calcula validade.
create function public.certificates_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category public.course_category;
  v_validity integer;
  v_attendance boolean;
  v_approved boolean;
begin
  select co.category, co.validity_months, e.attendance_ok, e.approved
    into v_category, v_validity, v_attendance, v_approved
    from public.enrollments e
    join public.classes cl on cl.id = e.class_id
    join public.courses co on co.id = cl.course_id
    where e.id = new.enrollment_id;

  if not found then
    raise exception 'Matricula inexistente' using errcode = 'foreign_key_violation';
  end if;

  if v_category = 'parceria' then
    raise exception 'Cursos de parceria nao emitem certificado'
      using errcode = 'check_violation', constraint = 'certificates_no_partnership_course';
  end if;

  if not (v_attendance and v_approved) then
    raise exception 'Certificado exige presenca confirmada e aprovacao'
      using errcode = 'check_violation';
  end if;

  -- validade sempre derivada do curso, nunca informada pelo cliente
  new.expires_at := case
    when v_validity is null then null
    else new.issued_at + pg_catalog.make_interval(months => v_validity)
  end;

  return new;
end;
$$;

create trigger certificates_before_insert
  before insert on public.certificates
  for each row execute function public.certificates_before_insert();

-- 2) Imutabilidade: so a revogacao (valid -> revoked) e permitida; nada mais muda.
create function public.certificates_before_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (new.id, new.enrollment_id, new.code, new.issued_at, new.expires_at,
      new.technical_lead_id, new.pdf_path, new.pdf_sha256)
     is distinct from
     (old.id, old.enrollment_id, old.code, old.issued_at, old.expires_at,
      old.technical_lead_id, old.pdf_path, old.pdf_sha256) then
    raise exception 'Certificado emitido e imutavel. Revogue e reemita.'
      using errcode = 'check_violation';
  end if;

  if old.status = 'revoked' and new.status is distinct from old.status then
    raise exception 'Certificado revogado nao pode voltar a ser valido'
      using errcode = 'check_violation';
  end if;

  if old.status = 'revoked' and (new.revoked_reason is distinct from old.revoked_reason
     or new.revoked_at is distinct from old.revoked_at) then
    raise exception 'Dados da revogacao sao imutaveis' using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger certificates_before_update
  before update on public.certificates
  for each row execute function public.certificates_before_update();

-- 3) Um curso nao pode virar parceria se ja emitiu certificados.
create function public.courses_guard_partnership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.category = 'parceria' and old.category is distinct from 'parceria' and exists (
    select 1
    from public.certificates c
    join public.enrollments e on e.id = c.enrollment_id
    join public.classes cl on cl.id = e.class_id
    where cl.course_id = new.id
  ) then
    raise exception 'Curso com certificados emitidos nao pode virar parceria'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger courses_guard_partnership
  before update of category on public.courses
  for each row execute function public.courses_guard_partnership();
