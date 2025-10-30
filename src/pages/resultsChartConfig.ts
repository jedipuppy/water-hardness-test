import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineController,
  LineElement,
  PointElement,
  Title as ChartTitle,
  Tooltip,
  LinearScale,
} from 'chart.js'
import { createErrorBarPlugin } from './resultsShared'

let isRegistered = false

export function ensureResultsChartsRegistered(): void {
  if (isRegistered) {
    return
  }
  const errorBarPlugin = createErrorBarPlugin()
  ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    LineController,
    BarElement,
    Tooltip,
    Legend,
    ChartTitle,
    errorBarPlugin,
  )
  isRegistered = true
}
