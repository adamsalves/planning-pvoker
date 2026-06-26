<script setup lang="ts">
import { onMounted } from 'vue'
import DefaultLayout from '@/layouts/DefaultLayout.vue'
import ConnectionOverlay from '@/components/ConnectionOverlay.vue'
import { useSocket } from '@/composables/useSocket'

// Pré-aquece o backend (Render free hiberna): abre o socket assim que a página
// carrega, então o servidor começa a acordar enquanto o usuário ainda digita o
// nome. O overlay cobre a espera; o RoomManager singleton evita conexões extras.
const { connect } = useSocket()
onMounted(() => connect())
</script>

<template>
  <DefaultLayout />
  <ConnectionOverlay />
</template>
