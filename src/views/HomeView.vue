<script setup lang="ts">
import { ref } from 'vue'
import { useRoute } from 'vue-router'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { z } from 'zod'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import BaseInput from '@/components/BaseInput.vue'
import { useRoom } from '@/composables/useRoom'
import { getJoinErrorMessage } from '@/composables/joinErrors'
import { DECKS, DECK_TYPES, JOINABLE_ROLES } from '@/types'

// Tab state: 'create' ou 'join'
const activeTab = ref<'create' | 'join'>('create')

const route = useRoute()
const { createRoom, joinRoom } = useRoom()

// Estado de envio compartilhado pelos dois forms (só um fica visível por vez):
// trava o botão (evita double-submit no cold start) e guarda a mensagem de erro.
const submitting = ref(false)
const submitError = ref('')

function setTab(tab: 'create' | 'join') {
  activeTab.value = tab
  submitError.value = ''
}

// --- FORMULÁRIO: Criar Sala ---
// O z.enum() usa a mesma constante que define o tipo DeckType
// Assim o Zod infere exatamente "fibonacci" | "tshirt" | "sequential" — sem necessidade de `as`
const createSchema = toTypedSchema(
  z.object({
    playerName: z
      .string()
      .min(2, 'Nome deve ter pelo menos 2 caracteres')
      .max(20, 'Nome deve ter no máximo 20 caracteres'),
    deckType: z.enum(DECK_TYPES),
    autoReveal: z.boolean(),
  }),
)

const {
  handleSubmit: handleCreateSubmit,
  errors: createErrors,
  defineField: defineCreateField,
} = useForm({
  validationSchema: createSchema,
  initialValues: {
    playerName: '',
    deckType: DECK_TYPES[0], // 'fibonacci' — inferido como DeckType, não string
    autoReveal: false,
  },
})

const [createPlayerName, createPlayerNameAttrs] = defineCreateField('playerName')
const [createDeckType, createDeckTypeAttrs] = defineCreateField('deckType')
const [createAutoReveal, createAutoRevealAttrs] = defineCreateField('autoReveal')

const onCreateRoom = handleCreateSubmit(async (values) => {
  // values.deckType já é DeckType — sem cast!
  submitError.value = ''
  submitting.value = true
  try {
    await createRoom(values.playerName, values.deckType, values.autoReveal)
  } catch (error) {
    submitError.value = getJoinErrorMessage(error)
  } finally {
    submitting.value = false
  }
})

// --- FORMULÁRIO: Entrar na Sala ---
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

const {
  handleSubmit: handleJoinSubmit,
  errors: joinErrors,
  defineField: defineJoinField,
} = useForm({
  validationSchema: joinSchema,
  initialValues: {
    playerName: '',
    roomCode: '',
    role: JOINABLE_ROLES[0], // 'member' — inferido como JoinableRole, não string
  },
})

const [joinPlayerName, joinPlayerNameAttrs] = defineJoinField('playerName')
const [joinRoomCode, joinRoomCodeAttrs] = defineJoinField('roomCode')
const [joinRole, joinRoleAttrs] = defineJoinField('role')

const sharedRoomCode = Array.isArray(route.query.room) ? route.query.room[0] : route.query.room
if (typeof sharedRoomCode === 'string' && sharedRoomCode.trim().length > 0) {
  activeTab.value = 'join'
  joinRoomCode.value = sharedRoomCode.trim()
}

// Quando o RoomView devolve o usuário por sessão inválida/sala inexistente,
// explica o motivo em vez de mandá-lo para a home sem contexto.
const sessionExpired = route.query.notice === 'session-expired'

