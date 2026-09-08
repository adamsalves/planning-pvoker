import confetti from 'canvas-confetti'
import { CELEBRATIONS } from '@/types'
import type { Celebration } from '@/types'

interface ConfettiImplementation {
  kind: 'confetti'
  run: () => void
}

// Forma dos sprites (B1–B4): um emoji atravessando a tela, estilo Slack.
// `path` escolhe a trajetória CSS (ver CelebrationStage); `durationMs` entra
// como --sprite-duration. 'arc' = pulos em ondas (dolphin), 'straight' =
// varredura diagonal (rocket, cards), 'rise' = sobe do rodapé (balloons).
export interface SpriteImplementation {
  kind: 'sprite'
  emoji: string
  path: 'arc' | 'straight' | 'rise'
  durationMs: number
}

export type CelebrationImplementation = ConfettiImplementation | SpriteImplementation

// Reproduz exatamente a animação anterior à feature: burst central + 2 canhões
// laterais. É também o fallback de TODA resolução que não acha implementação.
const CLASSIC: ConfettiImplementation = {
  kind: 'confetti',
  run: () => {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
    setTimeout(() => {
      confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } })
      confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } })
    }, 250)
  },
}

const FIREWORKS: ConfettiImplementation = {
  kind: 'confetti',
  run: () => {
    const end = Date.now() + 800
    const volley = () => {
      confetti({
        particleCount: 25,
        spread: 360,
        startVelocity: 30,
        ticks: 90,
        origin: { x: Math.random(), y: Math.random() * 0.4 },
      })
      if (Date.now() < end) setTimeout(volley, 150)
    }
    volley()
  },
}

// startVelocity 0 + gravidade fraca: as partículas não "explodem", chovem.
const RAIN: ConfettiImplementation = {
  kind: 'confetti',
  run: () => {
    confetti({
      particleCount: 80,
      spread: 360,
      startVelocity: 0,
      ticks: 220,
      gravity: 0.35,
      origin: { y: -0.2 },
    })
  },
}

// Como o classic sem o burst central: só os dois canhões, um de cada lado.
const CANNONS: ConfettiImplementation = {
  kind: 'confetti',
  run: () => {
    confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } })
    confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } })
  },
}

const BLAST: ConfettiImplementation = {
  kind: 'confetti',
  run: () => {
    confetti({ particleCount: 220, spread: 120, startVelocity: 45, origin: { y: 0.55 } })
  },
}

const STARS: ConfettiImplementation = {
  kind: 'confetti',
  run: () => {
    confetti({
      particleCount: 90,
      spread: 90,
      origin: { y: 0.6 },
      colors: ['#FFD166', '#FFF3B0', '#F4A259'],
      shapes: ['star'],
      scalar: 1.4,
    })
  },
}

// Naipes vermelhos e pretos mantêm a cor da verdade. shapeFromText rasteriza o
// glifo (a cor nasce assada na shape, e o scalar aqui precisa bater com o
// scalar do confetti para não borrar — aviso do README da lib).
const SUITS: ConfettiImplementation = {
  kind: 'confetti',
  run: () => {
    const suitShape = (text: string, color: string) =>
      confetti.shapeFromText({ text, scalar: 1.6, color })
    confetti({
      particleCount: 30,
      spread: 100,
      origin: { y: 0.6 },
      scalar: 1.6,
      shapes: [suitShape('♥', '#DC2626'), suitShape('♦', '#DC2626')],
    })
    confetti({
      particleCount: 30,
      spread: 100,
      origin: { y: 0.6 },
      scalar: 1.6,
      shapes: [suitShape('♠', '#111827'), suitShape('♣', '#111827')],
    })
  },
}

// As 4 sprites (B1–B4 do plano). Emoji cru, não ícone Lucide: a paleta
// monocromática currentColor mataria a piada (golfinho em contorno cinza não
// celebra nada — coerente com a convenção de ícones, que reserva emoji para
// quando a cor É a mensagem). Dependem da fonte do SO, então cada OS desenha o
// seu; é variedade aceitável, não bug (risco 3 do plano).
const DOLPHIN: SpriteImplementation = { kind: 'sprite', emoji: '🐬', path: 'arc', durationMs: 2200 }
const ROCKET: SpriteImplementation = {
  kind: 'sprite',
  emoji: '🚀',
  path: 'straight',
  durationMs: 1600,
}
// O "desfile" são as próprias cartas: uma sequência que atravessa junta.
const CARDS: SpriteImplementation = {
  kind: 'sprite',
  emoji: '🎴 🃏 🎴 🃏 🎴',
  path: 'straight',
  durationMs: 2800,
}
const BALLOONS: SpriteImplementation = {
  kind: 'sprite',
  emoji: '🎈 🎈 🎈',
  path: 'rise',
  durationMs: 3200,
}

// A ordem importa do lado do cliente (a frase do banner lê posição — ver
// contract-drift.spec): os quatro sprites ocupam os índices 7–10 e novos ids
// só entram DEPOIS deles. resolvedImplementation nunca devolve undefined
// mesmo para um 12º id que um servidor futuro sorteie antes deste cliente
// acompanhar (a janela "server antes do cliente" do plano): cai em classic.
const implementations: Partial<Record<Celebration, CelebrationImplementation>> = {
  classic: CLASSIC,
  fireworks: FIREWORKS,
  rain: RAIN,
  cannons: CANNONS,
  blast: BLAST,
  stars: STARS,
  suits: SUITS,
  dolphin: DOLPHIN,
  rocket: ROCKET,
  cards: CARDS,
  balloons: BALLOONS,
}

function isKnownCelebration(value: string): value is Celebration {
  return CELEBRATIONS.some((known) => known === value)
}

// Os dois resolvedores aceitam `Celebration | string` (e `undefined`) porque a
// borda aqui é o broadcast da rede, que não passa por zod: um servidor futuro
// pode sortear um 12º id que este vocabulário ainda não conhece (a janela
// "server antes do cliente" do plano). Os call-sites tipados seguem passando
// Celebration — o alargamento é só para a entrada de rede ser honestamente
// tratável, e testável, sem cast.
export function resolvedImplementation(
  celebration: Celebration | string | undefined,
): CelebrationImplementation {
  if (celebration === undefined || !isKnownCelebration(celebration)) return CLASSIC
  return implementations[celebration] ?? CLASSIC
}

// Frases do banner derivadas do ÍNDICE da celebração (decisão do plano: sem um
// SEGUNDO campo sincronizado no contrato — a mensagem fica coerente entre todos
// de graça). O catálogo precisa ter exatamente este número de mensagens; o
// registry.spec fixa a paridade, porque t() de chave inexistente não reclama.
export const CONSENSUS_MESSAGES = 4

export function bannerMessageKey(celebration: Celebration | string): string {
  // Id desconhecido (mesmo cenário da janela server→cliente) degrada junto com
  // a animação: mensagem do classic, em vez de renderizar a chave crua
  // 'room.reveal.messages.-1' no banner.
  const index = isKnownCelebration(celebration) ? CELEBRATIONS.indexOf(celebration) : -1
  return `room.reveal.messages.${index < 0 ? 0 : index % CONSENSUS_MESSAGES}`
}
