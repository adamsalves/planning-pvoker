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

// Mensagens conhecidas do servidor → chaves de tradução. Ponte temporária do
// F8: quando o servidor passar a ackar códigos estáveis (invalid_session,
// room_not_found…), este mapa troca as mensagens pt-BR pelos códigos — os
// consumidores (que só veem chaves) não mudam.
const SERVER_ERROR_KEYS: Record<string, string> = {
  'Sala não encontrada': 'errors.roomNotFound',
  'Sessão inválida': 'errors.invalidSession',
  'Dados de entrada inválidos': 'errors.invalidPayload',
}

// Mapeia um erro de criar/entrar em sala para a CHAVE i18n exibida ao usuário
// (o chamador traduz com t(), assim a mensagem reage à troca de idioma).
// Só um JoinAckError carrega um motivo real do servidor; qualquer outra falha é
// transitória (cold start / conexão) → chave genérica de "tente de novo".
export function getJoinErrorKey(error: unknown): string {
  if (error instanceof JoinAckError) {
    return SERVER_ERROR_KEYS[error.message] ?? 'errors.joinRefused'
  }
  return 'errors.transient'
}
