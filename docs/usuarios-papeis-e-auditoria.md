# Usuários, papéis, status operacional e auditoria

Documentação da base de identidade e controle de acesso do painel: cada login
passa a ser uma pessoa identificável, com papel e vínculo com a equipe, status
operacional próprio e trilha de auditoria das ações importantes.

> Este é o documento de **referência de uso**. Para o registro de *como se chegou
> aqui* — diagnóstico inicial, decisões de escopo, verificação executada e riscos
> — veja [`implementacao-hierarquia-usuarios.md`](./implementacao-hierarquia-usuarios.md).

## Por que isso existe

Antes desta entrega, o painel usava **um login compartilhado**: qualquer pessoa
autenticada escolhia seu nome num `<Select>` no header, e essa escolha ficava
apenas no `localStorage` do navegador. Não havia como saber quem fez o quê, nem
como impedir que alguém se passasse por outro atendente. A RLS existente era
cosmética (`using (true)`), servindo apenas para liberar o acesso via anon key.

## Ordem de aplicação das migrations

Rodar **nesta ordem** no SQL Editor do Supabase (projeto `napeofeenweerjhqucua`).
Cada uma depende da anterior:

| # | Arquivo | O que cria |
|---|---------|-----------|
| 1 | `supabase/migrations/20260725100000_perfis_papeis.sql` | `profiles`, funções de autorização, trigger de signup, backfill |
| 2 | `supabase/migrations/20260725110000_auditoria.sql` | `auditoria_eventos` + triggers de auditoria |
| 3 | `supabase/migrations/20260725120000_status_operacional.sql` | `atendente_status`, histórico e a função de troca de status |
| 4 | `supabase/migrations/20260727100000_usuarios_previstos.sql` | Mapa e-mail → papel da equipe da cvi |

Depois de aplicar, regenere os tipos e remova o bloco manual marcado em
`src/integrations/supabase/types.ts`:

```bash
supabase gen types typescript --project-id napeofeenweerjhqucua > src/integrations/supabase/types.ts
```

### Nada quebra antes de aplicar

O frontend detecta a ausência das tabelas (erro `PGRST205`) e mantém o
comportamento anterior: login único, atendente escolhido no header, nenhuma tela
bloqueada. As áreas novas mostram um aviso apontando qual migration falta. Isso
foi verificado contra o Supabase real antes das migrations serem aplicadas.

### O que acontece com quem já usa o painel

O backfill da migration 1 transforma **todos os usuários já existentes em
`auth.users` em administradores ativos**. Ninguém perde acesso.

A partir daí, **contas novas nascem inativas** (`ativo = false`) e precisam ser
liberadas por um admin em *Usuários e auditoria*. Isso fecha um buraco real: até
então, qualquer pessoa que se cadastrasse pela tela de signup ganhava acesso
total ao painel.

## Papéis

| Papel | Código | Escopo |
|-------|--------|--------|
| Administrador | `admin` | Toda a operação; gerencia usuários e vê a auditoria completa |
| Líder | `lider` | Acompanha a equipe, atribui atendimentos, vê auditoria da equipe |
| Atendente | `atendente` | Os próprios atendimentos e o próprio status |

## Equipe da cvi

A migration 4 preenche `usuarios_previstos`, o mapa que decide o papel de cada
e-mail **no primeiro login**:

| E-mail | Papel | Setor |
|--------|-------|-------|
| `recepcaohovetcvi@gmail.com` | `atendente` | Recepção — operacional |
| `adminclinicacvi@gmail.com` | `admin` | Administração da clínica |
| `danielskroski@gmail.com` | `admin` | Administrador do sistema |

Quem está no mapa entra **já ativo e com o papel certo**, inclusive entrando pelo
Google. Quem não está entra como atendente inativo, aguardando liberação — é a
proteção contra um e-mail qualquer se cadastrar e ganhar acesso.

O mapa só é legível e editável por `admin`. Para adicionar alguém depois:

