# Fila presencial: guia da equipe

A fila organiza quem chegou à clínica: a recepção ou o totem gera a **senha**, o veterinário **chama** o próximo e a **TV da sala de
espera** mostra a chamada com um sinal sonoro. Tudo fica no próprio dashboard, com o mesmo login.

## Endereços

| Tela | Endereço | Quem usa | Login |
| :--- | :--- | :--- | :--- |
| Fila (recepção, ajustes, histórico) | `/queue` | Recepção e gestão | Sim |
| Chamador do consultório | `/chamar` ou `/chamar/<sala>` | Veterinário (celular, tablet ou notebook) | Não |
| TV da sala de espera | `/tv` | Smart TV | Não |
| Totem de autoatendimento | `/totem` | Tablet na entrada | Sim (login de papel **Totem**) |
| Métricas | `/metrics` → aba **Fila presencial** | Gestão | Sim |

## Recepção (`/queue`)

- **Adicionar à fila**: escolha o tipo de atendimento, busque o cliente cadastrado (ou digite tutor e pet), informe o **WhatsApp** do
  tutor se quiser avisá-lo, escolha a prioridade e marque *Imprimir o cupom* se houver impressora. A senha nasce no banco: nunca
  repete, mesmo com duas recepções emitindo juntas.
- **Prioridades**: Emergência > Preferencial (Lei 10.048) > Normal. Quem tem a mesma prioridade é chamado por ordem de chegada.
- **Quadro**: Aguardando, Chamados, Em atendimento e Finalizados hoje. A linha mostra a origem (Totem, WhatsApp...), o telefone e,
  com ✓, que o tutor já recebeu aviso.
- **Ações**: Chamar (escolhendo a sala), Rechamar (toca o sinal de novo), Iniciar, Finalizar, Ausente, Retornar à fila, Cancelar e
  trocar de sala **sem perder a vez**.
- **Cupom**: o ícone da impressora reimprime a senha.
- A numeração **recomeça todo dia** (`A001`...). Se ficou alguém esquecido na fila de ontem, o número dele continua reservado.

## Veterinário (`/chamar`)

Abra o link da sua sala (a recepção copia em **Minha Sala → compartilhar**). **Chamar próximo** escolhe sozinho: Emergência, depois
Preferencial, depois Normal, por ordem de chegada. Duas salas clicando juntas nunca chamam o mesmo paciente. Depois: Iniciar,
Finalizar, Não compareceu, Transferir (mantém o horário de chegada).

## TV (`/tv`)

- Abra o endereço no navegador da Smart TV, em **tela cheia**, e dê **um toque** no controle para liberar o som.
- Mostra a senha chamada em tamanho gigante, a sala, as chamadas recentes e os próximos. Toca um sinal de dois tons a cada chamada.
- Com **vídeos**, escolha um dos 3 layouts em *Ajustes → TV e vídeos*.
- **Privacidade (LGPD)**: ligada, a TV mostra só a senha. Desligada, mostra a senha, o pet e o veterinário. O **primeiro nome do tutor** só aparece se o gestor ligar *Mostrar o primeiro nome do tutor* (a TV é pública: pense antes de ligar).
- Sem internet por alguns segundos? Aparece uma faixa vermelha e a TV se recupera sozinha.

## Totem (`/totem`)

O tutor toca no serviço, informa o nome (e o pet, e o WhatsApp se a clínica pedir) e recebe a senha impressa. Volta sozinho ao início.
Emergência tem botão próprio. O aparelho usa um **login de papel Totem**: ele só emite senha. Montagem do tablet e da impressora:
*Ajustes → Totem*.

## Ajustes (botão **Ajustes** em `/queue`, só gestor)

| Aba | O que muda |
| :--- | :--- |
| **Aparência** | Nome e subtítulo, **cor da marca** (os tons são gerados sozinhos), logotipo |
| **TV e vídeos** | Layout, som, privacidade, tempo do aviso, **playlist de vídeos** (envie MP4 ou use um endereço externo) |
| **Cupom** | Largura 58/80 mm, rodapé, logotipo no cupom, **numeração** (diária ou contínua), fuso horário, cupom de teste |
| **WhatsApp** | Liga os avisos ao tutor e edita as mensagens (veja abaixo) |
| **Totem** | Perguntar o WhatsApp no totem e o passo a passo do aparelho |

Vídeos e logotipo são salvos na hora; os outros campos usam **Salvar alterações**. Salas e tipos de atendimento continuam em
**Configurar Fila**.

## Avisos por WhatsApp

Quando ligados, o tutor que informou o telefone **e já conversou com a clínica no WhatsApp** recebe: a **senha** ao ser emitida, o aviso **"sua vez está chegando"** (faltando
poucas pessoas) e a **chamada** com a sala. Vêm **desligados**: o gestor liga em *Ajustes → WhatsApp* e a equipe técnica confirma o
envio. Para avisar também quem nunca falou com a clínica (primeiro contato), desligue *Só avisar quem já conversou*, com o consentimento do tutor: o número da clínica pode ser bloqueado por mensagens não esperadas. As mensagens saem pelo mesmo WhatsApp do atendimento, não aparecem na conversa e respeitam a lista de bloqueio.

## Quando algo dá errado

| Sintoma | O que fazer |
| :--- | :--- |
| TV mostra "Sem conexão" | Confira a internet da TV. Ela volta sozinha. Abra `/tv` em outro aparelho para ver se o problema é só na TV |
| TV não toca o som | Dê um toque na tela (o navegador só libera áudio depois de um gesto) e confira o botão de som |
| Vídeo não toca | Use MP4 H.264 + AAC. A TV avisa e tenta de novo a cada 30 s. Vídeo grande: use endereço externo |
| Totem não imprime | Térmica como **impressora padrão**; navegador com `--kiosk-printing`; libere pop-ups do endereço |
| Totem abre o painel de login | O login do aparelho foi desativado ou expirou: reative em Usuários e entre de novo |
| "Já foi encerrado" ao agir numa senha | Alguém já finalizou ou cancelou essa senha. Atualize a tela |
| Tutor não recebeu o WhatsApp | O aviso está ligado? A senha tem telefone? O número está bloqueado? Peça à equipe técnica para ver a outbox (`integracao-whatsapp.md`) |
| Número de senha "pulou" | Esperado: senhas canceladas e ausentes mantêm o número. Em outro dia a numeração recomeça |
