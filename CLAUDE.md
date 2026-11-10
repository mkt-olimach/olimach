# Olimach · Site + Plataforma de Certificados

Cliente da Agência 1925. Escola de treinamentos onshore/offshore em Macaé-RJ.
Marca: OLIMACH. Prazo: 14 dias úteis. Escopo fechado; nada fora dele sem aprovação.

## Stack
- Monorepo pnpm workspaces + Turborepo
- apps/site: Vite 5 + React 18 + TypeScript (landing one-page, SSG/prerender para SEO)
- apps/admin: Vite 5 + React 18 + TypeScript (plataforma interna)
- packages/ui: componentes e tokens compartilhados (Tailwind + CSS vars)
- packages/schemas: zod compartilhado
- Supabase: Auth (e-mail/senha, sem cadastro público), Postgres com RLS, Storage privado
- Geração de PDF: @react-pdf/renderer ou pdf-lib (server-side em Edge Function)
- QR: qrcode
- Deploy: Vercel via GitHub (site em domínio raiz, admin em admin.<dominio>)

## Design tokens (packages/ui)
--navy-900 #0B1F4D | --navy-700 #1A3A7A | --blue-500 #1E63C7
--orange-500 #F28A1E | --orange-600 #D9730D | --safety-yellow #F5C400
--bg #F5F7FA | --surface #FFFFFF | --border #E3E8EF
--text #1C2433 | --muted #6B7689
--success #1F9D55 | --warning #E0A100 | --danger #D64545

Fontes: Plus Jakarta Sans (títulos 700/800), Inter (texto). Ícones: lucide-react.
Raios: card 12px, botão landing 999px, botão admin 10px.
Logo oficial em /assets/brand. Nunca redesenhar.

## Modelo de dados
courses: id, slug, name, category (nr|profissionalizante|parceria), nr_code, workload_hours, syllabus (text), modality, validity_months, active
instructors: id, name, qualification, registry, signature_path
technical_leads: id, name, qualification, registry, signature_path
classes: id, course_id, start_date, end_date, location, status
class_instructors: class_id, instructor_id
students: id, full_name, cpf (unique), birth_date, phone, email, company
enrollments: id, class_id, student_id, attendance_ok, approved
certificates: id, enrollment_id, code (unique, nanoid 10, sem sequência), issued_at, expires_at, technical_lead_id, pdf_path, pdf_sha256, status (valid|revoked), revoked_reason, revoked_at
audit_log: id, actor_id, action, entity, entity_id, payload, created_at
profiles: id (auth.users), name, role (admin|secretaria)

Regra: cursos category = parceria não podem gerar certificado (constraint + validação na UI).
Status "vencido" é calculado (expires_at < now()), não gravado.

## Certificado (conteúdo mínimo NR-01)
Frente: logo, "CERTIFICADO", nome do aluno, CPF mascarado, curso, carga horária, período, local, validade, QR + código, assinatura do instrutor (nome + qualificação) e do responsável técnico (nome + registro), razão social e CNPJ.
Verso: conteúdo programático.
A4 paisagem. PDF imutável após emissão; correção = revogar + reemitir.

## Rotas
Site: / (one-page com âncoras), /validar, /validar/:code, /privacidade
Admin: /login, /, /alunos, /cursos, /turmas, /certificados, /instrutores, /relatorios, /configuracoes

## Página pública de validação
Mostra: nome, curso, carga horária, emissão, validade, status. CPF no formato ***.456.789-**.
Não expõe PDF publicamente. Rate limit por IP. Busca só por código exato.
Implementar via Edge Function ou RPC security definer; nunca liberar SELECT anônimo na tabela.

## Segurança e LGPD (baseline obrigatória)
- RLS em todas as tabelas; nenhuma tabela sem policy
- Service role só em Edge Functions
- Storage privado, URLs assinadas com expiração curta
- audit_log em emitir, editar, revogar, excluir
- Validação zod no cliente e no servidor
- Headers de segurança (CSP, HSTS, X-Frame-Options) na Vercel
- Sem dado pessoal em URL ou query string além do código do certificado
- Política de privacidade publicada

## SEO (apps/site)
- Title: Olimach | Cursos NR-10, NR-33, NR-35 e Treinamentos Offshore em Macaé
- H1 único. Uma section por bloco com id (#cursos, #nr-35 etc.)
- JSON-LD: EducationalOrganization + LocalBusiness, Course (um por curso), FAQPage
- Open Graph + favicon do símbolo
- Imagens WebP/AVIF, lazy, alt descritivo com termo local
- Lighthouse >= 90 em Performance, SEO e Acessibilidade
- CTA WhatsApp: https://wa.me/5522996150138?text=<mensagem por curso>

## Regras de conteúdo
- Proibido no código/copy: "reconhecido pelo MEC", "validade nacional", "blockchain", "anos de experiência", contadores de alunos/aprovação sem dado real.
- Dado faltante = placeholder [PENDENTE: ...] visível no dev.
- Dados de seed: cursos de NR e profissionalizantes. Nunca CBSP/HUET.
- Textos em pt-BR, sem travessão.

## Fluxo de trabalho
1. Ler este arquivo antes de qualquer tarefa.
2. Planejar antes de codar em mudanças com mais de um arquivo.
3. Commits pequenos e descritivos em pt-BR.
4. Migrations versionadas em supabase/migrations; nunca alterar banco manualmente.
5. Ao terminar uma etapa: rodar typecheck, lint, build e testar o fluxo no navegador.
6. Nunca commitar .env. Variáveis em .env.example.
