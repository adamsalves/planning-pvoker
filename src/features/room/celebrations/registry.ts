import confetti from 'canvas-confetti'
import { CELEBRATIONS } from '@/types'
import type { Celebration } from '@/types'

// Toda celebração é uma receita de canvas-confetti: a lib monta o próprio canvas
// em tela cheia e o efeito é o `run()`. Não há discriminante porque não há um
// segundo mecanismo — houve um (um personagem em DOM atravessando a tela, com
// trajetória em keyframes) e ele foi retirado antes de chegar a produção.
// Se um dia voltar um mecanismo de DOM, isto volta a ser união discriminada; um
// `kind` que nada discrimina só custa ruído nos call-sites.
export interface CelebrationImplementation {
  // Dispara o efeito e devolve o cancelamento das levas defasadas DELE. Três
  // receitas encadeiam levas com setTimeout, e o canvas da lib é global: sem
  // isso, avançar a rodada dentro da janela (450 ms no rain, ~900 ms no
  // fireworks) deixa a leva pendente estourar por cima da tela seguinte —
  // confetti fantasma de uma celebração que já acabou. Quem dispara é quem
  // cancela; o VoteReveal chama no unmount.
  run: () => () => void
}

// Receita de leva única: nada fica agendado, nada há para cancelar.
const NOTHING_PENDING = () => {}

// Reproduz exatamente a animação anterior à feature: burst central + 2 canhões
// laterais. É também o fallback de TODA resolução que não acha implementação.
const CLASSIC: CelebrationImplementation = {
  run: () => {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } })
    const timer = setTimeout(() => {
      confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0 } })
      confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1 } })
    }, 250)
    return () => clearTimeout(timer)
  },
}

const FIREWORKS: CelebrationImplementation = {
  run: () => {
    const end = Date.now() + 800
    // A cadeia troca de handle a cada leva, então o cancelamento tem que ler a
    // ÚLTIMA agendada — guardar o primeiro setTimeout deixaria o resto vivo.
    let timer: ReturnType<typeof setTimeout> | undefined
    const volley = () => {
      confetti({
        particleCount: 25,
        spread: 360,
        startVelocity: 30,
        ticks: 90,
        origin: { x: Math.random(), y: Math.random() * 0.4 },
      })
      if (Date.now() < end) timer = setTimeout(volley, 150)
    }
    volley()
    return () => clearTimeout(timer)
  },
}

// startVelocity 0 + gravidade fraca fazia a leva NASCER acima da tela e morrer
// antes de aparecer — "chuva que não se via". A receita dispara três frentes já
// na borda superior, com velocidade de queda real e vida longa o bastante para
// atravessar a viewport.
//
// O `angle` negativo não é decoração: o default da canvas-confetti é 90, que na
// conta dela (`y += sin(-angle) * velocity`) empurra a partícula para CIMA.
// Nascendo em y negativo e sendo lançada para cima, um terço da vida era gasto
// ainda fora da tela e a leva entrava já apagada — o fade é linear no tick.
// Medido nas fórmulas da lib em 1920×1080: 70% da vida visível e opacidade 0,70
// na entrada com o default, contra 97% e 0,97 apontando para baixo.
const RAIN: CelebrationImplementation = {
  run: () => {
    for (const x of [0.16, 0.5, 0.84]) {
      confetti({
        particleCount: 60,
        spread: 120,
        angle: -90,
        startVelocity: 18,
        gravity: 0.9,
        ticks: 320,
        scalar: 1.05,
        origin: { x, y: -0.1 },
      })
    }
    // Segunda leva, defasada, com drift: sustenta a chuva em vez de ser uma
    // rajada única — e a variância de x tira o efeito de "três jatos iguais".
    const timer = setTimeout(() => {
      for (const x of [0.32, 0.68]) {
        confetti({
          particleCount: 55,
          spread: 130,
          angle: -90,
          startVelocity: 16,
          gravity: 0.9,
          ticks: 320,
          scalar: 1.05,
          drift: 0.8,
          origin: { x, y: -0.1 },
        })
      }
    }, 450)
    return () => clearTimeout(timer)
  },
}

// Como o classic sem o burst central: só os dois canhões, um de cada lado.
const CANNONS: CelebrationImplementation = {
  run: () => {
    confetti({ particleCount: 80, angle: 60, spread: 60, origin: { x: 0, y: 0.7 } })
    confetti({ particleCount: 80, angle: 120, spread: 60, origin: { x: 1, y: 0.7 } })
    return NOTHING_PENDING
  },
}

const BLAST: CelebrationImplementation = {
  run: () => {
    confetti({ particleCount: 220, spread: 120, startVelocity: 45, origin: { y: 0.55 } })
    return NOTHING_PENDING
  },
}

const STARS: CelebrationImplementation = {
  run: () => {
    confetti({
      particleCount: 90,
      spread: 90,
      origin: { y: 0.6 },
      colors: ['#FFD166', '#FFF3B0', '#F4A259'],
      shapes: ['star'],
      scalar: 1.4,
    })
    return NOTHING_PENDING
  },
}

// Naipes vermelhos e pretos mantêm a cor da verdade. shapeFromText rasteriza o
// glifo (a cor nasce assada na shape, e o scalar aqui precisa bater com o
// scalar do confetti para não borrar — aviso do README da lib).
const SUITS: CelebrationImplementation = {
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
    return NOTHING_PENDING
  },
}

// O vocabulário inteiro tem entrada aqui. `Partial` fica de propósito, mas NÃO
// é ele que cobre a janela de deploy: um id que este cliente não conhece nem
// chega a indexar este mapa, porque `isKnownCelebration` barra antes. O `??`
// abaixo cobre outra coisa — um id ENTRAR em CELEBRATIONS sem entrada aqui, que
// é erro de quem edita, não de deploy. Quem impede esse ramo de virar rotina é
// o it.each de identidade no registry.spec.
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
// borda aqui é o broadcast da rede, que não passa por zod: um servidor mais novo
// pode sortear um id que este vocabulário ainda não conhece (a janela "server
// antes do cliente"), e um servidor mais velho pode sortear um que já saiu daqui
// — foi o caso das quatro sprites retiradas. Os call-sites tipados seguem
// passando Celebration; o alargamento é só para a entrada de rede ser
// honestamente tratável, e testável, sem cast.
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
