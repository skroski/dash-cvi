# Lembretes: migração do fluxo n8n "LembretesVacinas" para o Supabase

Origem: workflow n8n `LembretesVacinas` (id `zCDKniJ6XVCIWkXu`) e a planilha
"Agenda / Vacinas" (colunas Data Agendada, Serviços, Nome Cliente, Telefone,
Nome Pet, Status). Destino: módulo de Lembretes do dashboard (projeto Supabase
`napeofeenweerjhqucua`).

O fluxo já está incorporado: não é preciso ter o JSON do n8n para implantar.
A regra de negócio dele vira a regra pronta da seção 9 (migração
`03_regra_vacinacao.sql`).

O objetivo não é copiar os nodes, e sim levar a regra de negócio para o
Supabase e deixar o cliente operar tudo pelo dashboard.

## 1. Nodes do n8n e destino

| Node n8n | Tipo | O que faz | Destino no Supabase |
| --- | --- | --- | --- |
| Schedule Trigger1 | Cron, 20h, fuso da instância (America/Sao_Paulo) | Dispara uma vez por dia | `pg_cron` a cada minuto (UTC) chama `lembretes_planejar()` e a edge `lembretes-worker`. O horário de cada regra fica em `lembrete_configuracoes.horario_envio`, no fuso `America/Sao_Paulo`, e pode ser editado pelo dashboard. |
| PlanilhaVacina | Google Sheets (OAuth2) | Lê linhas com `Data Agendada = hoje` e `Status = CONFIRMADO` | Morre. A regra do filtro continua: `dias_antecedencia = 0` (data = hoje) e `somente_confirmados = true` (status CONFIRMADO). A agenda passa a viver em `lembrete_envios` (cadastro manual, importação de planilha ou integração). Isso elimina a credencial OAuth do Google. |
| Filter | Filtro | Compara a data com hoje | Morre. Vira o `where` de `lembretes_planejar()`. |
| Code in JavaScript | Código | Normaliza telefone, deduplica por telefone, ordena | `lembretes_planejar()`: agrupa por `telefone_chave` (telefone canônico) e grava **uma** linha em `lembrete_mensagens` por tutor e por dia, com `unique (telefone_chave, dia_envio)`. |
| Loop Over Items4 + Wait1 (20–50 s aleatório) | Loop + espera | "Debounce" entre envios | Morre como mecânica. No planejamento, cada mensagem recebe `programado_para` com intervalo aleatório acumulado (padrão 20–50 s, configurável por regra). O worker espera até cada horário dentro da própria execução. |
| Troca de Mensagens + OpenAI Chat Model4 | LLM (gpt-4.1-mini) | Reescreve uma mensagem a partir de 5 exemplos | Edge `lembretes-worker` chama a OpenAI com as 5 frases de exemplo da regra (editáveis no dashboard). O texto gerado é salvo **antes** do envio. Se a IA falhar, usa uma das frases de exemplo com as variáveis preenchidas. |
| Envia Mensagem1 | uazapi (`/send/text`) | Envia o WhatsApp | Edge `lembretes-worker`, com retry e backoff para 429/5xx/timeout. |
| AtualizaEnviado | Google Sheets (OAuth2) | Marca `Status = ENVIADO` pelo telefone | `lembrete_mensagens.status = 'enviado'` e as linhas de `lembrete_envios` vinculadas também. |
| Sticky Notes | Anotação | — | Morre. |

Não há Execute Sub-workflow nem Error Workflow configurado no fluxo original. O
equivalente de erro passa a ser a tabela `lembrete_erros` mais o painel de
falhas no dashboard.

## 2. Trigger e cutover

- Tipo: **(b) Cron/Schedule**. No n8n, 20h no fuso America/Sao_Paulo. No
  Supabase, `pg_cron` roda em UTC: o job roda a cada minuto e a comparação de
  horário é feita em `America/Sao_Paulo` dentro de `lembretes_planejar()`, então
  não há conversão fixa de horário a manter.
- O fluxo n8n lê uma planilha própria e não expõe webhook, então não há URL a
  reapontar. O "cutover" é **ativar o job do pg_cron**, o que exige
  autorização explícita. Se o n8n do cliente ainda estiver ativo, desative-o
  **antes** de ligar o envio automático, para não haver mensagem dupla.

## 3. Credenciais

| Credencial no n8n | Classe | Destino |
| --- | --- | --- |
| OpenAI (ex.: "Pet com Pet OpenAi") | (a) API key | Secret de edge `OPENAI_API_KEY` |
| uazApiApi (ex.: "Petcompet 01") | (a) Token estático | Secrets `UAZAPI_SERVER_URL` e `UAZAPI_INSTANCE_TOKEN`, com a **instância da própria clínica** |
| Google Sheets | (b) OAuth2 | **Não migra.** A planilha deixa de ser a fonte da agenda. |
| — | segredo novo | Vault `lembretes_cron_secret`, lido pelo `pg_cron`. Secret de edge `LEMBRETES_CRON_SECRET` com o mesmo valor. |

