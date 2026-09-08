<script setup lang="ts">
import type { SpriteImplementation } from './registry'

// Renderizador da DOM dos sprites (B1–B4 do plano). O tipo confetti não passa
// por aqui: roda direto no gatilho do VoteReveal — a lib cria o próprio canvas.
// Só existe sprite montado se o registry devolver uma implementação 'sprite'.
defineProps<{ implementation: SpriteImplementation }>()
</script>

<template>
  <span class="celebration-stage" aria-hidden="true">
    <span
      class="celebration-sprite"
      :data-path="implementation.path"
      :style="{ '--sprite-duration': `${implementation.durationMs}ms` }"
    >
      {{ implementation.emoji }}
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

/* Só transform + opacity: ficam no compositor, não disparam layout/paint
   (risco 4 do plano — o desfile de cartas tem que custar zero ao resto). O
   `forwards` segura o frame final, já fora da tela, até o VoteReveal desmontar. */
.celebration-sprite {
  position: absolute;
  top: 55%;
  left: -15vmax;
  font-size: var(--text-2xl);
  line-height: 1;
  white-space: nowrap;
  will-change: transform;
  opacity: 0;
}

.celebration-sprite[data-path='straight'] {
  animation: sprite-straight var(--sprite-duration) linear forwards;
}

.celebration-sprite[data-path='arc'] {
  animation: sprite-arc var(--sprite-duration) ease-in-out forwards;
}

.celebration-sprite[data-path='rise'] {
  top: auto;
  bottom: -12vmax;
  left: 8%;
  animation: sprite-rise var(--sprite-duration) ease-in forwards;
}

@keyframes sprite-straight {
  0% {
    transform: translate3d(0, 0, 0);
    opacity: 0;
  }
  8% {
    opacity: 1;
  }
  92% {
    opacity: 1;
  }
  100% {
    transform: translate3d(calc(100vw + 25vmax), -8vh, 0);
    opacity: 0;
  }
}

/* Golfinho cruzando em dois saltos: a componente X cresce linear, a Y faz as
   parábolas nos marcos de 25/50/75%. */
@keyframes sprite-arc {
  0% {
    transform: translate3d(0, 0, 0);
    opacity: 0;
  }
  8% {
    opacity: 1;
  }
  25% {
    transform: translate3d(28vw, -18vh, 0);
  }
  50% {
    transform: translate3d(56vw, 0, 0);
  }
  75% {
    transform: translate3d(84vw, -18vh, 0);
  }
  92% {
    opacity: 1;
  }
  100% {
    transform: translate3d(calc(100vw + 20vmax), 0, 0);
    opacity: 0;
  }
}

/* Balões subindo do rodapé com um leve balanço lateral. */
@keyframes sprite-rise {
  0% {
    transform: translate3d(0, 0, 0);
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  40% {
    transform: translate3d(3vw, -45vh, 0);
  }
  70% {
    transform: translate3d(-2vw, -80vh, 0);
  }
  90% {
    opacity: 1;
  }
  100% {
    transform: translate3d(1vw, -125vh, 0);
    opacity: 0;
  }
}

/* A animação inteira é decorativa e já nasce fora da tela; sob reduced-motion
   o VoteReveal nem monta o stage, então aqui só garantimos que um stage órfão
   (defensivo) não fique pulsando na tela. */
@media (prefers-reduced-motion: reduce) {
  .celebration-sprite {
    animation: none;
    opacity: 0;
  }
}
</style>
