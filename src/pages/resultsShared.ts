import type {
  ChartDataset,
  ChartOptions,
  Plugin,
  TooltipItem,
} from 'chart.js'
import type { LinearScale } from 'chart.js'
import { ACTIVE_SAMPLES, TRUE_ORDER } from '../config'
import type { SampleId } from '../types'
import type {
  EstimatedHardnessAnalysis,
  PatternFrequency,
  SampleAverageRank,
} from '../utils/statistics'

export interface HistogramBin {
  label: string
  count: number
}

export interface ScatterPointDatum {
  x: number
  y: number
  sampleId: SampleId
  actualRank: number
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}

export interface ScatterDataset
  extends ChartDataset<'scatter', ScatterPointDatum[]> {
  errorBarColor?: string
  errorBarLineWidth?: number
  errorBarCapWidth?: number
}

export interface EstimatedScatterPoint {
  x: number
  y: number
  sampleId: SampleId
  sampleLabel: string
  submissionId: string
}

export interface EstimatedScatterPayload {
  chartData: {
    datasets: ChartDataset<'scatter', EstimatedScatterPoint[]>[]
  }
  bounds: { min: number; max: number } | null
}

export interface EstimatedHardnessDistributionPoint {
  x: string
  y: number
  sampleId: SampleId
  sampleLabel: string
  submissionId: string
}

export interface EstimatedHardnessDistributionPayload {
  chartData: {
    datasets: ChartDataset<'scatter', EstimatedHardnessDistributionPoint[]>[]
  }
  categories: string[]
}

export interface AverageRankTick {
  position: number
  label: string
  sampleId: SampleId
}

export interface AverageRankPayload {
  chartData: { datasets: ScatterDataset[] }
  ticks: AverageRankTick[]
}

export interface AverageRankScatterPayload {
  chartData: { datasets: ScatterDataset[] }
  xMin: number | null
  xMax: number | null
}

export function buildAverageRankPayload(
  averageRanks: SampleAverageRank[],
): AverageRankPayload {
  const entryMap = new Map<SampleId, SampleAverageRank>(
    averageRanks.map((entry) => [entry.sample.id, entry]),
  )

  const ticks: AverageRankTick[] = ACTIVE_SAMPLES.map((sample, index) => ({
    position: index + 1,
    label: sample.label,
    sampleId: sample.id,
  }))

  const points: ScatterPointDatum[] = ACTIVE_SAMPLES.flatMap((sample, index) => {
    const entry = entryMap.get(sample.id)
    if (!entry || entry.count === 0) {
      return []
    }
    const position = index + 1
    const yError = entry.stdError
    const yMin = Math.max(entry.averageRank - yError, 0)
    const yMax = Math.min(entry.averageRank + yError, TRUE_ORDER.length + 0.5)
    return [
      {
        x: position,
        y: entry.averageRank,
        sampleId: entry.sample.id,
        actualRank: entry.actualRank,
        xMin: position,
        xMax: position,
        yMin,
        yMax,
      } satisfies ScatterPointDatum,
    ]
  })

  const datasets: ScatterDataset[] = [
    {
      label: '平均回答順位',
      data: points,
      backgroundColor: '#2563eb',
      borderColor: '#1d4ed8',
      pointRadius: 6,
      errorBarColor: '#0f172a',
      errorBarLineWidth: 1.6,
      errorBarCapWidth: 9,
      parsing: false,
    },
  ]

  return {
    chartData: { datasets },
    ticks,
  }
}