Todos ficam no `.env` do projeto (modelo em `.env.example`). Publicar:
`node scripts/lembretes-segredos.mjs --enviar`.

## 4. Volume e duração

- Planilha de referência: cerca de 30 a 65 tutores por disparo. Com intervalo
  de 20–50 s, isso leva de 20 a 40 minutos. Não cabe em uma execução de edge,
  então o processamento acontece por minuto, com claim atômico
  (`FOR UPDATE SKIP LOCKED`).

## 5. Estado e chaves

| Dado | Chave |
| --- | --- |
| Agendamento (`lembrete_envios`) | `configuracao_id + agendamento_chave + data_agendada` (já existia) |
| Mensagem do dia (`lembrete_mensagens`, nova) | `telefone_chave + dia_envio`, **global entre regras**: garante 1 lembrete por dia por tutor |
| Telefone canônico | só dígitos, sem `@s.whatsapp.net`. Para celular brasileiro com 13 dígitos, remove o nono dígito na chave, para que `5561993111008` e `556193111008` sejam o mesmo tutor. O envio usa o número original. |

## 6. Regras de negócio preservadas e novas

1. Somente agendamentos ativos: `status = 'pendente'` e status de agenda fora
   de cancelado, desmarcado, faltou e remarcado. Com `somente_confirmados`
   ligado na regra (caso do fluxo original), só entra `CONFIRMADO`.
2. Um lembrete por dia por tutor. Se o tutor tem 2 ou mais pets ou serviços no
   mesmo dia, sai **uma** mensagem citando todos.
3. As frases de exemplo são genéricas, sem detalhes de vacina. `{{servico}}` usa o
   texto do agendamento, depois o da categoria ("Como aparece na mensagem") e
   por fim o nome da categoria. Variáveis:
   `{{nome_tutor}}`, `{{nome_pet}}`, `{{servico}}`, `{{data}}`, `{{horario}}`,
   `{{quando}}` (hoje/amanhã/em N dias) e `{{clinica}}`.
4. Serviços categorizados (`lembrete_servicos`): Consulta Veterinária, Exame,
   Vacina, Retorno, Banho e Tosa, Cirurgia e outros. Cada regra pode atender
   todos os serviços ou só alguns.
5. **Trava contra disparo em massa:** a mensagem que passar mais de
   `janela_envio_horas` (padrão 3 h) do horário previsto vira `ignorado` e não é
   enviada. Agendamentos com data passada nunca são planejados.

## 7. Segurança

- A política `lembrete_envios_anon_all` (migração `20260821120000`) dava
  leitura e escrita totais ao papel `anon`, e a chave pública está no bundle do
  front. Com um sender automático, isso viraria um relay aberto de WhatsApp. A
  política foi removida. As tabelas novas não têm nenhuma política para `anon`.
- As edges de envio usam `service_role` e validam `X-Cron-Secret` em tempo
  constante na primeira linha.
- Os dados de clientes reais da planilha de outra empresa **não** são
  importados para testar.

## 8. Rollback

- Pausar tudo: `select cron.unschedule('lembretes-worker');`, ou desligar a
  chave "Envio automático" no dashboard (`lembrete_ajustes.envio_automatico`).
- Corrigir comportamento: novo deploy da edge `lembretes-worker`.

## 9. A regra pronta (migração `03_regra_vacinacao.sql`)

Cria a regra **Conscientização de vacinação**, equivalente ao fluxo original:

| Fluxo n8n | Campo da regra | Valor |
| --- | --- | --- |
| Schedule 20h | `horario_envio` | `20:00` (fuso `America/Sao_Paulo`) |
| `Data Agendada = hoje` | `dias_antecedencia` | `0` |
| `Status = CONFIRMADO` | `somente_confirmados` | `true` |
| Aba "Vacinas" | `servico_ids` | serviço "Vacina" |
| Wait 20–50 s | `intervalo_min/max_segundos` | `20` / `50` |
| gpt-4.1-mini + 5 exemplos | `usar_ia`, `modelo_ia`, `exemplos` | ligada, `gpt-4.1-mini`, 5 frases |

Diferenças deliberadas em relação ao fluxo:

- **Marca e fato local fora do texto.** As frases usam `{{clinica}}` (nome em
  Ajustes) e não citam o caso de raiva em Brasília, que é um fato datado e
  local. Para voltar a citá-lo, acrescente em "Instruções extras" da regra.
- **Prazo de envio de 3 h** (`janela_envio_horas`): se o agendador ficar fora do
  ar, mensagem atrasada vira "Não enviado" em vez de sair de madrugada.
- **A planilha deixa de ser a fonte.** Atendimentos entram por cadastro manual,
  importação ou integração, com o serviço "Vacina" para cair nesta regra.
- **Outros serviços** continuam na regra geral (padrão: dia anterior, 18h).
  Ajuste ou desative em Regras e frases.
