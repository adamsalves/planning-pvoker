<script setup lang="ts">
interface Props {
  subject: string
  roundNumber: number
  totalSubjects: number
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
      <span class="round-badge">Subject {{ roundNumber }}/{{ totalSubjects }}</span>
      <span class="round-status" :style="{ color: statusLabels[status].color }">
        {{ statusLabels[status].text }}
      </span>
    </div>
    <div class="progress-wrapper">
      <div class="progress-bar">
        <div
          class="progress-fill"
          :style="{ width: `${(roundNumber / totalSubjects) * 100}%` }"
        ></div>
      </div>
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

.progress-wrapper {
  width: 100%;
}

.progress-bar {
  height: 4px;
  background: var(--c-border);
  border-radius: var(--radius-full);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--c-primary);
  border-radius: var(--radius-full);
  transition: width var(--transition-normal);
}

.round-subject {
  font-size: var(--text-lg);
  font-weight: 600;
  color: var(--c-text);
  margin: 0;
}
</style>
