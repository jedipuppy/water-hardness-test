import type { SampleId, Submission, WaterSample } from '../types'

export interface ConfusionMatrixResult {
  labels: SampleId[]
  matrix: number[][]
}

export interface SampleAverageRank {
  sample: WaterSample
  actualRank: number
  averageRank: number
  count: number
  stdDeviation: number
  stdError: number
}

export interface SpearmanSummary {
  coefficients: number[]
  average: number | null
}

export interface BinomialTestResult {
  successes: number
  trials: number
  probabilityUnderNull: number
  pValue: number
}

export interface EstimatedHardnessPoint {
  sample: WaterSample
  submissionId: string
  actualHardness: number
  estimatedHardness: number
}

export interface EstimatedHardnessAnalysis {
  points: EstimatedHardnessPoint[]
  pearson: number | null
  count: number
}

export interface ClusteredPattern {
  id: number
  size: number
  centroid: number[]
  exampleOrder: SampleId[]
  averageDistance: number
  prominentSamples: Array<{
    sample: WaterSample
    meanAbsoluteShift: number
  }>
}

export interface PatternClustering {
  total: number
  clusters: ClusteredPattern[]
}

export interface PatternFrequencyEntry {
  order: SampleId[]
  count: number
  percentage: number
  isCorrect: boolean
}

export interface PatternFrequency {
  total: number
  entries: PatternFrequencyEntry[]
}

function generatePermutations(order: SampleId[]): SampleId[][] {
  if (order.length <= 1) {
    return [order]
  }
  const permutations: SampleId[][] = []

  const helper = (path: SampleId[], remaining: SampleId[]) => {
    if (remaining.length === 0) {
      permutations.push(path)
      return
    }
    remaining.forEach((sampleId, index) => {
      const nextRemaining = [
        ...remaining.slice(0, index),
        ...remaining.slice(index + 1),
      ]
      helper([...path, sampleId], nextRemaining)
    })
  }

  helper([], [...order])
  return permutations
}

function extractActiveOrder(
  submissionOrder: SampleId[],
  activeOrder: SampleId[],
): SampleId[] | null {
  const activeSet = new Set(activeOrder)
  const seen = new Set<SampleId>()
  const normalized: SampleId[] = []

  submissionOrder.forEach((sampleId) => {
    if (activeSet.has(sampleId) && !seen.has(sampleId)) {
      normalized.push(sampleId)
      seen.add(sampleId)
    }
  })

  if (normalized.length !== activeOrder.length) {
    return null
  }

  return normalized
}

function arraysEqual(a: SampleId[], b: SampleId[]): boolean {
  if (a.length !== b.length) {
    return false
  }
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) {
      return false
    }
  }
  return true
}

export function buildConfusionMatrix(
  submissions: Submission[],
  trueOrder: SampleId[],
): ConfusionMatrixResult {
  const size = trueOrder.length
  const matrix = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => 0),
  )

  submissions.forEach((submission) => {
    submission.order.forEach((sampleId, position) => {
      const actualIndex = trueOrder.indexOf(sampleId)
      if (actualIndex === -1) {
        return
      }
      const predictedIndex = position
      matrix[actualIndex][predictedIndex] += 1
    })
  })

  return {
    labels: trueOrder,
    matrix,
  }
}

