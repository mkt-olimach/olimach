import { Pending, buttonClasses, cn } from "@olimach/ui";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BookOpen,
  Check,
  ChevronDown,
  Clock,
  Compass,
  GraduationCap,
  Headphones,
  MapPin,
  MonitorSmartphone,
  Phone,
  ScanQrCode,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { categoryLabel, courses, faq } from "../content/courses";
import { courseWhatsappMessage, whatsappLink } from "../lib/whatsapp";

const generalMessage = "Olá! Gostaria de mais informações sobre os treinamentos da Olimach.";

/* Imagens do mockup (derivadas da referencia visual). Trocar por fotografias originais ou licenciadas
   da Olimach em producao, mantendo o alt descritivo com termo local. */
const img = {
  hero: "/assets/images/hero-offshore.webp",
  worker: "/assets/images/about-worker.webp",
  platform: "/assets/images/platform-card.webp",
};
const courseImages = [
  "/assets/images/offshore-safety.webp",
  "/assets/images/offshore-team.webp",
  "/assets/images/platform-card.webp",
  "/assets/images/about-worker.webp",
  "/assets/images/hero-offshore.webp",
];

/* Somente qualitativo: nenhum numero de alunos, anos ou aprovacao. */
const highlights = [
  { icon: UsersRound, value: "Formação", label: "Orientada ao mercado" },
  { icon: Award, value: "Cursos", label: "NR e profissionalizantes" },
  { icon: ShieldCheck, value: "Segurança", label: "Foco em boas práticas" },
  { icon: Compass, value: "Offshore", label: "Soluções para o setor" },
];

const featuredSlug = "nr-33";

function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-[10px] font-extrabold uppercase tracking-[0.19em] text-brand-500", className)}>{children}</p>;
}

