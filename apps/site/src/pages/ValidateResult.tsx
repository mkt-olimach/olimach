import { Card, StatusBadge } from "@olimach/ui";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { validateCertificate } from "../lib/validation";
import type { ValidationOutcome } from "../lib/validation";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" });
const formatDate = (iso: string | null) => (iso ? dateFormat.format(new Date(iso)) : "Sem validade definida");

const messages: Record<Exclude<ValidationOutcome["kind"], "found">, string> = {
  not_found: "Nenhum certificado encontrado para este código. Confira os 10 caracteres e tente de novo.",
  invalid_code: "Código inválido. Ele deve ter 10 caracteres, como impresso no certificado.",
  rate_limited: "Muitas consultas em pouco tempo. Aguarde um minuto e tente novamente.",
  not_configured: "Validação indisponível neste ambiente: a conexão com o banco ainda não foi configurada.",
  error: "Não foi possível consultar agora. Tente novamente em instantes.",
};

export function ValidateResult() {
  const { code = "" } = useParams();
  const [outcome, setOutcome] = useState<ValidationOutcome | null>(null);

  useEffect(() => {
    let active = true;
    setOutcome(null);
    validateCertificate(code).then((result) => {
      if (active) setOutcome(result);
    });
    return () => {
      active = false;
    };
  }, [code]);

  return (
    <section className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl">Resultado da validação</h1>
      <p className="mt-2 font-mono tracking-widest text-muted">{code.toUpperCase()}</p>

      <Card className="mt-6" aria-live="polite">
        {outcome === null && <p className="text-muted">Consultando...</p>}

        {outcome && outcome.kind !== "found" && <p className="text-ink">{messages[outcome.kind]}</p>}

        {outcome?.kind === "found" && (
          <dl className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <dt className="text-sm text-muted">Situação</dt>
              <dd>
                <StatusBadge status={outcome.row.status as "valid" | "revoked" | "expired"} />
              </dd>
            </div>
            <Row label="Aluno" value={outcome.row.student_name} />
            <Row label="CPF" value={outcome.row.cpf_masked} />
            <Row label="Curso" value={outcome.row.course_name} />
            <Row label="Carga horária" value={outcome.row.workload_hours ? `${outcome.row.workload_hours} horas` : null} />
            <Row label="Emissão" value={formatDate(outcome.row.issued_at)} />
            <Row label="Validade" value={formatDate(outcome.row.expires_at)} />
          </dl>
        )}
      </Card>

      <Link to="/validar" className="mt-6 inline-block text-sm font-semibold text-brand-500 hover:underline">
        Validar outro certificado
      </Link>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="font-medium text-navy-900">{value ?? "-"}</dd>
    </div>
  );
}
