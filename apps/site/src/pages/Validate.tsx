import { certificateCodeSchema } from "@olimach/schemas";
import { Button, Card } from "@olimach/ui";
import { Search } from "lucide-react";
import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";

export function Validate() {
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = certificateCodeSchema.safeParse(code);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Código inválido.");
      return;
    }
    navigate(`/validar/${parsed.data}`);
  }

  return (
    <section className="mx-auto max-w-xl px-4 py-16">
      <h1 className="text-3xl">Validar certificado</h1>
      <p className="mt-3 text-muted">
        Informe o código de 10 caracteres impresso no certificado. A busca aceita apenas o código exato.
      </p>
      <Card className="mt-6">
        <form onSubmit={onSubmit} noValidate>
          <label htmlFor="code" className="text-sm font-semibold text-navy-900">
            Código do certificado
          </label>
          <input
            id="code"
            value={code}
            onChange={(e) => {
              setCode(e.target.value.toUpperCase());
              setError(null);
            }}
            maxLength={10}
            autoComplete="off"
            spellCheck={false}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "code-error" : undefined}
            className="mt-2 w-full rounded-btn-admin border border-line bg-surface px-3 py-2.5 font-mono text-lg uppercase tracking-widest"
          />
          {error && (
            <p id="code-error" role="alert" className="mt-2 text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" context="landing" className="mt-4">
            <Search size={16} aria-hidden /> Validar
          </Button>
        </form>
      </Card>
    </section>
  );
}