export function buildAverageRankScatterPayload(
  averageRanks: SampleAverageRank[],
): AverageRankScatterPayload {
  let globalXMin = Number.POSITIVE_INFINITY
  let globalXMax = Number.NEGATIVE_INFINITY
  const points: ScatterPointDatum[] = averageRanks
    .filter((entry) => entry.count > 0)
    .map((entry) => {
      const x = entry.sample.hardness
      const xError = entry.sample.hardnessError ?? 0
      const yError = entry.stdError
      const yMin = Math.max(entry.averageRank - yError, 0)
      const yMax = Math.min(entry.averageRank + yError, TRUE_ORDER.length + 0.5)
      const xMinBound = x - xError
      const xMaxBound = x + xError
      globalXMin = Math.min(globalXMin, xMinBound)
      globalXMax = Math.max(globalXMax, xMaxBound)
      return {
        x,
        y: entry.averageRank,
        sampleId: entry.sample.id,
        actualRank: entry.actualRank,
        xMin: xMinBound,
        xMax: xMaxBound,
        yMin,
        yMax,
      }
    })
  const hasData = points.length > 0
  const datasets: ScatterDataset[] = [
    {
      label: '平均回答順位',
      data: points,
      backgroundColor: '#2563eb',
      borderColor: '#1d4ed8',
      pointRadius: 6,
      errorBarColor: '#0f172a',
      errorBarLineWidth: 1.6,
      errorBarCapWidth: 9,
      parsing: false,
    },
  ]
  return {
    chartData: { datasets },
    xMin: hasData ? globalXMin : null,
    xMax: hasData ? globalXMax : null,
  }
}

export function createAverageRankOptions(
  payload: AverageRankPayload,
): ChartOptions<'scatter'> {
  const tickMap = new Map<number, AverageRankTick>(
    payload.ticks.map((tick) => [tick.position, tick]),
  )
  const positions = payload.ticks.map((tick) => tick.position)
  const hasPositions = positions.length > 0
  const min =
    hasPositions && positions.length > 0
      ? Math.min(...positions) - 0.6
      : undefined
  const max =
    hasPositions && positions.length > 0
      ? Math.max(...positions) + 0.6
      : undefined

  return {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label(context: TooltipItem<'scatter'>) {
            const raw = context.raw as ScatterPointDatum
            const tick = tickMap.get((raw.x as number) ?? 0)
            const label = tick?.label ?? raw.sampleId ?? '―'
            const avg = raw.y.toFixed(2)
            const yError = (raw.yMax - raw.y).toFixed(2)
            return `${label}｜平均 ${avg} ±${yError}`
          },
        },
      },
    },
    scales: {
      x: {
        type: 'linear',
        min,
        max,
        title: {
          display: true,
          text: 'サンプル',
        },
        ticks: {
          stepSize: 1,
          callback(value) {
            const tick = tickMap.get(Number(value))
            return tick?.label ?? ''
          },
        },
      },
      y: {
        title: {
          display: true,
          text: '平均回答順位',
        },
        suggestedMin: 0.5,
        suggestedMax: TRUE_ORDER.length + 0.5,
        ticks: {
          stepSize: 1,
        },
      },
    },
  }
}

export function createAverageRankScatterOptions(
  payload: AverageRankScatterPayload,
): ChartOptions<'scatter'> {
  const { xMin, xMax } = payload
  const hasBounds =
    xMin !== null &&
    xMax !== null &&
    Number.isFinite(xMin) &&
    Number.isFinite(xMax)
  let min = xMin ?? undefined
  let max = xMax ?? undefined
  if (hasBounds) {
    const padding = Math.max(2, ((xMax! - xMin!) || 1) * 0.08)
    min = Math.max(0, (xMin ?? 0) - padding)
    max = (xMax ?? 0) + padding
  }
  return {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label(context: TooltipItem<'scatter'>) {
            const raw = context.raw as ScatterPointDatum
            const sampleId = raw.sampleId ?? '―'
            const actualRank = raw.actualRank ?? '不明'
            const avg = raw.y.toFixed(2)
            const yError = (raw.yMax - raw.y).toFixed(2)
            const xCenter = raw.x.toFixed(0)
            const xError = Math.abs(raw.xMax - raw.x).toFixed(0)
            return `${sampleId}｜実順位 ${actualRank}｜平均 ${avg} ±${yError}｜硬度 ${xCenter} ±${xError}`
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '実測硬度',
        },
        ...(hasBounds ? { min, max } : {}),
      },
      y: {
        title: {
          display: true,
          text: '平均回答順位',
        },
        suggestedMin: 0.5,
        suggestedMax: TRUE_ORDER.length + 0.5,
        ticks: {
          stepSize: 1,
        },
      },
    },
  }
}

