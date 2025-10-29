export type SampleId = 'A' | 'B' | 'C' | 'D'

export interface WaterSample {
  id: SampleId
  label: string
  hardness: number
  hardnessError?: number
}

export type EstimatedHardnessMap = Partial<Record<SampleId, number>>

export interface Submission {
  id: string
  studentId: string | null
  order: SampleId[]
  timestamp: number
  estimatedHardness: EstimatedHardnessMap
  comment: string | null
}

export interface SubmissionInput {
  studentId?: string | null
  order: SampleId[]
  timestamp?: number
  estimatedHardness: EstimatedHardnessMap
  comment?: string | null
}
