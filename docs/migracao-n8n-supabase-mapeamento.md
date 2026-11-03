# Mapeamento da migração n8n → Supabase — M. Galvão

Status: **Fase 2 implementada na branch `main`; ainda não aplicada no projeto
Supabase nem em tráfego de produção.** Nenhum webhook da UAZAPI, cron ou rota
de produção foi alterado por este código.

## Implementação nesta branch

- `20261021120000_agenda_configuravel.sql`: veterinários, especialidades,
  agendas seguras, jornadas, almoço/pausas/bloqueios, RLS e auditoria.
- `20261021130000_atendimento_filas_supabase.sql`: eventos idempotentes,
  conversas, debounce de quatro segundos, pausas humanas de oito horas,
  histórico, outbox e uso de IA; não há Redis nem `Wait` do n8n.
- `20261021140000_atendimento_tick.sql`,
  `20261021160000_atendimento_midias.sql`: acionadores protegidos para workers
  de texto e mídia. O cron permanece propositalmente desabilitado até o corte.
- Funções Edge: `uazapi-webhook`, `atendimento-worker`,
  `atendimento-outbox`, `atendimento-media-worker`, `atendimento-controle`,
  `agenda`, `whatsapp` e `conhecimento`.
- A base RAG agora é indexada pela função `conhecimento`, que extrai arquivos,
  cria embeddings no pgvector e fornece busca tipada à Maia. O painel não lê
  conteúdo ou embeddings diretamente; upload, exclusão e limpeza são ações
  autenticadas de gestor.
- A antiga tela Evolution/QR foi convertida em uma tela de status da instância
  UAZ. A instância, token e webhook são configurados no provedor e nos Secrets,
  nunca no navegador.
- O prompt completo de **Gerente cvi** foi migrado para
  `meu_prompt_versoes`, que é a fonte usada pelo worker e permanece editável,
  com histórico, no painel **Meu Prompt**.
- A página **Regras da agenda** permite gerir veterinários, especialidades,
  vínculos, duração, jornada semanal, almoço, pausas e bloqueios. Valores de
  calendário e credenciais não são exibidos ao navegador.

### Segredos e Vault necessários antes da implantação

Configurar apenas no Supabase Secrets: `UAZAPI_SERVER_URL`,
`UAZAPI_INSTANCE_TOKEN`, `UAZAPI_WEBHOOK_SECRET`,
`ATENDIMENTO_INTERNAL_SECRET`, `OPENAI_API_KEY`, `GROQ_API_KEY`,
`GOOGLE_CALENDAR_REFRESH_TOKEN`, `GOOGLE_OAUTH_CLIENT_ID`,
`GOOGLE_OAUTH_CLIENT_SECRET` e os IDs de calendário referenciados por
`GOOGLE_CALENDAR_*`. `ATENDIMENTO_SEND_ENABLED` deve permanecer ausente ou
`false` durante homologação.

No Vault, configurar as URLs das três funções workers
(`atendimento_worker_url`, `atendimento_outbox_url`,
`atendimento_media_worker_url`) e `atendimento_cron_secret`. A entrega da
outbox só é habilitada quando `ATENDIMENTO_SEND_ENABLED=true`; o padrão é não
enviar mensagens durante implantação e homologação.

Este documento é o contrato de migração. A implementação está pronta para
homologação; a ativação de tráfego continua deliberadamente separada para não
interromper o atendimento em produção.

## Fontes analisadas

- Export MGalvão.json: workflow ativo **MGalvão**, 204 nós.
- Export agendas_consultas.json: workflow ativo **agendas_consultas**, 63 nós.
- Export agenda_dra_carol.json: subworkflow de oncologia, 48 nós.
- Export agenda_dr_mauricio.json: subworkflow de gastro, 48 nós.
- Dashboard, migrações, Edge Functions, testes e documentação deste repositório.

Nenhum valor de credencial ou dado pessoal foi copiado para este documento.
Valores enviados por chat não serão gravados no código, SQL, arquivos de
ambiente ou logs.

## Atendimento atual: fluxo comprovado

~~~
UAZAPI (evento WhatsApp)
  -> POST /cvi público no n8n
  -> normalização; separa entrada e saída
  -> pausa para humano (Redis, 8h)
  -> agrupamento de mensagens por aproximadamente 4s (Redis + Wait)
  -> processamento de texto, áudio, imagem ou PDF
  -> agente Maia + memória PostgreSQL + agenda
  -> histórico, cadastro e uso de IA
  -> resposta fragmentada e envio sequencial pela UAZAPI

