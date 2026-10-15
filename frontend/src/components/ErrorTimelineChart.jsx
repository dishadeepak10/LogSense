import { useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

import { useTheme } from '../theme/context'
import { formatLogTime } from '../utils/format'

// Checked with a color-blindness validator: errors and warnings stay distinguishable.
// Both colors keep 3:1 contrast on the dark card; the legend, tooltips and table view help too.
// Errors and warnings keep the same colors in every theme; only the card color comes from the theme.
const COLORS = { errors: '#d03b3b', warnings: '#c98500', grid: '#27272a', axis: '#a1a1aa' }

function shortLabel(time, bucketSeconds) {
  const text = formatLogTime(time) // "2026-10-01 09:20:00"
  return bucketSeconds >= 86400 ? text.slice(5, 10) : text.slice(11, 16)
}

function ChartTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const row = payload[0].payload
  return (
    <div className="rounded-md bg-panel px-3 py-2 text-sm shadow-lg ring-1 ring-zinc-800">
      <p className="font-medium text-zinc-100">{formatLogTime(row.time)}</p>
      <p className="text-zinc-300">
        <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.errors }} />
        Errors: {row.errors}
      </p>
      <p className="text-zinc-300">
        <span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS.warnings }} />
        Warnings: {row.warnings}
      </p>
    </div>
  )
}

// Stacked bars: errors and warnings per time bucket (summary.error_timeline).
export default function ErrorTimelineChart({ timeline, bucketSeconds }) {
  const [showTable, setShowTable] = useState(false)
  const { palette } = useTheme()
  if (!timeline.length) {
    return <p className="text-sm text-zinc-400">This log has no readable timestamps, so there is no timeline.</p>
  }
  const rows = timeline.map((b) => ({ ...b, label: shortLabel(b.time, bucketSeconds) }))

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
        <span>One bar = {bucketSeconds >= 60 ? `${bucketSeconds / 60} min` : `${bucketSeconds} s`}</span>
        <button onClick={() => setShowTable(!showTable)} className="rounded-full px-3 py-1 text-accent-soft ring-1 ring-accent-1/40 transition hover:bg-accent-1/15">
          {showTable ? 'Show chart' : 'Show as table'}
        </button>
      </div>
      {showTable ? (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-panel text-zinc-400">
              <tr><th className="py-1">Time</th><th>Errors</th><th>Warnings</th></tr>
            </thead>
            <tbody>
              {rows.filter((r) => r.errors || r.warnings).map((r) => (
                <tr key={r.time} className="border-t border-zinc-800">
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
            <XAxis dataKey="label" tick={{ fontSize: 14, fill: COLORS.axis }} minTickGap={24} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fontSize: 14, fill: COLORS.axis }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: '#27272a' }} />
            {/* Legend words stay in normal text color; the colored square carries the identity */}
            <Legend iconType="square" wrapperStyle={{ fontSize: 15 }}
              formatter={(value) => <span style={{ color: '#d4d4d8' }}>{value}</span>} />
            {/* Stroke in the card color = small gap between stacked parts */}
            <Bar dataKey="errors" name="Errors" stackId="levels" fill={COLORS.errors} stroke={palette.panel} strokeWidth={1} />
            <Bar dataKey="warnings" name="Warnings" stackId="levels" fill={COLORS.warnings} stroke={palette.panel}
              strokeWidth={1} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
