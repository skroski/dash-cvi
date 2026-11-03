# Pesquisas de satisfação: Google Forms + Supabase + n8n

## Arquitetura

```text
n8n prepara o envio
  -> RPC do Supabase impede tutor duplicado
  -> WhatsApp recebe um link Google Forms individual
  -> tutor responde
  -> trigger instalável do Apps Script envia a resposta
  -> Edge Function valida o segredo
  -> Supabase salva a resposta e marca o tutor como Cadastrado
  -> Dashboard atualiza em tempo real
```

O React/Vite nunca recebe credenciais do Google nem a chave `service_role`.

## 1. Banco e Edge Function

Aplique a migração:

```bash
supabase db push
```

Crie um segredo forte e use o mesmo valor na Edge Function e no Apps Script:

```bash
supabase secrets set GOOGLE_FORMS_WEBHOOK_SECRET="troque-por-um-segredo-longo"
supabase functions deploy google-forms-satisfaction --no-verify-jwt
```

O JWT padrão fica desativado apenas para esse endpoint porque o Google Apps Script
não possui uma sessão Supabase. A requisição continua protegida pelo header
`x-webhook-secret`, pelo `formId` configurado e pelo token individual do tutor.

## 2. Preparar o Google Forms

1. Crie ou abra o formulário de satisfação.
2. Adicione uma pergunta obrigatória de resposta curta chamada
   `Código de acompanhamento`.
3. Na descrição da pergunta, informe: `Código preenchido automaticamente. Não altere.`
4. Adicione, conforme necessário:
   - uma pergunta de nota de 1 a 5;
   - uma pergunta NPS de 0 a 10;
   - uma pergunta aberta para comentário;
   - telefone e e-mail, caso não sejam coletados automaticamente.
5. No menu do formulário, escolha a opção para gerar um link pré-preenchido.
6. Preencha `TOKEN_TESTE` na pergunta de acompanhamento e gere o link.
7. Localize no link o parâmetro parecido com `entry.123456789=TOKEN_TESTE`.
8. No Dashboard, crie a campanha e informe:
   - a URL pública completa terminada em `/viewform`;
   - o ID interno do formulário, copiado da URL de edição entre `/d/` e `/edit`;
   - somente o número do parâmetro, por exemplo `123456789`.

O Dashboard e a função `preparar_envio_pesquisa_satisfacao` usam esse número para
criar um link individual com um UUID. O tutor fica associado à resposta correta.

## 3. Apps Script do formulário

No Google Forms, abra **Extensões > Apps Script** e cole:

```javascript
const QUESTION_TITLES = {
  tracking: 'Código de acompanhamento',
  rating: 'De 1 a 5, como você avalia sua experiência?',
  nps: 'De 0 a 10, o quanto você recomendaria nossa clínica?',
  comment: 'Conte-nos mais sobre sua experiência',
  email: 'E-mail',
  phone: 'Telefone',
};

function onSatisfactionFormSubmit(e) {
  if (!e || !e.response) {
    throw new Error('Este handler deve ser executado por um trigger do Google Forms.');
  }

  const properties = PropertiesService.getScriptProperties();
  const webhookUrl = properties.getProperty('SUPABASE_WEBHOOK_URL');
  const webhookSecret = properties.getProperty('WEBHOOK_SECRET');

  if (!webhookUrl || !webhookSecret) {
    throw new Error('Configure SUPABASE_WEBHOOK_URL e WEBHOOK_SECRET.');
  }

  const formResponse = e.response;
  const answers = {};

  formResponse.getItemResponses().forEach((itemResponse) => {
    answers[itemResponse.getItem().getTitle()] = itemResponse.getResponse();
  });

  const read = (title) => {
    const value = answers[title];
    if (Array.isArray(value)) return value.join(', ');
    return value === undefined || value === null ? '' : String(value).trim();
  };

  const numberOrNull = (value) => {
    if (!value) return null;
    const parsed = Number(String(value).replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : null;
  };

  const payload = {
    formId: FormApp.getActiveForm().getId(),
    responseId: formResponse.getId(),
    submittedAt: formResponse.getTimestamp().toISOString(),
    trackingToken: read(QUESTION_TITLES.tracking),
    rating: numberOrNull(read(QUESTION_TITLES.rating)),
    nps: numberOrNull(read(QUESTION_TITLES.nps)),
    comment: read(QUESTION_TITLES.comment) || null,
    email:
      formResponse.getRespondentEmail() ||
      read(QUESTION_TITLES.email) ||
      null,
    phone: read(QUESTION_TITLES.phone) || null,
    answers,
  };

  const result = UrlFetchApp.fetch(webhookUrl, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'x-webhook-secret': webhookSecret,
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const status = result.getResponseCode();
  if (status < 200 || status >= 300) {
    throw new Error(
      `Supabase respondeu ${status}: ${result.getContentText()}`
    );
  }
}

function installSatisfactionTrigger() {
  const handler = 'onSatisfactionFormSubmit';

  ScriptApp.getProjectTriggers()
    .filter((trigger) => trigger.getHandlerFunction() === handler)
    .forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  ScriptApp.newTrigger(handler)
    .forForm(FormApp.getActiveForm())
    .onFormSubmit()
    .create();
}
```

