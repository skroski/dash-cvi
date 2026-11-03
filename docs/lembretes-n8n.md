# Contrato do módulo de Lembretes com o n8n

O dashboard gerencia as regras em `public.lembrete_configuracoes`. O n8n executa
os envios e registra cada tentativa em `public.lembrete_envios`.

## Regra operacional

- Processar somente configurações com `ativo = true`.
- Respeitar `horario_envio` usando o `timezone` da configuração.
- Buscar somente agendamentos do dia seguinte (`dias_antecedencia = 1`).
- Criar o registro de envio antes de chamar o provedor de WhatsApp.
- Se a combinação `configuracao_id + agendamento_chave + data_agendada` já
  existir, não enviar novamente.
- Atualizar o registro para `enviado`, `falha` ou `ignorado` ao final.

Para que alterações de horário feitas no dashboard sejam aplicadas sem editar o
workflow, o gatilho do n8n deve rodar em uma frequência curta e consultar quais
regras estão no horário atual.

## Mapeamento da agenda

| Agenda | `lembrete_envios` |
| --- | --- |
| Data Agendada | `data_agendada` |
| Horário | `horario_agendado` |
| Serviços | `servico` |
| Nome Cliente | `nome_tutor` |
| Telefone | `telefone` |
| Nome Pet | `nome_pet` |

`agendamento_chave` deve ser um identificador estável do agendamento. Prefira o
ID do evento na origem. Não use apenas o número da linha da planilha, pois ele
pode mudar quando linhas forem inseridas ou removidas.

## Variáveis da mensagem

- `{{nome_tutor}}`
- `{{nome_pet}}`
- `{{servico}}`
- `{{data}}`
- `{{horario}}`

O n8n substitui essas variáveis pelos dados do agendamento antes do envio.

## Estados do histórico

- `pendente`: registro criado e ainda não processado.
- `processando`: chamada ao provedor em andamento.
- `enviado`: mensagem aceita pelo provedor.
- `falha`: tentativa encerrada com erro.
- `ignorado`: registro não enviado por dado inválido ou regra de negócio.

Use uma credencial Supabase com `service_role` armazenada no gerenciador de
credenciais do n8n. Essa chave nunca deve ser enviada ao navegador ou salva em
campos de texto do workflow.
