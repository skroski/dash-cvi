# Lembretes no Supabase: implantação passo a passo

Projeto Supabase: `napeofeenweerjhqucua` (o mesmo `project_id` do
`supabase/config.toml`). O que muda e por quê está em
[lembretes-migracao-n8n.md](lembretes-migracao-n8n.md).

Siga na ordem. Até o passo 6 nada é enviado sozinho: o envio automático nasce
**desligado**, e sem o agendador (pg_cron) só saem os testes e envios que alguém
manda pelo painel.

O banco é alterado **somente por arquivos de migração** (`supabase/migrations`),
aplicados com a Supabase CLI ou colados no SQL Editor. Nenhum assistente altera
o banco por conexão direta ou MCP.

## 0. Antes de começar

- **Não importe planilhas de clientes reais de outra empresa.** Para testar,
  cadastre um atendimento seu, com o seu número.
- Preencha o `.env` da raiz do projeto (modelo em `.env.example`):

  | Variável | O que é |
  | --- | --- |
  | `OPENAI_API_KEY` | chave da OpenAI desta clínica |
  | `UAZAPI_SERVER_URL` | URL do servidor uazapi (https://...) |
  | `UAZAPI_INSTANCE_TOKEN` | token da instância de WhatsApp desta clínica |
  | `LEMBRETES_CRON_SECRET` | pode deixar em branco: o script gera |

  Não use o prefixo `VITE_`: variável `VITE_*` vai para o bundle do front e
  fica pública. Estas chaves são só da edge function.

  Confira sem enviar nada:

  ```bash
  node scripts/lembretes-segredos.mjs
  ```

- Plano do Supabase: no plano gratuito o projeto é pausado depois de cerca de
  uma semana sem uso, e aí os lembretes param sem aviso. Para automação em
  produção, use plano pago.

## 0.1 Diagnóstico antes da migração (somente leitura)

A migração foi testada num banco montado a partir das migrações do repositório,
nunca no banco real. Rode esta consulta no SQL Editor **antes** do passo 1 e
guarde o resultado. Ela não mostra dados de clientes, só nomes e contagens.

```sql
select 'constraint' as item,
       conrelid::regclass::text || ' / ' || conname || ': ' || pg_get_constraintdef(oid) as detalhe
from pg_constraint
where conrelid in ('public.lembrete_configuracoes'::regclass, 'public.lembrete_envios'::regclass)
  and contype = 'c'
union all
select 'agenda', status || case when data_agendada >= current_date then ' (futuro)' else ' (passado)' end
       || ': ' || count(*)
from public.lembrete_envios
group by status, data_agendada >= current_date
union all
select 'politica', tablename || ' / ' || policyname || ' -> ' || array_to_string(roles, ',')
from pg_policies
where tablename like 'lembrete%'
union all
select 'extensao', extname || ' ' || extversion
from pg_extension
where extname in ('pg_cron', 'pg_net');
```

Se o pg_cron já estiver ligado, veja também os jobs existentes:

```sql
select jobname, schedule, active from cron.job;
```

O que conferir:

- **"agenda: pendente (futuro)"** com número alto: são atendimentos antigos
  (de importações, por exemplo) que ainda aguardam lembrete. Com o envio
  automático ligado, os da data alvo de cada dia vão receber mensagem. Se não
  deveriam, revise e cancele antes de ligar:

  ```sql
  update public.lembrete_envios set status = 'cancelado'
  where status = 'pendente' and data_agendada >= current_date;
  ```

- **Constraints**: a migração remove os CHECK antigos pelo conteúdo, então nomes
  diferentes dos do repositório não são problema. Guarde a lista para conferir
  depois.

## 1. Aplicar as migrações do banco

São duas, na ordem:

1. `supabase/migrations/20261021100000_otimizar_egress.sql`: RPCs e índices de agregação para redução de egress.
2. `supabase/migrations/20261021110000_lembretes_envio_supabase.sql`: tabelas,
   funções, RLS e o planejamento da fila do módulo de lembretes.

**Pela CLI** (recomendado), logado com a conta dona do projeto:

```bash
supabase login
```

```bash
supabase link --project-ref napeofeenweerjhqucua
```

Veja o que está pendente e **leia a lista** antes de aplicar. `db push` aplica
todas as migrações que o remoto ainda não tem, não só as de lembretes:

```bash
supabase migration list
```

```bash
supabase db push
```

**Pelo painel:** SQL Editor → New query, cole cada arquivo na ordem acima e
rode.

Confira:

```sql
select nome from public.lembrete_servicos order by ordem;
select id, nome, dias_antecedencia, horario_envio, somente_confirmados,
       cardinality(exemplos) as frases
from public.lembrete_configuracoes;
select envio_automatico from public.lembrete_ajustes;  -- deve ser false
```

As migrações podem ser rodadas de novo sem efeito colateral. Elas também
removem a política que deixava o papel `anon` ler e gravar `lembrete_envios`.

## 2. Publicar a edge function `lembretes`

```bash
supabase functions deploy lembretes --project-ref napeofeenweerjhqucua
```

O `supabase/config.toml` já define `verify_jwt = false` para essa função. A
autenticação é feita dentro dela, pelo segredo do cron ou pelo login do painel.

Se for publicar pelo painel (Edge Functions → Deploy a new function), crie a
função `lembretes` com os **dois** arquivos de `supabase/functions/lembretes/`
(`index.ts` e `mensagem.ts`) e desligue a opção **Verify JWT**.

## 3. Publicar os segredos (a partir do `.env`)

```bash
node scripts/lembretes-segredos.mjs --enviar
```

O script confere as quatro chaves, gera `LEMBRETES_CRON_SECRET` se estiver em
branco e roda `supabase secrets set` sem mostrar valores. Se uma chave aparecer
em log ou chat, ela está vazada: troque no provedor e rode de novo.

## 4. Conferir o que foi publicado

"Deploy succeeded" não prova que o código novo está no ar. Baixe o código
publicado numa pasta temporária (para não sobrescrever o repositório) e procure
marcadores dele:

```bash
supabase functions download lembretes --project-ref napeofeenweerjhqucua --workdir /tmp/lembretes-publicado
```

```bash
grep -c "lembretes_reivindicar\|validarTextoIA" /tmp/lembretes-publicado/supabase/functions/lembretes/*.ts
```

Os dois arquivos precisam aparecer com contagem maior que zero.

## 5. Ensaio pelo painel

1. Abra **Lembretes → Ajustes** (ícone de engrenagem). Informe o nome da clínica
   e o seu WhatsApp de teste. A lista "Situação da integração" deve marcar
   WhatsApp e IA. O agendador fica pendente até o passo 6.
1b. **Serviços**: em cada categoria, confira "Como aparece na mensagem" (ex.:
   consulta veterinária, em minúsculas). Cada agendamento também pode ter um
   texto próprio. Categorias vindas de importação precisam desse texto.
2. **Regras e frases**: revise as frases de exemplo. Em **Editar → IA**, use
   **Gerar prévia** para ver como a IA escreve. Nada é enviado.
3. **Enviar teste**: a mensagem precisa chegar no seu WhatsApp em menos de um
   minuto. Na aba **Mensagens** ela aparece como "Enviado", com o texto exato.
4. Cadastre um atendimento seu para hoje ou amanhã (**Novo agendamento**) e use
   **Enviar lembrete agora** na agenda. Confira a mensagem e a linha do tempo.

Se algo falhar, a aba **Atividade** e o detalhe da mensagem mostram o motivo.

## 6. Ligar o agendador (cutover)

Só com autorização explícita de quem responde pela clínica.

1. Gere o SQL de ativação a partir do `.env` (grava em `supabase/.temp`, fora do
   git, e **não executa nada**):

   ```bash
   node scripts/lembretes-segredos.mjs --sql
   ```

2. Abra `supabase/.temp/lembretes_ativar_cron.gerado.sql`, rode no SQL Editor e
   depois apague o arquivo (ele contém o segredo).
3. Em **Ajustes**, a lista deve marcar "Agendador ativo" e mostrar a última
   execução.

## 7. Ligar o envio automático

No painel, ligue a chave **Envio automático**. A partir daí, no horário de cada
regra ativa, os tutores com atendimento na data alvo recebem o lembrete:

- uma mensagem por tutor por dia, citando todos os pets e serviços;
- texto escrito pela IA a partir das frases de exemplo (se a IA falhar ou sair
  das regras, vai uma das frases);
- envio de uma mensagem por vez, com intervalo aleatório (padrão: 20 a 50 s);
- o que não sair até o prazo da regra (padrão: 3 h) fica como "Não enviado".
  Isso evita disparo atrasado em massa.

Na primeira noite, acompanhe a aba **Mensagens** no horário do envio.

## Voltar atrás

- Rápido, pelo painel: desligue a chave **Envio automático**.
- Completo: rode `supabase/scripts/lembretes_desativar_cron.sql`.

Nada é apagado. Agenda, mensagens e histórico continuam no banco.

## Acompanhamento (primeiras 2 semanas)

- Card **Falhas hoje** e aba **Mensagens** com o filtro "Falha": reenvie ou
  corrija o número.
- Aba **Atividade**: "Erro do sistema" indica configuração (segredo, Vault, IA)
  e precisa de atenção no mesmo dia.

## Testes automatizados

Banco (Postgres embutido com o ambiente do Supabase simulado) e edge function
(Deno com Supabase, OpenAI e uazapi simulados). Nenhum banco real é tocado e
nenhuma mensagem é enviada:

```bash
node <pasta-da-skill>/scripts/testar.mjs --base supabase/tests/lembretes/base.sql --modulo supabase/migrations/<timestamp>_lembretes_envio_supabase.sql --seed supabase/migrations/<timestamp>_lembretes_regra_vacinacao.sql --testes supabase/tests/lembretes
```

Tipos do `integrations/supabase/types.ts` (gerados do schema aplicado no Postgres
embutido, sem acessar o projeto):

```bash
node <pasta-da-skill>/scripts/gerar-tipos.mjs --base supabase/tests/lembretes/base.sql --modulo supabase/migrations/<timestamp>_lembretes_envio_supabase.sql --tipos src/integrations/supabase/types.ts
```
