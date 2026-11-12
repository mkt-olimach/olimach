-- Ajuste fino da assinatura em relacao a linha e aos textos (Configuracoes > Assinaturas do certificado).
-- Valores em pontos do PDF (1 pt = 1/72 pol), relativos a posicao padrao (base da imagem sobre a linha,
-- centralizada). sig_offset_y positivo sobe; sig_scale multiplica o tamanho padrao (cabe em 190 x 46 pt).
alter table public.certificate_signers
  add column sig_offset_x double precision not null default 0 check (sig_offset_x between -200 and 200),
  add column sig_offset_y double precision not null default 0 check (sig_offset_y between -150 and 150),
  add column sig_scale double precision not null default 1 check (sig_scale between 0.2 and 4);
