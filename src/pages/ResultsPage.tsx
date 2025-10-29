import { useMemo, useState } from 'react'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Title as ChartTitle,
  LineController,
  type TooltipItem,
  type ChartDataset,
  type ChartOptions,
  type Plugin,
} from 'chart.js'
import { Scatter } from 'react-chartjs-2'
import { Bar } from 'react-chartjs-2'
import { useSubmissions } from '../hooks/useSubmissions'
import {
  buildConfusionMatrix,
  buildEstimatedHardnessAnalysis,
  buildIncorrectPatternFrequency,
  computeAverageRanks,
  computeBinomialTest,
  computeSpearmanSummary,
  type EstimatedHardnessAnalysis,
  type PatternFrequency,
  type SampleAverageRank,
} from '../utils/statistics'
import { ACTIVE_SAMPLES, RANDOM_SUCCESS_PROBABILITY, TRUE_ORDER } from '../config'
import { isUsingFirebase } from '../services/submissions'
import type { SampleId } from '../types'
import type { Submission } from '../types'
import { generateTestDataset } from '../utils/testDataset'
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
interface HistogramBin {
  label: string
  count: number
}
interface ScatterPointDatum {
  x: number
  y: number
  sampleId: SampleId
  actualRank: number
  xMin: number
  xMax: number
  yMin: number
  yMax: number
}
interface ScatterDataset
  extends ChartDataset<'scatter', ScatterPointDatum[]> {
  errorBarColor?: string
  errorBarLineWidth?: number
  errorBarCapWidth?: number
}
interface ScatterPayload {
  chartData: { datasets: ScatterDataset[] }
  xMin: number | null
  xMax: number | null
}
interface EstimatedScatterPoint {
  x: number
  y: number
  sampleId: SampleId
  sampleLabel: string
  submissionId: string
}
interface EstimatedScatterPayload {
  chartData: { datasets: ChartDataset<'scatter', EstimatedScatterPoint[]>[] }
  bounds: { min: number; max: number } | null
}

