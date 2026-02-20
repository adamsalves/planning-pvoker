<script setup lang="ts">
interface Props {
  subject: string
  roundNumber: number
  totalRounds: number
  status: 'waiting' | 'voting' | 'revealed'
}

defineProps<Props>()

const statusLabels = {
  waiting: { text: 'Aguardando subject', color: 'var(--c-text-mute)' },
  voting: { text: 'Votação em andamento', color: 'var(--c-primary)' },
  revealed: { text: 'Votos revelados', color: 'var(--c-success)' },
}
</script>

<template>
  <div class="round-header">
    <div class="round-info">
      <span class="round-badge">Rodada {{ roundNumber }}/{{ totalRounds }}</span>
      <span class="round-status" :style="{ color: statusLabels[status].color }">
        {{ statusLabels[status].text }}
      </span>
    </div>
    <h3 class="round-subject">{{ subject }}</h3>
  </div>
</template>

<style scoped>
.round-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-5);
  background: var(--c-bg-mute);
  border-radius: var(--radius-lg);
}

.round-info {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.round-badge {
  font-size: var(--text-xs);
  font-weight: 600;
  padding: 2px var(--space-2);
  background: var(--c-primary-soft);
  color: var(--c-primary);
  border-radius: var(--radius-full);
}

.round-status {
  font-size: var(--text-sm);
  font-weight: 500;
}

.round-subject {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--c-text);
  margin: 0;
}
</style>
