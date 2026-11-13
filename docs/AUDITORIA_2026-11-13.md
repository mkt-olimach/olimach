# Auditoria /sec + /front: 13/11/2026

Base: MASTER-PROMPT-AUDITORIA-SAAS v2.10 (módulos B e C). Código na branch `feat/update`. Este relatório não é parecer jurídico nem garantia de segurança.

## Escopo e método
- Código: `supabase/migrations` (21 arquivos), `supabase/functions`, `apps/site`, `apps/admin`, `packages/*`.
- Banco: 77 testes automatizados em PGlite (matriz de acesso por papel, RLS, RPCs, provas, rate limit).
- Produção (somente leitura, chave anon pública do próprio projeto): sondagem de 21 tabelas/views e das RPCs.
- Dependências: `pnpm audit --prod`.
- Segredos: busca de padrões de chave no código e no bundle; decodificação do papel dos JWT encontrados.
- Não verificado: Storage real (políticas efetivas), Auth (MFA, política de senha, e-mail), Vercel (headers servidos), Edge Functions em execução, backups.

## Achados

| ID | Evidência | Gravidade | Prioridade | Status |
|---|---|---|---|---|
| SEC-01 anon com privilégio de SELECT em `certificate_signers`, `company_settings`, `gallery_images` | CONFIRMADO (produção responde 200 `[]`; as demais tabelas respondem 401) | Baixa (a RLS barra as linhas) | P3 | CORRIGIDO NA MIGRAÇÃO 21, falta aplicar e retestar |
| SEC-02 links da empresa aceitam `javascript:` e vão para `<a href>` no site | CONFIRMADO (sem restrição no banco nem no site) | Média (exige super admin mal-intencionado ou conta comprometida) | P2 | CORRIGIDO (check no banco + `safeHttpUrl` no site), falta aplicar migração 21 |
| SEC-03 rate limit usa o 1º item de `X-Forwarded-For`, forjável | PROVÁVEL (depende do proxy; a lógica foi confirmada no código e no teste) | Média | P2 | CORRIGIDO (`request_client_ip`), falta aplicar migrações 19 e 21 |
| SEC-04 buckets sem limite de tamanho e tipo no servidor (só o navegador validava) | CONFIRMADO no código | Baixa | P3 | CORRIGIDO na migração 21 (só efetivo no Supabase real) |
| SEC-05 `exam_submit` aceitava payload de respostas sem limite | CONFIRMADO | Baixa | P3 | CORRIGIDO (limite de 64 KB, na migração 19) |
| SEC-06 `validation_rate_limit` crescia sem limpeza no fluxo de provas | CONFIRMADO | Baixa | P3 | CORRIGIDO (limpeza horária) |
| DEP-01 `zod` 3.x: DoS de memória em coleções enormes (GHSA, alta) | CONFIRMADO pelo audit | Baixa na prática (o zod só valida respostas do próprio backend e formulários do painel) | P3 | ABERTO: exige migração para zod 4 (API muda) |
| DEP-02 `react-router` 6.x: open redirect por barra invertida; construtor via SSR (moderadas) | CONFIRMADO pelo audit | Baixa (sem SSR; só `Link` internos) | P3 | ABERTO: exige migração para React Router 7 |
| HRD-01 CSP libera `https://*.supabase.co` em `img-src` e `connect-src` (qualquer projeto Supabase) | HARDENING | Baixa | P3 | ABERTO: restringir ao host do projeto de cada instalação |
| HRD-02 CORS das Edge Functions cai em `*` sem `ALLOWED_ORIGIN` | HARDENING | Baixa (as funções exigem JWT) | P3 | ABERTO: definir `ALLOWED_ORIGIN` nos segredos |
| HRD-03 chave anon pública no bundle | NÃO É FALHA (papel `anon`, projeto `pppicdsfsszmonqrnonw`) | n/a | n/a | OK |

## Pontos verificados sem achado
- **Autorização em camadas.** Matriz por papel testada no banco: secretaria opera alunos e emite certificados, mas não edita catálogo nem revoga; admin faz o que a secretaria faz e mais; super admin é o único que mexe em super admin e no White Label. Cobertura: `supabase/tests/migrations.test.ts`.
- **Segredos.** `service_role` só em `invite-user` e `issue-certificate` (as duas Edge Functions). `.env` fora do Git. Bundle só com chave `anon`.
- **Provas online.** Gabarito inacessível ao aluno e ao anon (testado); correção no servidor; token de 244 bits e senha só como hash; bloqueio por 5 erros; token fora de qualquer URL de dado pessoal; `Referrer-Policy` evita vazar o token em navegação cruzada.
- **XSS.** Sem `dangerouslySetInnerHTML`, `innerHTML` ou `eval`. Dados da empresa renderizados como texto; JSON-LD montado com `JSON.stringify`.
- **Exportação CSV.** Células protegidas contra injeção de fórmula.
- **Headers da Vercel.** HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy e CSP sem `unsafe-inline` em scripts.
- **Armazenamento no navegador.** Sem token de sessão em `localStorage`. Só a cor de destaque (localStorage) e a prova em andamento (sessionStorage).

## Matriz IDOR/BOLA (B.28), resultado no banco
| Sujeito | Recurso | Resultado | Evidência |
|---|---|---|---|
| anon | qualquer tabela | bloqueado (permission denied) | teste "endurecimento" |
| anon | RPC de equipe (`create_exam_assignment`) | bloqueado | teste "provas online" |
| secretaria | escrever prova, galeria, empresa, super admin | bloqueado (RLS) | testes de provas, galeria e super admin |
| admin | promover alguém a super admin | bloqueado | teste super admin |
| aluno com token | prova de outro aluno | impossível sem o token da outra aplicação | teste "provas online" |

## O que aplicar
1. Migrações 19, 20 e 21 no SQL Editor (a 19 ainda não está em produção; a 21 depende da 19 por causa de `request_client_ip`).
2. Retestar em produção: `anon` deve receber 401 também em `certificate_signers`, `company_settings` e `gallery_images`.
3. Definir `ALLOWED_ORIGIN` nas Edge Functions.

## Riscos residuais
- Dependências com CVE aguardando migração de versão maior (zod 4, React Router 7).
- Controles do Supabase fora do repositório (MFA, política de senha, backups, limites do Storage) sem verificação.
- Provas: não há verificação de identidade do aluno além de link + CPF + senha; outra pessoa com os três itens pode fazer a prova.
- O CPF é dado pessoal e entra no fluxo de provas: falta política de retenção e atualização da política de privacidade.
