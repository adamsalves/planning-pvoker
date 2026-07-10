<script setup lang="ts">
import { ref } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import { useI18n } from 'vue-i18n'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import BaseInput from '@/components/BaseInput.vue'
import { useRoom } from '@/composables/useRoom'
import { getJoinErrorKey } from '@/composables/joinErrors'
import { JOINABLE_ROLES } from '@/types'

// Código pré-preenchido quando o usuário chega por link de convite (?room=...).
// O HomeView lê a query, decide a aba e repassa o valor já normalizado aqui.
const props = defineProps<{ initialRoomCode?: string }>()

const { t } = useI18n()
const { joinRoom } = useRoom()

// Estado de envio próprio deste form (ver nota no CreateRoomForm). F8: guarda a
// CHAVE i18n do erro; a tradução acontece no template.
const submitting = ref(false)
const submitErrorKey = ref('')

// F8: mensagens do schema são CHAVES i18n (ver nota no CreateRoomForm).
const joinSchema = toTypedSchema(
  z.object({
    playerName: z.string().min(2, 'home.validation.nameMin').max(20, 'home.validation.nameMax'),
    roomCode: z.string().min(1, 'home.validation.roomCodeRequired'),
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
  submitErrorKey.value = ''
  submitting.value = true
  try {
    await joinRoom(values.playerName, values.roomCode, values.role)
  } catch (error) {
    submitErrorKey.value = getJoinErrorKey(error)
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
        :label="t('home.nameLabel')"
        :placeholder="t('home.namePlaceholderJoin')"
        :error="errors.playerName ? t(errors.playerName) : undefined"
        required
      />

      <BaseInput
        v-model="roomCode"
        v-bind="roomCodeAttrs"
        :label="t('home.roomCodeLabel')"
        :placeholder="t('home.roomCodePlaceholder')"
        :error="errors.roomCode ? t(errors.roomCode) : undefined"
        required
      />

      <div class="field-group">
        <label class="field-label">{{ t('home.joinAsLabel') }}</label>
        <div class="role-options">
          <label :class="['role-option', { selected: role === 'member' }]">
            <input type="radio" value="member" v-model="role" v-bind="roleAttrs" class="sr-only" />
            <span class="role-icon">🃏</span>
            <span class="role-label">{{ t('home.roleMember') }}</span>
            <span class="role-desc">{{ t('home.roleMemberDesc') }}</span>
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
            <span class="role-label">{{ t('home.roleObserver') }}</span>
            <span class="role-desc">{{ t('home.roleObserverDesc') }}</span>
          </label>
        </div>
      </div>

      <p v-if="submitErrorKey" class="session-notice" role="alert">⚠️ {{ t(submitErrorKey) }}</p>
      <BaseButton type="submit" size="lg" block :loading="submitting">
        {{ t('home.joinButton') }}
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
