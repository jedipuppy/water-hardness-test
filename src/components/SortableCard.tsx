import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { CSSProperties } from 'react'
import type { SampleId, WaterSample } from '../types'

interface Props {
  sample: WaterSample
  position: number
  value: string
  onChange: (sampleId: SampleId, value: string) => void
}

export function SortableCard({ sample, position, value, onChange }: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: sample.id })

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.8 : 1,
    cursor: isDragging ? 'grabbing' : 'grab',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="sortable-card"
      {...attributes}
      {...listeners}
    >
      <div className="sortable-card-rank">{position + 1}</div>
      <div className="sortable-card-body">
        <div className="sortable-card-header">
          <span className="sortable-card-title">{sample.label}</span>
        </div>
        <div className="sortable-card-form">
          <label className="sortable-card-field">
            推定硬度
            <input
              type="range"
              min="0"
              max="2000"
              step="1"
              value={value}
              onChange={(event) => onChange(sample.id, event.target.value)}
              required
            />
          </label>
          <div className="sortable-card-range">
            現在値: <span className="sortable-card-range-value">{Number(value).toFixed(0)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