Pedido de humano
  -> pausa do bot + aviso ao cliente + resumo à equipe
~~~

O destino preservará esse contrato, mas com eventos idempotentes, filas
auditáveis e recuperação de falhas. Não será uma cópia mecânica de nós do n8n.

## Workflow MGalvão: nó/grupo → destino

| Origem | Comportamento atual confirmado | Destino Supabase |
| --- | --- | --- |
| Webhook EVO | POST em /cvi sem autenticação. | Edge uazapi-webhook, com assinatura/segredo de header conforme a documentação da nova UAZAPI, corpo bruto protegido e deduplicação por id do provedor. |
| LimpezaDados e dados_para_atendimento_humano1 | Normaliza texto, remetente, ids da mensagem/chat, mídia, tipo, legenda, timestamp, nome e direção. | `atendimento_eventos` e `atendimento_mensagens`; chave única de evento e somente hash do payload. |
| Ramo de mensagens enviadas | Mantém no histórico sem o bot responder novamente. | Persistência idempotente que nunca cria item na fila do bot. |
| Redis *_block e Switch Block | true pausa bot; encaminhamento humano cria TTL de 28.800 segundos. | conversation_pauses com reason, actor, created_at e expires_at. Pausas ainda válidas entram no corte. |
| LPUSH, Wait2, Pull e Edit Fields16 | Agrupa mensagens próximas; apenas a última execução processa o lote. | `atendimento_lotes` e RPC de claim atômico por conversa, elegível após cerca de 4s. O worker processa todas as mensagens do lote em ordem, sem `setTimeout` pós-resposta. |
| DadosClienteSupabase | Lê/cria cadastro associado à sessão. | Continuidade de dados_cliente com índices, validação e RPCs parametrizadas. |
| Áudio, imagem e PDF | Baixa mídia, transcreve áudio, analisa imagem e extrai PDF antes da IA. | `atendimento_midias` e worker protegido; baixa somente pelo id da mensagem na UAZ, transcreve/analisa/extrai antes da Maia e não segue URL externa arbitrária. |
| Gerente cvi e memória | Maia usa as últimas 20 interações, calculadora, cadastro e agenda. | Serviço Edge/worker com prompt versionado, memória equivalente em conversation_messages e ferramentas tipadas. |
| grava_info | Atualiza tutor, pet, raça, porte, email e serviço. | RPC transacional com campos permitidos e auditoria. |
| func_agenda e MultiAgendaFluxos | Agente chama agenda como subworkflow com entradas tipadas. | Função `agenda` interna e tipada; busca, cria, remarca e cancela. Remarcação/cancelamento exigem o ID confirmado do evento. |
| Classificadores | Decide bot/humano, mas existem critérios divergentes na configuração atual. | Política versionada com testes por exemplos reais; requer decisão registrada abaixo. |
| Parser, Split de Mensagem, loop e espera | Fragmenta resposta e envia em sequência. | whatsapp_outbox + worker ordenado por conversa, rate limit, idempotência e retentativa. |
| chats, chat_messages, n8n_chat_histories e tokens | Histórico operacional e custo de IA. | `atendimento_mensagens`, `atendimento_ia_uso` e tabelas existentes do painel durante a transição controlada. |

### Regras de conversa preservadas

O prompt da Maia contém persona, saudação por horário, uma pergunta por vez,
encaminhamentos, limites médicos, dados da clínica e roteiro de agenda. Será
transportado como ativo versionado, sem reescrever ou “melhorar” a conversa
durante esta migração.

Há uma ambiguidade que precisa de decisão antes da homologação: o prompt
conflita sobre disponibilidade_geral. O contrato executável de
agendas_consultas só a usa para buscar disponibilidade sem data específica.

**Correção (revisão de 2026-10):** os subworkflows de oncologia e gastro existem, mas o roteador
do agente que está no ar **não os chama** (os nós estão desativados) e as regras 69, 70 e 72 do
prompt mandam esses atendimentos para a recepção. Por isso a semente de exemplo deixa oncologia e
gastro **sem operações para o assistente**; os horários continuam sendo publicados no prompt
(`{{horarios:oncologia}}`, `{{horarios:gastroenterologia}}`). Para o assistente passar a agendá-las,
basta ligar as operações no tipo, em **Regras da agenda**. Decisão de negócio da clínica.

