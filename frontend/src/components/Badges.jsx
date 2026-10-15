import { CATEGORY_LABELS, SEVERITY_STYLES } from '../utils/format'

export function SeverityBadge({ severity }) {
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ${
        SEVERITY_STYLES[severity] || SEVERITY_STYLES.low
      }`}
    >
      {severity}
    </span>
  )
}

export function CategoryTag({ category }) {
  return (
    <span className="inline-flex rounded-md bg-slate-800 px-2 py-0.5 text-xs font-medium text-slate-300">
      {CATEGORY_LABELS[category] || category}
    </span>
  )
}

// Green when the LLM and the keyword rules agree, amber otherwise.
// Icon + words, so the meaning never depends on color alone.
export function ConfidenceBadge({ confidence }) {
  if (confidence === 'high') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-950 px-2.5 py-0.5 text-xs font-semibold text-green-300 ring-1 ring-green-800">
        <span aria-hidden="true">✓</span> High confidence
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-amber-950 px-2.5 py-0.5 text-xs font-semibold text-amber-200 ring-1 ring-amber-800">
      <span aria-hidden="true">!</span> Low confidence, verify manually
    </span>
  )
}

export function SourceTag({ source }) {
  return (
    <span className="text-xs text-slate-400">
      {source === 'llm' ? 'Explained by the AI model' : 'Rule-based explanation (no AI used)'}
    </span>
  )
}
