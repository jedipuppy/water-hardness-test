import {
  addDoc,
  collection,
  getDocs,
  getFirestore,
  onSnapshot,
  orderBy,
  query,
  type Firestore,
  type QueryDocumentSnapshot,
  type DocumentData,
} from 'firebase/firestore'
import { initializeApp, getApps } from 'firebase/app'
import type {
  EstimatedHardnessMap,
  SampleId,
  Submission,
  SubmissionInput,
} from '../types'

const SAMPLE_IDS: SampleId[] = ['A', 'B', 'C', 'D']
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const isFirebaseConfigured = Object.values(firebaseConfig).every(
  (value) => typeof value === 'string' && value.length > 0,
)

const firestore: Firestore | null = initializeFirestore()

function initializeFirestore(): Firestore | null {
  if (!isFirebaseConfigured) {
    return null
  }

  const existing = getApps()
  const app = existing.length > 0 ? existing[0] : initializeApp(firebaseConfig)
  return getFirestore(app)
}

const LOCAL_STORAGE_KEY = 'water-hardness-test/submissions'
type Listener = (submissions: Submission[]) => void
const localListeners = new Set<Listener>()
let localCache: Submission[] | null = null

export async function createSubmission(
  input: SubmissionInput,
): Promise<Submission> {
  const estimatedHardness = sanitizeEstimatedHardness(input.estimatedHardness)
  if (!estimatedHardness) {
    throw new Error('全てのカードで推定硬度を入力してください。')
  }
  const comment = sanitizeComment(input.comment)
  const submissionBase = {
    studentId: sanitizeStudentId(input.studentId),
    order: [...input.order],
    timestamp: input.timestamp ?? Date.now(),
    estimatedHardness,
    comment,
  }

  if (firestore) {
    const docRef = await addDoc(collection(firestore, 'submissions'), submissionBase)
    return { ...submissionBase, id: docRef.id }
  }

  const submission = { ...submissionBase, id: generateLocalId() }
  persistLocal([...getLocalCache(), submission])
  notifyLocal()
  return submission
}

export async function fetchSubmissions(): Promise<Submission[]> {
  if (firestore) {
    const submissionsQuery = query(
      collection(firestore, 'submissions'),
      orderBy('timestamp', 'asc'),
    )
    const snapshot = await getDocs(submissionsQuery)
    return snapshot.docs.map(extractSubmission)
  }

  return [...getLocalCache()]
}

export function subscribeToSubmissions(callback: Listener): () => void {
  if (firestore) {
    const submissionsQuery = query(
      collection(firestore, 'submissions'),
      orderBy('timestamp', 'asc'),
    )
    const unsubscribe = onSnapshot(submissionsQuery, (snapshot) => {
      callback(snapshot.docs.map(extractSubmission))
    })
    return unsubscribe
  }

  localListeners.add(callback)
  callback([...getLocalCache()])

  return () => {
    localListeners.delete(callback)
  }
}

function extractSubmission(
  doc: QueryDocumentSnapshot<DocumentData>,
): Submission {
  const data = doc.data()
  const order = (Array.isArray(data.order) ? data.order : []) as SampleId[]

  const estimatedHardness = sanitizeEstimatedHardness(data.estimatedHardness)
  return {
    id: doc.id,
    studentId: data.studentId ?? null,
    order,
    timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
    estimatedHardness: estimatedHardness ?? {},
    comment: sanitizeComment(data.comment),
  }
}

function sanitizeStudentId(studentId: SubmissionInput['studentId']): string | null {
  const trimmed = (studentId ?? '').trim()
  return trimmed.length > 0 ? trimmed : null
}

function sanitizeComment(comment: SubmissionInput['comment']): string | null {
  const trimmed = (comment ?? '').trim()
  return trimmed.length > 0 ? trimmed : null
}

function generateLocalId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return `local-${Math.random().toString(36).slice(2, 10)}`
}

function getLocalCache(): Submission[] {
  if (localCache) {
    return localCache
  }

  const storage = getStorage()
  if (!storage) {
    localCache = []
    return localCache
  }

  try {
    const raw = storage.getItem(LOCAL_STORAGE_KEY)
    if (!raw) {
      localCache = []
    } else {
      const parsed = JSON.parse(raw) as Submission[]
      localCache = Array.isArray(parsed) ? parsed : []
    }
  } catch {
    localCache = []
  }
  return localCache
}

function persistLocal(submissions: Submission[]): void {
  localCache = submissions
  const storage = getStorage()
  if (!storage) {
    return
  }
  storage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(submissions))
}

function notifyLocal(): void {
  const snapshot = [...getLocalCache()]
  localListeners.forEach((listener) => listener(snapshot))
}

export async function clearLocalSubmissions(): Promise<boolean> {
  if (firestore) {
    return false
  }
  persistLocal([])
  notifyLocal()
  return true
}

function getStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }
  return window.localStorage
}

export const isUsingFirebase = Boolean(firestore)

function sanitizeEstimatedHardness(
  source: SubmissionInput['estimatedHardness'] | EstimatedHardnessMap | undefined,
): EstimatedHardnessMap | undefined {
  if (!source) {
    return undefined
  }
  const entries = Object.entries(source)
    .map(([sampleId, value]) => {
      const numeric = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(numeric)) {
        return null
      }
      return [sampleId, numeric] as const
    })
    .filter((entry): entry is [string, number] => entry !== null)
    .filter(([sampleId]) => SAMPLE_IDS.includes(sampleId as SampleId))

  if (entries.length === 0) {
    return undefined
  }

  return entries.reduce<EstimatedHardnessMap>((acc, [sampleId, value]) => {
    acc[sampleId as SampleId] = value
    return acc
  }, {})
}
