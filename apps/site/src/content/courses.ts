import type { CourseCategory } from "@olimach/schemas";

export interface SiteCourse {
  slug: string;
  name: string;
  category: CourseCategory;
  /** Resumo curto. null = ainda nao fornecido pela Olimach (aparece como [PENDENTE] no dev). */
  summary: string | null;
  /** Rotulo curto exibido no rodape do card. */
  tag: string;
  /** Capa enviada no painel (URL publica). Ausente na lista estatica. */
  coverUrl?: string | null;
  workloadHours?: number;
  theoryHours?: number;
  practiceHours?: number;
  modality?: "presencial" | "online" | "hibrido";
}

export const modalityLabel = { presencial: "Presencial", online: "Online", hibrido: "Híbrido" } as const;

/* Treinamentos dos certificados de referencia (mesmos slugs de supabase/catalog/treinamentos.sql).
   Usada somente quando o banco nao esta configurado ou nao responde; o normal e vir do painel. */
export const courses: SiteCourse[] = [
  { slug: "nr-12", name: "NR-12 Capacitação em Máquinas e Equipamentos", category: "nr", summary: "Trabalho seguro com máquinas e equipamentos, proteções e bloqueio de funcionamento.", tag: "Máquinas e equipamentos" },
  { slug: "nr-18", name: "NR-18 Capacitação de Procedimentos de Segurança na Indústria", category: "nr", summary: "Procedimentos de segurança na construção, trabalho em altura e andaimes.", tag: "Construção" },
  { slug: "nr-33", name: "NR-33 Segurança e Saúde nos Trabalhos em Espaços Confinados", category: "nr", summary: "Segurança e procedimentos para trabalhos em espaços confinados.", tag: "Espaços confinados" },
  { slug: "nr-34", name: "NR-34 Observador de Trabalhos a Quente", category: "nr", summary: "Classes de fogo, métodos de extinção e prevenção em trabalhos a quente.", tag: "Trabalho a quente" },
  { slug: "nr-35", name: "NR-35 Trabalho em Altura", category: "nr", summary: "Prevenção de riscos e procedimentos para trabalho em altura.", tag: "Trabalho em altura" },
  { slug: "nr-37", name: "NR-37 Segurança e Saúde em Plataformas de Petróleo", category: "nr", summary: "Segurança e saúde em plataformas de petróleo.", tag: "Plataformas de petróleo" },
  { slug: "movimentacao-de-cargas", name: "Movimentação de Cargas (AMC / Homem de Área)", category: "profissionalizante", summary: "Segurança pessoal, produtos químicos e movimentação de cargas.", tag: "Operações" },
  { slug: "montador-de-andaime", name: "Montador de Andaime", category: "profissionalizante", summary: "Supervisão, montagem, desmontagem e segurança em andaimes.", tag: "Montagem" },
  { slug: "almoxarifado", name: "Almoxarifado", category: "profissionalizante", summary: "Organização, armazenagem e controle de materiais.", tag: "Logística" },
  { slug: "pintura-industrial-n1", name: "Pintura Industrial N1", category: "profissionalizante", summary: "Preparação de superfície, tintas e esquemas de pintura industrial.", tag: "Pintura" },
  { slug: "tecnicas-cozinheiro-offshore", name: "Técnicas para Cozinheiro Offshore", category: "profissionalizante", summary: "Hotelaria marítima, atendimento e segurança alimentar offshore.", tag: "Hotelaria offshore" },
  { slug: "tecnicas-saloneiro-offshore", name: "Técnicas para Saloneiro Offshore", category: "profissionalizante", summary: "Hotelaria marítima, atendimento e rotinas do saloneiro.", tag: "Hotelaria offshore" },
  { slug: "tecnicas-taifeiro-offshore", name: "Técnicas para Taifeiro Offshore", category: "profissionalizante", summary: "Biossegurança, atendimento e rotinas de trabalho do taifeiro.", tag: "Hotelaria offshore" },
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
