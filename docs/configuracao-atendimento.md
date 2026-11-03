# Configuração agnóstica do atendimento

Tudo o que muda de cliente para cliente é **dado no banco, editado no painel** — não código.
As migrações são neutras. Os dados de exemplo (uma clínica fictícia, "Clínica VetBots") estão em `supabase/seeds/clinica-vetbots.sql`.
Para implantar outra clínica, veja [`nova-clinica.md`](nova-clinica.md); o que cada trecho do prompt original virou está em [`prompt-n8n-cobertura.md`](prompt-n8n-cobertura.md).

## Onde configurar (somente administradores)

| O quê | Tela | Tabelas |
| --- | --- | --- |
| Checklist de implantação da clínica | **Config. do atendimento › Implantação** | (calculado) |
| Empresa, assistente, contato, endereço, Pix, planos, horário de funcionamento, saudação, modelo de IA, detecção de robô | **Config. do atendimento › Empresa** (`/atendimento-configuracao`) | `atendimento_config` |
| Serviços, valores e quem agenda cada um | **Config. do atendimento › Serviços e valores** | `clinica_servicos` |
| Estados do atendimento (humano, finalizado, outros) e efeitos | **Config. do atendimento › Estados** | `atendimento_estados` |
| Telefones que recebem avisos, por evento e escopo | **Config. do atendimento › Notificações** | `notificacao_destinatarios` |
| Regras do prompt (com versões e rollback; somente administradores) | **Meu Prompt** | `prompt_regras`, `meu_prompt_versoes`, `prompt_variaveis` |
| Calendários, tipos de agendamento, agendas, feriados, modelos de evento | **Regras da agenda** (`/agenda-configuracao`) | `agenda_*` |
| O que o assistente já agendou (somente leitura) | **Regras da agenda › Agendamentos do assistente** | `agenda_agendamentos` |

## Hierarquia (o mais específico vence)

```
atendimento_config (global)
  └─ agenda_especialidades  = TIPO de agendamento (biblioteca reutilizável)
       └─ agenda_regras     = AGENDA (profissional × tipo): duração, passo,
                              operações e instruções que sobrescrevem as do tipo
```

- **Duração**: pedido explícito do assistente → agenda → tipo.
- **Passo, antecedência mínima, capacidade simultânea, pets por agendamento, limites e ordem da busca**: agenda → tipo → padrão do sistema.
- **Título, descrição e local do evento**: agenda → tipo (modelos com `{{pet_nome}}`, `{{cliente_nome}}`, `{{servico}}`, `{{profissional}}`, `{{data}}`, `{{hora}}` …).
- **Convite ao cliente** (e-mail do cliente como convidado), **tag do cliente** e **aviso à equipe**: por tipo.
- **Semanas alternadas**: a janela da agenda pode ser quinzenal, contada a partir de uma data âncora (segunda-feira da semana da âncora).
- **Operações** (buscar/agendar/reagendar/cancelar): agenda → tipo; vale para o assistente, não para a equipe logada.
- **Unidade/setor/profissional** aparecem como *escopo* de destinatários e como atributos do profissional.
- **Empresa/tenant**: não há `tenant_id`. O isolamento entre clientes é **um projeto Supabase por cliente**
  (decisão deliberada: retrofitar tenant em todas as tabelas legadas quebraria RLS e funções existentes).

## Notificações

- Evento = chave de um estado com *Notificar a equipe* ligado, ou evento de agenda
  (`agendamento_criado`, `agendamento_reagendado`, `agendamento_cancelado`).
- Cada destinatário tem escopo: todos, unidade, profissional ou setor. Telefone normalizado para dígitos com código do país e validado (10–15 dígitos) na tela **e** no banco.
- O worker enfileira em `atendimento_outbox` (`tipo = 'notificacao'`, chave de idempotência por lote/evento/telefone). A entrega continua dependendo de `ATENDIMENTO_SEND_ENABLED=true`.
  Notificação não é gravada no histórico do cliente e só é barrada pela blacklist do **número de destino**.
- Mudou o telefone no painel → vale na próxima notificação (o worker lê a tabela a cada rodada).

## Estados e classificação

Cada estado define **como é detectado** e **o que faz**:

| Detecção | Como funciona |
| --- | --- |
| `padrao` | Estado quando nada mais se aplica (`em_andamento`). Só um ativo. |
| `mensagem_cliente` | Um classificador (LLM, temperatura 0) lê a mensagem do cliente com os *critérios* do estado. Resposta inválida ⇒ estado padrão (fail-safe). Falha do classificador ⇒ segue para a IA normal. |
| `resposta_assistente` | A resposta do assistente contém a *frase-gatilho* (sem diferenciar acento/caixa). |
| `manual` | Só aplicado por pessoas. |

Efeitos: pausar o bot (horas), mensagem automática ao cliente (substitui a resposta da IA no turno),
notificar a equipe (resumo por IA + texto com `{{resumo}}`, `{{telefone_cliente}}`, `{{estado}}`, `{{nome_empresa}}`), fechar a conversa.
A chave do estado é gravada em `atendimento_conversas.estado_atendimento` (histórico em `atendimento_estado_eventos`) para CRM e automações.

