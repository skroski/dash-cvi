# Registro da implementação — hierarquia de usuários, segurança e auditoria

**Data:** 2026-07-25
**Escopo:** identidade real por usuário, papéis, status operacional, auditoria e RLS
**Referência de uso:** [`usuarios-papeis-e-auditoria.md`](./usuarios-papeis-e-auditoria.md)

Este documento registra *o que foi encontrado, o que foi decidido e por quê*. Para
saber **como o sistema funciona hoje** (papéis, matriz de permissões, códigos de
status, ordem das migrations), use o documento de referência acima.

---

## 1. Diagnóstico inicial

Levantamento feito antes de qualquer alteração, sobre o código real do repositório.

### Autenticação (estado encontrado)

| Item | Situação encontrada |
|---|---|
| Framework | Vite + React 18 + React Router v6 (não é Next.js) |
| Auth | `AuthContext` usava apenas `session`/`user` do Supabase Auth |
| Guard | `ProtectedRoute` fazia checagem binária: `if (!user) redirect` |
| Perfil / papel | **Não existia** tabela `profiles`, coluna `role` nem enum de papéis |
| Identidade operacional | `<Select>` no header persistido em `localStorage` (`atendenteAtivoId`) |
| Vínculo `atendentes` ↔ `auth.users` | **Inexistente** |

O achado central: **o painel não tinha multi-usuário real**. O login era tratado
como compartilhado e "quem está atendendo" era uma escolha do navegador, sem
verificação. Qualquer pessoa logada podia se passar por qualquer atendente com um
clique, e nenhuma ação era atribuível a uma pessoa.

Isso torna decorativa qualquer camada construída por cima: não adianta hierarquia,
RLS ou auditoria se o banco não sabe quem é o usuário. Por isso a identidade virou
a primeira etapa, e não um detalhe da etapa 1.

### Banco de dados (estado encontrado)

- 26 tabelas; as mais antigas (`dados_cliente`, `chats`, `n8n_chat_histories`,
  `documents*`) criadas fora do controle de migrations.
- RLS **habilitada** na maioria das tabelas, mas com policies
  `for all using (true) with check (true)` — proteção cosmética. Comentário
  explícito na própria migration: *o dashboard acessa com a anon key, então as
  policies liberam acesso total*.
- `atendentes.cargo` é **texto livre** para exibição, não controle de acesso.
- Sem hierarquia (`manager_id`, `team_id`), sem status operacional, sem auditoria.
- Único ponto que capturava autoria: `mensagens_agendadas.created_by`, isolado e
  sem FK.

### Multi-tenant

Nenhuma ocorrência de `organization`, `tenant` ou empresa-cliente em todo o
repositório. Projeto Supabase único e hardcoded em `src/config/env.ts`, uma única
instância de WhatsApp. Confirmado com o responsável: **não há plano de vender o
painel para outras clínicas**.

### Fluxo de atribuição (estado encontrado)

Atribuição **100% manual**, em `src/hooks/useAtendimentos.ts`: um humano escolhe o
atendente na UI (`vincular`), com `transferir` e `encerrar` no mesmo padrão. Não
existe fila, round-robin, limite de simultâneos nem qualquer distribuidor
automático. Realtime já era usado extensivamente (10 hooks com `postgres_changes`).

---

## 2. Decisões de escopo

A proposta original era um template genérico de RBAC multi-tenant corporativo, não
derivado deste repositório. O confronto com a realidade levou aos cortes abaixo.

| Proposta original | Decisão | Motivo |
|---|---|---|
| `organizations`, `organization_id` em ~15 tabelas, `platform_admin` | **Cortado** | Single-tenant confirmado. Adicionar depois é possível sem refazer o que foi feito |
| Tabelas `roles`, `permissions`, `role_permissions` | **Cortado** | Três papéis e uma equipe pequena não justificam a indireção. Hoje um papel novo é um valor no `check` |
| Closure table / recursive CTE de hierarquia | **Cortado** | Só faz sentido com mais de uma equipe. `departamentos` já agrupa as pessoas |
| Distribuição automática (12 validações, `FOR UPDATE SKIP LOCKED`) | **Cortado** | Não existe distribuidor automático no sistema. As regras não teriam o que proteger |
| Matriz de 25 testes, `EXPLAIN ANALYZE`, relatórios formais | **Reduzido** | Substituído por verificação executável (`rls_verificacao.sql`) e validação real contra Postgres |
| MFA, rate limiting, CSP, CORS | **Adiado** | Escopo separado; misturar aumentaria o risco desta entrega |
| Perfis, papéis, vínculo com `auth.users` | **Mantido** | É a fundação que faltava |
| Status operacional + histórico | **Mantido** | Valor operacional imediato mesmo sem distribuição automática |
| Auditoria append-only | **Mantido** | Reduzido ao delta relevante, sem snapshots JSONB gigantes |
| RLS real | **Mantido, só nas tabelas novas** | Endurecer as antigas quebraria o n8n — ver riscos |

