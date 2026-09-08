<script setup lang="ts">
import { computed, watch, onMounted, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import IconPartyPopper from '~icons/lucide/party-popper'
import type { Celebration } from '@/types'
import { prefersReducedMotion } from '@/composables/matchMedia'
import { useVoteStats } from '@/composables/useVoteStats'
import { bannerMessageKey, resolvedImplementation } from './celebrations/registry'

interface Props {
  votes: Record<string, string | number>
  // Apenas jogadores ativos AGORA (sem observers). Omitir em recaps de rodadas
  // passadas: quem votou pode já ter saído e o denominador atual mentiria ("2/1").
  playerCount?: number
  celebrate?: boolean // dispara a celebração no consenso (default true); desligado no resumo
  // Sorteada pelo servidor. Omitida (rounds antigas, servidor pré-feature ou
  // recap sem campo) → 'classic', que é a animação que sempre existiu.
  celebration?: Celebration
}

const props = withDefaults(defineProps<Props>(), {
  celebrate: true,
})

const { t } = useI18n()

const resolvedCelebration = computed<Celebration>(() => props.celebration ?? 'classic')
const bannerMessage = computed(() => t(bannerMessageKey(resolvedCelebration.value)))

const hasCelebrated = ref(false)
// Cancelamento das levas defasadas da celebração em curso (ver o contrato de
// CelebrationImplementation). Fica fora do reactive de propósito: é um handle
// de efeito, ninguém renderiza a partir dele.
let cancelCelebration: (() => void) | undefined

// Estatísticas dos votos — fonte única (useVoteStats).
const { average, min, max, hasConsensus, consensusValue, distribution, maxCount, count } =
  useVoteStats(() => props.votes)

// A celebração é só canvas-confetti: a lib monta o próprio canvas em tela cheia,
// então roda no gatilho e não precisa de nada montado no template.
function startCelebration() {
  if (hasCelebrated.value || prefersReducedMotion()) return
  hasCelebrated.value = true
  cancelCelebration = resolvedImplementation(resolvedCelebration.value).run()
}

// Disparar na primeira renderização se houver consenso
onMounted(() => {
  if (props.celebrate && hasConsensus.value) startCelebration()
})

watch(hasConsensus, (newVal) => {
  if (props.celebrate && newVal) startCelebration()
})

// Avançar a rodada desmonta este componente (v-if no RoomVoting), mas o canvas
// da lib é global e sobrevive: sem cancelar, a leva ainda agendada estoura por
// cima da tela seguinte.
onBeforeUnmount(() => {
  cancelCelebration?.()
})
</script>

<template>
  <div class="vote-reveal animate-slide-up">
    <!-- Consensus Banner -->
    <div v-if="hasConsensus" class="consensus-banner">
      <IconPartyPopper class="consensus-icon" aria-hidden="true" />
      <strong>{{ bannerMessage }}</strong> {{ t('room.reveal.allVoted') }}
      <span class="consensus-value">{{ consensusValue }}</span>
    </div>

    <!-- Stats Grid -->
    <div class="stats-grid">
      <div v-if="average !== null" class="stat-card">
        <span class="stat-label">{{ t('stats.average') }}</span>
        <span class="stat-value">{{ average }}</span>
      </div>
      <div v-if="min !== null" class="stat-card">
        <span class="stat-label">{{ t('stats.min') }}</span>
        <span class="stat-value">{{ min }}</span>
      </div>
      <div v-if="max !== null" class="stat-card">
        <span class="stat-label">{{ t('stats.max') }}</span>
        <span class="stat-value">{{ max }}</span>
      </div>
      <div class="stat-card">
        <span class="stat-label">{{ t('stats.votes') }}</span>
        <span class="stat-value">{{
          playerCount != null ? `${count}/${playerCount}` : count
        }}</span>
      </div>
    </div>

    <!-- Distribution -->
    <div v-if="distribution.length > 0" class="distribution">
      <h4 class="distribution-title">{{ t('room.reveal.distribution') }}</h4>
      <div class="distribution-bars">
        <div v-for="item in distribution" :key="item.value" class="bar-row">
          <span class="bar-label">{{ item.value }}</span>
          <div class="bar-track">
            <div class="bar-fill" :style="{ width: `${(item.count / maxCount) * 100}%` }"></div>
          </div>
          <span class="bar-count">{{ item.count }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vote-reveal {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.consensus-banner {
  text-align: center;
  padding: var(--space-4);
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(99, 102, 241, 0.1));
  border: 1px solid var(--c-success);
  border-radius: var(--radius-lg);
  font-size: var(--text-lg);
  color: var(--c-text);
}

/* Verde do token semântico (inverte no dark, F3.9) para casar com a borda de
   sucesso do banner — o 🎉 que ele substitui já lia como "positivo". */
.consensus-icon {
  color: var(--c-success-text);
  margin-right: var(--space-1);
}

.consensus-value {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 36px;
  padding: 0 var(--space-2);
  background: var(--c-success);
  color: white;
  border-radius: var(--radius-md);
  font-weight: 700;
  margin-left: var(--space-1);
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: var(--space-3);
}

.stat-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3);
  background: var(--c-bg-mute);
  border-radius: var(--radius-lg);
}

.stat-label {
  font-size: var(--text-xs);
  font-weight: 500;
  color: var(--c-text-mute);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.stat-value {
  font-size: var(--text-2xl);
  font-weight: 800;
  color: var(--c-primary);
}

.distribution {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.distribution-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--c-text-mute);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin: 0;
}

.distribution-bars {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.bar-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.bar-label {
  min-width: 36px;
  font-weight: 600;
  text-align: center;
  color: var(--c-text);
  font-size: var(--text-sm);
}

.bar-track {
  flex: 1;
  height: 24px;
  background: var(--c-bg-mute);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--c-primary), var(--c-secondary));
  border-radius: var(--radius-full);
  transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 8px;
}

.bar-count {
  min-width: 24px;
  font-weight: 600;
  font-size: var(--text-sm);
  color: var(--c-text-soft);
  text-align: right;
}
</style>
