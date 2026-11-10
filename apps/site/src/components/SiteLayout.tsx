import { BrandLogo, Pending, cn } from "@olimach/ui";
import { ArrowUpRight, MapPin, Menu, MessageCircle, Search, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent, MouseEvent, ReactNode } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { whatsappLink } from "../lib/whatsapp";

const generalMessage = "Olá! Gostaria de mais informações sobre os treinamentos da Olimach.";

const nav = [
  { href: "/#inicio", label: "Início" },
  { href: "/#sobre", label: "Sobre nós" },
  { href: "/#cursos", label: "Cursos" },
  { href: "/validar", label: "Certificados" },
  { href: "/#contato", label: "Contato" },
];

function CourseSearch() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const q = term.trim();
    navigate({ pathname: "/", search: q ? `?q=${encodeURIComponent(q)}` : "", hash: "#cursos" });
  }

  return (
    <form onSubmit={onSubmit} role="search" className="hidden xl:block">
      <label htmlFor="course-search" className="sr-only">
        Buscar cursos
      </label>
      <div className="flex h-10 w-48 items-center gap-2 rounded-full border border-line bg-canvas px-4">
        <Search size={16} className="text-muted" aria-hidden />
        <input
          id="course-search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar cursos..."
          className="w-full bg-transparent text-xs text-ink outline-none placeholder:text-muted"
        />
      </div>
    </form>
  );
}

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function scrollToHash(hash: string) {
  document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth" });
}

/** Link para uma ancora da Home ("/#cursos"). Na Home rola suavemente sem recarregar; em outra rota navega e o efeito do layout rola. */
function AnchorLink({ href, className, children, onNavigate }: { href: string; className?: string; children: ReactNode; onNavigate?: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const hash = href.slice(href.indexOf("#"));

  function onClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    onNavigate?.();
    if (pathname === "/") {
      scrollToHash(hash);
      window.history.replaceState(null, "", `/${hash}`);
    } else {
      navigate({ pathname: "/", hash });
    }
  }

  return (
    <a href={href} onClick={onClick} className={className}>
      {children}
    </a>
  );
}

export function SiteLayout() {
  const { pathname, search, hash } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // O React Router nao rola ate a ancora sozinho (chegada vinda de outra rota, como /validar -> /#cursos).
  useEffect(() => {
    setMenuOpen(false);
    if (!hash) return;
    scrollToHash(hash);
  }, [pathname, search, hash]);

  return (
    <div className="bg-surface">
      {/* Largura total: fundos e faixas ocupam a tela inteira; so o conteudo tem largura maxima. */}
      <div>
        <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-6 px-5 py-1 md:px-10">
            <Link to="/" aria-label="OLIMACH, página inicial" className="shrink-0">
              <BrandLogo className="h-20 w-auto md:h-24" />
            </Link>

            <nav
              aria-label="Principal"
              className={cn(
                "absolute left-0 right-0 top-full flex-col gap-1 border-b border-line bg-surface px-5 py-4 text-sm font-semibold text-muted shadow-lg lg:static lg:flex lg:flex-row lg:gap-7 lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none",
                menuOpen ? "flex" : "hidden",
              )}
            >
              {nav.map((item) => (
                item.href.startsWith("/#") ? (
                  <AnchorLink key={item.href} href={item.href} onNavigate={() => setMenuOpen(false)} className="px-2 py-3 hover:text-navy-900 lg:p-0">
                    {item.label}
                  </AnchorLink>
                ) : (
                  <Link key={item.href} to={item.href} className="px-2 py-3 hover:text-navy-900 lg:p-0">
                    {item.label}
                  </Link>
                )
              ))}
            </nav>

            <div className="flex items-center gap-3">
              <CourseSearch />
              <Link
                to="/validar"
                className="hidden items-center gap-2 rounded-full border border-line px-4 py-2.5 text-xs font-bold text-navy-700 hover:bg-canvas sm:inline-flex"
              >
                <UserRound size={16} aria-hidden /> Validar certificado
              </Link>
              <button
                type="button"
                className="grid h-10 w-10 place-items-center rounded-[10px] border border-line text-navy-900 lg:hidden"
                aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((v) => !v)}
              >
                {menuOpen ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
              </button>
            </div>
          </div>
        </header>

        <main>
          <Outlet />
        </main>

        <footer className="bg-[#092744] text-white">
          <div className="mx-auto grid max-w-[1400px] gap-10 px-5 pb-10 pt-12 text-xs md:px-10 lg:grid-cols-[1.5fr_0.75fr_0.75fr_1.2fr]">
            <div>
              <BrandLogo className="h-24 w-auto rounded-lg bg-white p-2" />
              <p className="mt-5 max-w-[270px] text-[#a6bad0]">
                Treinamentos onshore e offshore em Macaé, RJ, com foco em segurança, desenvolvimento e qualificação.
              </p>
            </div>
            <div className="flex flex-col gap-3 text-[#b0c3d8]">
              <h3 className="mb-2 text-xs font-extrabold text-white">Explore</h3>
              <AnchorLink href="/#cursos" className="hover:text-white">Cursos e treinamentos</AnchorLink>
              <AnchorLink href="/#sobre" className="hover:text-white">Sobre a Olimach</AnchorLink>
              <Link to="/validar" className="hover:text-white">Validar certificado</Link>
            </div>
            <div className="flex flex-col gap-3 text-[#b0c3d8]">
              <h3 className="mb-2 text-xs font-extrabold text-white">Informações</h3>
              <AnchorLink href="/#contato" className="hover:text-white">Entre em contato</AnchorLink>
              <AnchorLink href="/#faq" className="hover:text-white">Dúvidas frequentes</AnchorLink>
              <Link to="/privacidade" className="hover:text-white">Política de privacidade</Link>
            </div>
            <div className="flex flex-col gap-3 text-[#b0c3d8]">
              <h3 className="mb-2 text-xs font-extrabold text-white">Vamos conversar?</h3>
              <p>Entre em contato para conhecer os treinamentos e consultar turmas.</p>
              <p className="flex items-center gap-2"><MapPin size={16} aria-hidden /> Macaé, RJ</p>
              <a
                href={whatsappLink(generalMessage)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-2 font-bold text-white"
              >
                WhatsApp (22) 99615-0138 <ArrowUpRight size={16} aria-hidden />
              </a>
            </div>
          </div>
          <div className="border-t border-[#31506c]">
            <div className="mx-auto flex max-w-[1400px] flex-col gap-2 px-5 py-5 text-[11px] text-[#92a9be] md:flex-row md:justify-between md:px-10">
              <span>© {new Date().getFullYear()} Olimach. Todos os direitos reservados.</span>
              <span><Pending>razão social e CNPJ</Pending></span>
              <span>Desenvolvido por Agência 1925</span>
            </div>
          </div>
        </footer>
      </div>

      <a
        href={whatsappLink(generalMessage)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Conversar com a Olimach pelo WhatsApp"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[#1cbd65] p-4 text-sm font-extrabold text-white shadow-lg transition-transform hover:-translate-y-1 sm:px-5 sm:py-3.5"
      >
        <MessageCircle size={24} aria-hidden />
        <span className="hidden sm:inline">Fale conosco</span>
      </a>
    </div>
  );
}