Paridade com o n8n: `atendimento_humano` (pedido explícito, pausa 8 h, aviso com resumo) e `finalizado`
(frase "Seu pet é especial para nós", aviso com resumo detalhado) vêm semeados com os mesmos textos e os dois telefones do fluxo.
**Testar**: o painel tem "Testar classificação" (função `atendimento-config`, sem efeitos colaterais).

## Agendas e tipos

1. **Calendário**: cadastre nome + ID do Google Calendar (guardado no Vault; nunca volta ao navegador). Instalações antigas seguem usando os Edge Secrets `GOOGLE_CALENDAR_*`.
2. **Tipo** (biblioteca): nome, outros nomes (aliases), duração/retorno, passo, operações permitidas, dados obrigatórios, instruções para o assistente. Crie a partir dos modelos (Consulta, Retorno, Vacinação, Ultrassonografia, Raio-X, Fisioterapia — apenas exemplos editáveis/apagáveis em `agenda_modelos`).
3. **Agenda** (profissional × tipo × calendário): crie a partir de modelo de jornada, ou **duplique** de outro profissional. Nasce **desativada**.
4. **Testar → Ativar**: "Testar" gera os horários dos próximos 7 dias só com as regras do banco e diz se o calendário está configurado/acessível; "Ativar" libera para o assistente.

Novo veterinário = cadastrar profissional → *Nova agenda a partir de um modelo* (ou *Duplicar*) → testar → ativar. Sem tocar em código.

### Roteamento correto com vários profissionais no mesmo tipo
Antes, `.limit(1)` escolhia uma agenda arbitrária. Agora a ferramenta `func_agenda` tem o campo `profissional`;
na criação, o evento vai para o calendário do profissional **cujo horário escolhido está livre**;
cancelar/remarcar localiza o calendário que contém o evento.

## JavaScript personalizado por agenda

**Decisão: não há execução de código vindo do front-end.** Os casos que exigiam um fluxo/JS por médico
(jornadas, durações, tipos, restrições, instruções, calendários) agora são **configuração declarativa**
validada por constraints no banco. Se surgir uma integração realmente inédita, ela deve entrar como
*ferramenta nova no backend* (revisada em código) e ser **ligada** por configuração — nunca colada pelo painel.

## Implantação (ordem)

Veja [`nova-clinica.md`](nova-clinica.md): migrações → (semente de demonstração, opcional) → segredos → funções
(`agenda`, `atendimento-config`, `conhecimento`, `atendimento-worker`, `atendimento-outbox`, `uazapi-webhook`)
→ front → checklist **Implantação** no painel. Cutover, webhook da UAZAPI, cron e
`ATENDIMENTO_SEND_ENABLED` só com autorização explícita.

Atenção ao semear a Clínica VetBots: os dois telefones de exemplo ficam ativos em *Notificações*;
com `ATENDIMENTO_SEND_ENABLED=true` passam a receber avisos reais.

## Testes

```bash
npm test                 # lógica pura + cobertura do prompt + telas (SSR)
npm run test:banco       # migrações + semente + RLS (PGlite; precisa instalar @electric-sql/pglite@0.2.17)
npm run test:edge        # Edge `agenda` e worker rodando de verdade em Deno, com backend falso
```

## Observações de operação

- O assistente só oferece tipos que têm **ao menos uma agenda ativa**; tipo recém-criado fica fora até a agenda ser testada e ativada.
- A listagem da agenda reúne os calendários de todas as agendas ativas do tipo (vários profissionais).
- `finalizado` só dispara se a resposta do assistente contiver a frase-gatilho — no n8n ela vinha do texto de confirmação do agendamento e da mensagem de emergência. Confira no **Meu Prompt** vigente e use "Testar classificação".
- Nome da empresa e do assistente são variáveis: mudar em **Empresa** vale na próxima mensagem, sem nova versão do prompt.
- `sync-google-calendar` (espelho do /schedule) usa a tabela `google_agenda_config`, independente de `agenda_calendarios`.

## Limitações conhecidas

- As Edge Functions foram executadas em Deno contra um backend falso (Supabase/Google/OpenAI em memória), **não** contra os serviços reais; falta o ensaio em produção com destino de teste.
- Padrões de operadora no `uazapi-webhook` (TIM/Claro/Vivo/Oi, "protocolo:") continuam no código; os de URA do worker já são configuráveis.
- Se o registro em `agenda_agendamentos` falhar depois de o evento ser criado, o evento fica órfão e é tratado como "feito pela equipe".
- Agendamentos simultâneos no mesmo horário só têm a segunda checagem como proteção (sem trava).
- E-mail HTML e planilha de auditoria do n8n foram substituídos por convite do Google Agenda + registro + aviso por WhatsApp.
- `{{nome_clinica}}` continua aceito no prompt por compatibilidade (alias de `{{nome_empresa}}`).