Princípio que guiou os cortes: **não construir mecanismo sem o problema
correspondente existir**. Cada peça mantida resolve algo observável hoje.

---

## 3. Modelo de dados

Relações efetivamente implementadas (divergências em relação à proposta anotadas):

```
auth.users (Supabase Auth — nunca exposta ao frontend)
  │ 1:1
  └── profiles
        ├── papel  → 'admin' | 'lider' | 'atendente'   [enum via CHECK, não tabela]
        └── atendente_id ──┐
                           │ 1:1 (unique)
                           ▼
                       atendentes ──── departamento_id ──▶ departamentos
                           │
        ┌──────────────────┼───────────────────────┐
        │ 1:1              │ 1:N                   │ 1:N
        ▼                  ▼                       ▼
  atendente_status   atendente_status_       atendimentos
  (status atual,       historico            (atribuição atual)
   PK = atendente_id)  (períodos abertos/         │
                        fechados)                 │ 1:N
                                                  ▼
                                        atendimento_transferencias
                                              (já existia)

  auditoria_eventos  ◀── escrita SOMENTE por triggers/funções security definer
    ator: profiles/atendentes · alvo: atendentes/profiles · atendimento_id
    (sem FK de propósito: a trilha sobrevive à remoção do registro auditado)
```

Hierarquia de pessoas — implementada:

```
Administrador (admin)
 ├── Líder (lider)          → enxerga toda a equipe
 └── Atendente (atendente)  → enxerga a si mesmo
```

**Divergência consciente:** não há cadeia de liderança (`manager_id`). `lider` vê
toda a equipe, não um subconjunto de liderados. Introduzir subordinação direta é
uma coluna auto-referente em `profiles` mais um ajuste nas funções `sou_gestor()` /
policies — não exige rework do que foi feito.

**Divergência consciente:** não há tabela de permissões. As permissões da matriz
estão expressas diretamente nas policies e funções (`sou_admin()`, `sou_gestor()`,
`perfil_atendente_id()`).

---

## 4. Entregáveis

### Migrations

| Arquivo | Conteúdo |
|---|---|
| `supabase/migrations/20260725100000_perfis_papeis.sql` | `profiles`; funções `perfil_papel()`, `perfil_atendente_id()`, `sou_admin()`, `sou_gestor()`; trigger de signup; trigger anti-escalação `profiles_guard`; RLS; grants/revokes; backfill |
| `supabase/migrations/20260725110000_auditoria.sql` | `auditoria_eventos`; `auditoria_registrar()`; triggers de imutabilidade; triggers de auditoria em `atendimentos` e `profiles`; RLS; grants/revokes |
| `supabase/migrations/20260725120000_status_operacional.sql` | `atendente_status`, `atendente_status_historico`; `definir_status_atendente()`; índice único de período aberto; RLS; Realtime; seed e trigger de status inicial |
| `supabase/migrations/20260727100000_usuarios_previstos.sql` | `usuarios_previstos` (mapa e-mail → papel); `handle_new_user()` passa a consultá-lo; correção dos perfis já existentes; RLS restrita a admin |

Todas com bloco de **rollback documentado** ao final e comentários explicando as
decisões não óbvias (por que `security definer`, por que sem FK na auditoria, por
que `revoke` explícito).

### Frontend

