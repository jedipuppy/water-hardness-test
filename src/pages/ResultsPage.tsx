import { useMemo } from 'react'
import { Bar, Scatter } from 'react-chartjs-2'
import { useResultsData } from '../hooks/useResultsData'
import {
  formatHardnessValues,
  formatOrder,
} from './resultsShared'
import {
  buildEstimatedHardnessDistributionPayload,
  buildAverageRankPayload,
  buildPatternFrequencyDistributionData,
  createAverageRankOptions,
  createEstimatedHardnessDistributionOptions,
  patternFrequencyChartOptions,
} from './resultsShared'
import { WATER_SAMPLES } from '../config'
import { ensureResultsChartsRegistered } from './resultsChartConfig'
import type { SampleId } from '../types'

ensureResultsChartsRegistered()

export default function ResultsPage() {
  const {
    isLoading,
    commentEntries,
    estimatedAnalysis,
    averageRanks,
    patternFrequency,
  } = useResultsData()
  const visibleCommentEntries = useMemo(() => commentEntries, [commentEntries])
  const patternFrequencyChartData = useMemo(
    () => buildPatternFrequencyDistributionData(patternFrequency),
    [patternFrequency],
  )
  const estimatedDistribution = useMemo(
    () => buildEstimatedHardnessDistributionPayload(estimatedAnalysis, WATER_SAMPLES),
    [estimatedAnalysis],
  )
  const averageRankPayload = useMemo(
    () => buildAverageRankPayload(averageRanks, WATER_SAMPLES),
    [averageRanks],
  )
  const hasAverageRankData =
    (averageRankPayload.chartData.datasets[0]?.data.length ?? 0) > 0

  return (
    <div className="page">
      <section className="panel">
        <div className="panel-header">
          <h2>回答一覧</h2>
        </div>
        <p className="panel-description">
          {isLoading
            ? '回答を読み込み中です…'
            : visibleCommentEntries.length === 0
              ? 'まだ回答がありません。'
              : '提出順に推定順位と推定硬度、コメントを表示します。'}
        </p>
      </section>
      <AnswersTable entries={visibleCommentEntries} isLoading={isLoading} />
      <section className="panel">
        <h3>パターン出現頻度の分布</h3>
        <p className="panel-description">
          同じ並び順が何回観測されたかを頻度別に集計します。正解は意識せず全体の傾向を確認できます。
        </p>
        {patternFrequency.total === 0 ? (
          <p className="panel-note">まだ分布を表示できるだけの回答がありません。</p>
        ) : (
          <div className="chart-wrapper pattern-bar-chart">
            <Bar
              options={patternFrequencyChartOptions}
              data={patternFrequencyChartData}
            />
          </div>
        )}
      </section>
      <section className="panel">
        <h3>平均回答順位（サンプル別）</h3>
        <p className="panel-description">
          各サンプルを横軸に取り、平均回答順位と標準誤差を比較します。
        </p>
        {!hasAverageRankData ? (
          <p className="panel-note">まだ平均順位を計算できる回答がありません。</p>
        ) : (
          <div className="chart-wrapper">
            <Scatter
              data={averageRankPayload.chartData}
              options={createAverageRankOptions(averageRankPayload)}
              redraw
            />
          </div>
        )}
      </section>
      <section className="panel">
        <h3>推定硬度の分布</h3>
        <p className="panel-description">
          回答者が入力した推定硬度をサンプルごとに並べ、値のばらつきを確認できます。
        </p>
        {estimatedAnalysis.count === 0 ? (
          <p className="panel-note">推定硬度の入力がまだありません。回答が集まると散布図が表示されます。</p>
        ) : (
          <div className="chart-wrapper">
            <Scatter
              data={estimatedDistribution.chartData}
              options={createEstimatedHardnessDistributionOptions(
                estimatedDistribution.categories,
              )}
              redraw
            />
          </div>
        )}
      </section>
    </div>
  )
}

function AnswersTable({
  entries,
  isLoading,
}: {
  entries: Array<{
    id: string
    timestamp: number
    order: SampleId[]
    hardness: Partial<Record<SampleId, number>>
    comment: string | null
  }>
  isLoading: boolean
}) {
  if (isLoading) {
    return null
  }
  if (entries.length === 0) {
    return (
      <section className="panel">
        <p className="panel-note">まだ回答がありません。</p>
      </section>
    )
  }
  return (
    <section className="panel">
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
            {entries.map((entry) => (
              <tr key={entry.id}>
                <td>{new Date(entry.timestamp).toLocaleString()}</td>
                <td className="pattern-table-order">
                  {formatOrder(entry.order)}
                </td>
                <td>{formatHardnessValues(entry.hardness)}</td>
                <td>{entry.comment ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
