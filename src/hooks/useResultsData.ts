import { useCallback, useMemo, useState } from 'react'
import { ACTIVE_SAMPLES, RANDOM_SUCCESS_PROBABILITY, TRUE_ORDER } from '../config'
import type { SampleId } from '../types'
import { useSubmissions } from './useSubmissions'
import {
  buildConfusionMatrix,
  buildEstimatedHardnessAnalysis,
  buildIncorrectPatternFrequency,
  computeAverageRanks,
  computeBinomialTest,
  computeSpearmanSummary,
  type BinomialTestResult,
  type EstimatedHardnessAnalysis,
  type PatternFrequency,
  type SampleAverageRank,
  type SpearmanSummary,
} from '../utils/statistics'
import type { Submission } from '../types'
import { generateTestDataset } from '../utils/testDataset'
import { normalizeOrderForActiveSamples } from '../pages/resultsShared'

const TEST_DATA_STORAGE_KEY = 'water-hardness-test/test-mode-data'

function loadStoredTestData(): Submission[] {
  if (typeof window === 'undefined' || !window.localStorage) {
    return []
  }
  try {
    const raw = window.localStorage.getItem(TEST_DATA_STORAGE_KEY)
    if (!raw) {
      return []
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }
    return parsed as Submission[]
  } catch {
    return []
  }
}

function useTestDatasetState() {
  const [testData, setTestDataState] = useState<Submission[]>(() =>
    loadStoredTestData(),
  )

  const setTestData = useCallback((entries: Submission[]) => {
    setTestDataState(entries)
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        if (entries.length === 0) {
          window.localStorage.removeItem(TEST_DATA_STORAGE_KEY)
        } else {
          window.localStorage.setItem(
            TEST_DATA_STORAGE_KEY,
            JSON.stringify(entries),
          )
        }
      } catch {
        // ignore storage errors
      }
    }
  }, [])

  const clearTestData = useCallback(() => {
    setTestData([])
  }, [setTestData])

  return { testData, setTestData, clearTestData }
}

export interface CommentEntry {
  id: string
  timestamp: number
  order: SampleId[]
  hardness: Partial<Record<SampleId, number>>
  comment: string | null
}

export interface ResultsData {
  isLoading: boolean
  submissions: Submission[]
  combinedSubmissions: Submission[]
  testData: Submission[]
  setTestData: (entries: Submission[]) => void
  applyTestData: (options?: Parameters<typeof generateTestDataset>[0]) => Submission[]
  clearTestData: () => void
  confusionMatrix: ReturnType<typeof buildConfusionMatrix>
  averageRanks: SampleAverageRank[]
  spearmanSummary: SpearmanSummary
  binomialTest: BinomialTestResult
  estimatedAnalysis: EstimatedHardnessAnalysis
  patternFrequency: PatternFrequency
  commentEntries: CommentEntry[]
}

export function useResultsData(): ResultsData {
  const { data: submissions, isLoading } = useSubmissions()
  const { testData, setTestData, clearTestData } = useTestDatasetState()

  const combinedSubmissions = useMemo(() => {
    if (testData.length === 0) {
      return submissions
    }
    return [...submissions, ...testData]
  }, [submissions, testData])

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

  const binomialTest = useMemo(
    () =>
      computeBinomialTest(
        combinedSubmissions,
        TRUE_ORDER,
        RANDOM_SUCCESS_PROBABILITY,
      ),
    [combinedSubmissions],
  )

  const estimatedAnalysis = useMemo(
    () => buildEstimatedHardnessAnalysis(combinedSubmissions, ACTIVE_SAMPLES),
    [combinedSubmissions],
  )

  const patternFrequency = useMemo(
    () => buildIncorrectPatternFrequency(combinedSubmissions, TRUE_ORDER),
    [combinedSubmissions],
  )

  const commentEntries = useMemo(() => {
    const entries = combinedSubmissions
      .map((submission) => {
        const normalized = normalizeOrderForActiveSamples(submission.order)
        if (!normalized) {
          return null
        }
        return {
          id: submission.id,
          timestamp:
            typeof submission.timestamp === 'number'
              ? submission.timestamp
              : Date.now(),
          order: normalized,
          hardness: submission.estimatedHardness ?? {},
          comment: submission.comment ?? null,
        }
      })
      .filter(
        (entry): entry is NonNullable<typeof entry> => entry !== null,
      )
      .sort((a, b) => b.timestamp - a.timestamp)
    return entries
  }, [combinedSubmissions])

  const applyTestData = useCallback(
    (options?: Parameters<typeof generateTestDataset>[0]) => {
      const dataset = generateTestDataset(options)
      setTestData(dataset)
      return dataset
    },
    [setTestData],
  )

  return {
    isLoading,
    submissions,
    combinedSubmissions,
    testData,
    setTestData,
    applyTestData,
    clearTestData,
    confusionMatrix,
    averageRanks,
    spearmanSummary,
    binomialTest,
    estimatedAnalysis,
    patternFrequency,
    commentEntries,
  }
}
