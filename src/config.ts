import type { SampleId, WaterSample } from './types'

export const WATER_SAMPLES: WaterSample[] = [
  {
    id: 'A',
    label: 'サンプル A',
    hardness: 120,
    hardnessError: 10,
  },
  {
    id: 'B',
    label: 'サンプル B',
    hardness: 70,
    hardnessError: 6,
  },
  {
    id: 'C',
    label: 'サンプル C',
    hardness: 180,
    hardnessError: 12,
  },
  {
    id: 'D',
    label: 'サンプル D',
    hardness: 40,
    hardnessError: 5,
  },
]

export const CORRECT_ORDER: SampleId[] = ['A', 'B', 'C', 'D']

export const ACTIVE_SAMPLES: WaterSample[] = CORRECT_ORDER.map((id) => {
  const sample = WATER_SAMPLES.find((item) => item.id === id)
  if (!sample) {
    throw new Error(`Unknown sample id in CORRECT_ORDER: ${id}`)
  }
  return sample
})

export const TRUE_ORDER: SampleId[] = [...CORRECT_ORDER]

export const RANDOM_SUCCESS_PROBABILITY = 1 / factorial(CORRECT_ORDER.length)

function factorial(n: number): number {
  return n <= 1 ? 1 : n * factorial(n - 1)
}
