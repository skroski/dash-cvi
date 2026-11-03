# Envio das mensagens agendadas

O dashboard grava o CRUD na tabela `mensagens_agendadas`. Para os envios
continuarem funcionando com o navegador fechado, configure um fluxo no n8n
executado a cada minuto.

## Fluxo mínimo

1. Use um `Schedule Trigger` com intervalo de 1 minuto.
2. Chame o RPC Supabase `claim_mensagens_agendadas` com `p_limit: 50`,
   autenticando com a `service_role`.
3. Para cada item retornado, envie `mensagem` ao `telefone`.
4. Use o campo `remetente` para a instância cvi.
5. Em caso de sucesso, atualize o registro:

```json
{
  "status": "enviado",
  "enviado_em": "={{ $now.toISO() }}",
  "provider_message_id": "={{ $json.messageId }}",
  "erro": null
}
```

6. Em caso de falha, atualize:

```json
{
  "status": "falha",
  "erro": "={{ $json.error.message }}"
}
```

O RPC muda cada item para `processando` de forma atômica antes de retorná-lo,
evitando envios duplicados quando duas execuções do fluxo se sobrepõem.

