import type { CourseCategory } from "@olimach/schemas";

export interface SiteCourse {
  slug: string;
  name: string;
  category: CourseCategory;
  /** Resumo curto. null = ainda nao fornecido pela Olimach (aparece como [PENDENTE] no dev). */
  summary: string | null;
  /** Rotulo curto exibido no rodape do card. */
  tag: string;
}

/* Os 10 cursos que emitem certificado. Mesmos slugs de supabase/seed.sql.
   Carga horaria e descricao so entram aqui depois de confirmadas pela Olimach. */
export const courses: SiteCourse[] = [
  { slug: "nr-10", name: "NR-10 Segurança em Instalações e Serviços em Eletricidade", category: "nr", summary: "Segurança em instalações e serviços com eletricidade.", tag: "Segurança elétrica" },
  { slug: "nr-33", name: "NR-33 Segurança e Saúde nos Trabalhos em Espaços Confinados", category: "nr", summary: "Segurança e procedimentos para trabalhos em espaços confinados.", tag: "Espaços confinados" },
  { slug: "nr-35", name: "NR-35 Trabalho em Altura", category: "nr", summary: "Prevenção de riscos e procedimentos para trabalho em altura.", tag: "Trabalho em altura" },
  { slug: "nr-37", name: "NR-37 Segurança e Saúde em Plataformas de Petróleo", category: "nr", summary: "Segurança e saúde em plataformas de petróleo.", tag: "Plataformas de petróleo" },
  { slug: "cpso-primeiros-socorros", name: "CPSO Primeiros Socorros", category: "profissionalizante", summary: "Capacitação voltada à resposta inicial em situações de emergência.", tag: "Segurança" },
  { slug: "movimentacao-de-cargas", name: "Movimentação de Cargas", category: "profissionalizante", summary: "Fundamentos e cuidados em operações de movimentação de materiais.", tag: "Operações" },
  { slug: "montador-de-andaime", name: "Montador de Andaime", category: "profissionalizante", summary: "Preparação para atividades relacionadas à montagem de andaimes.", tag: "Montagem" },
  { slug: "almoxarifado", name: "Almoxarifado", category: "profissionalizante", summary: "Organização, armazenagem e controle de materiais.", tag: "Logística" },
  { slug: "cuidador-de-idoso", name: "Cuidador de Idoso", category: "profissionalizante", summary: "Noções aplicadas ao cuidado e à assistência cotidiana.", tag: "Cuidados" },
  { slug: "barbeiro", name: "Barbeiro", category: "profissionalizante", summary: "Fundamentos para desenvolvimento de habilidades em barbearia.", tag: "Serviços" },
];

export const categoryLabel: Record<CourseCategory, string> = {
  nr: "Norma Regulamentadora",
  profissionalizante: "Profissionalizante",
  parceria: "Parceria",
};

export const faq = [
  {
    q: "Como valido um certificado da Olimach?",
    a: "Acesse a página Validar certificado e informe o código de 10 caracteres impresso no certificado, ou leia o QR code. A consulta mostra o nome, o curso, a carga horária, as datas e a situação do certificado.",
  },
  {
    q: "O que aparece na validação pública?",
    a: "Nome do aluno, CPF parcialmente oculto, curso, carga horária, data de emissão, validade e situação. O arquivo PDF não é exibido publicamente.",
  },
  {
    q: "Como me inscrevo em uma turma?",
    a: "Fale com a equipe pelo WhatsApp, informe o curso de interesse e receba orientação sobre próximas turmas, datas, documentos e valores.",
  },
  {
    q: "Qual a validade e quando preciso reciclar minha NR?",
    a: "Os requisitos dependem da norma e do treinamento. Consulte a equipe sobre o programa, a carga horária e os critérios de atualização da turma escolhida.",
  },
  {
    q: "Quais documentos e formas de pagamento são aceitos?",
    a: "A relação de documentos e as condições de pagamento são informadas pela equipe no atendimento pelo WhatsApp.",
  },
];
