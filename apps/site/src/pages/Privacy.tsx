import { Pending } from "@olimach/ui";

/* Rascunho tecnico da politica. O texto final precisa de revisao juridica da Olimach antes de ir ao ar. */
export function Privacy() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-3xl">Política de privacidade</h1>
      <p className="mt-2">
        <Pending>revisão jurídica e dados do controlador (razão social, CNPJ, encarregado)</Pending>
      </p>

      <div className="mt-6 space-y-6 text-ink">
        <section>
          <h2 className="text-xl">Dados que tratamos</h2>
          <p className="mt-2 text-muted">
            Para emitir certificados, a Olimach trata nome completo, CPF, data de nascimento, telefone, e-mail e
            empresa dos alunos, além dos dados da matrícula (curso, turma, presença e aprovação).
          </p>
        </section>
        <section>
          <h2 className="text-xl">Para que usamos</h2>
          <p className="mt-2 text-muted">
            Os dados são usados para registrar a participação nos treinamentos, emitir e validar certificados e
            cumprir obrigações legais e regulatórias.
          </p>
        </section>
        <section>
          <h2 className="text-xl">O que a validação pública mostra</h2>
          <p className="mt-2 text-muted">
            Ao consultar um código de certificado, são exibidos nome, CPF parcialmente oculto, curso, carga
            horária, datas de emissão e validade e a situação do certificado. O arquivo PDF não é público.
          </p>
        </section>
        <section>
          <h2 className="text-xl">Seus direitos</h2>
          <p className="mt-2 text-muted">
            Você pode solicitar confirmação de tratamento, acesso, correção e demais direitos previstos na Lei
            13.709/2018 (LGPD) pelo WhatsApp da Olimach.
          </p>
        </section>
      </div>
    </section>
  );
}