export function Home() {
  const [params] = useSearchParams();
  const [showAll, setShowAll] = useState(false);
  const query = (params.get("q") ?? "").trim().toLowerCase();

  const matches = query
    ? courses.filter((c) => `${c.name} ${c.tag} ${categoryLabel[c.category]}`.toLowerCase().includes(query))
    : courses;
  const visible = query || showAll ? matches : matches.slice(0, 6);
  const featured = courses.find((c) => c.slug === featuredSlug);

  return (
    <>
      {/* HERO */}
      <section id="inicio" className="mx-auto grid max-w-[1240px] items-center gap-8 px-5 pb-6 pt-10 md:px-10 lg:grid-cols-[43.5%_1fr] lg:gap-5 lg:pt-8">
        <div className="lg:pr-6">
          <Eyebrow className="flex items-center gap-2">
            Formação para novas oportunidades <span className="inline-block h-px w-8 bg-[#9db7ce]" aria-hidden />
          </Eyebrow>
          <h1 className="mt-5 text-4xl leading-[1.14] text-navy-900 md:text-5xl">
            Capacitação que impulsiona o seu futuro <span className="text-navy-700">no setor offshore.</span>
          </h1>
          <p className="mt-5 max-w-lg text-muted">
            A Olimach é uma escola de treinamentos em Macaé, RJ, com cursos de NR e profissionalizantes para quem atua ou
            deseja crescer nas áreas onshore e offshore.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <a href="#cursos" className={buttonClasses("accent", "landing")}>
              Conheça nossos cursos <ArrowRight size={16} aria-hidden />
            </a>
            <a href={whatsappLink(generalMessage)} target="_blank" rel="noopener noreferrer" className={buttonClasses("secondary", "landing")}>
              Fale conosco <ArrowUpRight size={16} aria-hidden />
            </a>
          </div>
          <p className="mt-6 flex items-center gap-2 text-[11px] text-[#8b9fb3]">
            <span className="h-2 w-2 rounded-full bg-orange-500" aria-hidden /> Conhecimento e segurança para avançar.
          </p>
        </div>

        <div className="relative h-[260px] md:h-[314px]">
          {/* A imagem do mockup traz uma margem branca a direita: ampliada e ancorada a esquerda para cortar */}
          <div className="absolute inset-0 overflow-hidden rounded-[20px] rounded-bl-[48px] bg-[#153255]">
            <img
              src={img.hero}
              alt="Plataforma de petróleo offshore ao pôr do sol, em operação na costa de Macaé"
              width={1500}
              height={431}
              decoding="async"
              {...({ fetchpriority: "high" } as Record<string, string>)}
              className="h-full w-full object-cover object-[64%_center]"
            />
          </div>
          <Link
            to="/validar"
            className="absolute -bottom-4 right-3 z-10 flex min-w-64 items-center gap-4 rounded-[14px] border border-line bg-surface p-4 shadow-xl hover:bg-canvas lg:-right-3 lg:bottom-4"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-canvas text-navy-700">
              <Award size={25} aria-hidden />
            </span>
            <span className="text-xs">
              <strong className="block leading-snug text-navy-900">Emissão e validação<br />de certificados</strong>
              <small className="mt-1 block text-[10px] text-muted">Consulte pelo código ou QR code.</small>
            </span>
            <span className="ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-full bg-orange-500 text-white">
              <ArrowUpRight size={18} aria-hidden />
            </span>
          </Link>
        </div>
      </section>

      {/* DESTAQUES */}
      <section aria-label="Destaques" className="mt-8 border-y border-line bg-surface">
        <ul className="mx-auto grid max-w-[1240px] grid-cols-2 px-5 py-4 md:px-10 lg:grid-cols-4">
          {highlights.map(({ icon: Icon, value, label }) => (
            <li
              key={value}
              className="flex min-h-14 items-center gap-4 border-b border-line py-3 text-navy-700 odd:border-r lg:justify-center lg:border-b-0 lg:border-r lg:last:border-r-0"
            >
              <Icon size={26} strokeWidth={1.55} className="shrink-0" aria-hidden />
              <div>
                <p className="font-heading text-base font-extrabold leading-tight text-navy-900">{value}</p>
                <p className="mt-0.5 text-[11px] text-muted">{label}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* SOBRE + DESTAQUE */}
      <section id="sobre" className="mx-auto grid max-w-[1240px] gap-5 px-5 pb-5 pt-10 md:px-10 lg:grid-cols-[36%_28%_1fr]">
        <div className="lg:pr-7">
          <Eyebrow>Sobre a Olimach</Eyebrow>
          <h2 className="mb-4 mt-4 text-2xl leading-snug text-navy-900 md:text-3xl">
            Mais que treinamentos,<br />formamos profissionais.
          </h2>
          <p className="mb-5 text-sm text-muted">
            A Olimach busca contribuir para uma atuação mais segura, eficiente e preparada para os desafios de um setor
            que exige conhecimento, responsabilidade e atualização contínua.{" "}
            <Pending>texto institucional aprovado pela Olimach</Pending>
          </p>
          <ul className="mb-5 space-y-3 text-xs text-muted">
            {[
              "Formação conectada à realidade do mercado",
              "Conteúdos técnicos e aplicação prática",
              "Foco em prevenção e segurança",
              "Atendimento direto pelo WhatsApp",
            ].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <Check size={18} className="shrink-0 rounded-full bg-orange-500 p-1 text-white" aria-hidden /> {t}
              </li>
            ))}
          </ul>
          <a href="#cursos" className="inline-flex items-center gap-2 text-sm font-bold text-navy-700 hover:underline">
            Conheça os treinamentos <ArrowUpRight size={17} aria-hidden />
          </a>
        </div>

        <div className="relative min-h-64 overflow-hidden rounded-[18px] md:min-h-80">
          <img
            src={img.worker}
            alt="Profissional com capacete de proteção em instalação industrial, treinamento de segurança em Macaé"
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </div>

        {featured && (
          <article className="relative isolate min-h-[340px] overflow-hidden rounded-[18px] text-white">
            <img
              src={img.platform}
              alt="Plataforma offshore ao entardecer, cenário do treinamento NR-33"
              loading="lazy"
              decoding="async"
              className="absolute inset-0 -z-20 h-full w-full object-cover"
            />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#07223f]/90 to-[#05192d]/65" aria-hidden />
            <div className="p-7 pb-24">
              <Eyebrow className="text-[#9eb6cf]">Treinamento em destaque</Eyebrow>
              <h3 className="mb-3 mt-5 max-w-xs text-2xl leading-snug !text-white">{featured.name}</h3>
              <p className="max-w-xs text-xs text-[#d1dce9]">{featured.summary}</p>
              <a
                href={whatsappLink(courseWhatsappMessage(featured.name))}
                target="_blank"
                rel="noopener noreferrer"
                className={`${buttonClasses("accent", "landing")} mt-5`}
              >
                Saiba mais <ArrowRight size={16} aria-hidden />
              </a>
            </div>
            <div className="absolute inset-x-6 bottom-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/25 pt-4 text-[10px] text-[#dce7f3]">
              <span className="flex items-center gap-1.5"><BookOpen size={16} aria-hidden /> Conteúdo técnico</span>
              <span className="flex items-center gap-1.5"><GraduationCap size={16} aria-hidden /> Consulte turmas</span>
              <span className="flex items-center gap-1.5"><Award size={16} aria-hidden /> Certificado com QR code</span>
            </div>
          </article>
        )}
      </section>

      {/* FAIXA DE DIFERENCIAIS */}
      <section id="diferenciais" className="mx-auto max-w-[1240px] px-5 pb-10 md:px-10">
        <ul className="grid rounded-2xl border border-line bg-surface px-3 py-5 shadow-sm lg:grid-cols-3">
          {[
            { icon: ScanQrCode, title: "Validação digital", text: "Consulta de certificados pelo código exato, em página pública.", to: "/validar" },
            { icon: ShieldCheck, title: "Compromisso com segurança", text: "Conteúdo orientado à prevenção e às boas práticas.", to: undefined },
            { icon: MonitorSmartphone, title: "Acesso responsivo", text: "Experiência adaptada a computadores e celulares.", to: undefined },
          ].map(({ icon: Icon, title, text, to }) => {
            const body = (
              <>
                <Icon size={27} className="shrink-0" aria-hidden />
                <span>
                  <strong className="block text-xs text-navy-700">{title}</strong>
                  <small className="mt-0.5 block max-w-[240px] text-[11px] leading-snug text-muted">{text}</small>
                </span>
              </>
            );
            const cls =
              "flex items-center gap-4 border-b border-line px-5 py-4 text-navy-700 lg:justify-center lg:border-b-0 lg:border-r";
            return (
              <li key={title} className="last:[&>*]:border-0">
                {to ? (
                  <Link to={to} className={cls}>
                    {body}
                  </Link>
                ) : (
                  <div className={cls}>{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* CURSOS */}
      <section id="cursos" className="mx-auto max-w-[1240px] px-5 pb-14 md:px-10">
        <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <Eyebrow>Desenvolvimento profissional</Eyebrow>
            <h2 className="mb-2 mt-3 text-2xl text-navy-900 md:text-3xl">Explore os treinamentos</h2>
            <p className="text-sm text-muted">
              {query
                ? `${matches.length} resultado(s) para "${params.get("q")}".`
                : "Escolha um curso e fale com a equipe para consultar turmas e inscrições."}
            </p>
          </div>
          {query ? (
            <Link to="/#cursos" className="inline-flex items-center gap-2 text-sm font-bold text-navy-700 hover:underline">
              Limpar busca <ArrowRight size={17} aria-hidden />
            </Link>
          ) : (
            courses.length > 6 && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                className="inline-flex items-center gap-2 text-sm font-bold text-navy-700 hover:underline"
              >
                {showAll ? "Mostrar menos" : "Ver todos os cursos"} <ArrowRight size={17} aria-hidden />
              </button>
            )
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((course) => (
            <article
              key={course.slug}
              id={course.slug}
              className="group scroll-mt-28 overflow-hidden rounded-[15px] border border-line bg-surface shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="relative h-40 overflow-hidden md:h-44">
                <img
                  src={courseImages[courses.indexOf(course) % courseImages.length]}
                  alt={`Ambiente de treinamento offshore, curso ${course.name}`}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
              </div>
              <div className="px-5 pt-5">
                <Eyebrow className="text-orange-600">{categoryLabel[course.category]}</Eyebrow>
                <h3 className="mb-2 mt-2 text-lg leading-snug text-navy-900">{course.name}</h3>
                <p className="mb-3 min-h-16 text-xs text-muted">
                  {course.summary ?? <Pending>descrição, carga horária e modalidade</Pending>}
                </p>
                <p className="mb-4 flex items-center gap-2 text-[11px] text-[#7d90a7]">
                  <GraduationCap size={15} aria-hidden /> <Pending>modalidade</Pending>
                </p>
                <a
                  href={whatsappLink(courseWhatsappMessage(course.name))}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between border-t border-line py-3.5 text-xs font-bold text-navy-700"
                >
                  Consultar turmas <ArrowUpRight size={18} aria-hidden />
                </a>
              </div>
            </article>
          ))}
          {visible.length === 0 && <p className="text-muted">Nenhum curso encontrado.</p>}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl px-5 pb-14 md:px-10">
        <Eyebrow>Dúvidas frequentes</Eyebrow>
        <h2 className="mb-6 mt-3 text-2xl text-navy-900 md:text-3xl">Suas dúvidas, respondidas.</h2>
        <div className="divide-y divide-line rounded-2xl border border-line bg-surface shadow-sm">
          {faq.map((item) => (
            <details key={item.q} className="group px-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 text-sm font-bold text-navy-900 [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown size={20} className="shrink-0 transition-transform group-open:rotate-180 group-open:text-orange-500" aria-hidden />
              </summary>
              <p className="pb-5 pr-6 text-sm text-muted">{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CONTATO */}
      <section id="contato" className="mx-auto max-w-[1240px] px-5 pb-14 md:px-10">
        <div className="flex flex-col gap-6 rounded-[18px] bg-gradient-to-br from-[#0b2b50] to-[#1e4e7e] p-7 text-white shadow-xl md:flex-row md:items-center md:px-9">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-[14px] border border-white/30 bg-white/10">
            <Headphones size={30} aria-hidden />
          </span>
          <div>
            <Eyebrow className="text-[#a5bfd8]">Vamos conversar?</Eyebrow>
            <h2 className="mb-1 mt-2 text-xl !text-white md:text-2xl">Invista na sua próxima qualificação.</h2>
            <p className="text-xs text-[#c2d0df]">Informações sobre treinamentos, turmas e inscrição, direto com a equipe.</p>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-xs text-[#d4dfed]">
              <li className="flex items-center gap-2"><MapPin size={14} aria-hidden /> Macaé, RJ <Pending>endereço completo</Pending></li>
              <li className="flex items-center gap-2"><Clock size={14} aria-hidden /> Seg a sex 08h às 17h30, sáb 08h às 12h30</li>
              <li className="flex items-center gap-2"><Phone size={14} aria-hidden /> (22) 99615-0138</li>
            </ul>
          </div>
          <a
            href={whatsappLink(generalMessage)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center justify-center gap-3 whitespace-nowrap rounded-full bg-white px-6 py-3.5 text-sm font-bold text-navy-900 hover:bg-canvas md:ml-auto"
          >
            Falar com a equipe <ArrowUpRight size={18} aria-hidden />
          </a>
        </div>
      </section>
    </>
  );
}