export function buildEstimatedScatterPayload(
  analysis: EstimatedHardnessAnalysis,
): EstimatedScatterPayload {
  if (analysis.count === 0) {
    return { chartData: { datasets: [] }, bounds: null }
  }
  const fallbackSampleId = ACTIVE_SAMPLES[0]?.id ?? TRUE_ORDER[0]
  const points: EstimatedScatterPoint[] = analysis.points.map((point) => ({
    x: point.actualHardness,
    y: point.estimatedHardness,
    sampleId: point.sample.id,
    sampleLabel: point.sample.label,
    submissionId: point.submissionId,
  }))
  const values = points.flatMap((point) => [point.x, point.y])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const scatterDataset: ChartDataset<'scatter', EstimatedScatterPoint[]> = {
    label: '推定硬度',
    data: points,
    backgroundColor: 'rgba(249, 115, 22, 0.9)',
    borderColor: '#ea580c',
    pointRadius: 5,
    pointHoverRadius: 6,
    parsing: false,
  }
  const datasets: ChartDataset<'scatter', EstimatedScatterPoint[]>[] = [
    scatterDataset,
  ]
  if (
    Number.isFinite(min) &&
    Number.isFinite(max) &&
    min !== Infinity &&
    max !== -Infinity
  ) {
    const baselinePoints: EstimatedScatterPoint[] = [
      {
        x: min,
        y: min,
        sampleId: fallbackSampleId,
        sampleLabel: '基準線',
        submissionId: 'baseline-min',
      },
      {
        x: max,
        y: max,
        sampleId: fallbackSampleId,
        sampleLabel: '基準線',
        submissionId: 'baseline-max',
      },
    ]
    const diagonalDataset: ChartDataset<'scatter', EstimatedScatterPoint[]> = {
      label: '基準線 y = x',
      data: baselinePoints,
      borderColor: 'rgba(15, 23, 42, 0.25)',
      borderDash: [6, 6],
      borderWidth: 1.2,
      pointRadius: 0,
      pointHoverRadius: 0,
      parsing: false,
      showLine: true,
      order: -1,
      fill: false,
      clip: false,
      pointHitRadius: 0,
      spanGaps: true,
    }
    datasets.push(diagonalDataset)
  }
  return {
    chartData: { datasets },
    bounds: { min, max },
  }
}

export function createEstimatedHardnessOptions(
  bounds: EstimatedScatterPayload['bounds'],
): ChartOptions<'scatter'> {
  const hasBounds =
    bounds !== null &&
    Number.isFinite(bounds.min) &&
    Number.isFinite(bounds.max)
  const min = hasBounds ? Math.max(0, bounds!.min - (bounds!.max - bounds!.min) * 0.05) : undefined
  const max = hasBounds ? bounds!.max + (bounds!.max - bounds!.min) * 0.05 : undefined
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label(context) {
            const raw = context.raw as EstimatedScatterPoint
            const sample = raw.sampleLabel ?? raw.sampleId ?? '―'
            return `${sample}｜実測 ${raw.x.toFixed(1)}｜推定 ${raw.y.toFixed(1)}`
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: '実測硬度',
        },
        ...(hasBounds ? { min, max } : {}),
      },
      y: {
        title: {
          display: true,
          text: '推定硬度',
        },
      },
    },
  }
}

export function buildEstimatedHardnessDistributionPayload(
  analysis: EstimatedHardnessAnalysis,
): EstimatedHardnessDistributionPayload {
  const categories = ACTIVE_SAMPLES.map((sample) => sample.label)
  const points: EstimatedHardnessDistributionPoint[] = analysis.points.map(
    (point) => ({
      x:
        ACTIVE_SAMPLES.find((sample) => sample.id === point.sample.id)?.label ??
        point.sample.label,
      y: point.estimatedHardness,
      sampleId: point.sample.id,
      sampleLabel: point.sample.label,
      submissionId: point.submissionId,
    }),
  )
  const dataset: ChartDataset<'scatter', EstimatedHardnessDistributionPoint[]> =
    {
      label: '推定硬度',
      data: points,
      backgroundColor: 'rgba(37, 99, 235, 0.8)',
      borderColor: '#1d4ed8',
      pointRadius: 4,
      pointHoverRadius: 5,
      parsing: false,
    }
  return {
    chartData: { datasets: [dataset] },
    categories,
  }
}

