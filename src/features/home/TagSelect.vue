<script setup lang="ts">
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'
import { PLAYER_TAGS, type PlayerTag } from '@/types'

// Seletor de área (tag) do jogador, compartilhado pelos dois forms de entrada
// (CreateRoomForm/JoinRoomForm) — extraído para não duplicar markup + CSS.
// Opcional: a opção vazia binda `undefined` (NÃO string vazia), casando com o
// `z.enum(PLAYER_TAGS).optional()` do schema sem fricção de '' fora do enum.
const model = defineModel<PlayerTag | undefined>()

const { t } = useI18n()
// useId(): id estável por instância p/ associar o <label> ao <select> (como BaseInput).
const selectId = useId()
</script>

<template>
  <div class="tag-field">
    <label :for="selectId" class="field-label">{{ t('home.tagLabel') }}</label>
    <select :id="selectId" v-model="model" class="tag-select" v-bind="$attrs">
      <option :value="undefined">{{ t('home.tagNone') }}</option>
      <option v-for="tagOption in PLAYER_TAGS" :key="tagOption" :value="tagOption">
        {{ t(`tags.${tagOption}`) }}
      </option>
    </select>
  </div>
</template>

<script lang="ts">
// inheritAttrs false: os attrs do vee-validate (onChange/onBlur/name) passados
// pelo form vão direto no <select>, não no wrapper.
export default {
  inheritAttrs: false,
}
</script>

<style scoped>
.tag-field {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.field-label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--c-text-soft);
}

/* <select> nativo estilizado com os tokens do tema, largura total como os BaseInput. */
.tag-select {
  width: 100%;
  padding: var(--space-3) var(--space-4);
  border: 2px solid var(--c-border);
  border-radius: var(--radius-lg);
  background: var(--c-bg);
  color: var(--c-text);
  font-family: inherit;
  font-size: var(--text-base);
  cursor: pointer;
  transition: border-color var(--transition-fast);
}

.tag-select:hover {
  border-color: var(--c-border-hover);
}

.tag-select:focus-visible {
  outline: 2px solid var(--c-primary);
  outline-offset: 2px;
  border-color: var(--c-primary);
}
</style>
