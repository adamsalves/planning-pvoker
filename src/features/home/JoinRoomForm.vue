<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import BaseInput from '@/components/BaseInput.vue'
import { useRoom } from '@/composables/useRoom'
import { getJoinErrorMessage } from '@/composables/joinErrors'
import { JOINABLE_ROLES } from '@/types'

// Código pré-preenchido quando o usuário chega por link de convite (?room=...).
// O HomeView lê a query, decide a aba e repassa o valor já normalizado aqui.
const props = defineProps<{ initialRoomCode?: string }>()

const { joinRoom } = useRoom()

// Estado de envio próprio deste form (ver nota no CreateRoomForm).
const submitting = ref(false)
const submitError = ref('')

const joinSchema = toTypedSchema(
  z.object({
    playerName: z
      .string()
      .min(2, 'Nome deve ter pelo menos 2 caracteres')
      .max(20, 'Nome deve ter no máximo 20 caracteres'),
    roomCode: z.string().min(1, 'Código da sala é obrigatório'),
    role: z.enum(JOINABLE_ROLES),
  }),
)

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: joinSchema,
  initialValues: {
    playerName: '',
    roomCode: props.initialRoomCode ?? '',
    role: JOINABLE_ROLES[0], // 'member' — inferido como JoinableRole, não string
  },
})

const [playerName, playerNameAttrs] = defineField('playerName')
const [roomCode, roomCodeAttrs] = defineField('roomCode')
const [role, roleAttrs] = defineField('role')

const onSubmit = handleSubmit(async (values) => {
  // values.role já é "member" | "observer" — sem cast!
  submitError.value = ''
  submitting.value = true
  try {
    await joinRoom(values.playerName, values.roomCode, values.role)
  } catch (error) {
    submitError.value = getJoinErrorMessage(error)
  } finally {
    submitting.value = false
  }
})
</script>

<template>
  <BaseCard class="form-card">
    <form @submit.prevent="onSubmit" class="form">
      <BaseInput
        v-model="playerName"
        v-bind="playerNameAttrs"
        label="Seu nome"
        placeholder="Ex: Maria"
        :error="errors.playerName"
        required
      />

      <BaseInput
        v-model="roomCode"
        v-bind="roomCodeAttrs"
        label="Código da sala"
        placeholder="Ex: a1b2c3d4"
        :error="errors.roomCode"
        required
      />

      <div class="field-group">
        <label class="field-label">Entrar como</label>
        <div class="role-options">
          <label :class="['role-option', { selected: role === 'member' }]">
            <input type="radio" value="member" v-model="role" v-bind="roleAttrs" class="sr-only" />
            <span class="role-icon">🃏</span>
            <span class="role-label">Jogador</span>
            <span class="role-desc">Vota nas estimativas</span>
          </label>

          <label :class="['role-option', { selected: role === 'observer' }]">
            <input
              type="radio"
              value="observer"
              v-model="role"
              v-bind="roleAttrs"
              class="sr-only"
            />
            <span class="role-icon">👁️</span>
            <span class="role-label">Espectador</span>
            <span class="role-desc">Apenas assiste</span>
          </label>
        </div>
      </div>

      <p v-if="submitError" class="session-notice" role="alert">⚠️ {{ submitError }}</p>
      <BaseButton type="submit" size="lg" block :loading="submitting">
        🔗 Entrar na Sala
      </BaseButton>
    </form>
  </BaseCard>
</template>

<style scoped>
/* Shell do formulário (compartilhado com o CreateRoomForm): mantido local em cada
   form para que os componentes fiquem autocontidos com seu próprio CSS scoped.
   ~pequena duplicação consciente, mesmo trade-off do RoomSetup/RoomVoting (F3.3). */
.form-card {
  animation: slideUp var(--transition-normal);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--c-text-soft);
}

.session-notice {
  margin-bottom: var(--space-4);
  padding: var(--space-3) var(--space-4);
  background: rgba(239, 68, 68, 0.1);
  color: var(--c-danger);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  text-align: center;
  animation: slideUp var(--transition-normal);
}

/* Role Options */
.role-options {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.role-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-4);
  border: 2px solid var(--c-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
  text-align: center;
}

.role-option:hover {
  border-color: var(--c-border-hover);
}

.role-option.selected {
  border-color: var(--c-primary);
  background: var(--c-primary-soft);
}

/* F2.6 — indicador de foco por teclado nos cartões de role: o input é .sr-only,
   então o anel vai no cartão-pai via :has(). Só :focus-visible (teclado), não no clique. */
.role-option:has(input:focus-visible) {
  outline: 2px solid var(--c-primary);
  outline-offset: 2px;
}

.role-icon {
  font-size: var(--text-2xl);
}

.role-label {
  font-weight: 600;
  font-size: var(--text-base);
  color: var(--c-text);
}

.role-desc {
  font-size: var(--text-xs);
  color: var(--c-text-mute);
}
</style>
