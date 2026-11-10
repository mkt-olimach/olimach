-- Validacao publica de certificados.
-- Nunca ha SELECT anonimo em tabelas: o anon so executa este RPC, que
--   * aceita apenas o codigo exato (10 caracteres do alfabeto),
--   * devolve apenas campos nao sensiveis (CPF mascarado, sem pdf_path/pdf_sha256),
--   * aplica rate limit por IP (hash do IP, nunca o IP em claro).

create table public.validation_rate_limit (
  ip_hash text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (ip_hash, window_start)
);
create index validation_rate_limit_window_idx on public.validation_rate_limit (window_start);

-- RLS ligada sem policies: nenhum papel de API le ou escreve. Apenas o RPC (definer).
alter table public.validation_rate_limit enable row level security;
revoke all on public.validation_rate_limit from anon, authenticated;

create function public.validate_certificate(p_code text)
returns table (
  status text,
  student_name text,
  cpf_masked text,
  course_name text,
  workload_hours integer,
  issued_at timestamptz,
  expires_at timestamptz
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  c_limit constant integer := 20;           -- tentativas por IP por minuto
  v_code text := pg_catalog.upper(pg_catalog.btrim(coalesce(p_code, '')));
  v_headers json;
  v_ip text;
  v_bucket timestamptz := pg_catalog.date_trunc('minute', now());
  v_hits integer;
begin
  -- IP do cliente (PostgREST expoe os cabecalhos no GUC request.headers)
  begin
    v_headers := pg_catalog.current_setting('request.headers', true)::json;
  exception when others then
    v_headers := null;
  end;
  v_ip := pg_catalog.split_part(coalesce(v_headers ->> 'x-forwarded-for', 'unknown'), ',', 1);

  delete from public.validation_rate_limit where window_start < now() - interval '1 hour';

  insert into public.validation_rate_limit as r (ip_hash, window_start, hits)
  values (
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(pg_catalog.btrim(v_ip), 'UTF8')), 'hex'),
    v_bucket,
    1
  )
  on conflict (ip_hash, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  if v_hits > c_limit then
    -- nao usa raise: a excecao desfaria o incremento do contador
    return query select 'rate_limited'::text, null::text, null::text, null::text,
                        null::integer, null::timestamptz, null::timestamptz;
    return;
  end if;

  if v_code !~ '^[2-9A-HJ-NP-Z]{10}$' then
    return; -- formato invalido: nao consulta, nao ha linha
  end if;

  return query
    select
      case
        when c.status = 'revoked' then 'revoked'
        when c.expires_at is not null and c.expires_at < now() then 'expired'
        else 'valid'
      end::text,
      s.full_name,
      '***.' || pg_catalog.substr(s.cpf, 4, 3) || '.' || pg_catalog.substr(s.cpf, 7, 3) || '-**',
      co.name,
      co.workload_hours,
      c.issued_at,
      c.expires_at
    from public.certificates c
    join public.enrollments e on e.id = c.enrollment_id
    join public.students s on s.id = e.student_id
    join public.classes cl on cl.id = e.class_id
    join public.courses co on co.id = cl.course_id
    where c.code = v_code;
end;
$$;

revoke all on function public.validate_certificate(text) from public;
grant execute on function public.validate_certificate(text) to anon, authenticated;
