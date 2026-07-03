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

// Códigos estáveis do servidor → chaves de tradução. O servidor acka CÓDIGOS
// language-agnostic (ver server/src/events.ts: AckErrorCode), nunca copy pt-BR —
// assim reescrever uma mensagem não quebra este mapa. Só os códigos que o fluxo
// de join pode devolver ao usuário aparecem aqui; os demais (voto, etc.) o
// cliente ignora. Código desconhecido → chave genérica de recusa abaixo.
const SERVER_ERROR_KEYS: Record<string, string> = {
  room_not_found: 'errors.roomNotFound',
  invalid_session: 'errors.invalidSession',
  invalid_payload: 'errors.invalidPayload',
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
