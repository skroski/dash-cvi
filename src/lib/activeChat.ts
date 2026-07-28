/**
 * Registra qual conversa está aberta no dashboard de chats, para que o
 * listener global de notificações não avise (som/toast) sobre a conversa que
 * o usuário já está lendo e o contador de não lidas não suba para ela.
 */
let activeChatSessionId: string | null = null;

export function setActiveChat(sessionId: string | null) {
  activeChatSessionId = sessionId;
}

export function getActiveChat(): string | null {
  return activeChatSessionId;
}
