-- Referencia tecnica do treinamento (normas e padroes em que se baseia). Sai no certificado,
-- logo abaixo do conteudo programatico, como "Referencia Tecnica".
alter table public.courses
  add column technical_reference text not null default '' check (length(technical_reference) <= 1000);