Altere os textos em `QUESTION_TITLES` para que sejam exatamente iguais aos títulos
das perguntas do seu formulário.

### Configurar as propriedades

Em **Configurações do projeto > Propriedades do script**, adicione:

| Propriedade | Valor |
| --- | --- |
| `SUPABASE_WEBHOOK_URL` | Endpoint exibido na aba Integração do Dashboard |
| `WEBHOOK_SECRET` | O mesmo valor de `GOOGLE_FORMS_WEBHOOK_SECRET` |

Depois:

1. execute manualmente `installSatisfactionTrigger`;
2. autorize o script;
3. envie uma resposta de teste pelo link individual;
4. confirme no Dashboard que o tutor mudou de **Enviado** para **Cadastrado**.

Não crie um trigger simples com o nome `onFormSubmit`. O trigger deve ser instalável
e vinculado ao formulário para disponibilizar `e.response`.

## 4. Contrato do n8n sem envio duplicado

Antes de enviar a mensagem, o n8n deve chamar:

```http
POST /rest/v1/rpc/preparar_envio_pesquisa_satisfacao
Authorization: Bearer SUPABASE_SERVICE_ROLE_KEY
apikey: SUPABASE_SERVICE_ROLE_KEY
Content-Type: application/json
```

Exemplo de body:

```json
{
  "p_configuracao_id": 1,
  "p_nome_tutor": "Mariana Gonçalves",
  "p_telefone": "5511981062675@s.whatsapp.net",
  "p_email": "mariana@example.com",
  "p_client_id": 123,
  "p_agendamento_chave": "agenda-987",
  "p_data_agendada": "2026-07-03",
  "p_horario_agendado": "20:15",
  "p_servico": "Consulta",
  "p_nome_pet": "Luna"
}
```

Resposta de um tutor novo:

```json
[
  {
    "envio_id": 42,
    "tracking_token": "52d516e0-c158-44e5-9cc1-71776490dc44",
    "link_pesquisa": "https://docs.google.com/forms/d/e/.../viewform?usp=pp_url&entry.123=52d516e0-c158-44e5-9cc1-71776490dc44",
    "status": "pendente",
    "deve_enviar": true
  }
]
```

Fluxo recomendado:

1. chamar `preparar_envio_pesquisa_satisfacao`;
2. usar um nó **IF** em `deve_enviar`;
3. se `false`, encerrar esse item sem enviar;
4. se `true`, substituir `{{link_pesquisa}}` pelo valor retornado;
5. enviar a mensagem;
6. atualizar `pesquisa_satisfacao_envios` usando `envio_id`:
   - sucesso: `status = enviado`, `enviado_em = now()`;
   - erro: `status = falha`, `erro = mensagem do provedor`.

A constraint `pesquisa_satisfacao_envios_tutor_unico` garante a deduplicação no banco
mesmo se duas execuções do n8n tentarem processar o mesmo telefone ao mesmo tempo.
Somente um registro marcado explicitamente como `falha` pode ser reaberto pela função
para nova tentativa; registros `pendente`, `enviado` ou `cadastrado` são ignorados.

## 5. Campos recebidos pelo Dashboard

O Apps Script envia os campos padronizados abaixo e também preserva todas as respostas
originais em `respostas`:

| Campo | Uso |
| --- | --- |
| `rating` | Nota média e distribuição de 1 a 5 |
| `nps` | Cálculo de promotores menos detratores |
| `comment` | Lista de comentários recentes |
| `answers` | JSON integral para futuras perguntas e análises |

Se uma pergunta não existir, o campo pode ser `null`; os demais resultados continuam
funcionando.
