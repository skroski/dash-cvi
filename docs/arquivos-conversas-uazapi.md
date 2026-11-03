# Arquivos das conversas (Uazapi → Supabase)

Como os anexos do WhatsApp — laudos, exames, fotos, áudios — passam a ter
registro e cópia permanente no Supabase, sem alterar o que o chat já exibia.

## O problema

Antes desta mudança, nenhum arquivo que passava pelo painel tinha registro em
banco:

| | Como funcionava | Risco |
| --- | --- | --- |
| **Recebido** | Única cópia no servidor da Uazapi, exibida pela URL de `/message/find` | Troca de instância, token revogado ou retenção do provedor apagam o histórico inteiro de anexos |
| **Enviado** | Vai do navegador direto para a Uazapi em base64; o chat mostra um `blob:` local | O `blob:` morre no F5. O anexo só volta se a Uazapi devolvê-lo — e só as 200 mensagens mais recentes são lidas |
| **Consulta** | Inexistente | Não dava para responder "quais arquivos esta cliente já mandou?" nem "quem enviou este laudo?" |

## O desenho

A `mediaUrl` que o `MessageItem` renderiza **continua sendo a da Uazapi**. Nada
no caminho de renderização mudou. O que foi acrescentado roda ao lado:

```
                      ┌──────────────────────────┐
  envio pelo painel ──┤ 1. POST /send/media      │──► Uazapi (inalterado)
                      │ 2. upload no Storage     │──► bucket conversa-midias
                      │ 3. insert no catálogo    │──► public.conversa_midias
                      └──────────────────────────┘

  abrir conversa ─────┤ GET /message/find        │──► Uazapi (inalterado)
                      │ upsert do catálogo       │──► public.conversa_midias
                      │ edge fn arquivar-midias  │──► bucket conversa-midias
                      └──────────────────────────┘
```

`public.conversa_midias` guarda os metadados; `uazapi_url` é o ponteiro volátil
do provedor e `storage_path` é a cópia permanente. Uma linha com `storage_path`
nulo significa "ainda dependemos só da Uazapi".

### Arquivo que o cliente envia

O anexo recebido tem **duas** origens possíveis, e o painel usa as duas:

| Origem | Quando aparece | Papel |
| --- | --- | --- |
| Realtime do `n8n_chat_histories` | Imediato | O que o cliente acabou de mandar surge na hora |
| Polling do `/message/find` | Até 15s depois | Versão hospedada, vira a canônica ao chegar |

Antes esta mídia do realtime era **descartada** (`if (incoming.mediaUrl &&
isUazapiConfigured()) return`) sob a premissa de que a Uazapi sempre a
devolveria. Quando não devolve, o anexo do cliente simplesmente nunca aparecia.
Agora ela entra imediatamente e o polling reconcilia.

### Como as origens são reconciliadas

Cada `ChatMessage` carrega `origem` (`uazapi` | `historico` | `catalogo` |
`local`) e `messageId`. Os espaços de id são independentes entre origens, então
a comparação muda conforme o par:

- **Realtime** (`jaEstaNaTela`): compara só contra a MESMA origem, por
  identidade. Não cruza com a Uazapi de propósito — uma única foto já
  hospedada casaria pela heurística com as três de uma rajada e engoliria
  duas.
- **Polling e carga** (`midiasSemPar`): pareia **1 para 1, consumindo** a
  correspondência. É o que garante que, se a Uazapi indexou só uma das três
  fotos, as outras duas continuem na tela em vez de serem absorvidas por ela.
  O polling ainda descarta as cópias antigas da própria Uazapi, já que
  `uazapiMedia` é a lista inteira recarregada.
- **Heurística** (`isSameMedia`): tipo real + janela de **90s** + nome do
  arquivo quando os dois lados têm. A janela é folgada de propósito: o horário
  que o n8n grava e o que a Uazapi devolve para a mesma mensagem divergem pelo
  processamento, e apertar a janela cria duplicata permanente sem proteger
  rajada nenhuma — quem protege é o pareamento 1:1.

Consequência aceita: quando a Uazapi indexa a foto *antes* do n8n gravar a
linha, aparece uma duplicata por até 15s, até o próximo polling. Preferiu-se
isso a arriscar sumir com o anexo do cliente.

`parseMessage` passou a carregar `messageId` (`n8n:<id da linha>`, com sufixo
`:<i>` em lote), que é a identidade usada no realtime e no catálogo.

### Como o formato é identificado

`src/lib/media.ts` decide o tipo na ordem: `type` (só quando é mesmo de mídia)
→ extensão do nome do arquivo → extensão no caminho da URL → mime de `data:`.

