-- Novo perfil: super_admin (acima de admin). Fica em arquivo proprio porque um valor novo de enum
-- so pode ser usado depois que a transacao que o criou terminar (ver a migration seguinte).
alter type public.profile_role add value if not exists 'super_admin';