```sql
insert into public.usuarios_previstos (email, papel, observacao)
values ('novapessoa@gmail.com', 'atendente', 'Setor X')
on conflict (email) do update set papel = excluded.papel;
```

O e-mail precisa estar **em minúsculas** (há um `check` que recusa o contrário):
o provedor pode devolver a capitalização de outro jeito e o mapeamento não
casaria. Alternativa sem SQL: deixar a pessoa entrar e liberá-la na tela
*Usuários e auditoria*.

### Criação das contas

As contas em si **não são criadas por estas migrations** — elas nascem quando a
pessoa entra pela primeira vez com o Google, ou por convite em *Authentication →
Users → Invite* no painel do Supabase. O mapa só decide o papel de quem chega.

### Vínculo com o cadastro de atendente

Os e-mails acima são de setor, não de pessoa física, e entram **sem
`atendente_id`**. Enquanto não forem vinculados a uma linha de `atendentes` em
*Usuários e auditoria*, quem tem papel `atendente` não terá controle de status
próprio nem o filtro "Atribuídas" — é o passo seguinte, quando cada pessoa tiver
seu próprio login.

## Visibilidade dos módulos

Definida em `src/config/modulos.ts`, fonte única lida pela barra lateral e pelo
`ModuloGuard` — por isso não existe item escondido do menu cuja URL ainda abre.

| Módulo | Admin | Líder | Atendente |
| --- | :---: | :---: | :---: |
| Início, Conversas, Grupos, Clientes, Lembretes, Agenda | Sim | Sim | Sim |
| Métricas | Sim | Sim | Não |
| Atendentes (equipe) | Sim | Sim | Não |
| Pesquisas | Sim | Sim | Não |
| Usuários e auditoria | Sim | Não | Não |
| Conexão WhatsApp | Sim | Não | Não |
| Conhecimento | Sim | Não | Não |
| Configurações | Sim | Não | Não |

Isto é **conveniência de interface, não a barreira de segurança**: o que protege
os dados é a RLS. Esconder um menu não impede ninguém de consultar a API do
Supabase direto — por isso as tabelas novas têm policies reais, e por isso a
tabela antiga ainda liberada continua sendo o risco em aberto no fim deste
documento.

## Login com Google

O botão *Entrar com Google* fica na tela de entrada, junto do login por
e-mail e senha (que continua funcionando).

Para ele funcionar, é preciso habilitar o provedor **uma vez** no Supabase —
isso não dá para fazer por migration:

1. Google Cloud Console → criar credencial **OAuth 2.0 Client ID** (tipo *Web
   application*).
2. Em *Authorized redirect URIs*, informar:
   `https://napeofeenweerjhqucua.supabase.co/auth/v1/callback`
3. No Supabase: *Authentication → Providers → Google*, habilitar e colar o
   **Client ID** e o **Client Secret**.
4. Em *Authentication → URL Configuration*, conferir que a **Site URL** e as
   *Redirect URLs* incluem o domínio do painel (e `http://localhost:8080` para
   desenvolvimento).

Sem esse passo o botão redireciona e volta com erro do provedor.

## Matriz de permissões

Aplicada no banco (RLS + funções), não apenas na interface.

| Operação | Admin | Líder | Atendente |
| --- | :---: | :---: | :---: |
| Ver o próprio perfil | Sim | Sim | Sim |
| Ver todos os usuários | Sim | Sim | Não |
| Alterar papel de um usuário | Sim | Não | Não |
| Liberar / desativar usuário | Sim | Não | Não |
| Alterar vínculo com atendente | Sim | Não | Não |
| Alterar o próprio papel | Não | Não | Não |
| Ver status da equipe | Sim | Sim | Sim |
| Alterar o próprio status | Sim | Sim | Sim |
| Alterar status de outro | Sim | Sim | Não |
| Ver histórico de status da equipe | Sim | Sim | Só o próprio |
| Ver auditoria completa | Sim | Sim | Só onde é ator ou alvo |
| Alterar ou apagar auditoria | Não | Não | Não |
| Trocar o "atendente em uso" no header | Sim | Sim | Não (vem do login) |