export function computeAverageRanks(
  submissions: Submission[],
  samples: WaterSample[],
  trueOrder: SampleId[],
): SampleAverageRank[] {
  const totals = new Map<SampleId, { sum: number; count: number; sumSquares: number }>()
  samples.forEach((sample) => {
    totals.set(sample.id, { sum: 0, count: 0, sumSquares: 0 })
  })

  submissions.forEach((submission) => {
    submission.order.forEach((sampleId, index) => {
      const entry = totals.get(sampleId)
      if (!entry) {
        return
      }
      const rank = index + 1
      entry.sum += rank
      entry.count += 1
      entry.sumSquares += rank * rank
    })
  })

  return samples.map((sample) => {
    const entry =
      totals.get(sample.id) ?? { sum: 0, count: 0, sumSquares: 0 }
    const averageRank = entry.count === 0 ? 0 : entry.sum / entry.count
    let variance = 0
    if (entry.count > 1) {
      const meanSquare = entry.sumSquares / entry.count
      const populationVariance = meanSquare - averageRank * averageRank
      variance = Math.max(
        0,
        (entry.count / (entry.count - 1)) * populationVariance,
      )
    }
    const stdDeviation = entry.count > 1 ? Math.sqrt(variance) : 0
    const stdError =
      entry.count > 0 ? stdDeviation / Math.sqrt(entry.count) : 0
    return {
      sample,
      actualRank: trueOrder.indexOf(sample.id) + 1,
      averageRank,
      count: entry.count,
      stdDeviation,
      stdError,
    }
  })
}

export function computeSpearmanSummary(
  submissions: Submission[],
  trueOrder: SampleId[],
): SpearmanSummary {
  const trueRanks = buildRankMap(trueOrder)
  const coefficients = submissions
    .map((submission) => spearmanForSubmission(submission.order, trueRanks))
    .filter((value): value is number => Number.isFinite(value))

  const average =
    coefficients.length === 0
      ? null
      : coefficients.reduce((acc, value) => acc + value, 0) / coefficients.length

  return { coefficients, average }
}

export function computeBinomialTest(
  submissions: Submission[],
  trueOrder: SampleId[],
  successProbability: number,
): BinomialTestResult {
  const successes = submissions.filter((submission) =>
    isExactMatch(submission.order, trueOrder),
  ).length
  const trials = submissions.length
  const pValue = binomialUpperTail(successes, trials, successProbability)

  return {
    successes,
    trials,
    probabilityUnderNull: successProbability,
    pValue,
  }
}

export function buildIncorrectPatternFrequency(
  submissions: Submission[],
  trueOrder: SampleId[],
): PatternFrequency {
  const permutations = generatePermutations(trueOrder)
  const frequency = new Map<
    string,
    { order: SampleId[]; count: number; isCorrect: boolean }
  >()

  permutations.forEach((order) => {
    const key = order.join('|')
    frequency.set(key, {
      order,
      count: 0,
      isCorrect: arraysEqual(order, trueOrder),
    })
  })

  let total = 0

  submissions.forEach((submission) => {
    const normalized = extractActiveOrder(submission.order, trueOrder)
    if (!normalized) {
      return
    }

    total += 1
    const key = normalized.join('|')
    const entry = frequency.get(key)
    if (entry) {
      entry.count += 1
    } else {
      frequency.set(key, {
        order: normalized,
        count: 1,
        isCorrect: arraysEqual(normalized, trueOrder),
      })
    }
  })

  const entries = Array.from(frequency.values())
    .sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count
      }
      return a.order.join('').localeCompare(b.order.join(''))
    })
    .map((entry) => ({
      order: entry.order,
      count: entry.count,
      percentage: total === 0 ? 0 : (entry.count / total) * 100,
      isCorrect: entry.isCorrect,
    }))

  return { total, entries }
}

export function buildEstimatedHardnessAnalysis(
  submissions: Submission[],
  samples: WaterSample[],
): EstimatedHardnessAnalysis {
  const sampleIndex = new Map<SampleId, WaterSample>(
    samples.map((sample) => [sample.id, sample]),
  )
  const points: EstimatedHardnessPoint[] = []
  const actualValues: number[] = []
  const estimatedValues: number[] = []

  submissions.forEach((submission) => {
    const estimates = submission.estimatedHardness
    if (!estimates) {
      return
    }
    Object.entries(estimates).forEach(([sampleId, value]) => {
      if (!Number.isFinite(value)) {
        return
      }
      const sample = sampleIndex.get(sampleId as SampleId)
      if (!sample) {
        return
      }
      const numericValue = Number(value)
      if (!Number.isFinite(numericValue)) {
        return
      }
      points.push({
        sample,
        submissionId: submission.id,
        actualHardness: sample.hardness,
        estimatedHardness: numericValue,
      })
      actualValues.push(sample.hardness)
      estimatedValues.push(numericValue)
    })
  })

  const pearson =
    points.length >= 2 ? computePearsonCorrelation(actualValues, estimatedValues) : null

  return {
    points,
    pearson,
    count: points.length,
  }
}

