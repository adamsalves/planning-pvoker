// Erro tipado para rejeições de `join_room` vindas do servidor (ACK com `error`).
// Mora num módulo próprio — separado de useSocket — porque o RoomView.spec mocka
// `@/composables/useSocket`; assim a classe real continua importável nos testes.
//
// A distinção é a regra de ouro do fluxo de sala: só um `JoinAckError` significa
// "sessão realmente inválida / sala inexistente" → volta pra Home. Qualquer outra
// falha (socket indisponível, cold start, queda) é transitória — o overlay cobre e
// o retry do Socket.IO resolve, sem jogar o usuário pra fora da sala.
export class JoinAckError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'JoinAckError'
  }
}
