<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useConnectionStore } from '@/stores/connection'

// Overlay full-screen temático que mascara o cold start (~1 min) e as reconexões
// do backend no Render free. Dirigido pelo connection store; o RoomView trata
// erro REAL de sessão à parte — aqui é só "o servidor está acordando/voltando".
const connection = useConnectionStore()

// Aparição com debounce p/ não piscar em conexões rápidas, e tempo mínimo visível
// p/ não tremular se conectar logo após aparecer.
const SHOW_DELAY_MS = 500
const MIN_VISIBLE_MS = 1000
const ROTATE_MS = 2500

const visible = ref(false)
let showTimer: ReturnType<typeof setTimeout> | undefined
let hideTimer: ReturnType<typeof setTimeout> | undefined
let shownAt = 0

function clearVisibilityTimers() {
  if (showTimer) clearTimeout(showTimer)
  if (hideTimer) clearTimeout(hideTimer)
  showTimer = undefined
  hideTimer = undefined
}

watch(
  () => connection.isWaiting,
  (waiting) => {
    clearVisibilityTimers()
    if (waiting) {
      if (visible.value) return
      showTimer = setTimeout(() => {
        visible.value = true
        shownAt = Date.now()
      }, SHOW_DELAY_MS)
    } else if (visible.value) {
      const remaining = MIN_VISIBLE_MS - (Date.now() - shownAt)
      if (remaining <= 0) visible.value = false
      else hideTimer = setTimeout(() => (visible.value = false), remaining)
    }
  },
  { immediate: true },
)

// Copy rotativa — puramente decorativa (aria-hidden). O anúncio p/ leitores de tela
// é estável (ariaMessage), pra não tagarelar a cada rotação.
const ROTATING_COPY = [
  'Embaralhando as cartas…',
  'Preparando a mesa…',
  'Reunindo o time…',
  'Revisando as regras da sala…',
]
const DOWN_COPY = 'Isso está demorando mais que o normal, mas ainda estamos tentando…'

const copyIndex = ref(0)
let rotateTimer: ReturnType<typeof setInterval> | undefined

const message = computed(() =>
  connection.isDown ? DOWN_COPY : (ROTATING_COPY[copyIndex.value % ROTATING_COPY.length] ?? ''),
)

const ariaMessage = computed(() =>
  connection.isDown
    ? 'A conexão está demorando mais que o normal. Ainda tentando reconectar.'
    : 'Conectando ao servidor. Aguarde um momento.',
)

watch(visible, (isVisible) => {
  if (rotateTimer) {
    clearInterval(rotateTimer)
    rotateTimer = undefined
  }
  if (isVisible) {
    copyIndex.value = 0
    rotateTimer = setInterval(() => {
      copyIndex.value = (copyIndex.value + 1) % ROTATING_COPY.length
    }, ROTATE_MS)
  }
})

onUnmounted(() => {
  clearVisibilityTimers()
  if (rotateTimer) clearInterval(rotateTimer)
})
</script>

<template>
  <Transition name="overlay-fade">
    <div
      v-if="visible"
      class="connection-overlay"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div class="overlay-content">
        <div class="pp-card" aria-hidden="true">
          <div class="pp-card__inner">
            <span class="pp-card__suit">♠</span>
          </div>
        </div>
        <p class="overlay-message" aria-hidden="true">{{ message }}</p>
        <p class="sr-only">{{ ariaMessage }}</p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.connection-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000; /* acima do navbar (z-index: 40) */
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-6);
  /* fallback opaco p/ browsers sem color-mix; depois a versão translúcida + blur */
  background: var(--c-bg);
  background: color-mix(in srgb, var(--c-bg) 82%, transparent);
  backdrop-filter: blur(6px);
}

.overlay-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-5);
  text-align: center;
  animation: slideUp var(--transition-normal);
}

/* Carta de baralho temática (gradiente primary → secondary) */
.pp-card {
  width: 84px;
  height: 118px;
  perspective: 600px;
  animation: pp-float 2.4s ease-in-out infinite;
}

.pp-card__inner {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-xl);
  background: linear-gradient(145deg, var(--c-primary), var(--c-secondary));
  box-shadow: var(--shadow-lg);
  transform-style: preserve-3d;
  animation: pp-flip 2s linear infinite;
}

.pp-card__suit {
  font-size: var(--text-3xl);
  color: #fff;
  line-height: 1;
}

.overlay-message {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--c-text);
  max-width: 32ch;
  min-height: 1.6em; /* reserva a linha p/ a copy não pular ao trocar */
}

@keyframes pp-float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-12px);
  }
}

@keyframes pp-flip {
  from {
    transform: rotateY(0deg);
  }
  to {
    transform: rotateY(360deg);
  }
}

/* Transição de entrada/saída do overlay */
.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity var(--transition-normal);
}
.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}

/* Acessibilidade: sem animação para quem prefere movimento reduzido */
@media (prefers-reduced-motion: reduce) {
  .pp-card,
  .pp-card__inner {
    animation: none;
  }
  .overlay-content {
    animation: none;
  }
}
</style>
