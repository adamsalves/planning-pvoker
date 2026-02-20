<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <main class="app-container">
    <RouterView />
  </main>
</template>

<style scoped>
.app-container {
  min-height: 100vh;
  margin: 0 auto;
  max-width: 1200px;
  padding: 1rem;
}
</style>
