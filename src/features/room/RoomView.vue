<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const roomId = route.params.id
</script>

<template>
  <div>
    <h1>Sala {{ roomId }}</h1>
    <RouterLink to="/">Sair</RouterLink>
  </div>
</template>
