import { BrandLogo, cn } from "@olimach/ui";
import {
  BadgeCheck,
  BarChart3,
  CalendarDays,
  GraduationCap,
  Home,
  LogOut,
  Settings,
  UserCog,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";

const nav: Array<{ to: string; label: string; icon: LucideIcon; end?: boolean }> = [
  { to: "/", label: "Início", icon: Home, end: true },
  { to: "/alunos", label: "Alunos", icon: Users },
  { to: "/cursos", label: "Cursos", icon: GraduationCap },
  { to: "/turmas", label: "Turmas", icon: CalendarDays },
  { to: "/certificados", label: "Certificados", icon: BadgeCheck },
  { to: "/instrutores", label: "Instrutores", icon: UserCog },
  { to: "/relatorios", label: "Relatórios", icon: BarChart3 },
  { to: "/configuracoes", label: "Configurações", icon: Settings },
];

/** Layout protegido: exige sessao e perfil ativo (a autorizacao real e a RLS no banco). */
export function AdminLayout() {
  const { loading, session, profile, signOut } = useAuth();

  if (loading) return <p className="p-8 text-muted">Carregando...</p>;
  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-line bg-surface p-4 md:flex">
        <div className="px-2 py-3">
          <BrandLogo className="h-24 w-auto" />
        </div>
        <nav aria-label="Principal" className="mt-6 flex flex-1 flex-col gap-1">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-btn-admin px-3 py-2 text-sm font-medium",
                  isActive ? "bg-canvas text-navy-900" : "text-muted hover:bg-canvas hover:text-navy-900",
                )
              }
            >
              <Icon size={18} aria-hidden /> {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-4 border-b border-line bg-surface px-6 py-3">
          <div className="text-right text-sm">
            <p className="font-semibold text-navy-900">{profile?.name ?? session.user.email}</p>
            <p className="text-muted">{profile ? (profile.role === "admin" ? "Administrador" : "Secretaria") : "Sem perfil ativo"}</p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-btn-admin p-2 text-muted hover:bg-canvas hover:text-navy-900"
            aria-label="Sair"
          >
            <LogOut size={18} aria-hidden />
          </button>
        </header>
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