export function createEstimatedHardnessDistributionOptions(
  categories: string[],
): ChartOptions<'scatter'> {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label(context) {
            const raw = context.raw as EstimatedHardnessDistributionPoint
            const label = raw.sampleLabel ?? raw.sampleId ?? '—'
            return `${label}: ${raw.y.toFixed(1)}`
          },
        },
      },
    },
    scales: {
      x: {
        type: 'category',
        labels: categories,
        title: {
          display: true,
          text: 'サンプル',
        },
      },
      y: {
        title: {
          display: true,
          text: '推定硬度',
        },
        beginAtZero: true,
      },
    },
  }
}

export function buildHistogram(coefficients: number[]): HistogramBin[] {
  const binWidth = 0.2
  const binCount = Math.ceil(2 / binWidth)
  const bins: HistogramBin[] = []
  for (let i = 0; i < binCount; i += 1) {
    const min = -1 + i * binWidth
    const max = min + binWidth
    bins.push({
      label: `${min.toFixed(1)}〜${max.toFixed(1)}`,
      count: 0,
    })
  }
  coefficients.forEach((value) => {
    if (!Number.isFinite(value)) {
      return
    }
    const clamped = Math.max(-0.999, Math.min(0.999, value))
    const index = Math.min(
      bins.length - 1,
      Math.max(0, Math.floor((clamped + 1) / binWidth)),
    )
    bins[index].count += 1
  })
  return bins
}

export function buildHistogramData(bins: HistogramBin[]) {
  return {
    labels: bins.map((bin) => bin.label),
    datasets: [
      {
        type: 'bar' as const,
        label: '提出件数',
        data: bins.map((bin) => bin.count),
        backgroundColor: '#16a34a',
      },
    ],
  }
}

export function buildPatternFrequencyDistributionData(
  frequency: PatternFrequency,
): { labels: string[]; datasets: ChartDataset<'bar', number[]>[] } {
  const labels = frequency.entries.map((entry) => formatOrder(entry.order))
  const data = frequency.entries.map((entry) => entry.count)
  const dataset: ChartDataset<'bar', number[]> = {
    label: '件数',
    data,
    backgroundColor: '#2563eb',
    borderRadius: 6,
  }
  return {
    labels,
    datasets: [dataset],
  }
}

export const patternFrequencyChartOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label(context) {
          const value = context.parsed.y ?? context.parsed
          return `件数: ${value}`
        },
      },
    },
  },
  scales: {
    x: {
      title: {
        display: true,
        text: '回答パターン',
      },
      ticks: {
        autoSkip: false,
        maxRotation: 45,
        minRotation: 45,
      },
    },
    y: {
      title: {
        display: true,
        text: '件数',
      },
      beginAtZero: true,
      ticks: {
        precision: 0,
      },
    },
  },
}

export const histogramOptions: ChartOptions<'bar'> = {
  responsive: true,
  plugins: {
    legend: {
      display: false,
    },
    title: {
      display: false,
    },
  },
  scales: {
    x: {
      title: {
        display: true,
        text: 'Spearman 順位相関係数',
      },
    },
    y: {
      title: {
        display: true,
        text: '提出件数',
      },
      beginAtZero: true,
    },
  },
}

export function normalizeOrderForActiveSamples(
  order: SampleId[],
): SampleId[] | null {
  const activeSet = new Set(TRUE_ORDER)
  const seen = new Set<SampleId>()
  const normalized: SampleId[] = []

  order.forEach((sampleId) => {
    if (activeSet.has(sampleId) && !seen.has(sampleId)) {
      normalized.push(sampleId)
      seen.add(sampleId)
    }
  })

  if (normalized.length !== TRUE_ORDER.length) {
    return null
  }

  return normalized
}

