import { Card } from "@olimach/ui";
import { BadgeCheck, BookOpen, Users } from "lucide-react";
import { Link } from "react-router-dom";

/* Os indicadores serao calculados do banco quando as telas de dados existirem.
   Ate la nenhum numero e exibido: sem dados ficticios. */
const stats = [
  { label: "Certificados emitidos", icon: BadgeCheck },
  { label: "Alunos cadastrados", icon: Users },
  { label: "Cursos ativos", icon: BookOpen },
];

export function Dashboard() {
  return (
    <div>
      <h1 className="text-3xl">Gerencie seus certificados de forma simples e segura.</h1>
      <p className="mt-2 text-muted">Emita, organize e valide os certificados dos treinamentos.</p>
      <Link
        to="/certificados"
        className="mt-5 inline-flex rounded-btn-admin bg-navy-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-700"
      >
        Emitir certificado
      </Link>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {stats.map(({ label, icon: Icon }) => (
          <Card key={label} className="flex items-center gap-4">
            <span className="rounded-btn-admin bg-canvas p-3 text-navy-900">
              <Icon size={22} aria-hidden />
            </span>
            <div>
              <p className="text-2xl font-extrabold text-navy-900">-</p>
              <p className="text-sm text-muted">{label}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
