import { formatUtc } from '../utils/format'
import { ConfidenceBadge, SourceTag } from './Badges'

// The three fields from the LLM (or the rule-based fallback) plus the confidence badge.
export default function AnalysisCard({ analysis }) {
  if (!analysis) {
    return (
      <section className="rounded-lg bg-slate-900 p-5 ring-1 ring-slate-800">
        <p className="text-slate-400">No analysis available for this incident.</p>
      </section>
    )
  }
  return (
    <section className="rounded-lg bg-slate-900 p-5 ring-1 ring-slate-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">AI analysis</h2>
        <ConfidenceBadge confidence={analysis.confidence} />
      </div>
      <dl className="mt-4 space-y-4">
        <div>
          <dt className="text-sm font-semibold text-slate-400">Probable root cause</dt>
          <dd className="mt-1 text-slate-100">{analysis.root_cause}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-slate-400">Why</dt>
          <dd className="mt-1 whitespace-pre-line break-words text-slate-200">{analysis.why}</dd>
        </div>
        <div>
          <dt className="text-sm font-semibold text-slate-400">Suggested action</dt>
          <dd className="mt-1 whitespace-pre-line text-slate-200">{analysis.suggested_action}</dd>
        </div>
      </dl>
      <p className="mt-4 border-t border-slate-800 pt-3">
        <SourceTag source={analysis.source} />
        <span className="text-xs text-slate-500"> · {formatUtc(analysis.created_at)}</span>
      </p>
    </section>
  )
}