export function formatOrder(order: SampleId[]): string {
  return order.join(' → ')
}

export function formatHardnessValues(
  hardness: Partial<Record<SampleId, number>>,
): string {
  return ACTIVE_SAMPLES.map((sample) => {
    const value = hardness[sample.id]
    return `${sample.label}: ${typeof value === 'number' ? value.toFixed(0) : '—'}`
  }).join('、')
}

export function formatPValue(pValue: number): string {
  if (!Number.isFinite(pValue)) {
    return '—'
  }
  if (pValue < 0.001) {
    return '< 0.001'
  }
  return pValue.toFixed(3)
}

export function formatCorrelation(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—'
  }
  return value.toFixed(2)
}

export function createErrorBarPlugin(): Plugin<'scatter'> {
  return {
    id: 'customErrorBars',
    afterDatasetsDraw(chart) {
      const ctx = chart.ctx
      const xScale = chart.scales.x as LinearScale
      const yScale = chart.scales.y as LinearScale
      if (!xScale || !yScale) {
        return
      }
      chart.getSortedVisibleDatasetMetas().forEach((meta) => {
        const dataset = chart.data.datasets[meta.index] as
          | ScatterDataset
          | undefined
        const datasetType = (dataset as { type?: string })?.type
        if (
          !dataset ||
          (datasetType && datasetType !== 'scatter') ||
          !chart.isDatasetVisible(meta.index)
        ) {
          return
        }
        const color = dataset.errorBarColor ?? '#1d4ed8'
        const lineWidth = dataset.errorBarLineWidth ?? 1.5
        const capWidth = dataset.errorBarCapWidth ?? 8
        ctx.save()
        ctx.strokeStyle = color
        ctx.lineWidth = lineWidth
        meta.data.forEach((element, index) => {
          const rawContext = (
            element as typeof element & { $context?: { raw?: unknown } }
          ).$context
          const pointData =
            (rawContext?.raw as ScatterPointDatum | undefined) ??
            ((dataset.data?.[index] as ScatterPointDatum) ?? undefined)
          if (!pointData) {
            return
          }
          const xCentral = element.x
          const yCentral = element.y
          const xMinValue = pointData.xMin ?? pointData.x
          const xMaxValue = pointData.xMax ?? pointData.x
          const yMinValue = pointData.yMin ?? pointData.y
          const yMaxValue = pointData.yMax ?? pointData.y
          const xMinPixel = xScale.getPixelForValue(xMinValue)
          const xMaxPixel = xScale.getPixelForValue(xMaxValue)
          const yMinPixel = yScale.getPixelForValue(yMinValue)
          const yMaxPixel = yScale.getPixelForValue(yMaxValue)
          ctx.beginPath()
          ctx.moveTo(xMinPixel, yCentral)
          ctx.lineTo(xMaxPixel, yCentral)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(xMinPixel, yCentral - capWidth / 2)
          ctx.lineTo(xMinPixel, yCentral + capWidth / 2)
          ctx.moveTo(xMaxPixel, yCentral - capWidth / 2)
          ctx.lineTo(xMaxPixel, yCentral + capWidth / 2)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(xCentral, yMinPixel)
          ctx.lineTo(xCentral, yMaxPixel)
          ctx.stroke()
          ctx.beginPath()
          ctx.moveTo(xCentral - capWidth / 2, yMinPixel)
          ctx.lineTo(xCentral + capWidth / 2, yMinPixel)
          ctx.moveTo(xCentral - capWidth / 2, yMaxPixel)
          ctx.lineTo(xCentral + capWidth / 2, yMaxPixel)
          ctx.stroke()
        })
        ctx.restore()
      })
    },
  }
}

export function buildHeatmapColor(intensity: number): string {
  const clamped = Math.min(1, Math.max(0, intensity))
  const hue = 200 - clamped * 120
  const alpha = 0.15 + clamped * 0.55
  return `hsla(${hue}, 70%, 50%, ${alpha})`
}
