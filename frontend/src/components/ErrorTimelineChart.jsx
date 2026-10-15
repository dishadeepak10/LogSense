import { useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

import { formatLogTime } from '../utils/format'

// Checked with a color-blindness validator: errors and warnings stay distinguishable.
// Warnings are light, so the chart also has a legend, tooltips and a table view.
const COLORS = { errors: '#d03b3b', warnings: '#eda100', grid: '#e2e8f0', axis: '#64748b' }

function shortLabel(time, bucketSeconds) {
  const text = formatLogTime(time) // "2026-10-01 09:20:00"
  return bucketSeconds >= 86400 ? text.slice(5, 10) : text.slice(11, 16)
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-md bg-white px-3 py-2 text-sm shadow-lg ring-1 ring-slate-200">
      <p className="font-medium text-slate-900">{formatLogTime(row.time)}</p>
      <p className="text-slate-700">
        <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.errors }} />
        Errors: {row.errors}
      </p>
      <p className="text-slate-700">
        <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.warnings }} />
        Warnings: {row.warnings}
      </p>
    </div>
  )
}

// Stacked bars: errors and warnings per time bucket (summary.error_timeline).
export default function ErrorTimelineChart({ timeline, bucketSeconds }) {
  const [showTable, setShowTable] = useState(false)
  if (!timeline.length) {
    return <p className="text-sm text-slate-500">This log has no readable timestamps, so there is no timeline.</p>
  }
  const rows = timeline.map((b) => ({ ...b, label: shortLabel(b.time, bucketSeconds) }))

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span>One bar = {bucketSeconds >= 60 ? `${bucketSeconds / 60} min` : `${bucketSeconds} s`}</span>
        <button onClick={() => setShowTable(!showTable)} className="text-blue-700 hover:underline">
          {showTable ? 'Show chart' : 'Show as table'}
        </button>
      </div>
      {showTable ? (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-white text-slate-500">
              <tr><th className="py-1">Time</th><th>Errors</th><th>Warnings</th></tr>
            </thead>
            <tbody>
              {rows.filter((r) => r.errors || r.warnings).map((r) => (
                <tr key={r.time} className="border-t border-slate-100">
                  <td className="py-1">{formatLogTime(r.time)}</td><td>{r.errors}</td><td>{r.warnings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={rows} barCategoryGap={1} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke={COLORS.grid} />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: COLORS.axis }} minTickGap={24} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: COLORS.axis }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
            {/* Legend words stay in normal text color; the colored square carries the identity */}
            <Legend iconType="square" wrapperStyle={{ fontSize: 13 }}
              formatter={(value) => <span style={{ color: '#334155' }}>{value}</span>} />
            {/* White stroke = small gap between stacked parts */}
            <Bar dataKey="errors" name="Errors" stackId="levels" fill={COLORS.errors} stroke="#fff" strokeWidth={1} />
            <Bar dataKey="warnings" name="Warnings" stackId="levels" fill={COLORS.warnings} stroke="#fff"
              strokeWidth={1} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
