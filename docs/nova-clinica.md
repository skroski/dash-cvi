# Implantar uma nova clínica

O sistema é **um projeto Supabase por cliente** (não há `tenant_id`). Tudo o que muda de uma clínica
para outra é dado no banco, editado no painel. Nenhuma migração contém dado de cliente: os dados da
uma clínica **fictícia** ("Clínica VetBots") ficam isolados em `supabase/seeds/clinica-vetbots.sql`, que serve de
exemplo e de ambiente de teste (veja `supabase/seeds/README.md`). Seeds de clientes reais ficam em
`supabase/seeds/privado/`, ignorada pelo git.

## Ordem de implantação

1. **Projeto Supabase novo** (plano pago: o plano gratuito pausa o projeto sem atividade e o atendimento fica mudo).
2. **Migrações** em ordem: `supabase/migrations/*` inteiras (`supabase db push`).
   As duas últimas são as da configuração por clínica:
   `20261027100000_clinica_configuracao_prompt.sql` e `20261027110000_agenda_motor_configuravel.sql`.
3. **Semente** — opcional, para demonstração ou teste (a `clinica-vetbots.sql` fictícia). Uma clínica real **não** roda essa semente: ela começa com o
   modelo neutro (18 regras genéricas, nenhuma agenda, nenhum serviço) e configura tudo no painel.
4. **Segredos** das Edge Functions: `node scripts/segredos.mjs --enviar` (lista completa em
   `supabase/functions/_shared/segredos.ts` e `.env.example`).
5. **Deploy das funções**, nesta ordem: `agenda`, `atendimento-config`, `conhecimento`,
   `atendimento-worker`, `atendimento-outbox`, `uazapi-webhook`. Confirme o deploy baixando o código
   publicado e procurando o marcador `AGENDA_EDGE_V2_MOTOR_CONFIGURAVEL` na função `agenda`.
6. **Front**: defina as variáveis `VITE_*` da clínica (abaixo) e publique.
7. **Painel**: abra **Config. do atendimento › Implantação** e percorra o checklist até ficar tudo verde.
8. **Só depois** (e só com autorização explícita): apontar o webhook da UAZAPI, ligar o cron e
   `ATENDIMENTO_SEND_ENABLED=true`. Antes disso o assistente grava a resposta no outbox, mas **não envia**.

## O que é específico de cada clínica

| Item | Onde | Observação |
| --- | --- | --- |
| Nome da empresa, assistente, telefone, endereço, site, Instagram, Pix, planos, frase de encerramento, estilo, fuso, horário de funcionamento, saudação | **Config. do atendimento › Empresa** | Viram variáveis do prompt (`{{nome_empresa}}`, `{{endereco}}`, …). |
| Serviços, valores e quem agenda (assistente × recepção × equipe) | **Config. do atendimento › Serviços e valores** | `{{preco:chave}}` e `{{servico:chave}}` leem daqui. |
| Calendários, tipos de agendamento, agendas (profissional × tipo), feriados | **Regras da agenda** | Duração, passo, antecedência, capacidade, pets por agendamento, janelas quinzenais, almoço, modelos do evento, convite ao cliente, tag. |
| Regras do prompt | **Meu Prompt** (somente administradores) | Versionado, com reversão. Os marcadores `{{…}}` são validados no banco. |
| Estados do atendimento e notificações | **Config. do atendimento › Estados / Notificações** | |

### Variáveis do front (`.env` / ambiente de build)

`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_CLIENT_ID`, `VITE_WEBHOOK_BASE_URL`,
`VITE_EMAIL_GRUPO_VETERINARIOS` (vazio desliga o recurso).

> **Atenção:** `src/config/env.ts` ainda traz como *fallback* a URL e a chave pública do Supabase da
> M. Galvão. Em uma clínica nova **defina sempre as `VITE_*`**; sem elas o front aponta para o projeto
> errado. O mesmo vale para `project_id` em `supabase/config.toml` (troque pelo ref da clínica antes de
> `supabase link` / deploy).

## Como o prompt funciona

`meu_prompt_versoes.conteudo` é um **modelo** com marcadores. O worker o renderiza a cada lote de
mensagens (data e hora atuais, dados do cliente e do pet, empresa, preços e horários), numa única
passagem — o que o cliente digita nunca é reinterpretado como marcador. Marcador desconhecido é
removido e registrado como `prompt_variavel_desconhecida`; o banco recusa salvar marcador fora do
registro `prompt_variaveis`. A tela **Meu Prompt** mostra o modelo e a prévia de como o assistente o recebe.

Editar o prompt exige papel **administrador** (função `pode_editar_meu_prompt()`); o e-mail fixo do dono
deixou de ter acesso especial.

## Como rodar os testes

| Comando | O que cobre | Pré-requisito |
| --- | --- | --- |
| `npm test` | lógica pura (prompt, motor de agenda, ferramentas, front, cobertura do prompt) + renderização SSR das telas | Node 22+ |
| `npm run test:banco` | migrações neutras + semente + RLS num Postgres embutido (PGlite) | `npm --prefix /tmp/pglite install @electric-sql/pglite@0.2.17` (ou defina `PGLITE_PATH`) |
| `npm run test:edge` | a Edge `agenda` e o `atendimento-worker` **de verdade** (Deno) contra um Supabase/Google/OpenAI falsos | acesso à internet na primeira execução (baixa o Deno) |
| `npm run test:tudo` | todos os acima | |

Nenhum teste toca banco, WhatsApp, Google ou OpenAI reais.

## Premissas e limites conhecidos

- **Premissa não verificada:** as migrações `20261021`–`20261026` foram editadas (dados da M. Galvão saíram
  delas) presumindo que **nunca foram aplicadas** em produção. Não foi possível conferir (MCP do Supabase
  indisponível). Se já foram aplicadas, o projeto da M. Galvão precisa da semente **dela** (guardada só nesta máquina,
  em `supabase/seeds/privado/clinica-cvi.sql`, fora do git) e as migrações novas só complementam.
  Confira com `select version from supabase_migrations.schema_migrations`.
- Reaplicar a `20261027100000` sobrescreve edições do painel nas 18 regras genéricas de mesmo código
  (a versão anterior continua recuperável com `prompt_reverter_versao`).
- Se o registro em `agenda_agendamentos` falhar depois de o evento ser criado no Google, o evento fica
  órfão e passa a ser tratado como "feito pela equipe" (o assistente não cancela nem remarca).
- Duas pessoas agendando o mesmo horário ao mesmo tempo são protegidas apenas pela segunda checagem
  antes de gravar, não por trava.
- Código legado com `-03:00` fixo (`calendarApi.ts`, `useAgendaType`, `EventFormDialog`) ainda existe
  no front; o motor novo usa o fuso da empresa.
- Os padrões de operadora (TIM/Claro/Vivo/Oi) do `uazapi-webhook` continuam no código.
- Há erros de `tsc` antigos em arquivos do front que esta mudança não tocou.