| Arquivo | Situação | Papel na entrega |
|---|---|---|
| `src/types/perfil.ts` | novo | Papéis, status, metadados de UI, `formatarTempoNoStatus` |
| `src/types/auditoria.ts` | novo | Tipos e rótulos das ações auditadas |
| `src/hooks/usePerfil.ts` | novo | Carrega o perfil; expõe `setupPendente` |
| `src/hooks/useStatusAtendentes.ts` | novo | Status da equipe, Realtime, mutação otimista com rollback |
| `src/hooks/useUsuarios.ts` | novo | Gestão de papel/vínculo/situação |
| `src/hooks/useAuditoria.ts` | novo | Consulta paginada e filtrada no servidor |
| `src/pages/UsersPage.tsx` | novo | Tela de usuários + auditoria (abas) |
| `src/components/atendentes/StatusSelector.tsx` | novo | Controle do próprio status, com confirmação de efeito |
| `src/components/atendentes/EquipeStatusPanel.tsx` | novo | Visão de equipe + histórico de status |
| `src/components/atendentes/StatusOperacionalBadge.tsx` | novo | Badge de status |
| `src/context/AuthContext.tsx` | alterado | Passa a expor `perfil`, `papel`, `isAdmin`, `isGestor`, `setupPendente` |
| `src/context/AtendenteAtivoContext.tsx` | alterado | Identidade derivada do login; trava para papel `atendente` |
| `src/components/layout/ProtectedRoute.tsx` | alterado | Bloqueia conta inativa com tela explicativa |
| `src/components/layout/AppSidebar.tsx` | alterado | Item de gestão visível só para gestor |
| `src/components/layout/AppHeader.tsx` | alterado | Inclui o controle de status |
| `src/components/atendentes/AtendenteAtivoSelector.tsx` | alterado | Vira indicador quando a identidade vem do login |
| `src/pages/AttendantsPage.tsx` | alterado | Inclui o painel de equipe |
| `src/integrations/supabase/types.ts` | alterado | Bloco manual com as tabelas novas (**remover após regenerar**) |
| `src/config/modulos.ts` | novo | Registro central: quais papéis abrem cada rota; `papelEfetivo`, `podeAcessarRota` |
| `src/components/layout/ModuloGuard.tsx` | novo | Bloqueia rota fora do papel, inclusive por URL direta |
| `src/components/GoogleSignInButton.tsx` | novo | Entrada com Google (usa o `signInWithSocial` que já existia e nunca fora ligado) |
| `src/pages/Index.tsx` | alterado | Botão do Google junto ao login por e-mail/senha |
| `src/App.tsx`, `routeMeta.ts` | alterado | Rota `/users`; rotas envolvidas pelo `ModuloGuard` |

---

## 5. Estratégia de compatibilidade

Requisito explícito: não quebrar a operação atual.

1. **Backfill preserva o acesso.** Todos os usuários já existentes em `auth.users`
   viram `admin` ativo. Ninguém perde acesso ao aplicar as migrations.
2. **O app funciona sem as migrations.** O frontend detecta o erro `PGRST205` das
   tabelas ausentes e mantém o comportamento anterior (login único, atendente no
   header), em vez de travar. As áreas novas mostram qual migration falta.
3. **Nenhuma tabela ou coluna existente foi alterada ou removida.** As migrations
   só adicionam objetos novos e triggers.
4. **Fluxo de atribuição intacto.** `useAtendimentos.ts` não foi modificado; a
   auditoria de atribuição/transferência/encerramento é capturada por trigger no
   banco, sem tocar no código de atribuição.
5. **Abas e filtros preservados.** O filtro "Atribuídas" continua funcionando —
   muda apenas a origem do `atendenteAtivoId` (login em vez de `localStorage`).

---

## 6. Verificação executada

O projeto não tem test runner configurado (só `lint` e `build`). Em vez de
introduzir um framework de testes, a verificação foi feita onde ela prova algo:
executando as migrations contra um Postgres real.

| Verificação | Resultado |
|---|---|
| `npm run build` (produção) | ✅ passa |
| Lint nos arquivos alterados/criados | ✅ 0 erros (23 erros do repositório são pré-existentes, em arquivos não tocados) |
| `tsc --noEmit` | ✅ sem erros |
| Migrations aplicadas em Postgres real (PGlite) | ✅ as quatro aplicam limpas |
| 12 checagens de comportamento | ✅ todas passam |
| 14 checagens de RLS com papéis reais | ✅ todas passam |
| 18 checagens do mapa e-mail → papel | ✅ todas passam |
| 22 checagens da visibilidade de módulos por papel | ✅ todas passam |
| Tela de login no navegador | ✅ botão do Google renderiza, sem erro de console |
| App funcionando **sem** as migrations | ✅ confirmado contra o Supabase real (`PGRST205` nas novas, `200` em `atendentes`) |

Checagens de comportamento cobertas: trigger de signup criando perfil inativo,
atomicidade de status + histórico + auditoria, fechamento do período anterior,
ajuste de motivo sem criar novo período, status inválido recusado, atendente
inativo sem status, proteção do último admin, imutabilidade da auditoria,
auditoria automática de atribuição.

Checagens de RLS (executadas assumindo os papéis `authenticated` e `anon` com JWTs
distintos — uma conexão administrativa não provaria nada, pois o dono da tabela
ignora as policies): isolamento de leitura por papel, tentativa de auto-promoção,
troca do próprio vínculo, alteração de status de terceiro, forja e remoção de
auditoria, e acesso anônimo.

Checagens do mapa e-mail → papel: os 5 e-mails da equipe caindo no papel certo e
já ativos; conta pré-existente sendo corrigida de atendente inativo para o papel
previsto; e-mail fora do mapa entrando inativo; e-mail parecido (`+2`, outra
capitalização) **não** herdando papel; `check` recusando e-mail com maiúscula no
mapa; e leitura/escrita do mapa negada a líder, atendente e anônimo.

