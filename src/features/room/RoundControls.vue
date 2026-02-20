<script setup lang="ts">
import BaseButton from '@/components/BaseButton.vue'

interface Props {
  status: 'waiting' | 'voting' | 'revealed'
  allVoted: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  reveal: []
  newRound: []
}>()
</script>

<template>
  <div class="round-controls">
    <!-- Durante votação: botão de revelar -->
    <BaseButton
      v-if="status === 'voting'"
      variant="primary"
      size="lg"
      block
      @click="emit('reveal')"
    >
      👁️ Revelar Votos
      <span v-if="allVoted" class="hint">(todos votaram!)</span>
    </BaseButton>

    <!-- Após revelar: botão de nova rodada -->
    <BaseButton
      v-if="status === 'revealed'"
      variant="secondary"
      size="lg"
      block
      @click="emit('newRound')"
    >
      🔄 Nova Rodada
    </BaseButton>
  </div>
</template>

<style scoped>
.round-controls {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.hint {
  font-size: var(--text-sm);
  font-weight: 400;
  opacity: 0.8;
  margin-left: var(--space-1);
}
</style>