const onJoinRoom = handleJoinSubmit(async (values) => {
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
  <div class="home-container">
    <!-- Hero Section -->
    <div class="hero">
      <span class="hero-icon">🃏</span>
      <h1 class="hero-title">Planning Poker</h1>
      <p class="hero-subtitle">Estimativas ágeis com seu time, em tempo real</p>
    </div>

    <!-- Aviso de sessão expirada (redirecionado do RoomView) -->
    <p v-if="sessionExpired" class="session-notice" role="alert">
      ⚠️ Sua sessão expirou ou a sala não está mais disponível. Entre novamente.
    </p>

    <!-- Tab Switcher -->
    <div class="tab-switcher">
      <button :class="['tab-btn', { active: activeTab === 'create' }]" @click="setTab('create')">
        Criar Sala
      </button>
      <button :class="['tab-btn', { active: activeTab === 'join' }]" @click="setTab('join')">
        Entrar na Sala
      </button>
    </div>

    <!-- Forms -->
    <Transition name="tab" mode="out-in">
      <!-- CREATE ROOM FORM -->
      <BaseCard v-if="activeTab === 'create'" key="create" class="form-card">
        <form @submit.prevent="onCreateRoom" class="form">
          <BaseInput
            v-model="createPlayerName"
            v-bind="createPlayerNameAttrs"
            label="Seu nome"
            placeholder="Ex: João"
            :error="createErrors.playerName"
            required
          />

          <div class="field-group">
            <label class="field-label">Tipo de Baralho</label>
            <div class="deck-options">
              <label
                v-for="(deck, key) in DECKS"
                :key="key"
                :class="['deck-option', { selected: createDeckType === key }]"
              >
                <input
                  type="radio"
                  :value="key"
                  v-model="createDeckType"
                  v-bind="createDeckTypeAttrs"
                  class="sr-only"
                />
                <span class="deck-label">{{ deck.label }}</span>
                <span class="deck-values">{{ deck.values.join(', ') }}</span>
              </label>
            </div>
            <span v-if="createErrors.deckType" class="field-error">{{
              createErrors.deckType
            }}</span>
          </div>

          <div class="field-group">
            <label class="toggle-label">
              <input
                type="checkbox"
                v-model="createAutoReveal"
                v-bind="createAutoRevealAttrs"
                class="toggle-input sr-only"
              />
              <span class="toggle-switch"></span>
              <span class="toggle-text">Auto-revelar quando todos votarem</span>
            </label>
          </div>

          <p v-if="submitError" class="session-notice" role="alert">⚠️ {{ submitError }}</p>
          <BaseButton type="submit" size="lg" block :loading="submitting">
            🚀 Criar Sala
          </BaseButton>
        </form>
      </BaseCard>

      <!-- JOIN ROOM FORM -->
      <BaseCard v-else key="join" class="form-card">
        <form @submit.prevent="onJoinRoom" class="form">
          <BaseInput
            v-model="joinPlayerName"
            v-bind="joinPlayerNameAttrs"
            label="Seu nome"
            placeholder="Ex: Maria"
            :error="joinErrors.playerName"
            required
          />

          <BaseInput
            v-model="joinRoomCode"
            v-bind="joinRoomCodeAttrs"
            label="Código da sala"
            placeholder="Ex: a1b2c3d4"
            :error="joinErrors.roomCode"
            required
          />

          <div class="field-group">
            <label class="field-label">Entrar como</label>
            <div class="role-options">
              <label :class="['role-option', { selected: joinRole === 'member' }]">
                <input
                  type="radio"
                  value="member"
                  v-model="joinRole"
                  v-bind="joinRoleAttrs"
                  class="sr-only"
                />
                <span class="role-icon">🃏</span>
                <span class="role-label">Jogador</span>
                <span class="role-desc">Vota nas estimativas</span>
              </label>

              <label :class="['role-option', { selected: joinRole === 'observer' }]">
                <input
                  type="radio"
                  value="observer"
                  v-model="joinRole"
                  v-bind="joinRoleAttrs"
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
    </Transition>
  </div>
</template>

<style scoped>
.home-container {
  max-width: 520px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
}

/* Hero */
.hero {
  text-align: center;
  margin-bottom: var(--space-8);
  animation: slideUp var(--transition-normal);
}

.hero-icon {
  font-size: 4rem;
  display: block;
  margin-bottom: var(--space-4);
}

.hero-title {
  font-size: var(--text-3xl);
  font-weight: 800;
  letter-spacing: -1px;
  background: linear-gradient(135deg, var(--c-primary), var(--c-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: var(--space-2);
}

.hero-subtitle {
  color: var(--c-text-mute);
  font-size: var(--text-lg);
}

/* Aviso de sessão expirada */
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

/* Tab Switcher */
.tab-switcher {
  display: flex;
  background: var(--c-bg-mute);
  border-radius: var(--radius-lg);
  padding: var(--space-1);
  margin-bottom: var(--space-6);
}

.tab-btn {
  flex: 1;
  padding: var(--space-2) var(--space-4);
  border: none;
  background: transparent;
  border-radius: var(--radius-md);
  font-size: var(--text-base);
  font-weight: 500;
  color: var(--c-text-mute);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.tab-btn.active {
  background: var(--c-bg-soft);
  color: var(--c-text);
  box-shadow: var(--shadow-sm);
}

/* Form */
.form-card {
  animation: slideUp var(--transition-normal);
}

.form {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

/* Field Group */
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

.field-error {
  font-size: var(--text-sm);
  color: var(--c-danger);
}

/* Deck Options */
.deck-options {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.deck-option {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: var(--space-3) var(--space-4);
  border: 2px solid var(--c-border);
  border-radius: var(--radius-lg);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.deck-option:hover {
  border-color: var(--c-border-hover);
}

.deck-option.selected {
  border-color: var(--c-primary);
  background: var(--c-primary-soft);
}

.deck-label {
  font-weight: 600;
  font-size: var(--text-base);
  color: var(--c-text);
}

.deck-values {
  font-size: var(--text-sm);
  color: var(--c-text-mute);
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

/* F2.6 — indicador de foco por teclado nos cartões de deck/role: o input é .sr-only,
   então o anel vai no cartão-pai via :has(). Só :focus-visible (teclado), não no clique. */
.deck-option:has(input:focus-visible),
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

/* Toggle Switch */
.toggle-label {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  cursor: pointer;
}

.toggle-switch {
  position: relative;
  width: 44px;
  height: 24px;
  background: var(--c-border);
  border-radius: var(--radius-full);
  transition: background var(--transition-fast);
  flex-shrink: 0;
}

.toggle-switch::after {
  content: '';
  position: absolute;
  width: 18px;
  height: 18px;
  background: white;
  border-radius: 50%;
  top: 3px;
  left: 3px;
  transition: transform var(--transition-fast);
  box-shadow: var(--shadow-sm);
}

.toggle-input:checked + .toggle-switch {
  background: var(--c-primary);
}

.toggle-input:checked + .toggle-switch::after {
  transform: translateX(20px);
}

.toggle-input:focus-visible + .toggle-switch {
  outline: 2px solid var(--c-primary);
  outline-offset: 2px;
}

.toggle-text {
  font-size: var(--text-sm);
  color: var(--c-text-soft);
}

/* Tab Transition */
.tab-enter-active,
.tab-leave-active {
  transition:
    opacity var(--transition-fast),
    transform var(--transition-fast);
}

.tab-enter-from {
  opacity: 0;
  transform: translateX(10px);
}

.tab-leave-to {
  opacity: 0;
  transform: translateX(-10px);
}

/* Reuse slide animation from main.css */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
