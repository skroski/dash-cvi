# Publicar a agenda e os lembretes (marcar, convidar, marcar o cliente e lembrar)

Roteiro para levar ao ar o ciclo completo. Nada aqui é feito automaticamente:
cada passo mexe em produção e precisa de quem responde pela clínica.

Projeto Supabase desta aplicação: `napeofeenweerjhqucua` (o do `supabase/config.toml`).

## O que acontece quando tudo estiver publicado

Tutor pede, pelo WhatsApp, uma vacina ou consulta:

1. O assistente busca horários livres (regras da agenda + eventos já no Google Agenda).
2. Ao confirmar, a edge function `agenda` cria o evento no Google Agenda do profissional,
   com título, descrição e local dos modelos configurados, e convida por e-mail o cliente
   e o profissional (quando o tipo e a agenda pedem).
3. O agendamento é registrado em `agenda_agendamentos` (permite remarcar e cancelar depois).
4. O cliente recebe o marcador (tag) configurado no tipo, ex.: "Agendou via assistente".
5. **Ponte (migração `20261030100000`)**: o registro cria o lembrete em `lembrete_envios`
   (origem `integracao`). Remarcar muda a data do mesmo lembrete; cancelar cancela o que
   ainda não saiu, inclusive a mensagem já planejada.
6. O módulo de lembretes decide a regra pelo serviço (o tipo "Vacinas" cai na categoria
   "Vacina" e na regra de vacinação; "Consulta..." cai em "Consulta Veterinária") e envia no
   horário da regra, desde que o envio automático esteja ligado.

O lembrete do próprio Google (notificação do evento) não é definido pela aplicação: vale o
padrão de notificações de cada agenda.

## Situação encontrada antes deste roteiro

Confira de novo antes de seguir (os comandos estão em cada passo).

| Item | Em produção | No repositório |
| --- | --- | --- |
| Função `agenda` | V1 (marcador `M_GALVAO_AGENDA_EDGE_V1`) | V2 (`AGENDA_EDGE_V2_MOTOR_CONFIGURAVEL`): registro, tag, modelos, feriados, convite |
| Função `atendimento-worker` | versão de 22/10 | com a ferramenta `func_agenda` nova |
| `GOOGLE_CALENDAR_REFRESH_TOKEN` e IDs dos calendários | **ausentes** nos segredos | exigidos pela `agenda` |
| Funções `lembretes`, `sync-google-calendar`, `atendimento-config` | não publicadas | prontas |
| Ponte agendamento → lembrete | não existia | migração `20261030100000` |
| Histórico de migrações do CLI | vazio (esquema aplicado pelo SQL Editor) | 45+ arquivos |

## Roteiro (nesta ordem)

### 0. Conferir o banco (somente leitura, SQL Editor do projeto certo)

```sql
select 'gatilho' as item, tgname::text as detalhe from pg_trigger
where tgrelid in ('public.lembrete_envios'::regclass, 'public.agenda_agendamentos'::regclass) and not tgisinternal
union all select 'funcao', proname::text from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('lembrete_revisar_mensagem', 'lembrete_telefone_chave', 'lembrete_normalizar', 'lembrete_envios_preparar')
union all select 'coluna', column_name::text from information_schema.columns
where table_schema = 'public' and table_name = 'lembrete_envios'
  and column_name in ('status_agendamento', 'origem', 'servico_id', 'mensagem_id', 'telefone_chave')
union all select 'regra', id || ' | ' || nome || ' | dias=' || dias_antecedencia || ' | servicos=' || servico_ids::text
from public.lembrete_configuracoes
union all select 'envio_automatico', envio_automatico::text from public.lembrete_ajustes
union all select 'tipo', chave || ' | aliases=' || aliases::text || ' | tag_id=' || coalesce(tag_id::text, 'sem tag')
from public.agenda_especialidades;
```

Esperado: as 4 funções, as 5 colunas, os gatilhos `lembrete_envios_preparar` e `lembrete_envios_revisar_fila`,
`envio_automatico = false` e cada tipo que o assistente agenda com `tag_id` preenchido.

### 1. Migração da ponte

Pelo SQL Editor (o jeito que este projeto usa): cole e rode
`supabase/migrations/20261030100000_agenda_agendamentos_lembretes.sql`. Ela é idempotente.
Não envia nada: só cria o gatilho e, se já houver agendamentos futuros confirmados em
`agenda_agendamentos`, cria os lembretes que faltam (a tabela estava vazia na checagem).

