-- Carga horaria teorica e pratica. workload_hours continua sendo o TOTAL e agora e sempre
-- a soma dos dois campos (constraint). Treinamentos existentes ficam com todo o total como
-- teorico e pratica = 0 ate a Olimach informar a divisao real no painel.

alter table public.courses
  add column theory_hours integer not null default 0 check (theory_hours >= 0),
  add column practice_hours integer not null default 0 check (practice_hours >= 0);

update public.courses set theory_hours = workload_hours, practice_hours = 0;

-- Compatibilidade: insercao que informa so o total (seed, scripts antigos) vira "tudo teorico".
create function public.courses_default_split()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.theory_hours = 0 and new.practice_hours = 0 then
    new.theory_hours := new.workload_hours;
  end if;
  return new;
end;
$$;

create trigger courses_default_split
  before insert on public.courses
  for each row execute function public.courses_default_split();

alter table public.courses
  add constraint courses_workload_is_sum check (workload_hours = theory_hours + practice_hours);

-- Vitrine publica passa a devolver a divisao. O tipo de retorno muda, entao recria a funcao.
drop function public.public_courses();

create function public.public_courses()
returns table (
  slug text,
  name text,
  category public.course_category,
  nr_code text,
  workload_hours integer,
  theory_hours integer,
  practice_hours integer,
  modality text,
  description text,
  cover_path text
)
language sql
stable
security definer
set search_path = ''
as $$
  select c.slug, c.name, c.category, c.nr_code, c.workload_hours, c.theory_hours, c.practice_hours,
         c.modality, c.description, c.cover_path
  from public.courses c
  where c.active
  order by c.name;
$$;

revoke all on function public.public_courses() from public;
grant execute on function public.public_courses() to anon, authenticated;
