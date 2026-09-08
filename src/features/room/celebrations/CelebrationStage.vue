<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import type { SpriteImplementation } from './registry'
import SpriteArt from './SpriteArt.vue'

// Renderizador da DOM das sprites em modo espetáculo: um scrim (cenário atrás,
// animado SÓ em opacity), o personagem em SVG com partes animadas (SpriteArt)
// varrendo a tela e os acentos de confetti coreografados na timeline da
// trajetória. O tipo confetti não passa por aqui: roda direto no gatilho do
// VoteReveal.
const props = defineProps<{ implementation: SpriteImplementation }>()

// Timers dos acentos: o stage pode desmontar no meio da coreografia (rodada
// nova, reset) — limpar tudo no unmount é o que evita confetti fantasma
// pipocando numa celebração que já acabou.
let timers: ReturnType<typeof setTimeout>[] = []

onMounted(() => {
  timers = props.implementation.accents.map((accent) => setTimeout(accent.fire, accent.atMs))
})

onBeforeUnmount(() => {
  for (const timer of timers) clearTimeout(timer)
  timers = []
})
</script>

<template>
  <span class="celebration-stage" aria-hidden="true">
    <span
      v-if="implementation.scrim"
      class="celebration-scrim"
      :data-tone="implementation.scrim"
      :style="{ '--sprite-duration': `${implementation.durationMs + 900}ms` }"
    ></span>
    <span
      class="celebration-sprite"
      :data-path="implementation.path"
      :style="{
        '--sprite-duration': `${implementation.durationMs}ms`,
        '--sprite-size': `${implementation.sizeVmin}vmin`,
      }"
    >
      <SpriteArt :art="implementation.art" />
    </span>
  </span>
</template>

<style scoped>
.celebration-stage {
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  z-index: 40;
}

/* Scrim: gradiente ESTATICO; o que anima é só opacity (compositor). O delay
   0/900 extra segura o véu até o ultimo personagem sair. */
.celebration-scrim {
  position: absolute;
  inset: 0;
  opacity: 0;
  animation: scrim-fade var(--sprite-duration) ease forwards;
}

.celebration-scrim[data-tone='dark'] {
  background: radial-gradient(circle at 55% 45%, rgba(2, 6, 23, 0.5), rgba(2, 6, 23, 0.82));
}

.celebration-scrim[data-tone='sea'] {
  background: linear-gradient(
    to bottom,
    rgba(2, 6, 23, 0.45) 0%,
    rgba(2, 6, 23, 0.55) 58%,
    rgba(3, 105, 161, 0.75) 62%,
    rgba(2, 60, 102, 0.85) 100%
  );
}

.celebration-scrim[data-tone='felt'] {
  background: radial-gradient(circle at 50% 42%, rgba(22, 101, 52, 0.45), rgba(12, 58, 32, 0.82));
}

.celebration-scrim[data-tone='sky'] {
  background: linear-gradient(to bottom, rgba(76, 29, 149, 0.5), rgba(17, 12, 46, 0.8));
}

@keyframes scrim-fade {
  0% {
    opacity: 0;
  }
  8% {
    opacity: 1;
  }
  88% {
    opacity: 1;
  }
  100% {
    opacity: 0;
  }
}

.celebration-sprite {
  position: absolute;
  /* A arte em SVG preenche a largura; a altura acompanha o viewBox de cada
     personagem. O tamanho vem do registry (sizeVmin). */
  width: var(--sprite-size);
  will-change: transform;
  opacity: 0;
}

.celebration-sprite[data-path='arc'] {
  left: -22vmin;
  top: 58%;
  animation: sprite-arc var(--sprite-duration) ease-in-out forwards;
}

/* O desenho do foguete ja aponta 45 graus para cima e para a direita (e o eixo
   do proprio emoji), entao a trajetoria anda em vmin nos DOIS eixos: e o unico
   jeito de o deslocamento ficar paralelo ao bico em qualquer proporcao de tela.
   Com vw/vh o angulo mudaria junto com o formato da janela. */
.celebration-sprite[data-path='launch'] {
  left: 6%;
  bottom: -26vmin;
  animation: sprite-launch var(--sprite-duration) cubic-bezier(0.5, 0, 0.8, 0.55) forwards;
}

.celebration-sprite[data-path='flip'] {
  left: 50%;
  top: 50%;
  animation: sprite-flip var(--sprite-duration) ease-in-out forwards;
}

.celebration-sprite[data-path='rise'] {
  bottom: -14vmin;
  /* A ondulação lateral mora no translate3d do keyframe; o balanço e a
     defasagem do trio vivem dentro do SpriteArt (grupos com delay). */
  left: 22%;
  animation: sprite-rise var(--sprite-duration) ease-in forwards;
}

