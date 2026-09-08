<script setup lang="ts">
import type { SpriteImplementation } from './registry'

// Renderizador da DOM dos sprites (B1–B4 do plano). O tipo confetti não passa
// por aqui: roda direto no gatilho do VoteReveal — a lib cria o próprio canvas.
// Só existe sprite montado se o registry devolver uma implementação 'sprite',
// o que acontece a partir do PR C (até lá, os 4 ids degradam para classic).
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

/* A animação em si (trajetória, timing) chega no PR C junto com as variantes;
   aqui o sprite só existe posicionado, fora da tela, sem pintar nada. */
.celebration-sprite {
  position: absolute;
  left: -10vmax;
  top: 50%;
  font-size: var(--text-2xl);
  will-change: transform;
}
</style>