Observação: `lider` hoje enxerga toda a equipe, não um subconjunto. Não existe
hierarquia de liderança (`manager_id`) porque a operação atual tem uma equipe só
— ver "O que ficou de fora".

Observação 2: a RLS permite ao `lider` **ler** perfis e auditoria da equipe, mas
a tela *Usuários e auditoria* é só de admin. É um superconjunto deliberado — o
banco já suporta uma visão de auditoria para o líder, se um dia ela for
desejada, sem precisar mexer em policy. O líder acompanha a equipe pelo painel
de status em *Atendentes*.

## Status operacional

Códigos gravados em português, seguindo a convenção do schema
(`atendimentos.status` = `aberto`/`encerrado`):

| Código | Rótulo | Recebe novas atribuições |
|--------|--------|:---:|
| `disponivel` | Disponível | Sim |
| `em_atendimento` | Em atendimento | Sim |
| `almoco` | Almoço | Não |
| `pausa` | Pausa | Não |
| `reuniao` | Reunião | Não |
| `offline` | Indisponível | Não |

Regras garantidas pelo banco:

- **um único status atual por atendente** — a PK de `atendente_status` é o
  `atendente_id`;
- **um único período aberto no histórico** — índice único parcial
  `atendente_status_historico_aberto_uidx`;
- **atomicidade** — status atual, histórico e auditoria são gravados na mesma
  transação por `definir_status_atendente()`;
- **concorrência** — a função trava a linha do status (`for update`) antes de
  alterar, então duas mudanças simultâneas serializam em vez de gerarem dois
  períodos abertos;
- **atendente inativo não recebe status**.

A troca de status é otimista na interface, mas **reverte visualmente** se o
servidor recusar. Mudar para um status que bloqueia atribuições pede confirmação
explícita, mostrando o efeito prático.

> "Sem novas atribuições automáticas" descreve a intenção do status. Como hoje a
> atribuição é **manual**, o status funciona como sinalização para quem atribui
> (o painel de equipe mostra quem está disponível). Quando existir distribuição
> automática, `STATUS_META[...].recebeAtribuicao` já é o ponto de decisão.

## Auditoria

Tabela `auditoria_eventos`, **append-only**, escrita apenas por triggers.

Ações registradas: `atendimento.atribuido`, `atendimento.transferido`,
`atendimento.encerrado`, `status.alterado`, `usuario.criado`,
`usuario.papel_alterado`, `usuario.ativado`, `usuario.desativado`,
`usuario.vinculo_alterado`.

Garantias:

- **o cliente não escreve auditoria** — não existe policy de `INSERT` para
  `authenticated`; só as triggers `security definer` gravam. Não há como forjar
  nem omitir um evento pelo frontend;
- **ninguém altera nem apaga** — não há policy de `UPDATE`/`DELETE`, e as
  triggers `auditoria_sem_update`/`auditoria_sem_delete` levantam exceção. Como
  triggers rodam mesmo para `service_role`, nem o n8n consegue apagar a trilha;
- **sem dados sensíveis** — grava apenas o delta relevante (ex.: `{"de":
  "disponivel", "para": "almoco"}`), nunca a linha inteira, senhas ou tokens;
- **ações do n8n aparecem como "sistema"** — quando não há `auth.uid()`, o ator
  fica nulo e é exibido como `sistema`.

Índices cobrem exatamente as consultas da tela: ordenação por data e filtros por
ação, ator, alvo e atendimento.

## Segurança

- **Escalação de privilégio**: RLS controla quais *linhas* podem ser alteradas,
  não quais *colunas*. A trigger `profiles_guard` recusa qualquer mudança de
  `papel`, `ativo`, `atendente_id` ou `id` feita por quem não é admin — inclusive
  no mesmo `UPDATE` de um campo permitido (mass assignment).
