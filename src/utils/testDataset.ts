import { ACTIVE_SAMPLES, TRUE_ORDER } from '../config'
import type { EstimatedHardnessMap, Submission, SampleId } from '../types'

interface GeneratorOptions {
  count?: number
  correctRatio?: number
  mildErrorRatio?: number
}

const DEFAULT_GENERATOR_OPTIONS: GeneratorOptions = {
  count: 100,
  correctRatio: 0.1,
  mildErrorRatio: 0.45,
}

const TEST_COMMENTS = [
  'Dが飲みやすかった。',
  'Aが苦くてBがまろやかだった。',
  'AとCの違いがわからなかった',
  'Aが一番硬度が高く感じた',
  'Cは飲み慣れている味だった。あとはよくわからなかった。',
  'Dが飲みやすかった。',
  'Aになにか味を感じた。',
  'Dに酸味を感じた',
  'よくわからなかった。',
  'Cが甘かった。',
  'CとDの違いがわからなかった。Aは金属的だった。',
  'Cは滑らかに感じた。',
  'Bは苦くて飲めなかった。',
] as const;

const SAMPLE_IDS = ['S0001', 'S0002', 'S0003', 'S0004', 'S0005']
const HARDNESS_INDEX = new Map(
  ACTIVE_SAMPLES.map((sample) => [sample.id, sample.hardness]),
)

export function generateTestDataset(
  options: GeneratorOptions = {},
): Submission[] {
  const { count, correctRatio, mildErrorRatio } = {
    ...DEFAULT_GENERATOR_OPTIONS,
    ...options,
  }

  const datasetCount = count ?? 0
  const now = Date.now()
  const submissions: Submission[] = []

  for (let index = 0; index < datasetCount; index += 1) {
    const order = createOrder(correctRatio ?? 0.35, mildErrorRatio ?? 0.4)
    const estimatedHardness = createEstimatedHardness()
    const comment =
      TEST_COMMENTS[index % TEST_COMMENTS.length] ?? TEST_COMMENTS[0]
    submissions.push({
      id: `test-${index + 1}`,
      studentId: SAMPLE_IDS[index % SAMPLE_IDS.length],
      order,
      timestamp: now - (datasetCount - index) * 60 * 1000,
      estimatedHardness,
      comment,
    })
  }

  return submissions
}

function createOrder(correctRatio: number, mildErrorRatio: number): SampleId[] {
  const coin = Math.random()
  if (coin < correctRatio) {
    return [...TRUE_ORDER]
  }
  if (coin < correctRatio + mildErrorRatio) {
    return applyLocalSwap(TRUE_ORDER)
  }
  return shuffle([...TRUE_ORDER])
}

function applyLocalSwap(order: SampleId[]): SampleId[] {
  const result = [...order]
  const firstIndex = Math.floor(Math.random() * result.length)
  const secondIndex = clampIndex(
    firstIndex + (Math.random() > 0.5 ? 1 : -1),
    result.length,
  )
  swap(result, firstIndex, secondIndex)
  for (let i = 0; i < 2; i += 1) {
    if (Math.random() > 0.4) {
      const extraFirst = Math.floor(Math.random() * result.length)
      const extraSecond = clampIndex(
        extraFirst + (Math.random() > 0.5 ? 1 : -1),
        result.length,
      )
      swap(result, extraFirst, extraSecond)
    }
  }
  return result
}

function shuffle(order: SampleId[]): SampleId[] {
  const result = [...order]
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    swap(result, i, j)
  }
  return result
}

function swap<T>(array: T[], first: number, second: number): void {
  const temp = array[first]
  array[first] = array[second]
  array[second] = temp
}

function clampIndex(index: number, length: number): number {
  if (index < 0) {
    return 0
  }
  if (index >= length) {
    return length - 1
  }
  return index
}

function createEstimatedHardness(): EstimatedHardnessMap {
  const map: EstimatedHardnessMap = {}
  ACTIVE_SAMPLES.forEach((sample) => {
    const actual = HARDNESS_INDEX.get(sample.id) ?? 0
    const noise = randomNormal(0, Math.max(10, actual * 0.24))
    const estimate = Math.max(0, actual + noise)
    map[sample.id] = Math.round(estimate * 10) / 10
  })
  return map
}

function randomNormal(mean: number, stdDev: number): number {
  // Box-Muller transform
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  const magnitude = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
  return mean + magnitude * stdDev
}
