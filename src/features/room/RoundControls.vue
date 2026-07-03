<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/BaseButton.vue'

interface Props {
  status: 'waiting' | 'voting' | 'revealed'
  allVoted: boolean
  isLastSubject: boolean
}

defineProps<Props>()

const emit = defineEmits<{
  reveal: []
  nextRound: []
  finish: []
}>()

const { t } = useI18n()
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
      {{ t('room.controls.reveal') }}
      <span v-if="allVoted" class="hint">{{ t('room.controls.allVotedHint') }}</span>
    </BaseButton>

    <!-- Após revelar: botão de próximo ou finalizar -->
    <BaseButton
      v-if="status === 'revealed' && !isLastSubject"
      variant="secondary"
      size="lg"
      block
      @click="emit('nextRound')"
    >
      {{ t('room.controls.next') }}
    </BaseButton>

    <BaseButton
      v-if="status === 'revealed' && isLastSubject"
      variant="primary"
      size="lg"
      block
      @click="emit('finish')"
    >
      {{ t('room.controls.finish') }}
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
