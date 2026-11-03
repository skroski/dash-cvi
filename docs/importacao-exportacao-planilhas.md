# Importação e exportação de planilhas

Os módulos **Lembretes** e **Pesquisas de Satisfação** aceitam arquivos `.xlsx` e
`.csv` de até 10 MB.

Antes da gravação, o Dashboard mostra:

- a regra ou campanha de destino;
- o total de linhas válidas;
- duplicidades encontradas dentro do arquivo;
- linhas com data, telefone, status ou nota inválidos;
- uma prévia das primeiras dez linhas.

## Lembretes

Colunas reconhecidas:

| Coluna | Obrigatória | Observação |
| --- | --- | --- |
| Data Agendada | Sim | Aceita `yyyy-mm-dd` ou `dd/mm/yyyy` |
| Horário | Não | Aceita `HH:mm` |
| Serviços | Não | Também reconhece `Serviço` |
| Descrição | Não | Texto livre |
| Nome Cliente | Sim | Também reconhece `Tutor` |
| Telefone | Sim | Caracteres não numéricos são removidos |
| E-mail | Não | Texto |
| Nome Pet | Não | Texto |
| Porte | Não | Texto |
| Preço | Não | Número, com ponto ou vírgula decimal |
| Status | Não | Status original do agendamento |
| Status Lembrete | Não | Pendente, Processando, Enviado, Falha ou Ignorado |
| Enviado em | Não | Data e horário do envio |
| Erro | Não | Mensagem de falha |

Uma linha é considerada duplicada quando regra, chave importada e data agendada já
existem. O registro existente é preservado.

## Pesquisas de Satisfação

Colunas reconhecidas:

| Coluna | Obrigatória | Observação |
| --- | --- | --- |
| Data Agendada | Sim | Aceita `yyyy-mm-dd` ou `dd/mm/yyyy` |
| Horário | Não | Aceita `HH:mm` |
| Nome Cliente | Sim | Também reconhece `Tutor` |
| Telefone | Sim | Identificador usado para impedir duplicidade |
| E-mail | Não | Texto |
| Status | Sim | Enviado, Cadastrado, Pendente ou Falha |
| Enviado em | Não | Data e horário |
| Cadastrado em | Não | Data e horário da resposta |
| Nota | Não | Número entre 1 e 5 |
| NPS | Não | Número entre 0 e 10 |
| Comentário | Não | Resposta aberta |

O mesmo telefone não é inserido duas vezes na mesma campanha. Se a linha importada
contiver Nota, NPS ou Comentário, ela também cria uma resposta vinculada e o status
é definido como `Cadastrado`.

## Exportação

O botão **Exportar Excel** busca todos os registros do módulo no Supabase, em páginas
de até mil registros, e gera um `.xlsx` com:

- cabeçalho fixo e destacado;
- datas, horários, números e preços como valores tipados;
- cores semânticas na coluna de status;
- as colunas originais da planilha primeiro;
- campos operacionais do Dashboard ao final.

Dentro do diálogo de importação, **Baixar modelo** gera somente os cabeçalhos
compatíveis com o módulo.
