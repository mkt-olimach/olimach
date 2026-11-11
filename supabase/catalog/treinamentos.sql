-- Catalogo de treinamentos da Olimach, extraido dos certificados de referencia (pasta "certificados").
-- Rodar no Supabase SQL Editor. Idempotente: pode rodar mais de uma vez.
--
-- * Insere os treinamentos novos e atualiza os que o seed.sql ja criou (mesmo slug): carga horaria,
--   validade, modalidade, conteudo programatico e descricao. Nome e categoria dos existentes nao mudam,
--   exceto "movimentacao-de-cargas" (ver comentario abaixo). A capa (cover_path) nunca e alterada aqui.
-- * Carga horaria, validade e conteudo vem dos certificados. Validade = meses entre emissao e
--   "valido ate"; "N/A" no certificado = sem validade (null).
-- * Nenhum dado de aluno e importado: so o catalogo.
-- * Confirmar com a Olimach antes de publicar (ver docs/PENDING_INPUTS.md): os certificados de
--   referencia sao da Munoz Consultoria e de outro emissor (Almoxarifado).

insert into public.courses (slug, name, category, nr_code, workload_hours, modality, validity_months, active, description, syllabus)
values
  ('nr-12', 'NR-12 Capacitação em Máquinas e Equipamentos', 'nr', 'NR-12', 8, 'presencial', 24, true,
   'Capacitação para trabalho seguro com máquinas e equipamentos, com foco em equipamentos de corte e desbaste, sistemas de proteção, bloqueio de funcionamento e checklist operacional.',
   $t$Equipamentos de corte e desbaste; acessórios (coifas, disco de corte, disco de desbaste, escova, retífica, lixa e outros); sistema de segurança; proteção física contra faíscas; proteção elétrica (quadros, disjuntores e cabos de alimentação); EPI e EPC; descrição e identificação dos riscos associados a cada máquina e equipamento e as proteções específicas; funcionamento das proteções, como e por que devem ser usadas; como e em que circunstâncias uma proteção pode ser removida; o que fazer se uma proteção foi danificada ou perdeu sua função; princípios de segurança na utilização da máquina ou equipamento; segurança para riscos mecânicos, elétricos e outros relevantes; método de trabalho seguro; permissão de trabalho; sistema de bloqueio de funcionamento durante inspeção, limpeza, lubrificação e manutenção; preenchimento de checklist operacional; identificação das partes móveis, fixas e interligadas; identificação dos riscos na zona de funcionamento; reconhecimento das medidas de segurança existentes no equipamento. Teoria 6 h, prática 2 h. Referência técnica: NR-12.$t$),

  ('nr-18', 'NR-18 Capacitação de Procedimentos de Segurança na Indústria', 'nr', 'NR-18', 16, 'presencial', 36, true,
   'Capacitação em procedimentos de segurança na indústria da construção, com base na NR-18 e na NBR 6494, incluindo trabalho em altura, andaimes tubulares e movimentação de cargas.',
   $t$Objetivo; normas regulamentadoras aplicáveis ao trabalho em altura; relações interpessoais e cidadania; educação e meio ambiente; revisão do sistema métrico decimal; conceitos básicos de qualidade e produtividade; higiene do trabalho; segurança do trabalho; ABNT NBR 6494 Segurança em Andaimes; NR-18 Condições e Meio Ambiente de Trabalho na Indústria da Construção; trabalho em altura, procedimentos básicos; andaime tubular e suas definições; inspeção de materiais; tipos de andaimes; elementos e acessórios tubulares; qualidade dos andaimes; andaime de encaixe (Elite, Kibloc, Modex, Multicrab e outros); plataforma de trabalho, madeiramento e acesso; leitura e interpretação de projetos de andaime; ferramentas utilizadas; estrutura de andaimes tubulares; movimentação de cargas e içamento de materiais; planejamento e execução na montagem de andaimes. Teoria 8 h, prática 8 h. Referência técnica: NR-18.$t$),

  ('nr-34', 'NR-34 Observador de Trabalhos a Quente', 'nr', 'NR-34', 8, 'presencial', 12, true,
   'Curso básico para o observador de trabalhos a quente: classes de fogo, métodos de extinção, equipamentos de combate a incêndio, alarmes, rotas de fuga e práticas de prevenção.',
   $t$Classes de fogo; métodos de extinção; tipos de equipamentos de combate a incêndio; sistemas de alarme e comunicação; rotas de fuga; equipamento de proteção individual e coletiva; práticas de prevenção e combate a incêndio. Teoria 4 h, prática 4 h. Referência técnica: NR-34.1.$t$),

  ('nr-33', 'NR-33 Segurança e Saúde nos Trabalhos em Espaços Confinados', 'nr', 'NR-33', 16, 'presencial', 12, true,
   'Capacitação de trabalhadores autorizados e vigias para atuar com segurança em espaços confinados, incluindo permissão de entrada e trabalho, controle de riscos e noções de resgate.',
   $t$1. Utilização da Permissão de Entrada e Trabalho (PET); 2. Procedimento de emergência e evacuação, responsabilidades e obrigações do trabalhador envolvido; 3. Definições; 4. Reconhecimento, avaliação e controle de riscos; 5. Funcionamento dos equipamentos utilizados; 6. Procedimentos e utilização da PET; 7. Noções de resgate e primeiros socorros; 8. Identificação dos espaços confinados: tanques, vasos, colunas, galerias, caixas de inspeção, reservatórios, tubulações, entre outros; 9. Critérios de indicação e uso de equipamentos para controle de riscos e práticas seguras em espaços confinados; 10. Legislação de segurança e saúde no trabalho, programa de proteção respiratória, área classificada e operações de salvamento; 11. Medidas de controle de riscos físicos, químicos, biológicos, ergonômicos e de acidentes; 12. Monitoramento, bloqueio de fontes de energia, ventilação exaustora e diluidora, purga, comunicação, EPI e proteções coletivas; 13. Deveres e responsabilidades da empresa, do vigia, dos trabalhadores e dos supervisores. Carga horária total: 16 h. Referência técnica: NR-33.$t$),

  ('nr-35', 'NR-35 Trabalho em Altura', 'nr', 'NR-35', 8, 'presencial', 24, true,
   'Treinamento de capacitação para trabalho em altura: análise de riscos, equipamentos de proteção, acidentes típicos, condutas de emergência, noções de resgate e primeiros socorros.',
   $t$Objetivo; normas regulamentadoras aplicáveis ao trabalho em altura; análise de riscos e condições impeditivas; riscos potenciais ao trabalho em altura e medidas de proteção e controle; sistemas, equipamentos e procedimentos de proteção coletiva; equipamentos de proteção individual para trabalhos em altura (seleção, inspeção, conservação e limitação de uso); acidentes típicos em trabalhos em altura; condutas em situações de emergência, incluindo noções técnicas de resgate e primeiros socorros. Teoria 4 h, prática 4 h. Referência técnica: NR-06, NR-18, NR-34 e NR-35.$t$),

  ('nr-37', 'NR-37 Segurança e Saúde em Plataformas de Petróleo', 'nr', 'NR-37', 6, 'presencial', 60, true,
   'Treinamento avançado de segurança em plataformas de petróleo: acesso à plataforma, riscos a bordo, áreas classificadas, produtos químicos, EPC e EPI e procedimentos de emergência.',
   $t$a) meios e procedimentos de acesso à plataforma; b) condições e meio ambiente de trabalho; c) substâncias combustíveis e inflamáveis presentes a bordo: características, propriedades, perigos e riscos; d) áreas classificadas, fontes de ignição e seu controle; e) riscos ambientais existentes na área da plataforma; f) medidas de segurança disponíveis para o controle dos riscos operacionais a bordo; g) outros riscos inerentes às atividades específicas dos trabalhadores e as respectivas medidas de controle e eliminação; h) riscos psicossociais decorrentes de vários estressores, como jornada prolongada, trabalho em turnos e noturno; i) riscos radiológicos de origem industrial ou de ocorrência natural, quando existentes; j) produtos químicos perigosos e explosivos armazenados e manuseados a bordo; k) Ficha de Informação de Segurança de Produtos Químicos (FISPQ); l) Equipamentos de Proteção Coletiva (EPC); m) Equipamentos de Proteção Individual (EPI); n) procedimentos a serem adotados em situações de emergência. Carga horária: 6 h teóricas. Referência técnica: NR-37.9.6.3.$t$),

  ('movimentacao-de-cargas', 'Movimentação de Cargas (AMC / Homem de Área)', 'profissionalizante', null, 40, 'presencial', 24, true,
   'Formação de Auxiliar de Movimentação de Cargas (Homem de Área): segurança pessoal, manuseio de produtos químicos, movimentação e içamento de cargas, sinais e comunicação, e prática supervisionada.',
   $t$Módulo I, Responsabilidade Social e Segurança Pessoal (12 h): introdução; conhecendo o segmento offshore; responsabilidade social e relações humanas a bordo; segurança no trabalho a bordo; noções de meio ambiente; prevenção da poluição e fiscalização (MARPOL). Módulo II, Manuseio de Produtos Químicos (4 h): produto perigoso; FISPQ; recomendações de armazenamento, rotulagem e manuseio; transporte e classificação de produtos perigosos. Módulo III, Movimentação de Cargas (20 h): conceitos básicos; considerações gerais (amarrações, acessórios de içamento, cabos de aço etc.); tabela de capacidade de cargas e ângulos de içamento; operação (cargas perigosas, peças de pequeno porte, tubos, perfis, chapas e eixos etc.); sinais e comunicação; segurança na movimentação de cargas; acidente do trabalho e sua prevenção; equipamentos de proteção coletiva e individual; dispositivos aplicáveis das normas regulamentadoras; equipamento de guindar (tipos, inspeções de equipamentos e acessórios); situações especiais de risco (proximidade de rede elétrica energizada, condições climáticas adversas, entre outras); ergonomia do posto de trabalho. Módulo IV, Prática (4 h). Carga horária total: 40 h.$t$),

  ('montador-de-andaime', 'Montador de Andaime', 'profissionalizante', null, 40, 'presencial', 36, true,
   'Capacitação em procedimentos de supervisão, montagem, desmontagem e segurança em andaimes, com base na NR-18 e na NBR 6494.',
   $t$Objetivo; normas regulamentadoras aplicáveis ao trabalho em altura; relações interpessoais e cidadania; educação e meio ambiente; revisão do sistema métrico decimal; conceitos básicos de qualidade e produtividade; higiene do trabalho; segurança do trabalho; ABNT NBR 6494 Segurança em Andaimes; NR-18; trabalho em altura, procedimentos básicos; andaime tubular e suas definições; inspeção de materiais; tipos de andaimes; elementos e acessórios tubulares; qualidade dos andaimes; andaime de encaixe (Elite, Kibloc, Modex, Multicrab e outros); plataforma de trabalho, madeiramento e acesso; leitura e interpretação de projetos de andaime; ferramentas utilizadas; estrutura de andaimes tubulares; movimentação de cargas e içamento de materiais; planejamento e execução na montagem de andaimes. Teoria 20 h, prática 20 h. Referência técnica: NR-18 e NR-34.$t$),

  ('almoxarifado', 'Almoxarifado', 'profissionalizante', null, 20, 'presencial', null, true,
   'Organização, armazenagem e controle de materiais: funções do almoxarife, fluxo de materiais, estoque, inventário, expedição, gestão de fornecedores e tecnologia aplicada.',
   $t$Introdução; funções do almoxarife; indicadores de desempenho; organização do almoxarifado; fluxo de materiais; recebimento de materiais; armazenamento de materiais; controle de estoque; inventário de materiais; expedição de materiais; embalagem e etiquetagem de materiais; movimentação interna de materiais; gestão de fornecedores; compra de materiais; cotação de preços; tecnologia aplicada. Carga horária total: 20 h.$t$),

  ('pintura-industrial-n1', 'Pintura Industrial N1', 'profissionalizante', null, 200, 'presencial', 24, true,
   'Formação em pintura industrial nível 1: corrosão, preparação de superfície, tintas e esquemas de pintura, aplicação por rolo e trincha, controle de qualidade e QSMS.',
   $t$a) matemática aplicada à pintura; b) Qualidade, Saúde, Meio Ambiente e Segurança do Trabalho (QSMS); c) corrosão; d) fundamentos da pintura industrial; e) competências do profissional; f) tintas; g) películas; h) esquemas de pintura; i) inspeção visual da superfície, antes e após o seu preparo; j) preparação de superfície (limpeza química, manual e mecânica); k) condições climáticas para pintura industrial; l) normas técnicas para pintura industrial; m) preparação das tintas; n) aplicação do esquema de pintura e normas técnicas; o) aplicação de tinta pelo método de rolo e trincha; p) medição da espessura da película úmida; q) retoque no esquema de pintura; r) controle de qualidade da aplicação do esquema de pintura (pontos de retenção); s) falhas e defeitos na aplicação com rolo e trincha; t) noções do teste de aderência da película e do teste de descontinuidade no esquema de pintura. Teoria 160 h, prática 40 h. Referência técnica: NBR 16378.$t$),

  ('tecnicas-cozinheiro-offshore', 'Técnicas para Cozinheiro Offshore', 'profissionalizante', null, 164, 'presencial', null, true,
   'Formação para atuar como cozinheiro em unidades offshore: hotelaria marítima, excelência no atendimento, segurança, meio ambiente e saúde, e boas práticas de segurança alimentar.',
   $t$Módulo 1, Módulo Geral para Cozinheiro: capítulo 1, a hotelaria marítima; capítulo 2, excelência no atendimento; capítulo 3, segurança, meio ambiente e saúde; capítulo 4, noções de segurança alimentar e boas práticas. Módulo 2 (conforme o certificado de referência, que traz o título "Trabalho do Saloneiro"; revisar): capítulo 1, local de trabalho; capítulo 2, rotinas; capítulo 3, práticas específicas. Teoria 130 h, prática 34 h. Referência técnica: NR-06, NR-15, NR-17, NR-23, NR-25, NR-30, NR-32, NR-34, NR-36, NR-37; NBR 14725 (FISPQ); NORMAM-01/DPC; NORMAM-27; ISO 9001; ISO 14001; ABNT NBR ISO 22000; OHSAS 18001; Resolução RDC nº 216 (Anvisa).$t$),

  ('tecnicas-saloneiro-offshore', 'Técnicas para Saloneiro Offshore', 'profissionalizante', null, 64, 'presencial', null, true,
   'Formação para atuar como saloneiro em unidades offshore: hotelaria marítima, excelência no atendimento, segurança, meio ambiente e saúde, e rotinas do trabalho a bordo.',
   $t$Módulo 1, Módulo Geral para Saloneiro: capítulo 1, a hotelaria marítima; capítulo 2, excelência no atendimento; capítulo 3, segurança, meio ambiente e saúde; capítulo 4, noções de segurança alimentar e boas práticas. Módulo 2, Trabalho do Saloneiro: capítulo 1, local de trabalho; capítulo 2, rotinas; capítulo 3, práticas específicas. Teoria 40 h, prática 24 h. Referência técnica: NR-06, NR-15, NR-17, NR-23, NR-25, NR-30, NR-32, NR-34, NR-37; NBR 14725 (FISPQ); NORMAM-01/DPC; NORMAM-27; ISO 9001; ISO 14001; ABNT NBR ISO 22000; OHSAS 18001; Resolução RDC nº 216 (Anvisa).$t$),

  ('tecnicas-taifeiro-offshore', 'Técnicas para Taifeiro Offshore', 'profissionalizante', null, 64, 'presencial', null, true,
   'Formação para atuar como taifeiro em unidades offshore: perfil profissional, excelência no atendimento, noções de biossegurança, segurança alimentar, SMS e rotinas de trabalho.',
   $t$Módulo 1, Módulo Geral: perfil de profissionais; excelência no atendimento; noções de biossegurança; noções de segurança alimentar e boas práticas; SMS. Módulo 2, Trabalho de taifeiro: local de trabalho; rotinas; práticas específicas. Teoria 32 h, prática 32 h. Referência técnica: NR-06, NR-15, NR-17, NR-23, NR-25, NR-30, NR-32, NR-34, NR-37.$t$)
on conflict (slug) do update set
  workload_hours = excluded.workload_hours,
  modality = excluded.modality,
  validity_months = excluded.validity_months,
  description = excluded.description,
  syllabus = excluded.syllabus,
  name = excluded.name,
  active = true;

-- Remove os treinamentos de exemplo do seed que nao constam nos certificados de referencia.
-- So apaga os que nao tem turma cadastrada; os com turma continuam e ficam inativos (inative-os
-- tambem no painel se preferir). Rodar este arquivo de novo e seguro.
delete from public.courses c
where c.slug in ('nr-10', 'cpso-primeiros-socorros', 'cuidador-de-idoso', 'barbeiro')
  and not exists (select 1 from public.classes cl where cl.course_id = c.id);

update public.courses
set active = false
where slug in ('nr-10', 'cpso-primeiros-socorros', 'cuidador-de-idoso', 'barbeiro');
