import { useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { DndContext, type DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { SortableCard } from '../components/SortableCard'
import { ACTIVE_SAMPLES, TRUE_ORDER } from '../config'
import { useSubmitSubmission } from '../hooks/useSubmissions'
import type { SampleId } from '../types'

const initialOrder: SampleId[] = [...TRUE_ORDER]
const sampleMap = new Map(ACTIVE_SAMPLES.map((sample) => [sample.id, sample]))
const initialEstimatedInputs = ACTIVE_SAMPLES.reduce<Record<SampleId, string>>(
  (acc, sample) => {
    acc[sample.id] = '0'
    return acc
  },
  {} as Record<SampleId, string>,
)

export default function InputPage() {
  const [order, setOrder] = useState<SampleId[]>(initialOrder)
  const [studentId, setStudentId] = useState('')
  const [estimatedHardnessInputs, setEstimatedHardnessInputs] = useState(
    initialEstimatedInputs,
  )
  const [comment, setComment] = useState('')
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const submitMutation = useSubmitSubmission()

  const orderedSamples = useMemo(
    () =>
      order.map((sampleId) => {
        const sample = sampleMap.get(sampleId)
        if (!sample) {
          throw new Error(`Unknown sample id: ${sampleId}`)
        }
        return sample
      }),
    [order],
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) {
      return
    }
    setOrder((current) => {
      const oldIndex = current.indexOf(active.id as SampleId)
      const newIndex = current.indexOf(over.id as SampleId)
      return arrayMove(current, oldIndex, newIndex)
    })
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)

    const estimatedHardnessMap = Object.entries(
      estimatedHardnessInputs,
    ).reduce<Record<SampleId, number>>((acc, [sampleId, value]) => {
      const numeric = Number(value)
      if (Number.isFinite(numeric)) {
        acc[sampleId as SampleId] = numeric
      }
      return acc
    }, {} as Record<SampleId, number>)

    if (Object.keys(estimatedHardnessMap).length !== ACTIVE_SAMPLES.length) {
      setError('全てのカードで推定硬度を入力してください。')
      return
    }

    submitMutation.mutate(
      {
        studentId,
        order,
        estimatedHardness: estimatedHardnessMap,
        comment,
      },
      {
        onSuccess: () => {
          navigate('/results')
        },
        onError: (submissionError) => {
          setError(submissionError.message)
        },
      },
    )
  }

  const resetOrder = () => {
    setOrder(initialOrder)
    setEstimatedHardnessInputs(initialEstimatedInputs)
    setComment('')
    setError(null)
  }

  const handleEstimatedChange = (sampleId: SampleId, value: string) => {
    setEstimatedHardnessInputs((current) => ({
      ...current,
      [sampleId]: value,
    }))
  }

  return (
    <div className="page">
      <section className="panel">
        <h2>ドラッグ＆ドロップで順位と推定硬度を登録</h2>
        <p className="panel-description">
          上から硬度が低いと思う順に並べ替え、各カードのスライダーで推定硬度を入力してください。提出後は集計ページで全体の傾向を確認できます。
        </p>
        <form className="form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>学籍番号（任意）</span>
            <input
              type="text"
              placeholder="例: S1234567"
              value={studentId}
              onChange={(event) => setStudentId(event.target.value)}
              autoComplete="off"
            />
            <small>匿名参加も可能です。</small>
          </label>
          <div className="drag-area">
            <DndContext onDragEnd={handleDragEnd}>
              <SortableContext
                items={order}
                strategy={verticalListSortingStrategy}
              >
                <div className="sortable-stack">
                  {orderedSamples.map((sample, index) => (
                    <SortableCard
                      key={sample.id}
                      sample={sample}
                      position={index}
                      value={estimatedHardnessInputs[sample.id]}
                      onChange={handleEstimatedChange}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
          <label className="form-field">
            <span>硬度によってどんな違いを感じた？（任意）</span>
            <textarea
              rows={3}
              placeholder="例: Aは口当たりが柔らかく、Dはしっかりした苦みを感じました"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
            />
          </label>
          {error ? <div className="form-error">{error}</div> : null}
          <div className="form-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={resetOrder}
              disabled={submitMutation.isPending}
            >
              初期順に戻す
            </button>
            <button
              type="submit"
              className="button"
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? '送信中…' : '回答を送信'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel panel-secondary">
        <h3>保存について</h3>
        <ul className="bullet-list">
          <li>回答はタイムスタンプ付きで保存されます。</li>
          <li>Firebase の設定が未入力の場合はブラウザに仮保存されます。</li>
          <li>統計は回答送信後すぐに更新されます。</li>
        </ul>
      </section>
    </div>
  )
}