- **Lockout**: a mesma trigger impede rebaixar ou desativar o último admin ativo.
- **IDOR**: `definir_status_atendente` nunca aceita o `p_atendente_id` recebido
  como verdade — resolve o chamador por `auth.uid()` e valida o escopo.
- **Funções `security definer`**: usadas só onde necessário (quebrar recursão de
  RLS em `profiles` e escrever nas tabelas sem policy de escrita). Todas com
  `search_path = ''`, nomes qualificados por schema, `revoke` de `public`/`anon` e
  `grant` apenas para `authenticated`. As funções de identidade não recebem
  parâmetro de usuário — não há como perguntar pelo papel de outra pessoa.
- **`service_role`**: continua fora do frontend. O painel usa apenas a chave
  publicável e o JWT do usuário.
- **Privilégios de tabela (camada antes da RLS)**: um projeto Supabase concede
  `ALL` às tabelas novas por *default privileges*, o que tornaria a intenção de
  menor privilégio apenas decorativa. Por isso cada migration faz `REVOKE`
  explícito: `authenticated` não tem `INSERT`/`DELETE` em `profiles`, nem
  qualquer escrita em `auditoria_eventos` e nas tabelas de status; `anon` perde
  todo acesso às quatro tabelas. Forjar um evento de auditoria falha no
  privilégio, antes mesmo de chegar na policy.

## Verificação das policies

`supabase/tests/rls_verificacao.sql` roda no SQL Editor e simula usuários reais
(admin, líder, atendente, anônimo) trocando o JWT da sessão. Cobre isolamento de
leitura, auto-promoção, alteração de status de terceiros e tentativa de forjar ou
apagar auditoria. O script termina em `ROLLBACK` — não deixa resíduo.

As migrations e esse script foram executados contra um Postgres real (PGlite)
antes da entrega: as três migrations aplicam limpas e as 14 verificações passam,
incluindo atomicidade de status/histórico/auditoria, bloqueio de status
inválido, proteção do último admin e imutabilidade da trilha. O que **não** foi
possível validar aqui é o comportamento no projeto real com dados existentes —
rode o script no SQL Editor depois de aplicar as migrations.

## O que ficou de fora (e por quê)

- **Multi-tenant** (`organizations`, `organization_id`): o painel atende uma
  clínica só e não há plano de vender para outras. Adicionar depois é possível
  sem refazer o que foi feito.
- **Tabelas dinâmicas de papéis e permissões** (`roles`, `permissions`,
  `role_permissions`): três papéis e uma equipe pequena não justificam a
  indireção. Um novo papel hoje é um valor no `check` + uma linha na matriz.
- **Hierarquia de liderança** (`manager_id`, cadeia de liderados): só faz sentido
  com mais de uma equipe. Hoje `departamentos` já agrupa as pessoas.
- **Distribuição automática de atendimentos** (fila, limite de simultâneos,
  `FOR UPDATE SKIP LOCKED`): não existe distribuidor automático no sistema — a
  atribuição é manual em `useAtendimentos.ts`. Sem esse mecanismo, as regras não
  teriam o que proteger.
- **RLS real nas tabelas antigas** (`atendentes`, `atendimentos`,
  `dados_cliente`, `n8n_chat_histories`, ...): ver risco em aberto abaixo.

## Risco em aberto

As tabelas anteriores a esta entrega continuam com policies permissivas
(`using (true)`), então **a anon key ainda lê e escreve nelas sem autenticação**.
Isso não é uma regressão — é o estado que já existia —, mas segue sendo o maior
buraco de segurança do sistema.

Endurecer essas policies é um passo separado e arriscado: o n8n escreve nas
tabelas de chat, e a mudança precisa ser feita tabela por tabela, verificando o
painel e as automações a cada passo. As funções (`sou_gestor()`,
`perfil_atendente_id()`, ...) já estão prontas para isso.