## Workflow agendas_consultas: contrato e destino

Entrada interna observada:

~~~
Funcao, nome_pet, date_start, date_finish, email, servico, nome_cliente,
data_antiga, remotejid, porte_pet, preco_servico, descricao,
disponibilidade_geral
~~~

As ações ativas são agendar, cancelar, reagendar e buscar. O fluxo valida data
futura, email, serviço e disponibilidade; cria/altera/remove eventos do Google
Calendar; envia email; escreve planilha; e consulta/cria tags do cliente.

| Regra encontrada no export | Implementação alvo |
| --- | --- |
| Clínica geral: seg–qui 09:00–18:00, sex 08:00–18:00, sáb 08:00–16:00. | Janelas configuráveis, no fuso America/Sao_Paulo. |
| Gastro: ter/qui 10:00–18:00. Oncologia: seg–qui, início entre 09:00 e 17:00. | Regras por serviço e profissional, preservando o agendamento automático ativo. |
| Retorno de 30 min; padrão de 60 min. | Duração por serviço/consulta em transação. |
| Busca geral por até 20 dias, em intervalos de 30 min, com limite de opções. | RPC de disponibilidade com resposta equivalente. |
| Verifica conflito antes de criar/alterar. | Lock concorrente por calendário/intervalo e segunda checagem no Google Calendar. |
| Email e planilha acompanham criar/cancelar/reagendar. | Jobs de notificação/auditoria com idempotency key; falha não duplica consulta. |
| Consulta/criação de tags no Supabase. | RPCs parametrizadas, sem SQL por interpolação. |

Os grandes nós de código de horários serão convertidos em regras cobertas por
testes e configuração no banco, não copiados como JavaScript opaco do n8n.

### Subworkflows de especialidade confirmados

| Fluxo | Ações | Regra de agenda comprovada | Dependências/saída |
| --- | --- | --- | --- |
| agenda_dra_carol | buscar, agendar, cancelar, reagendar | Oncologia: seg–qui, início 09:00–17:00; retorno 30 min e demais consultas 60 min. | Google Calendar, Gmail e Google Sheets; somente permite cancelar/reagendar evento criado pela conta do bot. |
| agenda_dr_mauricio | buscar, agendar, cancelar, reagendar | Gastro: ter/qui, 10:00–18:00; retorno 30 min e demais consultas 60 min. | Mesmo ciclo e dependências de Carol. |

Os dois são subworkflows (por isso constam como inativos no export): são
executados internamente pelo workflow principal quando a ferramenta de agenda
seleciona a especialidade. Ambos declaram os mesmos campos de entrada, mas sem
tipos explícitos em quase todos eles; no Supabase esse contrato será tipado e
validado no limite da ferramenta.

Eles não possuem timezone próprio, Error Workflow nem retentativas de nó. Os
identificadores de calendário estão fixados na configuração dos nós atuais e
serão transferidos como configuração secreta/administrativa — nunca para o
cliente web ou para o código-fonte.

O cálculo de Carol aceita uma consulta padrão iniciando às 17:00 e terminando
às 18:00; a mensagem atual ao usuário descreve atendimento até 18:00. O novo
serviço preservará ambas as semânticas. Os retornos de 30 minutos permanecem
em grade de 30 minutos; consultas de 60 minutos usam grade de 60 minutos.

Os retornos da agenda são uma string de resposta consumida pelo agente. A
paridade cobrirá: horário disponível, alternativas quando ocupado, criação,
cancelamento, reagendamento, data passada, evento inexistente e
encaminhamento quando o evento tiver sido criado pela equipe humana.

### Configuração visual da agenda — requisito confirmado

Veterinários, especialidades, horários, intervalos de almoço e duração de
consultas serão administrados no **front-end autenticado do sistema**. Não
ficarão fixados nos workflows, no código da Edge Function, no localStorage ou
na configuração do navegador.

