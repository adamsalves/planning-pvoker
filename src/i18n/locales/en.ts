import type { MessageSchema } from './pt-BR'

// Tipado contra o schema do pt-BR: qualquer chave faltando/sobrando é erro de build.
export const en: MessageSchema = {
  common: {
    closeModal: 'Close dialog',
  },
  layout: {
    backToRoom: 'Back to Room',
    home: 'Home',
    history: 'History',
    madeBy: 'made by',
    theme: {
      light: 'light',
      dark: 'dark',
      system: 'system',
      toggle: 'Theme: {name}. Click to switch.',
    },
    localeToggle: 'Switch language to Portuguese',
  },
  home: {
    subtitle: 'Agile estimates with your team, in real time',
    sessionExpired: 'Your session expired or the room is no longer available. Join again.',
    tabs: {
      create: 'Create Room',
      join: 'Join Room',
    },
    nameLabel: 'Your name',
    namePlaceholderCreate: 'E.g.: John',
    namePlaceholderJoin: 'E.g.: Mary',
    deckTypeLabel: 'Deck Type',
    autoReveal: 'Auto-reveal when everyone has voted',
    createButton: '🚀 Create Room',
    roomCodeLabel: 'Room code',
    roomCodePlaceholder: 'E.g.: a1b2c3d4',
    joinAsLabel: 'Join as',
    roleMember: 'Player',
    roleMemberDesc: 'Votes on estimates',
    roleObserver: 'Observer',
    roleObserverDesc: 'Just watches',
    joinButton: '🔗 Join Room',
    validation: {
      nameMin: 'Name must be at least 2 characters',
      nameMax: 'Name must be at most 20 characters',
      roomCodeRequired: 'Room code is required',
    },
  },
  decks: {
    fibonacci: 'Fibonacci',
    tshirt: 'T-Shirt Sizes',
    sequential: 'Sequential',
  },
  errors: {
    transient: "Couldn't connect right now. Please try again in a moment.",
    roomNotFound: 'Room not found',
    invalidSession: 'Invalid session',
    invalidPayload: 'Invalid input data',
    joinRefused: "Couldn't join the room.",
  },
}
