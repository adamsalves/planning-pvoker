<script setup lang="ts">
import PokerCard from './PokerCard.vue'
import type { DeckType } from '@/types'
import { DECKS } from '@/types'

interface Props {
  deckType: DeckType
  selectedValue: string | number | null
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<{
  vote: [value: string | number]
}>()

function handleSelect(value: string | number) {
  emit('vote', value)
}
</script>

<template>
  <div class="voting-area">
    <p class="voting-label">Selecione sua estimativa:</p>
    <div class="cards-grid">
      <PokerCard
        v-for="value in DECKS[deckType].values"
        :key="String(value)"
        :value="value"
        :selected="selectedValue === value"
        :disabled="disabled"
        @select="handleSelect"
      />
    </div>
  </div>
</template>

<style scoped>
.voting-area {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.voting-label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--c-text-mute);
  margin: 0;
}

.cards-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
  justify-content: center;
}
</style>
