<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale,
} from 'chart.js'
import type { SessionHistory } from '@/stores/history'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const props = defineProps<{
  session: SessionHistory
}>()

// Type guard em vez de cast `as number[]` (regra do projeto: sem casts).
const isNumber = (v: string | number): v is number => typeof v === 'number'

// Baralho não-numérico (ex.: T-Shirt) não tem média que faça sentido — sem isto o
// gráfico vira uma linha de zeros (enganosa). Detectamos e escondemos (ver template).
const hasNumericVotes = computed(() =>
  props.session.rounds.some((round) => Object.values(round.votes).some(isNumber)),
)

// Distingue "sem votos" de "baralho não-numérico" — sem isto, uma sessão vazia
// mostraria a mensagem de não-numérico (imprecisa).
const hasAnyVotes = computed(() =>
  props.session.rounds.some((round) => Object.keys(round.votes).length > 0),
)

const chartData = computed(() => {
  const labels = props.session.rounds.map((r, i) => `R${i + 1}: ${r.subject}`)

  const data = props.session.rounds.map((round) => {
    const numericVotes = Object.values(round.votes).filter(isNumber)
    if (numericVotes.length === 0) return 0
    const sum = numericVotes.reduce((acc, curr) => acc + curr, 0)
    return sum / numericVotes.length
  })

  return {
    labels,
    datasets: [
      {
        label: 'Média de Votos',
        backgroundColor: '#4ade80', // primary green
        data,
      },
    ],
  }
})

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    title: {
      display: true,
      text: 'Média das Estimativas por Rodada',
    },
  },
  scales: {
    y: { beginAtZero: true },
  },
}
</script>

<template>
  <div class="chart-wrapper">
    <Bar v-if="hasNumericVotes" :data="chartData" :options="chartOptions" />
    <p v-else-if="!hasAnyVotes" class="chart-empty">Ainda não há votos nesta sessão.</p>
    <p v-else class="chart-empty">Gráfico de média indisponível para baralhos não-numéricos.</p>
  </div>
</template>

<style scoped>
.chart-wrapper {
  position: relative;
  height: 300px;
  width: 100%;
}

.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  margin: 0;
  padding: var(--space-4);
  color: var(--c-text-mute);
  font-size: var(--text-sm);
  text-align: center;
}
</style>
