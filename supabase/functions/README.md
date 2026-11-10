# Edge Functions

## issue-certificate

Gera o PDF do certificado (A4 paisagem, frente e verso, QR code), grava no bucket privado `certificates` e cria o
registro em `public.certificates`. Roda com o JWT de quem chamou: a RLS e os triggers do banco continuam valendo,
sem `service_role`.

### Segredos (Supabase > Edge Functions > Secrets, ou `supabase secrets set`)

| Segredo | Exemplo | Para que |
|---|---|---|
| `SITE_URL` | `https://www.olimach.com.br` | endereco do QR code (`<SITE_URL>/validar/<codigo>`) |
| `COMPANY_LEGAL_NAME` | razao social completa | rodape do certificado |
| `COMPANY_CNPJ` | `00.000.000/0001-00` | rodape do certificado |
| `ALLOWED_ORIGIN` (opcional) | `https://admin.olimach.com.br` | CORS; padrao `*` |

`SUPABASE_URL` e `SUPABASE_ANON_KEY` ja existem no ambiente das funcoes. Sem os tres segredos, a funcao recusa a
emissao (422): o certificado exige razao social e CNPJ (NR-01).

### Deploy

```bash
supabase functions deploy issue-certificate
```

A funcao precisa de JWT (padrao): nao use `--no-verify-jwt`.

### Observacoes

- Assinaturas: so PNG ou JPG (pdf-lib nao le WebP).
- O PDF e enviado antes do registro (o banco exige `pdf_path` e `pdf_sha256`). Se o registro falhar, o PDF fica orfao
  no Storage (nao ha exclusao permitida); e inofensivo, o codigo e unico.
- O gerador fica em `_shared/certificate-pdf.ts` e tem testes em `supabase/tests/certificate-pdf.test.ts`.

## invite-user

Convida um usuario da equipe por e-mail (somente administrador). E o **unico** ponto do projeto que usa a
`service_role` (necessaria para criar contas no Auth); a chave existe so no ambiente da funcao.

| Segredo | Exemplo | Para que |
|---|---|---|
| `ADMIN_URL` | `https://admin.olimach.com.br` | destino do link do convite (`<ADMIN_URL>/redefinir-senha`) |

```bash
supabase functions deploy invite-user
```

Fluxo: valida o JWT do chamador (`is_admin`), envia o convite (`inviteUserByEmail`) e cria o perfil (nome e papel).
A pessoa abre o link, define a senha em `/redefinir-senha` e entra. Se a criacao do perfil falhar, a conta e removida.
Configure o SMTP em Authentication > Emails e a URL do painel em Authentication > URL Configuration.