interface CommentEntry {
  id: string
  timestamp: number
  order: SampleId[]
  hardness: Partial<Record<SampleId, number>>
  comment: string | null
}
export default function ResultsPage() {
  const { data: submissions, isLoading } = useSubmissions()
  const [testData, setTestData] = useState<Submission[]>([])
  const combinedSubmissions = useMemo(
    () =>
      testData.length === 0 ? submissions : [...submissions, ...testData],
    [submissions, testData],
  )
  const confusionMatrix = useMemo(
    () => buildConfusionMatrix(combinedSubmissions, TRUE_ORDER),
    [combinedSubmissions],
  )
  const averageRanks = useMemo(
    () => computeAverageRanks(combinedSubmissions, ACTIVE_SAMPLES, TRUE_ORDER),
    [combinedSubmissions],
  )
  const spearmanSummary = useMemo(
    () => computeSpearmanSummary(combinedSubmissions, TRUE_ORDER),
    [combinedSubmissions],
  )
  const histogram = useMemo(
    () => buildHistogram(spearmanSummary.coefficients),
    [spearmanSummary.coefficients],
  )
  const binomialTest = useMemo(
    () =>
      computeBinomialTest(
        combinedSubmissions,
        TRUE_ORDER,
        RANDOM_SUCCESS_PROBABILITY,
      ),
    [combinedSubmissions],
  )
  const scatterPayload = useMemo(
    () => buildScatterData(averageRanks),
    [averageRanks],
  )
  const estimatedAnalysis = useMemo(
    () => buildEstimatedHardnessAnalysis(combinedSubmissions, ACTIVE_SAMPLES),
    [combinedSubmissions],
  )
  const estimatedScatter = useMemo(
    () => buildEstimatedScatterPayload(estimatedAnalysis),
    [estimatedAnalysis],
  )
  const patternFrequency: PatternFrequency = useMemo(
    () => buildIncorrectPatternFrequency(combinedSubmissions, TRUE_ORDER),
    [combinedSubmissions],
  )
  const patternFrequencyChartData = useMemo(
    () => buildPatternFrequencyChartData(patternFrequency),
    [patternFrequency],
  )
  const commentEntries = useMemo(() => {
    const entries: CommentEntry[] = combinedSubmissions
      .map((submission) => {
        const normalized = normalizeOrderForActiveSamples(submission.order)
        if (!normalized) {
          return null
        }
        return {
          id: submission.id,
          timestamp: typeof submission.timestamp === 'number' ? submission.timestamp : Date.now(),
          order: normalized,
          hardness: submission.estimatedHardness ?? {},
          comment: submission.comment ?? null,
        }
      })
      .filter((entry): entry is CommentEntry => entry !== null)
      .sort((a, b) => b.timestamp - a.timestamp)
    return entries
  }, [combinedSubmissions])
  const displayCount = combinedSubmissions.length
  const testCount = testData.length
  const rankKey = `rank-${combinedSubmissions.length}-${testCount}`
  const hardnessKey = `hardness-${estimatedAnalysis.count}-${testCount}`
  return (
    <div className="page">
      <section className="panel">
        <div className="panel-header">
          <h2>集計ダッシュボード</h2>
          <span className="badge">
            {isUsingFirebase ? 'Firebase が有効です' : 'ローカルモードで集計中'}
          </span>
          {testCount > 0 ? (
            <span className="badge badge-secondary">
              テストデータ {testCount} 件含む
            </span>
          ) : null}
        </div>
        <p className="panel-description">
          {isLoading
            ? '回答を読み込み中です…'
            : displayCount === 0
              ? 'まだ回答がありません。テストデータを投入して、グラフ表示を確認できます。'
              : `現在 ${displayCount} 件の回答が集まっています。`}
        </p>
        <div className="summary-grid">
          <div className="summary-card">
            <h3>正答数</h3>
            <p className="summary-value">{binomialTest.successes}</p>
            <span className="summary-hint">全 {binomialTest.trials} 件中</span>
          </div>
          <div className="summary-card">
            <h3>平均 Spearman</h3>
            <p className="summary-value">
              {spearmanSummary.average === null
                ? '—'
                : spearmanSummary.average.toFixed(2)}
            </p>
            <span className="summary-hint">全提出を対象</span>
          </div>
          <div className="summary-card">
            <h3>硬度推定 相関</h3>
            <p className="summary-value">{formatCorrelation(estimatedAnalysis.pearson)}</p>
            <span className="summary-hint">
              データ点 {estimatedAnalysis.count}
            </span>
          </div>
          <div className="summary-card">
            <h3>二項検定 p 値</h3>
            <p className="summary-value">{formatPValue(binomialTest.pValue)}</p>
            <span className="summary-hint">
              帰無仮説: 成功確率 {RANDOM_SUCCESS_PROBABILITY.toFixed(3)}
            </span>
          </div>
        </div>
      </section>
      <section className="panel">
        <h3>混同行列（実際の順位 × 回答順位）</h3>
        <ConfusionMatrixTable matrix={confusionMatrix} />
      </section>
      <section className="panel">
        <h3>平均回答順位と実硬度</h3>
        <p className="panel-description">
          各サンプルの実測硬度を横軸、平均回答順位を縦軸にプロットしています。
        </p>
        <div className="chart-wrapper">
          <Scatter
            key={rankKey}
            data={scatterPayload.chartData}
            options={createScatterOptions(scatterPayload)}
            plugins={[errorBarPlugin]}
            redraw
          />
        </div>
      </section>
      <section className="panel">
        <h3>推定硬度と実測硬度の相関</h3>
        <p className="panel-description">
          各サンプルの推定硬度と実測硬度の関係を表示します。
        </p>
        {estimatedAnalysis.count === 0 ? (
          <p className="panel-description">推定硬度の入力がまだありません。入力が集まると散布図が表示されます。</p>
        ) : (
          <div className="chart-wrapper">
            <Scatter
              key={hardnessKey}
              data={estimatedScatter.chartData}
              options={createEstimatedHardnessOptions(estimatedScatter.bounds)}
              updateMode="resize"
              redraw
            />
          </div>
        )}
      </section>
      <section className="panel">
        <h3>誤答パターンの頻度分布</h3>
        <p className="panel-description">
          出現する誤答パターンを降順で可視化しています。正解パターンは青、それ以外はオレンジで表示します。
        </p>
        {patternFrequency.total === 0 ? (
          <p className="panel-note">誤答がないため表示できません。</p>
        ) : (
          <div className="chart-wrapper pattern-bar-chart">
            <Bar options={patternFrequencyChartOptions} data={patternFrequencyChartData} />
          </div>
        )}
      </section>
      <section className="panel">
        <h3>回答一覧（推定順・硬度・コメント）</h3>
        <p className="panel-description">
          予想の並び、各サンプルの推定硬度、自由記述のコメントを提出順に一覧表示します。
        </p>
        {commentEntries.length === 0 ? (
          <p className="panel-note">まだ回答がありません。</p>
        ) : (
          <div className="pattern-table-wrapper">
            <table className="pattern-table">
              <thead>
                <tr>
                  <th>提出時刻</th>
                  <th>予想順</th>
                  <th>推定硬度</th>
                  <th>コメント</th>
                </tr>
              </thead>
              <tbody>
                {commentEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.timestamp).toLocaleString()}</td>
                    <td className="pattern-table-order">{formatOrder(entry.order)}</td>
                    <td>{formatHardnessValues(entry.hardness)}</td>
                    <td>{entry.comment ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section className="panel">
        <h3>Spearman 順位相関係数の分布</h3>
        <div className="chart-wrapper">
          <Bar data={buildHistogramData(histogram)} options={histogramOptions} />
        </div>
      </section>
      <section className="panel panel-secondary">
        <h3>テストモード</h3>
        <p className="panel-description">
          授業前にダッシュボードの挙動を確認したい場合は、サンプルデータを一時的に追加できます。
          実データや Firestore には送信されず、このブラウザでのみ有効です。
        </p>
        <div className="form-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setTestData(generateTestDataset({ count: 100 }))}
          >
            テストデータを投入（100件）
          </button>
          <button
            type="button"
            className="button"
            onClick={() => setTestData([])}
            disabled={testCount === 0}
          >
            テストデータをクリア
          </button>
        </div>
      </section>
    </div>
  )
}
function formatOrder(order: SampleId[]): string {
  return order.join(' → ')
}

function ConfusionMatrixTable({
  matrix,
}: {
  matrix: ReturnType<typeof buildConfusionMatrix>
}) {
  const { labels, matrix: values } = matrix
  const maxValue = Math.max(...values.flat(), 1)
  return (
    <div className="confusion-table-wrapper">
      <table className="confusion-table">
        <thead>
          <tr>
            <th>実順位＼回答順位</th>
            {labels.map((label, index) => (
              <th key={label}>{index + 1} 位</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {values.map((row, rowIndex) => (
            <tr key={labels[rowIndex]}>
              <th>
                {rowIndex + 1} 位 ({labels[rowIndex]})
              </th>
              {row.map((value, columnIndex) => (
                <td
                  key={`${rowIndex}-${columnIndex}`}
                  style={{
                    backgroundColor: buildHeatmapColor(value / maxValue),
                  }}
                >
                  {value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
function buildHeatmapColor(intensity: number): string {
  const clamped = Math.min(1, Math.max(0, intensity))
  const hue = 200 - clamped * 120
  const alpha = 0.15 + clamped * 0.55
  return `hsla(${hue}, 70%, 50%, ${alpha})`
}
function buildScatterData(averageRanks: SampleAverageRank[]): ScatterPayload {
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
function createScatterOptions(
  payload: ScatterPayload,
  axisLabels?: { x?: string; y?: string },
): ChartOptions<'scatter'> {
  const { xMin, xMax } = payload
  const hasBounds = xMin !== null && xMax !== null && Number.isFinite(xMin) && Number.isFinite(xMax)
  let min = xMin ?? undefined
  let max = xMax ?? undefined
  if (hasBounds) {
    const padding = Math.max(2, ((xMax! - xMin!) || 1) * 0.08)
    min = Math.max(0, (xMin ?? 0) - padding)
    max = (xMax ?? 0) + padding
  }
  const xLabel = axisLabels?.x ?? '実測硬度'
  const yLabel = axisLabels?.y ?? '平均回答順位'
  return {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
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
      title: {
        display: false,
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: xLabel,
        },
        ...(hasBounds ? { min, max } : {}),
      },
      y: {
        title: {
          display: true,
          text: yLabel,
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
function buildEstimatedScatterPayload(
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
  const datasets: ChartDataset<'scatter', EstimatedScatterPoint[]>[] = [scatterDataset]
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
function createEstimatedHardnessOptions(
  bounds: EstimatedScatterPayload['bounds'],
): ChartOptions<'scatter'> {
  const hasBounds =
    bounds !== null &&
    Number.isFinite(bounds.min) &&
    Number.isFinite(bounds.max) &&
    bounds.min !== Infinity &&
    bounds.max !== -Infinity
  let min: number | undefined
  let max: number | undefined
  if (hasBounds && bounds) {
    const range = bounds.max - bounds.min
    const padding = Math.max(5, range * 0.08 || 5)
    min = Math.max(0, bounds.min - padding)
    max = bounds.max + padding
  }
  return {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label(context: TooltipItem<'scatter'>) {
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
        ...(hasBounds ? { min, max } : {}),
      },
    },
  }
}
function buildHistogram(coefficients: number[]): HistogramBin[] {
  if (coefficients.length === 0) {
    return defaultHistogram()
  }
  const bins = defaultHistogram()
  const binWidth = 0.2
  coefficients.forEach((value) => {
    const index = Math.min(
      bins.length - 1,
      Math.max(0, Math.floor((value + 1) / binWidth)),
    )
    bins[index].count += 1
  })
  return bins
}
function defaultHistogram(): HistogramBin[] {
  const binWidth = 0.2
  const bins: HistogramBin[] = []
  for (let i = 0; i < 10; i += 1) {
    const min = -1 + i * binWidth
    const max = min + binWidth
    bins.push({
      label: `${min.toFixed(1)}〜${max.toFixed(1)}`,
      count: 0,
    })
  }
  return bins
}
function buildHistogramData(bins: HistogramBin[]) {
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
function buildPatternFrequencyChartData(
  frequency: PatternFrequency,
): {
  labels: string[]
  datasets: Array<
    ChartDataset<'bar', number[]> & { meta: { percentages: number[] } }
  >
} {
  const labels = frequency.entries.map((entry) => formatOrder(entry.order))
  const counts = frequency.entries.map((entry) => entry.count)
  const percentages = frequency.entries.map((entry) => entry.percentage)
  const colors = frequency.entries.map((entry) =>
    entry.isCorrect ? '#2563eb' : 'rgba(249, 115, 22, 0.85)',
  )

  const dataset: ChartDataset<'bar', number[]> & {
    meta: { percentages: number[] }
  } = {
    label: '件数',
    data: counts,
    backgroundColor: colors,
    hoverBackgroundColor: colors,
    borderRadius: 6,
    meta: { percentages },
  }

  return {
    labels,
    datasets: [dataset],
  }
}

const patternFrequencyChartOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      callbacks: {
        label(context) {
          const dataset = context.dataset as ChartDataset<'bar', number[]> & {
            meta?: { percentages: number[] }
          }
          const value = context.parsed.y ?? context.parsed
          const percentage = dataset.meta?.percentages?.[context.dataIndex] ?? 0
          return `件数: ${value} (${percentage.toFixed(1)}%)`
        },
      },
    },
  },
  scales: {
    x: {
      title: {
        display: true,
        text: '順位パターン',
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
function normalizeOrderForActiveSamples(order: SampleId[]): SampleId[] | null {
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

function formatHardnessValues(
  hardness: Partial<Record<SampleId, number>>,
): string {
  return ACTIVE_SAMPLES.map((sample) => {
    const value = hardness[sample.id]
    return `${sample.label}: ${typeof value === 'number' ? value.toFixed(0) : '—'}`
  }).join('、')
}

const histogramOptions = {
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
function formatPValue(pValue: number): string {
  if (!Number.isFinite(pValue)) {
    return '—'
  }
  if (pValue < 0.001) {
    return '< 0.001'
  }
  return pValue.toFixed(3)
}
function createErrorBarPlugin(): Plugin<'scatter'> {
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
        const dataset = chart.data.datasets[meta.index] as ScatterDataset | undefined
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
          const rawContext = (element as typeof element & { $context?: { raw?: unknown } }).$context
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
function formatCorrelation(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return '—'
  }
  return value.toFixed(2)
}



