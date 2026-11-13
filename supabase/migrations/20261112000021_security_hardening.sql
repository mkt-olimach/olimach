-- Endurecimento (auditoria de seguranca).
--
-- 1) O anon nao acessa tabela nenhuma: so executa RPCs SECURITY DEFINER. Tabelas criadas depois da migration 4
--    herdaram, no Supabase, o privilegio padrao de SELECT/INSERT/... para anon (a RLS barrava as linhas, mas o
--    privilegio de tabela nao precisa existir). Revoga o existente e o padrao para tabelas futuras.
-- 2) Campos de URL da empresa aceitam so http(s): o site renderiza esses valores em <a href>, e "javascript:"
--    seria XSS. NOT VALID: vale para novas gravacoes sem falhar por dado antigo (validar depois, se quiser).
-- 3) validate_certificate passa a usar o IP do cliente confiavel (request_client_ip), nao o primeiro item de
--    X-Forwarded-For, que o cliente pode forjar para fugir do rate limit.
-- 4) Buckets: limite de tamanho e tipos MIME aplicados no servidor (antes so o navegador validava).

-- 1) anon sem acesso a tabelas
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- 2) URLs seguras
alter table public.company_settings
  add constraint company_settings_urls_http check (
    (website = '' or website ~* '^https?://')
    and (facebook = '' or facebook ~* '^https?://')
    and (instagram = '' or instagram ~* '^https?://')
    and (linkedin = '' or linkedin ~* '^https?://')
    and (youtube = '' or youtube ~* '^https?://')
  ) not valid;

-- 3) rate limit com IP confiavel
create or replace function public.validate_certificate(p_code text)
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
  v_bucket timestamptz := pg_catalog.date_trunc('minute', now());
  v_hits integer;
begin
  delete from public.validation_rate_limit where window_start < now() - interval '1 hour';

  insert into public.validation_rate_limit as r (ip_hash, window_start, hits)
  values (
    pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(public.request_client_ip(), 'UTF8')), 'hex'),
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

-- 4) limites de upload nos buckets (colunas existem no Supabase; ignora em ambientes sem elas)
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'storage' and table_name = 'buckets' and column_name = 'allowed_mime_types'
  ) then
    update storage.buckets set file_size_limit = 2097152, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'] where id = 'course-covers';
    update storage.buckets set file_size_limit = 2097152, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon'] where id = 'branding';
    update storage.buckets set file_size_limit = 5242880, allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp'] where id = 'gallery';
    update storage.buckets set file_size_limit = 1048576, allowed_mime_types = array['image/png', 'image/jpeg'] where id = 'signatures';
    update storage.buckets set file_size_limit = 10485760, allowed_mime_types = array['application/pdf'] where id = 'certificates';
  end if;
end;
$$;