/* Foguete: pop-in pequeno e aceleracao pela diagonal — a entrada com overshoot
   de escala é o squash&stretch que dá peso ao lançamento, e a escala caindo no
   fim é o afastamento. */
@keyframes sprite-launch {
  0% {
    transform: translate3d(0, 0, 0) scale(0.4);
    opacity: 0;
  }
  10% {
    transform: translate3d(6vmin, -15vmin, 0) scale(1.08);
    opacity: 1;
  }
  22% {
    transform: translate3d(16vmin, -26vmin, 0) scale(1);
  }
  55% {
    transform: translate3d(48vmin, -57vmin, 0) scale(0.94);
  }
  85% {
    transform: translate3d(84vmin, -92vmin, 0) scale(0.82);
    opacity: 1;
  }
  100% {
    transform: translate3d(106vmin, -114vmin, 0) scale(0.72);
    opacity: 0;
  }
}

/* Golfinho: dois saltos, o segundo mais alto; some "na água" e o respingo é
   o acento de confetti na mesma marca de tempo. O sinal da rotacao acompanha a
   parabola — nariz para cima na subida (anti-horario), para baixo na queda —
   porque o desenho espelhado nada para a direita. */
@keyframes sprite-arc {
  0% {
    transform: translate3d(0, 0, 0) scale(0.3);
    opacity: 0;
  }
  6% {
    transform: translate3d(6vw, -6vh, 0) scale(1.08) rotate(-14deg);
    opacity: 1;
  }
  25% {
    transform: translate3d(30vw, -26vh, 0) scale(1) rotate(-6deg);
  }
  36% {
    transform: translate3d(41vw, -22vh, 0) scale(0.98) rotate(10deg);
  }
  47% {
    transform: translate3d(52vw, 4vh, 0) scale(0.96) rotate(18deg);
  }
  57% {
    transform: translate3d(62vw, -18vh, 0) scale(1) rotate(-12deg);
  }
  68% {
    transform: translate3d(72vw, -36vh, 0) scale(1.02) rotate(-5deg);
  }
  88% {
    transform: translate3d(88vw, 2vh, 0) scale(0.95) rotate(16deg);
    opacity: 1;
  }
  100% {
    transform: translate3d(100vw, 14vh, 0) scale(0.9) rotate(20deg);
    opacity: 0;
  }
}

/* Cartas: gira no centro (rotateY com leve overshoot de escala), segura, depois
   o leque atravessa. O perspective() dentro do transform é o que faz o giro
   virar carta virando de verdade — sem ele rotateY é só um achatamento lateral.
   Continua tudo em transform/opacity, no compositor. */
@keyframes sprite-flip {
  0% {
    transform: translate(-50%, -50%) perspective(900px) rotateY(-96deg) scale(0.5);
    opacity: 0;
  }
  14% {
    transform: translate(-50%, -50%) perspective(900px) rotateY(0deg) scale(1.12);
    opacity: 1;
  }
  20% {
    transform: translate(-50%, -50%) perspective(900px) rotateY(0deg) scale(1);
  }
  38% {
    transform: translate(-50%, -50%) perspective(900px) rotateY(0deg) scale(1);
    opacity: 1;
  }
  100% {
    transform: translate(calc(-50% + 120vw), -70%) perspective(900px) rotate(8deg) scale(0.9);
    opacity: 0;
  }
}

/* Balões: o trio sobe junto (o balanço individual é interno à arte) e fica
   visível até perto do fim — os pops da registry acontecem com eles em cena. */
@keyframes sprite-rise {
  0% {
    transform: translate3d(0, 0, 0) scale(0.4);
    opacity: 0;
  }
  8% {
    transform: translate3d(1vw, -8vh, 0) scale(1.05);
    opacity: 1;
  }
  34% {
    transform: translate3d(-1.5vw, -46vh, 0) scale(1);
  }
  58% {
    transform: translate3d(1.5vw, -82vh, 0) scale(1);
  }
  78% {
    transform: translate3d(-0.5vw, -108vh, 0) scale(0.98);
    opacity: 1;
  }
  90% {
    transform: translate3d(0, -124vh, 0) scale(0.94);
    opacity: 0;
  }
  100% {
    transform: translate3d(0, -132vh, 0);
    opacity: 0;
  }
}

/* Decorativa por natureza: sob reduced-motion o VoteReveal nem monta o stage;
   aqui é o guardatório defensivo para um stage órfão não piscar na tela. */
@media (prefers-reduced-motion: reduce) {
  .celebration-scrim,
  .celebration-sprite {
    animation: none;
    opacity: 0;
  }
}
</style>
