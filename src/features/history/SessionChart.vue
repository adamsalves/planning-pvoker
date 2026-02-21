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

const chartData = computed(() => {
  const labels = props.session.rounds.map((r, i) => `R${i + 1}: ${r.subject}`)

  const data = props.session.rounds.map((round) => {
    const votes = Object.values(round.votes)
    const numericVotes = votes.filter((v) => typeof v === 'number') as number[]
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
    <Bar :data="chartData" :options="chartOptions" />
  </div>
</template>

<style scoped>
.chart-wrapper {
  position: relative;
  height: 300px;
  width: 100%;
}
</style>
