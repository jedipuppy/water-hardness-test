import { useMemo } from 'react'
import { Bar, Scatter } from 'react-chartjs-2'
import { RANDOM_SUCCESS_PROBABILITY } from '../config'
import { useResultsData } from '../hooks/useResultsData'
import { ensureResultsChartsRegistered } from './resultsChartConfig'
import type { SampleId } from '../types'
import {
  buildAverageRankScatterPayload,
  buildEstimatedScatterPayload,
  buildHistogram,
  buildHistogramData,
  buildPatternFrequencyDistributionData,
  buildHeatmapColor,
  createAverageRankScatterOptions,
  createEstimatedHardnessOptions,
  formatCorrelation,
  formatPValue,
  histogramOptions,
  patternFrequencyChartOptions,
} from './resultsShared'

ensureResultsChartsRegistered()

export default function AnalysisPage() {
  const {
    averageRanks,
    estimatedAnalysis,
    patternFrequency,
    spearmanSummary,
    binomialTest,
    confusionMatrix,
    testData,
    applyTestData,
    clearTestData,
  } = useResultsData()

 const averageRankScatter = useMemo(
   () => buildAverageRankScatterPayload(averageRanks),
   [averageRanks],
 )
  const estimatedScatter = useMemo(
    () => buildEstimatedScatterPayload(estimatedAnalysis),
    [estimatedAnalysis],
  )
  const histogram = useMemo(
    () => buildHistogram(spearmanSummary.coefficients),
    [spearmanSummary.coefficients],
  )
  const patternFrequencyChartData = useMemo(
    () => buildPatternFrequencyDistributionData(patternFrequency),
    [patternFrequency],
  )

  const displayCount = averageRanks.reduce(
    (acc, entry) => acc + entry.count,
    0,
  )
  const testCount = testData.length
  const rankScatterKey = `rank-scatter-${displayCount}-${testCount}`
  const hardnessCorrelationKey = `hardness-corr-${estimatedAnalysis.count}-${testCount}`

  return (
    <div className="page">
      <section className="panel">
        <div className="panel-header">
          <h2>詳細分析</h2>
          {testCount > 0 ? (
            <span className="badge badge-secondary">
              テストデータ {testCount} 件含む
            </span>
          ) : null}
        </div>
        <p className="panel-description">
          順位や推定硬度の傾向、回答パターンの分布を可視化して、授業前のリハーサルや振り返りに役立てます。
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
            <span className="summary-hint">サンプル {estimatedAnalysis.count} 点</span>
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
        <h3>混同行列（実順位 × 回答順位）</h3>
        <ConfusionMatrixTable matrix={confusionMatrix} />
      </section>
      <section className="panel">
        <h3>平均回答順位と実硬度</h3>
        <p className="panel-description">
          実測硬度を横軸、平均回答順位を縦軸に取り、標準誤差と硬度の誤差を併せて表示します。
        </p>
        <div className="chart-wrapper">
          <Scatter
            key={rankScatterKey}
            data={averageRankScatter.chartData}
            options={createAverageRankScatterOptions(averageRankScatter)}
            redraw
          />
        </div>
      </section>
      <section className="panel">
        <h3>推定硬度と実測硬度の相関</h3>
        <p className="panel-description">
          推定硬度と実測硬度を散布図で比較し、y=x の基準線と照らして推定のずれを確認します。
        </p>
        {estimatedAnalysis.count === 0 ? (
          <p className="panel-description">
            推定硬度の入力がまだ集まっていません。値が集まると散布図が表示されます。
          </p>
        ) : (
          <div className="chart-wrapper">
            <Scatter
              key={hardnessCorrelationKey}
              data={estimatedScatter.chartData}
              options={createEstimatedHardnessOptions(estimatedScatter.bounds)}
              updateMode="resize"
              redraw
            />
          </div>
        )}
      </section>
      <section className="panel">
        <h3>パターン出現頻度の分布</h3>
        <p className="panel-description">
          同じ並び順が何回観測されたかを集計し、頻度別のパターン数として表示します。
        </p>
        {patternFrequency.total === 0 ? (
          <p className="panel-note">まだ分布を表示できるだけのデータがありません。</p>
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
        <h3>Spearman 順位相関係数の分布</h3>
        <div className="chart-wrapper">
          <Bar
            data={buildHistogramData(histogram)}
            options={histogramOptions}
          />
        </div>
      </section>
      <section className="panel panel-secondary">
        <h3>テストモード</h3>
        <p className="panel-description">
          サンプルデータを投入するとグラフが即時更新されます。挙動確認後はクリアしてください。
        </p>
        <div className="form-actions">
          <button
            type="button"
            className="button button-secondary"
            onClick={() => applyTestData({ count: 100 })}
          >
            テストデータを投入（100件）
          </button>
          <button
            type="button"
            className="button"
            onClick={() => clearTestData()}
            disabled={testCount === 0}
          >
            テストデータをクリア
          </button>
        </div>
      </section>
    </div>
  )
}

function ConfusionMatrixTable({
  matrix,
}: {
  matrix: { labels: SampleId[]; matrix: number[][] }
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
