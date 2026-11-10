-- Seed de desenvolvimento. Idempotente (pode rodar mais de uma vez).
--
-- Cursos: somente os 10 que emitem certificado (NR e profissionalizantes). Nenhum curso de parceria.
-- Carga horaria e validade sao VALORES DE REFERENCIA ([EXEMPLO]): a coluna e numerica, entao o
-- marcador vai no syllabus. Confirmar tudo com a Olimach antes de emitir certificados reais.
-- Instrutores e responsavel tecnico sao ficticios, marcados [EXEMPLO]. Nunca usar em producao.

insert into public.courses (slug, name, category, nr_code, workload_hours, syllabus, modality, validity_months, active)
values
  ('nr-10', 'NR-10 Segurança em Instalações e Serviços em Eletricidade', 'nr', 'NR-10', 40,
   '[PENDENTE: conteúdo programático oficial e [EXEMPLO] carga horária de referência]', 'presencial', 24, true),
  ('nr-33', 'NR-33 Segurança e Saúde nos Trabalhos em Espaços Confinados', 'nr', 'NR-33', 16,
   '[PENDENTE: conteúdo programático oficial e [EXEMPLO] carga horária de referência]', 'presencial', 12, true),
  ('nr-35', 'NR-35 Trabalho em Altura', 'nr', 'NR-35', 8,
   '[PENDENTE: conteúdo programático oficial e [EXEMPLO] carga horária de referência]', 'presencial', 24, true),
  ('nr-37', 'NR-37 Segurança e Saúde em Plataformas de Petróleo', 'nr', 'NR-37', 8,
   '[PENDENTE: conteúdo programático oficial e [EXEMPLO] carga horária de referência]', 'presencial', 24, true),
  ('cpso-primeiros-socorros', 'CPSO Primeiros Socorros', 'profissionalizante', null, 8,
   '[PENDENTE: conteúdo programático oficial e [EXEMPLO] carga horária de referência]', 'presencial', null, true),
  ('movimentacao-de-cargas', 'Movimentação de Cargas', 'profissionalizante', null, 8,
   '[PENDENTE: conteúdo programático oficial e [EXEMPLO] carga horária de referência]', 'presencial', null, true),
  ('montador-de-andaime', 'Montador de Andaime', 'profissionalizante', null, 8,
   '[PENDENTE: conteúdo programático oficial e [EXEMPLO] carga horária de referência]', 'presencial', null, true),
  ('almoxarifado', 'Almoxarifado', 'profissionalizante', null, 8,
   '[PENDENTE: conteúdo programático oficial e [EXEMPLO] carga horária de referência]', 'presencial', null, true),
  ('cuidador-de-idoso', 'Cuidador de Idoso', 'profissionalizante', null, 8,
   '[PENDENTE: conteúdo programático oficial e [EXEMPLO] carga horária de referência]', 'presencial', null, true),
  ('barbeiro', 'Barbeiro', 'profissionalizante', null, 8,
   '[PENDENTE: conteúdo programático oficial e [EXEMPLO] carga horária de referência]', 'presencial', null, true)
on conflict (slug) do nothing;

insert into public.instructors (id, name, qualification, registry)
values
  ('00000000-0000-4000-8000-0000000000a1', '[EXEMPLO] Instrutor Um', '[EXEMPLO] Qualificação a confirmar', '[EXEMPLO] Registro 0001'),
  ('00000000-0000-4000-8000-0000000000a2', '[EXEMPLO] Instrutora Dois', '[EXEMPLO] Qualificação a confirmar', '[EXEMPLO] Registro 0002')
on conflict (id) do nothing;

insert into public.technical_leads (id, name, qualification, registry)
values
  ('00000000-0000-4000-8000-0000000000b1', '[EXEMPLO] Responsável Técnico', '[EXEMPLO] Qualificação a confirmar', '[EXEMPLO] Registro 0001')
on conflict (id) do nothing;
