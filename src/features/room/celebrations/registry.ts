import confetti from 'canvas-confetti'
import { CELEBRATIONS } from '@/types'
import type { Celebration } from '@/types'

interface ConfettiImplementation {
  kind: 'confetti'
  run: () => void
}

// Um momento de confetti disparado pelo CelebrationStage em um ponto da
// trajetória da sprite (trilha do foguete, respingo do golfinho, pop dos
// balões). É o casamento dos dois mecanismos: DOM para o personagem, canvas
// para o espetáculo em volta dele.
interface CelebrationAccent {
  atMs: number
  fire: () => void
}

// Sprites: personagem gigante varrendo a tela com scrim próprio e acentos
// coreografados. `art` escolhe o desenho SVG (SpriteArt) — arte vetorial com
// PARTES animadas (chama, barbatana, balanço), não um emoji estático; `path`
// é a coreografia do deslocamento; `sizeVmin` é o tamanho do personagem;
// `scrim` é o cenário atrás. Nada aqui é contrato de rede: o sorteio só
// entrega o id.
export interface SpriteImplementation {
  kind: 'sprite'
  art: 'dolphin' | 'rocket' | 'cards' | 'balloons'
  path: 'arc' | 'rise' | 'launch' | 'flip'
  sizeVmin: number
  durationMs: number
  scrim?: 'dark' | 'sea' | 'felt' | 'sky'
  accents: CelebrationAccent[]
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

// startVelocity 0 + gravidade fraca fazia a leva NASCER acima da tela e
// morrer antes de aparecer — "chuva que não se via". A receita agora dispara
// três frentes já na borda superior, com velocidade de queda real e vida
// longa o bastante para atravessar a viewport.
const RAIN: ConfettiImplementation = {
  kind: 'confetti',
  run: () => {
    for (const x of [0.16, 0.5, 0.84]) {
      confetti({
        particleCount: 95,
        spread: 120,
        startVelocity: 18,
        gravity: 0.9,
        ticks: 320,
        scalar: 1.05,
        origin: { x, y: -0.1 },
      })
    }
    // Segunda leva, defasada, com drift: sustenta a chuva em vez de ser uma
    // rajada única — e a variância de x tira o efeito de "três jatos iguais".
    setTimeout(() => {
      for (const x of [0.32, 0.68]) {
        confetti({
          particleCount: 80,
          spread: 130,
          startVelocity: 16,
          gravity: 0.9,
          ticks: 320,
          scalar: 1.05,
          drift: 0.8,
          origin: { x, y: -0.1 },
        })
      }
    }, 450)
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

// As 4 sprites, em modo espetáculo: personagem gigante, cenário (scrim) e
// trilha de confetti coreografada nos momentos-chave da trajetória. Emoji cru
// por decisão do plano — Lucide monocromático não celebra nada. Dependem da
// fonte do SO; cada OS desenha o seu (risco 3 aceito).
const FIRE = ['#F97316', '#FBBF24', '#FDE68A']
const OCEAN = ['#38BDF8', '#0EA5E9', '#E0F2FE']
const POKER = ['#DC2626', '#111827', '#F8FAFC']
const PARTY = ['#EF4444', '#FCA5A5', '#B91C1C']

function burst(
  atMs: number,
  origin: { x: number; y: number },
  colors: string[],
  opts: {
    count?: number
    spread?: number
    startVelocity?: number
    angle?: number
    gravity?: number
    scalar?: number
  } = {},
): CelebrationAccent {
  return {
    atMs,
    fire: () =>
      confetti({
        particleCount: opts.count ?? 24,
        spread: opts.spread ?? 55,
        startVelocity: opts.startVelocity ?? 26,
        angle: opts.angle ?? 90,
        gravity: opts.gravity ?? 1,
        scalar: opts.scalar ?? 1.1,
        origin,
        colors,
      }),
  }
}

const DOLPHIN: SpriteImplementation = {
  kind: 'sprite',
  art: 'dolphin',
  path: 'arc',
  sizeVmin: 28,
  durationMs: 2800,
  scrim: 'sea',
  // O respingo tem que cair onde o golfinho ENCOSTA na água: os keyframes de
  // sprite-arc voltam à linha d'água em 47% e 88% da duração (mais a saída, no
  // começo). Acento em cima do ápice é espuma no ar.
  accents: [
    burst(190, { x: 0.05, y: 0.62 }, OCEAN, { count: 14 }),
    burst(1320, { x: 0.48, y: 0.62 }, OCEAN, { count: 24, scalar: 1.15 }),
    burst(2470, { x: 0.84, y: 0.62 }, OCEAN, { count: 32, scalar: 1.25 }),
  ],
}

const ROCKET: SpriteImplementation = {
  kind: 'sprite',
  art: 'rocket',
  path: 'launch',
  sizeVmin: 34,
  durationMs: 2600,
  scrim: 'dark',
  // A trilha segue a diagonal de sprite-launch (canto de baixo à esquerda →
  // canto de cima à direita), medida numa tela deitada de proporção comum: as
  // origens do canvas-confetti são fração da viewport, não do sprite, então
  // mudar a trajetória obriga a re-marcar cada acento.
  accents: [
    burst(560, { x: 0.25, y: 0.82 }, FIRE, {
      count: 12,
      spread: 40,
      startVelocity: 12,
      scalar: 0.8,
    }),
    burst(1000, { x: 0.34, y: 0.66 }, FIRE, {
      count: 14,
      spread: 40,
      startVelocity: 12,
      scalar: 0.9,
    }),
    burst(1440, { x: 0.44, y: 0.51 }, FIRE, { count: 16, spread: 40, startVelocity: 12 }),
    burst(1900, { x: 0.55, y: 0.31 }, FIRE, {
      count: 16,
      spread: 40,
      startVelocity: 12,
      scalar: 1.05,
    }),
    // O boom no ápice une as duas linguagens favoritas da casa: explosão +
    // estrelas douradas (a variante stars, elogiada na revisão).
    {
      atMs: 2250,
      fire: () => {
        confetti({
          particleCount: 140,
          spread: 360,
          startVelocity: 45,
          origin: { x: 0.64, y: 0.16 },
          colors: FIRE,
        })
        confetti({
          particleCount: 60,
          spread: 110,
          origin: { x: 0.64, y: 0.16 },
          colors: ['#FFD166', '#FFF3B0'],
          shapes: ['star'],
          scalar: 1.6,
        })
      },
    },
  ],
}

// O flip no centro é o clímax; a chuva de naipes cai quando a carta "abre".
const CARDS: SpriteImplementation = {
  kind: 'sprite',
  art: 'cards',
  path: 'flip',
  sizeVmin: 58,
  durationMs: 3400,
  scrim: 'felt',
  accents: [
    burst(1150, { x: 0.5, y: 0.3 }, POKER, {
      count: 50,
      spread: 150,
      startVelocity: 14,
      scalar: 1.3,
    }),
    // Em 2450ms o leque já saiu pela direita (sprite-flip começa a varredura em
    // 38%): a segunda chuva acompanha a partida, não o vazio.
    burst(1800, { x: 0.62, y: 0.34 }, POKER, {
      count: 40,
      spread: 170,
      startVelocity: 12,
      scalar: 1.2,
    }),
  ],
}

// Cada pop acontece com o trio AINDA visível na subida — se o acento atrasar
// demais, vira confetti órfão sem balão em cena. E o x segue os TRÊS balões
// dentro do sprite (que ocupa ~25% da largura a partir de left: 22%), não a
// largura da tela.
const BALLOONS: SpriteImplementation = {
  kind: 'sprite',
  art: 'balloons',
  path: 'rise',
  sizeVmin: 44,
  durationMs: 2900,
  scrim: 'sky',
  accents: [
    burst(1250, { x: 0.27, y: 0.4 }, PARTY, { count: 34 }),
    burst(1500, { x: 0.35, y: 0.27 }, PARTY, { count: 34 }),
    burst(1750, { x: 0.43, y: 0.15 }, PARTY, { count: 34 }),
  ],
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