| Área visual | O que a operação poderá configurar | Proteção e efeito no atendimento |
| --- | --- | --- |
| Veterinários | Nome de exibição, ativo/inativo, cor e vínculo com uma agenda previamente configurada. | O identificador/credencial Google nunca aparece no navegador; a Edge resolve o vínculo no servidor. |
| Especialidades | Nome, veterinários habilitados, duração padrão e duração de retorno. | A ferramenta do agente consulta somente especialidades ativas e permitidas. |
| Jornada semanal | Uma ou mais faixas por dia e por veterinário/especialidade. | O motor usa as faixas para gerar slots e validar criação, alteração e busca. |
| Almoço e pausas | Intervalos recorrentes ou de uma data específica, inclusive exceções e bloqueios. | São tratados como indisponibilidade antes de consultar/criar no Google Calendar. |
| Calendário operacional | Rótulo de agenda para cada profissional/especialidade. | O vínculo real com Google é administrado no backend por usuário autorizado, sem expor segredo. |

A interface será uma grade semanal legível, com faixas de atendimento e
intervalos de almoço visíveis no mesmo eixo de tempo. Ao salvar, validará
sobreposições, intervalo inválido, especialidade sem profissional e calendário
não associado. Cada mudança será auditada, terá data de vigência e não mudará
consultas já confirmadas.

Essa área substituirá a configuração operacional que hoje fica fragmentada em
JavaScript dos workflows e nos endpoints gravados no navegador. A página
ConfigurationManager atual não será reaproveitada para segredos nem URLs; ela
será migrada para uma configuração protegida no Supabase.

## Gatilhos, filas e erros

| Origem | Semântica atual | Equivalente Supabase |
| --- | --- | --- |
| Webhook UAZAPI | Evento de mensagem e uma única URL configurável. | Edge autenticada, resposta rápida e enfileiramento transacional. |
| Debounce | Cerca de 4 segundos por conversa. | Worker/fila com claim atômico por conversa. |
| Pausa humana | TTL de 8 horas. | expires_at no Postgres, sem Redis. |
| Saída WhatsApp | Loop com divisão e espera. | Outbox ordenada, backoff, limite por conversa e tentativa auditada. |
| Agenda | Ferramenta interna do agente. | RPC/serviço tipado e transacional. |
| Lembretes/mensagens agendadas | Há implementação parcial no repositório. | pg_cron chama workers protegidos; somente após teste de equivalência. |

Chamadas externas terão estados pending, processing, sent/failed, contagem de
tentativas, próxima execução e logs sem segredos. Erros de UAZAPI, Google,
Storage ou IA irão para fila de falha e alerta operacional.

## Continuidade de dados

- dados_cliente, chats, chat_messages e histórico hoje associado a
  n8n_chat_histories.session_id.
- Eventos, anexos privados, mensagens pendentes e enviadas.
- Pausas de bot ainda válidas no corte.
- Configurações de serviço, horário, calendário, destinatários humanos e
  templates de e-mail.
- Auditoria de agenda e consumo de IA.

O destino terá unicidade para eventos/mensagens e índices de conversa, data e
estado. Consultas atuais que interpolam session_id em SQL serão trocadas por
RPCs/queries parametrizadas.

## Dependências e credenciais

| Dependência | Uso atual | Próxima ação |
| --- | --- | --- |
| UAZAPI | Entrada, mídia e saída WhatsApp. | Guardar somente em Supabase Secrets/Vault; configurar a nova instância depois de validar autenticação e payload real. |
| Google Calendar | Leitura e mudanças de eventos. | Criar OAuth/conta de serviço própria e conceder acesso. Tokens de refresh administrados pelo n8n não serão reaproveitados. |
| Gmail | Emails de agenda. | Nova autorização e testes com destinatários de homologação. |
| Google Sheets | Auditoria de agenda. | Nova autorização; confirmar planilha, abas e colunas. |
| OpenAI | Agente, áudio e visão. | Chave exclusiva em Secrets, permissões mínimas e acompanhamento de custo. |
| Redis | Pausa e buffer. | Retirado do caminho do atendimento; Postgres assume o estado. |

Foram identificados segredos em código existente e configuração HTTP do
workflow. Como também houve credenciais transmitidas nesta conversa, todos
devem ser tratados como expostos e **rotacionados** antes de configurar as
integrações. Seus valores não serão reproduzidos nem persistidos.

## Itens que exigem homologação antes do corte

1. Amostras reais e sanitizadas da nova UAZAPI para confirmar os nomes finais
   de campos de texto, mídia, id e direção; o adaptador já aceita as variações
   observadas nos exports, mas não deve ser ativado por inferência.
2. Acesso ao Google Calendar para verificar criação, remarcação e cancelamento
   em cada agenda configurada, incluindo os efeitos paralelos de e-mail e
   planilha que antes eram feitos pelo n8n.
