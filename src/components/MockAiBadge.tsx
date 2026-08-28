import { FlaskConical } from 'lucide-react'
import { MODEL_ID } from '../ai/mockNova'

/** Every AI surface in this build carries one of these. Nothing calls a model. */
export function MockAiBadge({ label }: { label?: string }) {
  return (
    <span
      className="mockai-badge"
      title={`Mock-up of ${MODEL_ID}. No model is invoked; the text comes from a local template.`}
    >
      <FlaskConical aria-hidden size={12} />
      <span>{label ?? 'Mock-up — no AI model is called'}</span>
    </span>
  )
}