Checagens de módulos: conjunto exato de rotas por papel, negativos explícitos
(atendente e líder em `/users`, `/configuration`, `/evolution`), rota fora do
registro seguindo liberada, fail-open sem migrations, menor privilégio quando o
perfil não existe, e grupos da barra lateral vazios sumindo.

### O que não foi verificado

- **As migrations não foram aplicadas no projeto real** (`napeofeenweerjhqucua`):
  ele não é acessível pelas credenciais disponíveis. Rodar no SQL Editor.
- **As telas autenticadas não foram vistas em execução** — não houve login no
  painel. A tela de login foi verificada no navegador; o restante compila e tem
  a lógica testada, mas a visão de cada papel dentro do painel continua pendente
  de teste com contas reais.
- **O fluxo OAuth do Google não foi executado** — o provedor precisa ser
  habilitado no painel do Supabase primeiro, e disparar um login real não cabe a
  mim. O que foi verificado é que o botão renderiza e está ligado ao
  `signInWithSocial`.
- **Comportamento com os dados reais existentes** (volume, nomes duplicados,
  atendentes já cadastrados) só se confirma após aplicar.

---

## 7. Segurança

Decisões e o que cada uma protege:

| Vetor | Proteção |
|---|---|
| Escalação de privilégio (mass assignment) | Trigger `profiles_guard` recusa mudança de `papel`, `ativo`, `atendente_id` ou `id` por quem não é admin — inclusive no mesmo `UPDATE` de um campo permitido. RLS controla linhas, não colunas |
| Lockout administrativo | A mesma trigger impede rebaixar/desativar o último admin ativo |
| IDOR | `definir_status_atendente()` nunca aceita o `p_atendente_id` recebido como verdade: resolve o chamador por `auth.uid()` e valida escopo |
| Recursão de RLS | Funções `security definer` para consultar `profiles` de dentro das policies de `profiles` |
| Sequestro de `search_path` | Todas as funções `security definer` usam `set search_path = ''` e nomes qualificados por schema |
| Consulta de papel alheio | As funções de identidade não recebem parâmetro de usuário — só respondem sobre `auth.uid()` |
| Forja de auditoria | Sem policy de `INSERT` **e** `REVOKE INSERT` de `authenticated`: falha no privilégio, antes da policy |
| Adulteração de auditoria | Sem policy de `UPDATE`/`DELETE`, `REVOKE` explícito **e** triggers de imutabilidade que barram até `service_role` |
| Menor privilégio real | O projeto concede `ALL` por *default privileges*; os `REVOKE` explícitos são o que de fato restringe |
| Cadastro aberto | Contas novas nascem inativas e exigem liberação por admin — antes, qualquer signup dava acesso total |
| `service_role` | Continua fora do frontend; o painel usa só a chave publicável e o JWT do usuário |

---

## 8. Riscos remanescentes

1. **Tabelas antigas continuam permissivas.** `atendentes`, `atendimentos`,
   `dados_cliente`, `n8n_chat_histories` e outras seguem com `using (true)` e são
   legíveis/graváveis pela anon key **sem autenticação**. Não é uma regressão — é o
   estado que já existia —, mas é o maior buraco de segurança do sistema.
   Endurecer exige ir tabela por tabela verificando painel e n8n a cada passo; as
   funções auxiliares já estão prontas para isso.
2. **`lider` enxerga toda a equipe**, não um subconjunto. Aceitável com uma equipe
   só; revisar quando houver mais de uma.
3. **`em_atendimento` é manual.** Não é derivado automaticamente da existência de
   atendimentos abertos.
4. **Bloco manual em `types.ts`** fica desatualizado se o schema mudar — remover
   assim que os tipos forem regenerados.
5. **Migrations aplicadas à mão**, sem CI validando o estado do banco.

---

## 9. Próximos passos sugeridos

Em ordem de valor:

1. Aplicar as quatro migrations e rodar `supabase/tests/rls_verificacao.sql`.
2. Habilitar o provedor Google no Supabase (passo a passo no documento de
   referência) e entrar uma vez com cada e-mail da equipe para conferir o que
   cada papel enxerga.
3. Regenerar `types.ts` e remover o bloco manual.
4. Vincular cada pessoa da equipe a um login próprio (papel + `atendente_id`) na
   tela *Usuários e auditoria* — os e-mails atuais são de setor, não de pessoa,
   e entram sem vínculo.
5. Endurecer a RLS das tabelas antigas — tabela por tabela, começando pelas que o
   n8n **não** escreve.
6. Só então avaliar distribuição automática de atendimentos, que é onde
   `STATUS_META[...].recebeAtribuicao` passa a ser regra de negócio e não
   sinalização.