> **Não rode `supabase db push` agora.** O histórico remoto está vazio (o esquema veio do SQL
> Editor), então o CLI tentaria reaplicar todas as migrações. Antes, marque as já aplicadas com
> `supabase migration repair --status applied <versão>` (confira cada uma).

### 2. Token do Google com permissão de escrita

O `/schedule` usa o login do navegador, só leitura. A edge function precisa do próprio token,
da conta Google dono das agendas (ou com permissão de edição em todas), com o escopo
`https://www.googleapis.com/auth/calendar.events`. Os segredos `GOOGLE_OAUTH_CLIENT_ID` e
`GOOGLE_OAUTH_CLIENT_SECRET` já existem; falta o `GOOGLE_CALENDAR_REFRESH_TOKEN`.

Preencha só o que falta num arquivo à parte (o `--enviar` publica **todos** os preenchidos e
sobrescreve os atuais) e não cole o token em chat:

```bash
node scripts/segredos.mjs --arquivo .env.agenda
```

```bash
node scripts/segredos.mjs --arquivo .env.agenda --enviar
```

### 3. IDs dos calendários

Em **Regras da agenda**, informe o ID do Google Calendar de cada agenda (fica criptografado no
Vault) ou crie o segredo com o nome indicado em `agenda_calendarios.secret_key`
(ex.: `GOOGLE_CALENDAR_CLINICA_GERAL`). Em cada agenda, use **Testar**: precisa mostrar
"calendário acessível" e os horários dos próximos dias.

### 4. Marcador do cliente

Em **Regras da agenda → tipo**, escolha "Marcador aplicado ao cliente ao agendar" em consulta e
vacinas (o passo 0 mostra os tipos sem tag).

### 5. Publicar as funções (juntas)

```bash
supabase functions deploy agenda --project-ref napeofeenweerjhqucua
```

```bash
supabase functions deploy atendimento-worker --project-ref napeofeenweerjhqucua
```

O worker precisa ser republicado junto: ele embute o código de `_shared/agenda_*.ts` no momento
do deploy. Confira que o código novo está no ar (o marcador V2 tem de aparecer):

```bash
supabase functions download agenda --project-ref napeofeenweerjhqucua --use-api
```

Antes de publicar, rode `npm run test:tudo` (com `PGLITE_PATH` apontando para o PGlite instalado).
O `atendimento-config` (tela de configuração do atendimento) também está sem publicar.

### 6. Ensaio sem cliente real

Com o seu número, peça uma vacina e uma consulta ao assistente. Confira: evento no Google
Agenda (e e-mail de convite), linha em `agenda_agendamentos`, tag no cliente e o lembrete na
aba **Lembretes → Agenda** (origem integração). Remarque e cancele: o lembrete acompanha.
`ATENDIMENTO_SEND_ENABLED` decide se o assistente responde de verdade no WhatsApp; confira o
valor atual antes do ensaio.

### 7. Lembretes

Siga `docs/lembretes-implantacao.md` a partir do passo 2 (publicar `lembretes`, segredos,
ensaio, agendador e envio automático). As migrações dele já estão no banco. Antes de ligar o
**Envio automático**, revise a agenda de lembretes: todo agendamento futuro já criado entra
na fila da data-alvo da regra.

## Limites conhecidos

- **Mexer direto no Google Agenda** (cancelar, arrastar o evento) não chega ao lembrete.
  Cancele e remarque pelo assistente/painel, ou cancele o lembrete na aba Lembretes.
- **Eventos criados pela equipe no painel** não entram em `agenda_agendamentos`: sem tag e sem
  lembrete automático (a equipe ainda pode cadastrar o lembrete à mão).
- **Sem telefone com DDD** (10+ dígitos) ou com horário no passado: o lembrete não é criado.
- **Agendamento de última hora**: se o horário do envio da regra já passou, a mensagem vira
  "Não enviado" (prazo de segurança da regra), nunca sai atrasada em massa.
- Lembrete **cancelado à mão** no painel continua cancelado, mesmo se o atendimento for remarcado.

## Voltar atrás

- Parar só a ponte (os lembretes já criados ficam): `drop trigger agenda_agendamentos_lembrete on public.agenda_agendamentos;`
- Cancelar os lembretes pendentes que a ponte criou:
  `update public.lembrete_envios set status = 'cancelado' where agendamento_chave like 'agenda:%' and status = 'pendente';`
- Parar todos os envios: desligue **Envio automático** no painel (ou `supabase/scripts/lembretes_desativar_cron.sql`).