Isso existe porque **o campo `type` é sobrecarregado**: às vezes é o formato
(`image`, `imageMessage`, `ptt`), às vezes é o papel de quem falou (`human`,
`ai`). E a URL que a Uazapi hospeda normalmente não tem extensão. Confiar só no
`type` fazia uma foto do cliente ser renderizada como card de PDF.

O chat renderiza: imagem inline (clique abre em nova guia), vídeo com player,
áudio com player, e card com nome + formato real + abrir/baixar para o resto.

### Por que a cópia dos bytes recebidos é server-side

O navegador não consegue baixar a `fileURL` da Uazapi (o host de arquivos dela
não libera CORS) e, mesmo que liberasse, cada painel aberto refaria o mesmo
download. A edge function `arquivar-midias` faz isso uma vez, com
`service_role`, ao lado do Storage.

### Degradação

Todas as leituras e escritas novas engolem o próprio erro e devolvem
vazio/no-op. Enquanto a migração não estiver aplicada — ou se a edge function
não estiver publicada — o chat funciona exatamente como funcionava.

## Instalação

**1. Migração** — rodar `supabase/migrations/20260814120000_conversa_midias.sql`
no SQL Editor do Supabase (projeto `napeofeenweerjhqucua`). Cria a tabela, as
policies, a view de apoio e o bucket privado `conversa-midias`.

> A seção 4 (bucket + policies de `storage.objects`) é a última do arquivo
> porque é a única que depende de privilégio sobre o schema `storage`. Se ela
> falhar por permissão, o catálogo já está aplicado — crie o bucket
> `conversa-midias` (privado, 20MB) e as policies de SELECT/INSERT para
> `authenticated` pelo Dashboard, em Storage → Policies.

**2. Edge function** (opcional — sem ela, só o que sai do painel ganha cópia):

```bash
supabase functions deploy arquivar-midias
```

**3. Segredo da Uazapi** para a edge function baixar os arquivos:

```bash
supabase secrets set UAZAPI_INSTANCE_TOKEN=<token da instância>
```

## Verificação

Abra uma conversa que tenha anexo e confira o catálogo:

```sql
select direcao, tipo, nome_arquivo, storage_path, enviada_por_nome, ocorrido_em
  from public.conversa_midias
 order by id desc
 limit 20;
```

O que ainda depende só da Uazapi:

```sql
select count(*) from public.conversa_midias_pendentes;
```

Se esse número cresce sem parar, a edge function não está publicada ou não está
conseguindo baixar os arquivos (ver logs em `supabase functions logs
arquivar-midias`).

## Detalhes que importam

- **Chave da conversa:** `session_id` é sempre o JID normalizado
  (`buildChatId` em `src/services/uazapi.ts`) — `55DDNNNNNNNNN@s.whatsapp.net`
  ou `...@g.us`. Uazapi e catálogo precisam usar exatamente a mesma.
- **Idempotência:** o par `(session_id, message_id)` é único. Abrir a mesma
  conversa dez vezes não gera dez linhas.
- **`message_id` local:** quando o `/send/media` não devolve um id, gravamos
  `local:<uuid>`. Nesse caso a mesma mídia pode gerar uma segunda linha quando
  a indexação do `/message/find` passar por ela. É registro duplicado no
  catálogo, nunca anexo duplicado no chat — a deduplicação da exibição usa id
  **ou** a heurística de horário (`isSameMediaOrId` em `useChatMessages`).
- **Indexação só na abertura:** nunca no polling de 15s. São até 200 mensagens
  por chamada, por conversa aberta. Cataloga as duas origens — o
  `/message/find` (`indexarMidiasDaConversa`) e o histórico do n8n
  (`indexarMidiasDoHistorico`), que é a única que registra o anexo recebido
  quando a Uazapi não expõe a URL. URLs `data:` e `blob:` são ignoradas: a
  primeira traz o base64 inteiro, a segunda só existe na aba que a criou.
- **URLs assinadas:** o bucket é privado (são documentos de paciente). O painel
  gera URLs com 12h de validade, uma vez por conversa aberta.
- **Sem DELETE:** `authenticated` não tem permissão de apagar o catálogo nem
  objetos do bucket. Correções passam pelo `service_role`.

## Pendências conhecidas

- Não existe interface de "Arquivos da conversa". O catálogo já suporta
  (`session_id`, `telefone`, `tipo`, `ocorrido_em` estão indexados), mas a tela
  não foi feita.
- O token da instância Uazapi está no bundle do navegador
  (`src/config/env.ts`) — ele autoriza `/send/media` e `/message/find` em nome
  da clínica. Mover para um proxy server-side é assunto à parte desta mudança.
