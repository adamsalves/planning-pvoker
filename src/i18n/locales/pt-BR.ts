// Catálogo pt-BR — a fonte da verdade do schema de mensagens: o catálogo `en` é
// tipado contra `MessageSchema` (typeof deste objeto), então chave faltando ou
// sobrando no inglês vira erro de compilação, não bug silencioso em produção.
export const ptBR = {
  common: {
    closeModal: 'Fechar janela',
  },
  layout: {
    backToRoom: 'Voltar à Sala',
    home: 'Home',
    history: 'Histórico',
    madeBy: 'feito por',
    theme: {
      light: 'claro',
      dark: 'escuro',
      system: 'automático',
      toggle: 'Tema: {name}. Clique para alternar.',
    },
    localeToggle: 'Mudar idioma para inglês',
  },
  home: {
    subtitle: 'Estimativas ágeis com seu time, em tempo real',
    sessionExpired: 'Sua sessão expirou ou a sala não está mais disponível. Entre novamente.',
    tabs: {
      create: 'Criar Sala',
      join: 'Entrar na Sala',
    },
    nameLabel: 'Seu nome',
    namePlaceholderCreate: 'Ex: João',
    namePlaceholderJoin: 'Ex: Maria',
    deckTypeLabel: 'Tipo de Baralho',
    autoReveal: 'Auto-revelar quando todos votarem',
    createButton: '🚀 Criar Sala',
    roomCodeLabel: 'Código da sala',
    roomCodePlaceholder: 'Ex: a1b2c3d4',
    joinAsLabel: 'Entrar como',
    roleMember: 'Jogador',
    roleMemberDesc: 'Vota nas estimativas',
    roleObserver: 'Espectador',
    roleObserverDesc: 'Apenas assiste',
    joinButton: '🔗 Entrar na Sala',
    validation: {
      nameMin: 'Nome deve ter pelo menos 2 caracteres',
      nameMax: 'Nome deve ter no máximo 20 caracteres',
      roomCodeRequired: 'Código da sala é obrigatório',
    },
  },
  decks: {
    fibonacci: 'Fibonacci',
    tshirt: 'T-Shirt Sizes',
    sequential: 'Sequencial',
  },
  errors: {
    transient: 'Não foi possível conectar agora. Tente novamente em instantes.',
    roomNotFound: 'Sala não encontrada',
    invalidSession: 'Sessão inválida',
    invalidPayload: 'Dados de entrada inválidos',
    joinRefused: 'Não foi possível entrar na sala.',
  },
}

export type MessageSchema = typeof ptBR
