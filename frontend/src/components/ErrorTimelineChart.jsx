import { useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Legend, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'

import { useTheme } from '../theme/context'
import { formatLogTime, logTimeMs } from '../utils/format'

// Errors and warnings keep the same colors in both modes (checked with a color-blindness
// validator on the dark and the white card). Grid, axis, gap and incident-shade colors follow the mode.
const COLORS = { errors: '#d03b3b', warnings: '#c98500' }
const MODE_COLORS = {
  dark: { grid: '#27272a', axis: '#a1a1aa', cursor: '#27272a', legend: '#d4d4d8', panel: '#18181b', incident: '#10b981' },
  light: { grid: '#e4e4e7', axis: '#52525b', cursor: '#f4f4f5', legend: '#3f3f46', panel: '#ffffff', incident: '#059669' },
}

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

const MAX_SHADED_INCIDENTS = 5 // more shaded areas would clutter the chart

// Round y-axis steps (1, 2, 5, 10, 20, 50...) with ~20% headroom above the tallest bar,
// so the axis reads 0, 5, 10 instead of 0, 3, 6, 9, 10 and incident labels have room.
function yTicks(rows) {
  const tallest = Math.max(...rows.map((r) => r.errors + r.warnings), 1)
  const target = tallest * 1.2
  const rough = target / 4
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const step = Math.max(1, [1, 2, 5, 10].map((m) => m * magnitude).find((v) => v >= rough)) // counts are whole numbers
  const ticks = []
  for (let v = 0; v <= Math.ceil(target / step) * step; v += step) ticks.push(v)
  return ticks
}

// The bar (bucket) a log time falls into: the last bucket that starts at or before it.
function bucketOf(rows, time) {
  const at = logTimeMs(time)
  if (at == null) return null
  let found = rows[0].time
  for (const row of rows) {
    if (logTimeMs(row.time) <= at) found = row.time
  }
  return found
}

// Stacked bars: errors and warnings per time bucket (summary.error_timeline).
// The most severe incidents are shaded, so you can see which spike became which incident.
export default function ErrorTimelineChart({ timeline, bucketSeconds, incidents = [] }) {
  const [showTable, setShowTable] = useState(false)
  const ui = MODE_COLORS[useTheme().mode]
  if (!timeline.length) {
    return <p className="text-sm text-zinc-400">This log has no readable timestamps, so there is no timeline.</p>
  }
  const rows = timeline
  const ticks = yTicks(rows)
  const shaded = incidents
    .slice(0, MAX_SHADED_INCIDENTS)
    .map((i) => ({ id: i.id, from: bucketOf(rows, i.start_time), to: bucketOf(rows, i.end_time) }))
    .filter((i) => i.from && i.to)

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between text-xs text-zinc-400">
        <span>
          One bar = {bucketSeconds >= 60 ? `${bucketSeconds / 60} min` : `${bucketSeconds} s`}
          {shaded.length > 0 && <span className="ml-2 text-accent-soft">· shaded = incident</span>}
        </span>
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
        <div className="min-h-[260px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} barCategoryGap={1} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke={ui.grid} />
            <XAxis dataKey="time" tickFormatter={(t) => shortLabel(t, bucketSeconds)} tick={{ fontSize: 14, fill: ui.axis }}
              minTickGap={24} tickLine={false} />
            <YAxis allowDecimals={false} domain={[0, ticks[ticks.length - 1]]} ticks={ticks} tick={{ fontSize: 14, fill: ui.axis }} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: ui.cursor }} />
            {/* Legend words stay in normal text color; the colored square carries the identity */}
            <Legend iconType="square" wrapperStyle={{ fontSize: 15 }}
              formatter={(value) => <span style={{ color: ui.legend }}>{value}</span>} />
            {shaded.map((i) => (
              <ReferenceArea key={i.id} x1={i.from} x2={i.to} fill={ui.incident} fillOpacity={0.12}
                stroke={ui.incident} strokeOpacity={0.4} strokeDasharray="4 3"
                label={{ value: `#${i.id}`, position: 'insideTop', fill: ui.incident, fontSize: 13, fontWeight: 600 }} />
            ))}
            {/* Stroke in the card color = small gap between stacked parts */}
            <Bar dataKey="errors" name="Errors" stackId="levels" fill={COLORS.errors} stroke={ui.panel} strokeWidth={1} />
            <Bar dataKey="warnings" name="Warnings" stackId="levels" fill={COLORS.warnings} stroke={ui.panel}
              strokeWidth={1} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
