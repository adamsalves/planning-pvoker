<script setup lang="ts">
import { ref } from 'vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseInput from '@/components/BaseInput.vue'

const emit = defineEmits<{
  submit: [subject: string]
}>()

const subject = ref('')
const error = ref('')

function handleSubmit() {
  if (subject.value.trim().length < 2) {
    error.value = 'O subject deve ter pelo menos 2 caracteres'
    return
  }
  error.value = ''
  emit('submit', subject.value.trim())
  subject.value = ''
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="subject-form">
    <BaseInput
      v-model="subject"
      label="Subject da rodada"
      placeholder="Ex: Implementar endpoint de login"
      :error="error"
      required
    />
    <BaseButton type="submit" size="md"> ▶️ Iniciar Votação </BaseButton>
  </form>
</template>

<style scoped>
.subject-form {
  display: flex;
  gap: var(--space-3);
  align-items: flex-end;
}

.subject-form :deep(.base-input-wrapper) {
  flex: 1;
}
</style>