export function buildIncorrectPatternClustering(
  submissions: Submission[],
  samples: WaterSample[],
  trueOrder: SampleId[],
  desiredClusterCount = 3,
): PatternClustering {
  const trueRanks = buildRankMap(trueOrder)
  const sampleCount = trueOrder.length

  const normalizedData = submissions
    .map((submission) => {
      const normalized = extractActiveOrder(submission.order, trueOrder)
      if (!normalized || arraysEqual(normalized, trueOrder)) {
        return null
      }
      const feature = trueOrder.map((sampleId) => {
        const predictedRank = normalized.indexOf(sampleId)
        const actualRank = (trueRanks.get(sampleId) ?? 1) - 1
        return predictedRank - actualRank
      })
      return { submission, normalized, feature }
    })
    .filter((item): item is { submission: Submission; normalized: SampleId[]; feature: number[] } => item !== null)

  const total = normalizedData.length
  if (total === 0) {
    return { total: 0, clusters: [] }
  }

  const clusters = normalizedData.map((_, index) => ({ indices: [index] as number[] }))

  const targetClusterCount = Math.min(
    Math.max(1, desiredClusterCount),
    clusters.length,
  )

  const computeCentroid = (indices: number[]): number[] => {
    const mean = new Array(sampleCount).fill(0)
    indices.forEach((idx) => {
      normalizedData[idx].feature.forEach((value, featureIndex) => {
        mean[featureIndex] += value
      })
    })
    return mean.map((value) => value / indices.length)
  }

  const getCentroid = (cluster: { indices: number[]; centroid?: number[] }) => {
    if (!cluster.centroid) {
      cluster.centroid = computeCentroid(cluster.indices)
    }
    return cluster.centroid
  }

  const mergeClusters = (aIndex: number, bIndex: number) => {
    const first = Math.min(aIndex, bIndex)
    const second = Math.max(aIndex, bIndex)
    const a = clusters[first]
    const b = clusters[second]
    const mergedIndices = [...a.indices, ...b.indices]
    const merged = { indices: mergedIndices, centroid: computeCentroid(mergedIndices) } as { indices: number[]; centroid: number[] }
    clusters.splice(second, 1)
    clusters.splice(first, 1, merged)
  }

  while (clusters.length > targetClusterCount) {
    let bestDistance = Number.POSITIVE_INFINITY
    let mergeA = 0
    let mergeB = 1
    for (let i = 0; i < clusters.length; i += 1) {
      const centroidA = getCentroid(clusters[i])
      for (let j = i + 1; j < clusters.length; j += 1) {
        const centroidB = getCentroid(clusters[j])
        const distance = euclideanDistanceSquared(centroidA, centroidB)
        if (distance < bestDistance) {
          bestDistance = distance
          mergeA = i
          mergeB = j
        }
      }
    }
    mergeClusters(mergeA, mergeB)
  }

  const result: ClusteredPattern[] = clusters
    .map((cluster, clusterIndex) => {
      const memberIndexes = cluster.indices
      const size = memberIndexes.length
      const centroid = getCentroid(cluster)
      const averageDistance =
        memberIndexes.reduce((sum, idx) => {
          const feature = normalizedData[idx].feature
          return sum + Math.sqrt(euclideanDistanceSquared(feature, centroid))
        }, 0) / size

      const prominentSamples = samples
        .map((sample, sampleIndex) => {
          const meanAbsoluteShift =
            memberIndexes.reduce(
              (sum, idx) =>
                sum + Math.abs(normalizedData[idx].feature[sampleIndex]),
              0,
            ) / size
          return { sample, meanAbsoluteShift }
        })
        .filter((entry) => entry.meanAbsoluteShift > 0)
        .sort((a, b) => b.meanAbsoluteShift - a.meanAbsoluteShift)
        .slice(0, 3)

      return {
        id: clusterIndex,
        size,
        centroid,
        exampleOrder: normalizedData[memberIndexes[0]].normalized,
        averageDistance,
        prominentSamples,
      }
    })
    .sort((a, b) => b.size - a.size)

  return { total, clusters: result }
}

