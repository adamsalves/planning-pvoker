<script setup lang="ts">
import { ref, computed } from 'vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseInput from '@/components/BaseInput.vue'

interface Props {
  subjects: string[]
  playerCount: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  add: [subject: string]
  remove: [index: number]
  start: []
}>()

const subject = ref('')
const error = ref('')

const canStart = computed(() => props.subjects.length >= 1 && props.playerCount >= 2)

function handleAdd() {
  if (subject.value.trim().length < 2) {
    error.value = 'O subject deve ter pelo menos 2 caracteres'
    return
  }
  error.value = ''
  emit('add', subject.value.trim())
  subject.value = ''
}
</script>

<template>
  <div class="subject-form">
    <form @submit.prevent="handleAdd" class="add-form">
      <BaseInput
        v-model="subject"
        label="Adicionar subject"
        placeholder="Ex: Implementar endpoint de login"
        :error="error"
      />
      <BaseButton type="submit" size="md">➕ Adicionar</BaseButton>
    </form>

    <!-- Subject Backlog List -->
    <div v-if="subjects.length > 0" class="backlog">
      <p class="backlog-title">📋 Backlog ({{ subjects.length }} subjects)</p>
      <ul class="backlog-list">
        <li v-for="(item, index) in subjects" :key="index" class="backlog-item">
          <span class="backlog-index">{{ index + 1 }}.</span>
          <span class="backlog-text">{{ item }}</span>
          <button class="remove-btn" @click="emit('remove', index)" title="Remover">✕</button>
        </li>
      </ul>
    </div>

    <!-- Empty state -->
    <div v-else class="empty-backlog">
      <p>Adicione os subjects que serão votados nesta sessão</p>
    </div>

    <!-- Start Session Button -->
    <div class="start-section">
      <BaseButton variant="primary" size="lg" block :disabled="!canStart" @click="emit('start')">
        ▶️ Iniciar Sessão de Votação
      </BaseButton>
      <p v-if="subjects.length > 0 && playerCount < 2" class="start-hint">
        ⏳ Aguardando mais jogadores entrarem na sala...
      </p>
    </div>
  </div>
</template>

<style scoped>
.subject-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.add-form {
  display: flex;
  gap: var(--space-3);
  align-items: flex-end;
}

.add-form :deep(.base-input-wrapper) {
  flex: 1;
}

.backlog {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.backlog-title {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--c-text-mute);
  margin: 0;
}

.backlog-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.backlog-item {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  padding: var(--space-2) var(--space-3);
  background: var(--c-bg-mute);
  border-radius: var(--radius-md);
  transition: background var(--transition-fast);
}

.backlog-item:hover {
  background: var(--c-bg-soft);
}

.backlog-index {
  font-size: var(--text-sm);
  font-weight: 600;
  color: var(--c-primary);
  min-width: 1.5rem;
}

.backlog-text {
  flex: 1;
  font-size: var(--text-sm);
}

.remove-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--c-text-mute);
  font-size: var(--text-sm);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  transition: all var(--transition-fast);
}

.remove-btn:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.empty-backlog {
  text-align: center;
  padding: var(--space-4);
  color: var(--c-text-mute);
  font-size: var(--text-sm);
  border: 2px dashed var(--c-border);
  border-radius: var(--radius-md);
}

.start-section {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.start-hint {
  text-align: center;
  font-size: var(--text-xs);
  color: var(--c-text-mute);
  margin: 0;
}
</style>
