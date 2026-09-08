import confetti from 'canvas-confetti'
import { CELEBRATIONS } from '@/types'
import type { Celebration } from '@/types'

interface ConfettiImplementation {
  kind: 'confetti'
  run: () => void
}

// Forma consumida pelo PR C (sprites atravessando a tela, estilo Slack). A
// união já nasce discriminada porque os 4 ids de sprite existem no contrato de
// rede HOJE — o que falta é a implementação, e até ela chegar a resolução
// abaixo devolve 'classic' para eles (ver o teste que fixa essa degradação).
export interface SpriteImplementation {
  kind: 'sprite'
  emoji: string
  path: 'arc' | 'straight'
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

// Faltam de propósito as 4 sprites: entram no PR C. A janela entre o deploy do
// servidor (sorteia as 11) e o do cliente com C tem que degradar para classic,
// nunca quebrar — por isso a resolução abaixo nunca devolve undefined.
const implementations: Partial<Record<Celebration, CelebrationImplementation>> = {
  classic: CLASSIC,

  fireworks: FIREWORKS,
  rain: RAIN,
  cannons: CANNONS,
  blast: BLAST,
  stars: STARS,
  suits: SUITS,
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
