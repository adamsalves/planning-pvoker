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
import { DECKS, DECK_TYPES } from '@/types'
import IconTriangleAlert from '~icons/lucide/triangle-alert'
import IconRocket from '~icons/lucide/rocket'

const { t } = useI18n()
const { createRoom } = useRoom()

// Estado de envio próprio deste form: trava o botão (evita double-submit no cold
// start) e guarda o erro. Antes era compartilhado no HomeView; cada form agora é
// autocontido e cuida da própria chamada assíncrona.
// F8: o erro é guardado como CHAVE i18n e traduzido no template — assim a
// mensagem acompanha a troca de idioma mesmo com o erro já na tela.
const submitting = ref(false)
const submitErrorKey = ref('')

// O z.enum() usa a mesma constante que define o tipo DeckType, então o Zod infere
// exatamente "fibonacci" | "tshirt" | "sequential" — sem necessidade de `as`.
// F8: as mensagens do schema são CHAVES i18n (traduzidas na renderização) — o
// schema fica estático, preservando a inferência de tipos do vee-validate, e a
// mensagem de erro visível reage à troca de idioma.
const createSchema = toTypedSchema(
  z.object({
    playerName: z.string().min(2, 'home.validation.nameMin').max(20, 'home.validation.nameMax'),
    deckType: z.enum(DECK_TYPES),
    autoReveal: z.boolean(),
  }),
)

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: createSchema,
  initialValues: {
    playerName: '',
    deckType: DECK_TYPES[0], // 'fibonacci' — inferido como DeckType, não string
    autoReveal: false,
  },
})

const [playerName, playerNameAttrs] = defineField('playerName')
const [deckType, deckTypeAttrs] = defineField('deckType')
const [autoReveal, autoRevealAttrs] = defineField('autoReveal')

const onSubmit = handleSubmit(async (values) => {
  // values.deckType já é DeckType — sem cast!
  submitErrorKey.value = ''
  submitting.value = true
  try {
    await createRoom(values.playerName, values.deckType, values.autoReveal)
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
        :placeholder="t('home.namePlaceholderCreate')"
        :error="errors.playerName ? t(errors.playerName) : undefined"
        required
      />

      <div class="field-group">
        <label class="field-label">{{ t('home.deckTypeLabel') }}</label>
        <div class="deck-options">
          <label
            v-for="(deck, key) in DECKS"
            :key="key"
            :class="['deck-option', { selected: deckType === key }]"
          >
            <input
              type="radio"
              :value="key"
              v-model="deckType"
              v-bind="deckTypeAttrs"
              class="sr-only"
            />
            <span class="deck-label">{{ t(`decks.${key}`) }}</span>
            <span class="deck-values">{{ deck.values.join(', ') }}</span>
          </label>
        </div>
        <span v-if="errors.deckType" class="field-error">{{ errors.deckType }}</span>
      </div>

      <div class="field-group">
        <label class="toggle-label">
          <input
            type="checkbox"
            v-model="autoReveal"
            v-bind="autoRevealAttrs"
            class="toggle-input sr-only"
          />
          <span class="toggle-switch"></span>
          <span class="toggle-text">{{ t('home.autoReveal') }}</span>
        </label>
      </div>

      <p v-if="submitErrorKey" class="session-notice" role="alert">
        <IconTriangleAlert aria-hidden="true" />
        {{ t(submitErrorKey) }}
      </p>
      <BaseButton type="submit" size="lg" block :loading="submitting">
        <IconRocket class="btn-icon" aria-hidden="true" />
        {{ t('home.createButton') }}
      </BaseButton>
    </form>
  </BaseCard>
</template>

<style scoped>
/* Shell do formulário (compartilhado com o JoinRoomForm): mantido local em cada
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

.field-error {
  font-size: var(--text-sm);
  color: var(--c-danger);
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

/* F2.6 — indicador de foco por teclado nos cartões de deck: o input é .sr-only,
   então o anel vai no cartão-pai via :has(). Só :focus-visible (teclado), não no clique. */
.deck-option:has(input:focus-visible) {
  outline: 2px solid var(--c-primary);
  outline-offset: 2px;
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
</style>