3. Error Workflows ou fluxos desativados que não aparecem nos quatro exports.
   Eles não serão reativados sem um contrato funcional verificável.

Nós desativados de bootstrap/TTS não serão migrados como produção sem
confirmação de que devam voltar a operar.

## Correções obrigatórias, sem mudar a regra clínica

1. Autenticar e deduplicar a entrada; o webhook atual é público.
2. Remover tokens do navegador, código e configuração de nós; usar
   Secrets/Vault e rotação.
3. Usar operações SQL parametrizadas.
4. Trocar Redis/Wait por fila transacional.
5. Validar URL de mídia e manter anexos privados para evitar SSRF.
6. Aplicar idempotência, backoff, fila de falhas e observabilidade em UAZAPI,
   Google e IA.
7. Corrigir Edge Functions existentes que carregam credenciais/defaults
   sensíveis antes de ativar o novo caminho.

## Corte, rollback e homologação

A UAZAPI não será alterada antes da homologação. Antes do corte será capturado,
com segurança, o destino atual do webhook e o procedimento de retorno. O corte
será: deploy sem tráfego; testes em homologação sem mensagens reais; testes de
idempotência, mídia, pausa, agenda, fragmentação e erro; checkpoint/migração de
pausas; troca controlada da URL única; observação assistida e rollback imediato
para a URL anterior se houver divergência.

Não haverá remoção do n8n, ativação de cron, envio real ou troca de webhook sem
autorização explícita nessa etapa.

## Homologação e corte

Antes de trocar a URL de webhook, registrar de forma segura o destino atual,
aplicar as migrations, implantar as Edge Functions, preencher Secrets/Vault e
validar: texto, deduplicação, pausa humana, áudio, imagem, PDF, RAG, agenda,
cancelamento/remarcação e outbox. O cron e `ATENDIMENTO_SEND_ENABLED=true`
somente entram depois desses testes, com uma conversa de homologação e sem
misturar o envio real ao teste inicial.

O corte da UAZ continua pendente de confirmação explícita do usuário: ele muda
um sistema externo em produção. O rollback é restaurar imediatamente o webhook
anterior e manter as filas novas desativadas; nenhum dado do atendimento atual
é apagado durante essa etapa.

## Revisão de cobertura (prompt e nós do n8n)

A tabela completa — as 94 regras do prompt, as seções e cada nó relevante, com o destino de cada um —
está em [`prompt-n8n-cobertura.md`](prompt-n8n-cobertura.md) e é conferida por teste
(`supabase/tests/clinica/cobertura.test.mjs`). Lacunas que a revisão encontrou e como foram resolvidas:

| Lacuna no destino | Resolução |
| --- | --- |
| O prompt completo era sobreposto por um compilador antigo; o texto salvo nunca chegava ao modelo. | Um único compilador SQL (`obter_prompt_compilado`) e renderização por lote no worker. |
| Expressões do n8n (`{{ $now ... }}`) podiam ser salvas e vazar como texto. | Marcadores validados contra o registro `prompt_variaveis`; expressões do n8n são recusadas. |
| Dados da M. Galvão (nome, telefone, endereço, Pix, preços, médicos) fixos no código e nas migrações. | Variáveis do prompt, catálogo de serviços e semente isolada. |
| `grava_info` (cadastro do cliente/pet) não existia. | Ferramenta do worker, limitada a nome, pet, porte, raça, e-mail e serviço. |
| Cancelar/remarcar dependia de adivinhar o evento. | Registro `agenda_agendamentos`; evento da equipe é encaminhado à recepção. |
| Busca de horários só olhava um dia, ignorava passado, fuso e feriados. | Motor com busca em vários dias/ao redor da data, filtro de passado, fuso por data, feriados, capacidade e janelas quinzenais. |
| Horário de almoço oferecido e depois recusado pelo prompt. | Almoço configurado na agenda. |
| Pausa e divisão de mensagens (Parser Chain com LLM). | Formatador e divisor determinísticos, com pausa configurável entre mensagens. |
| Gmail (confirmação HTML) e Google Sheets (auditoria). | Substituídos por convite do Google Agenda + registro `agenda_agendamentos` + aviso por WhatsApp. **A confirmar com a clínica.** |
| Conflitos internos do prompt (regras 6, 32×46, pets por agendamento, saudação da madrugada). | Resolvidos por padrão e listados em "Decisões que dependem da clínica" no doc de cobertura. |