function buildRankMap(order: SampleId[]): Map<SampleId, number> {
  const map = new Map<SampleId, number>()
  order.forEach((sampleId, index) => {
    map.set(sampleId, index + 1)
  })
  return map
}

function spearmanForSubmission(
  order: SampleId[],
  trueRanks: Map<SampleId, number>,
): number | null {
  if (order.length === 0 || trueRanks.size === 0) {
    return null
  }
  const n = trueRanks.size
  const deltas = order
    .map((sampleId, index) => {
      const actualRank = trueRanks.get(sampleId)
      if (!actualRank) {
        return null
      }
      const predictedRank = index + 1
      return actualRank - predictedRank
    })
    .filter((value): value is number => value !== null)

  if (deltas.length !== n) {
    return null
  }

  const sumSquared = deltas.reduce((sum, value) => sum + value * value, 0)
  return 1 - (6 * sumSquared) / (n * (n * n - 1))
}

function isExactMatch(order: SampleId[], trueOrder: SampleId[]): boolean {
  if (order.length !== trueOrder.length) {
    return false
  }
  return order.every((sampleId, index) => sampleId === trueOrder[index])
}

function binomialUpperTail(k: number, n: number, p: number): number {
  if (n === 0) {
    return 1
  }
  let cumulative = 0
  for (let i = k; i <= n; i += 1) {
    cumulative += binomialProbability(i, n, p)
  }
  return Math.min(1, Math.max(0, cumulative))
}

function binomialProbability(k: number, n: number, p: number): number {
  if (p <= 0) {
    return k === n ? 1 : 0
  }
  if (p >= 1) {
    return k === n ? 1 : 0
  }
  const logProb =
    logCombination(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p)
  return Math.exp(logProb)
}

function logCombination(n: number, k: number): number {
  if (k < 0 || k > n) {
    return Number.NEGATIVE_INFINITY
  }
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k)
}

const factorialCache = new Map<number, number>()

function logFactorial(n: number): number {
  if (n <= 1) {
    return 0
  }
  const cached = factorialCache.get(n)
  if (cached) {
    return cached
  }
  let sum = 0
  for (let i = 2; i <= n; i += 1) {
    sum += Math.log(i)
  }
  factorialCache.set(n, sum)
  return sum
}

function computePearsonCorrelation(actual: number[], estimated: number[]): number {
  const n = actual.length
  if (n !== estimated.length || n === 0) {
    return NaN
  }
  const meanActual = actual.reduce((sum, value) => sum + value, 0) / n
  const meanEstimated = estimated.reduce((sum, value) => sum + value, 0) / n

  let numerator = 0
  let actualVariance = 0
  let estimatedVariance = 0

  for (let i = 0; i < n; i += 1) {
    const aCentered = actual[i] - meanActual
    const eCentered = estimated[i] - meanEstimated
    numerator += aCentered * eCentered
    actualVariance += aCentered * aCentered
    estimatedVariance += eCentered * eCentered
  }

  if (actualVariance === 0 || estimatedVariance === 0) {
    return 0
  }

  return numerator / Math.sqrt(actualVariance * estimatedVariance)
}

function euclideanDistanceSquared(v1: number[], v2: number[]): number {
  return v1.reduce((sum, value, index) => {
    const diff = value - (v2[index] ?? 0)
    return sum + diff * diff
  }, 0)
}

