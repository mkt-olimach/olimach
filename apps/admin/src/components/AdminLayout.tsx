import { BrandLogo, cn } from "@olimach/ui";
import {
  Bell,
  BookOpen,
  CalendarDays,
  ChartNoAxesColumn,
  FileText,
  Images,
  Home,
  LogOut,
  Menu,
  Search,
  Palette,
  Settings2,
  UserCog,
  UsersRound,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { isSuperAdminRole, roleLabel, useAuth } from "../lib/auth";
import { initials } from "../lib/certificates";
import { useCompany } from "../lib/company";

const nav: Array<{ to: string; label: string; icon: LucideIcon; end?: boolean }> = [
  { to: "/", label: "Início", icon: Home, end: true },
  { to: "/alunos", label: "Alunos", icon: UsersRound },
  { to: "/cursos", label: "Treinamentos", icon: BookOpen },
  { to: "/turmas", label: "Turmas", icon: CalendarDays },
  { to: "/certificados", label: "Certificados", icon: FileText },
  { to: "/instrutores", label: "Instrutores", icon: UserCog },
  { to: "/galeria", label: "Galeria", icon: Images },
  { to: "/relatorios", label: "Relatórios", icon: ChartNoAxesColumn },
  { to: "/configuracoes", label: "Configurações", icon: Settings2 },
];

/** Modulo exclusivo do super administrador, logo abaixo de Configuracoes. */
const whiteLabelItem = { to: "/white-label", label: "White Label", icon: Palette };

function GlobalSearch() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [term, setTerm] = useState(params.get("q") ?? "");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const q = term.trim();
    navigate({ pathname: "/", search: q ? `?q=${encodeURIComponent(q)}` : "" });
  }

  return (
    <form onSubmit={onSubmit} role="search" className="max-w-[490px] flex-1">
      <label htmlFor="global-search" className="sr-only">
        Buscar aluno, certificado ou treinamento
      </label>
      <div className="flex h-10 items-center gap-3 rounded-[13px] bg-canvas px-3.5 text-ink">
        <Search size={17} aria-hidden />
        <input
          id="global-search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Buscar aluno, certificado ou treinamento..."
          className="w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-[#9eabba]"
        />
      </div>
    </form>
  );
}

/** Layout protegido: exige sessao e perfil ativo (a autorizacao real e a RLS no banco). */
export function AdminLayout() {
  const { loading, session, profile, recovery, signOut } = useAuth();
  const { company } = useCompany();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => setDrawerOpen(false), [pathname]);

  if (loading) return <p className="p-8 text-muted">Carregando...</p>;
  if (!session) return <Navigate to="/login" replace />;
  // Sessao vinda do link de recuperacao: so serve para definir a nova senha.
  if (recovery) return <Navigate to="/redefinir-senha" replace />;

  const displayName = profile?.name ?? session.user.email ?? "Usuário";

  return (
    <div className="min-h-screen bg-[#f4f6f9] md:p-4">
      <div className="mx-auto min-h-[calc(100vh-2rem)] max-w-[1700px] overflow-clip bg-surface md:grid md:grid-cols-[236px_minmax(0,1fr)] md:rounded-[17px] md:border md:border-line md:shadow-sm">
        {drawerOpen && (
          <button
            type="button"
            aria-label="Fechar menu"
            className="fixed inset-0 z-40 bg-navy-900/40 md:hidden"
            onClick={() => setDrawerOpen(false)}
          />
        )}

        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-[245px] flex-col border-r border-line bg-surface px-4 pb-6 pt-6 shadow-xl transition-transform md:static md:z-auto md:w-auto md:translate-x-0 md:pt-8 md:shadow-none",
            drawerOpen ? "translate-x-0" : "-translate-x-[105%]",
          )}
        >
          <div className="mb-8 flex items-center justify-between px-2">
            <BrandLogo src={company.logoUrl ?? undefined} name={company.name} className="h-24 w-auto" />
            <button
              type="button"
              className="rounded-btn-admin p-2 text-muted md:hidden"
              aria-label="Fechar menu"
              onClick={() => setDrawerOpen(false)}
            >
              <X size={20} aria-hidden />
            </button>
          </div>

          <nav aria-label="Principal" className="flex flex-col gap-1">
            {(isSuperAdminRole(profile?.role) ? [...nav, whiteLabelItem] : nav).map(({ to, label, icon: Icon, end }: { to: string; label: string; icon: LucideIcon; end?: boolean }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-4 rounded-[11px] px-3.5 py-3 text-[13px] transition-colors",
                    isActive ? "bg-[#edf1f7] font-semibold text-navy-900" : "font-medium text-[#45566c] hover:bg-canvas",
                  )
                }
              >
                <Icon size={19} strokeWidth={1.8} aria-hidden /> {label}
              </NavLink>
            ))}
          </nav>

          <div className="relative mt-auto hidden min-h-[230px] overflow-hidden rounded-[13px] border border-line bg-canvas p-6 md:block">
            <p className="relative z-10 text-sm font-extrabold uppercase text-navy-900">{company.name}</p>
            <p className="relative z-10 mt-2 max-w-[150px] text-[13px] text-[#5b6d86]">Segurança que leva mais longe.</p>
            <img
              src="/assets/images/platform-card.webp"
              alt=""
              loading="lazy"
              className="absolute inset-x-0 bottom-0 h-[150px] w-full object-cover [mask-image:linear-gradient(0deg,#000_72%,transparent)]"
            />
          </div>
        </aside>

        <div className="flex min-w-0 flex-col bg-[radial-gradient(ellipse_at_0%_12%,#edf2f8_0,transparent_37%)]">
          <header className="flex h-[70px] items-center justify-between gap-4 border-b border-line bg-surface/80 px-4 md:h-[86px] md:px-8">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center rounded-btn-admin text-navy-900 md:hidden"
              aria-label="Abrir menu"
              onClick={() => setDrawerOpen(true)}
            >
              <Menu size={22} aria-hidden />
            </button>
            <GlobalSearch />
            <div className="flex items-center gap-3">
              <span className="relative hidden text-[#172944] md:block" title="Notificações">
                <Bell size={20} aria-hidden />
              </span>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#092248] text-xs font-semibold text-white" aria-hidden>
                {initials(displayName)}
              </span>
              <div className="hidden min-w-24 text-sm md:block">
                <p className="max-w-[170px] truncate text-xs font-bold text-ink">{displayName}</p>
                <p className="text-[10px] text-muted">
                  {profile ? roleLabel[profile.role] : "Sem perfil ativo"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void signOut()}
                className="rounded-btn-admin p-2 text-muted hover:bg-canvas hover:text-navy-900"
                aria-label="Sair"
              >
                <LogOut size={18} aria-hidden />
              </button>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 md:px-8 md:py-7">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
