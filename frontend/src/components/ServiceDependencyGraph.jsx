import { useMemo, useState, useRef } from 'react'

// ─── helpers ────────────────────────────────────────────────────────────────

const SEV_ORDER = { critical: 4, high: 3, medium: 2, low: 1 }

function sevRank(s) {
  return SEV_ORDER[s?.toLowerCase()] ?? 0
}

/** Return the fill colour for a node based on its worst incident severity. */
function nodeColor(worstSev) {
  switch (worstSev?.toLowerCase()) {
    case 'critical': return '#ef4444' // red-500
    case 'high':     return '#f97316' // orange-500
    case 'medium':   return '#f59e0b' // amber-500
    default:         return '#71717a' // zinc-500
  }
}

// ─── layout ─────────────────────────────────────────────────────────────────

const W = 800
const H = 300
const CX = W / 2
const CY = H / 2
const PADDING = 60

/** Circular layout for ≤ 8 nodes. */
function circularLayout(nodes) {
  const r = Math.min(CX, CY) - PADDING
  return nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2
    return { ...n, x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle) }
  })
}

/** Simple spring layout for > 8 nodes; runs ~200 iterations. */
function springLayout(nodes, edges) {
  const REPEL = 4000
  const ATTRACT = 0.04
  const DAMPING = 0.85
  const ITERS = 200

  // Start on a circle then settle
  let pos = nodes.map((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2
    const r = Math.min(CX, CY) - PADDING
    return { id: n.id, x: CX + r * Math.cos(angle), y: CY + r * Math.sin(angle), vx: 0, vy: 0 }
  })

  const idxOf = Object.fromEntries(pos.map((p, i) => [p.id, i]))

  for (let iter = 0; iter < ITERS; iter++) {
    const forces = pos.map(() => ({ fx: 0, fy: 0 }))

    // Repulsion between all pairs
    for (let a = 0; a < pos.length; a++) {
      for (let b = a + 1; b < pos.length; b++) {
        const dx = pos[b].x - pos[a].x
        const dy = pos[b].y - pos[a].y
        const dist2 = Math.max(1, dx * dx + dy * dy)
        const dist = Math.sqrt(dist2)
        const f = REPEL / dist2
        forces[a].fx -= (f * dx) / dist
        forces[a].fy -= (f * dy) / dist
        forces[b].fx += (f * dx) / dist
        forces[b].fy += (f * dy) / dist
      }
    }

    // Attraction along edges
    for (const e of edges) {
      const ai = idxOf[e.source]
      const bi = idxOf[e.target]
      if (ai == null || bi == null) continue
      const dx = pos[bi].x - pos[ai].x
      const dy = pos[bi].y - pos[ai].y
      forces[ai].fx += ATTRACT * dx
      forces[ai].fy += ATTRACT * dy
      forces[bi].fx -= ATTRACT * dx
      forces[bi].fy -= ATTRACT * dy
    }

    // Integrate
    pos = pos.map((p, i) => {
      const vx = (p.vx + forces[i].fx) * DAMPING
      const vy = (p.vy + forces[i].fy) * DAMPING
      return {
        ...p,
        vx,
        vy,
        x: Math.max(PADDING, Math.min(W - PADDING, p.x + vx)),
        y: Math.max(PADDING, Math.min(H - PADDING, p.y + vy)),
      }
    })
  }

  return nodes.map((n, i) => ({ ...n, x: pos[i].x, y: pos[i].y }))
}

// ─── main component ──────────────────────────────────────────────────────────

/**
 * @param {object[]} incidents  – incident objects with service_timeline & severity
 * @param {string[]} allServices – all service names from summary.services
 */
export default function ServiceDependencyGraph({ incidents = [], allServices = [] }) {
  const [hoveredNode, setHoveredNode] = useState(null)
  const [hoveredEdge, setHoveredEdge] = useState(null)
  const [tooltip, setTooltip] = useState(null) // { x, y, lines[] }
  const svgRef = useRef(null)

  // ── derive graph data ──────────────────────────────────────────────────────
  const { nodes, edges, hasCascades } = useMemo(() => {
    // Collect per-service stats
    const serviceStats = {} // id → { worstSev, totalErrors }
    for (const svc of allServices) {
      serviceStats[svc] = { worstSev: null, totalErrors: 0 }
    }

    // Map edge key → { count, incidentTitles }
    const edgeMap = {}

    let hasCascades = false

    for (const inc of incidents) {
      const timeline = inc.service_timeline ?? []
      if (timeline.length < 2) continue
      hasCascades = true

      const rank = sevRank(inc.severity)

      for (const entry of timeline) {
        const svc = entry.service
        if (!serviceStats[svc]) serviceStats[svc] = { worstSev: null, totalErrors: 0 }
        serviceStats[svc].totalErrors += entry.error_count ?? 0
        if (rank > sevRank(serviceStats[svc].worstSev)) {
          serviceStats[svc].worstSev = inc.severity
        }
      }

      // Edges: each consecutive pair in timeline represents a cascade
      for (let i = 0; i < timeline.length - 1; i++) {
        const src = timeline[i].service
        const tgt = timeline[i + 1].service
        const key = `${src}→${tgt}`
        if (!edgeMap[key]) edgeMap[key] = { source: src, target: tgt, count: 0, titles: [] }
        edgeMap[key].count += 1
        edgeMap[key].titles.push(inc.title ?? inc.id ?? 'Incident')
      }
    }

    if (!hasCascades) return { nodes: [], edges: [], hasCascades: false }

    // Find "first to break" in the worst incident
    const worstInc = incidents
      .filter(i => (i.service_timeline ?? []).length >= 2)
      .sort((a, b) => sevRank(b.severity) - sevRank(a.severity))[0]
    const firstBreaker = worstInc?.service_timeline?.[0]?.service ?? null

    // Build node list from services that appear in any cascade edge, plus allServices
    const involvedServices = new Set([
      ...Object.keys(serviceStats),
      ...Object.values(edgeMap).flatMap(e => [e.source, e.target]),
    ])

    const rawNodes = [...involvedServices].map(id => ({
      id,
      worstSev: serviceStats[id]?.worstSev ?? null,
      totalErrors: serviceStats[id]?.totalErrors ?? 0,
      isFirstBreaker: id === firstBreaker,
    }))

    const edges = Object.values(edgeMap)

    // Layout
    const laid = rawNodes.length <= 8 ? circularLayout(rawNodes) : springLayout(rawNodes, edges)

    return { nodes: laid, edges, hasCascades }
  }, [incidents, allServices])

  // ── empty state ────────────────────────────────────────────────────────────
  if (!hasCascades) {
    return (
      <div className="flex h-[200px] flex-col items-center justify-center gap-2 rounded-xl bg-zinc-800/40 text-center">
        <span className="text-3xl">🔗</span>
        <p className="text-sm font-medium text-zinc-300">No cross-service cascades detected.</p>
        <p className="text-xs text-zinc-500">Either there are no incidents, or each incident affected only one service.</p>
      </div>
    )
  }

  // ── node radius scale ──────────────────────────────────────────────────────
  const maxErrors = Math.max(1, ...nodes.map(n => n.totalErrors))
  function nodeRadius(n) {
    const base = 14
    const extra = 10
    return base + extra * Math.sqrt(n.totalErrors / maxErrors)
  }

  // ── edge stroke width ──────────────────────────────────────────────────────
  function edgeWidth(count) {
    if (count >= 3) return 3
    if (count === 2) return 2
    return 1.2
  }

  // ── arrow endpoint offset (so arrow starts/ends at node border) ───────────
  function edgeEndpoints(src, tgt) {
    const dx = tgt.x - src.x
    const dy = tgt.y - src.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    const nx = dx / dist
    const ny = dy / dist
    const sr = nodeRadius(src) + 2
    const tr = nodeRadius(tgt) + 6 // extra gap for arrowhead
    return {
      x1: src.x + nx * sr,
      y1: src.y + ny * sr,
      x2: tgt.x - nx * tr,
      y2: tgt.y - ny * tr,
    }
  }

  const nodeById = Object.fromEntries(nodes.map(n => [n.id, n]))

  // ── tooltip handler ────────────────────────────────────────────────────────
  function showEdgeTooltip(e, edge) {
    const svg = svgRef.current
    if (!svg) return
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse())
    setTooltip({
      x: svgPt.x,
      y: svgPt.y - 12,
      lines: [`${edge.source} → ${edge.target}`, ...edge.titles.slice(0, 5)],
    })
  }

  function hideTooltip() {
    setTooltip(null)
    setHoveredEdge(null)
  }

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: '100%', height: '320px' }}
      aria-label="Service dependency graph"
    >
      <defs>
        {/* Arrowhead marker — default */}
        <marker id="sdg-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#52525b" />
        </marker>
        {/* Arrowhead marker — highlighted */}
        <marker id="sdg-arrow-hl" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="var(--accent-1, #10b981)" />
        </marker>
        {/* Pulse animation for first-breaker ring */}
        <style>{`
          @keyframes sdg-pulse {
            0%, 100% { opacity: 0.8; r: 4px; }
            50% { opacity: 0.3; r: 8px; }
          }
          .sdg-pulse-ring { animation: sdg-pulse 1.8s ease-in-out infinite; }
        `}</style>
      </defs>

      {/* ── edges ── */}
      {edges.map((edge) => {
        const src = nodeById[edge.source]
        const tgt = nodeById[edge.target]
        if (!src || !tgt) return null
        const ep = edgeEndpoints(src, tgt)
        const isHl =
          hoveredNode === edge.source ||
          hoveredNode === edge.target ||
          hoveredEdge === `${edge.source}→${edge.target}`
        return (
          <line
            key={`${edge.source}→${edge.target}`}
            x1={ep.x1} y1={ep.y1} x2={ep.x2} y2={ep.y2}
            stroke={isHl ? 'var(--accent-1, #10b981)' : '#52525b'}
            strokeWidth={edgeWidth(edge.count)}
            strokeOpacity={hoveredNode && !isHl ? 0.15 : 0.9}
            markerEnd={isHl ? 'url(#sdg-arrow-hl)' : 'url(#sdg-arrow)'}
            strokeLinecap="round"
            style={{ cursor: 'pointer', transition: 'stroke 0.15s, stroke-opacity 0.15s' }}
            onMouseEnter={(e) => { setHoveredEdge(`${edge.source}→${edge.target}`); showEdgeTooltip(e, edge) }}
            onMouseLeave={hideTooltip}
          />
        )
      })}

      {/* ── nodes ── */}
      {nodes.map((node) => {
        const r = nodeRadius(node)
        const color = nodeColor(node.worstSev)
        const isHl = hoveredNode === node.id
        const dimmed = hoveredNode && !isHl

        return (
          <g
            key={node.id}
            style={{ cursor: 'default' }}
            onMouseEnter={() => setHoveredNode(node.id)}
            onMouseLeave={() => setHoveredNode(null)}
          >
            {/* Teal pulse ring for first-breaker */}
            {node.isFirstBreaker && (
              <circle
                cx={node.x} cy={node.y}
                r={r + 6}
                fill="none"
                stroke="var(--accent-2, #14b8a6)"
                strokeWidth="2"
                strokeOpacity={dimmed ? 0.1 : 0.7}
                className="sdg-pulse-ring"
              />
            )}

            {/* Main circle */}
            <circle
              cx={node.x} cy={node.y} r={r}
              fill={color}
              fillOpacity={dimmed ? 0.2 : isHl ? 1 : 0.85}
              stroke={isHl ? '#fff' : 'rgba(255,255,255,0.15)'}
              strokeWidth={isHl ? 2 : 1}
              style={{ transition: 'fill-opacity 0.15s, stroke 0.15s' }}
            />

            {/* Label */}
            <text
              x={node.x}
              y={node.y + r + 14}
              textAnchor="middle"
              fontSize="10"
              fill={dimmed ? '#52525b' : '#d4d4d8'}
              style={{ transition: 'fill 0.15s', userSelect: 'none', pointerEvents: 'none' }}
            >
              {node.id.length > 18 ? node.id.slice(0, 16) + '…' : node.id}
            </text>

            {/* Error count badge (only if > 0) */}
            {node.totalErrors > 0 && (
              <text
                x={node.x}
                y={node.y + 4}
                textAnchor="middle"
                fontSize="9"
                fontWeight="600"
                fill="#fff"
                fillOpacity={dimmed ? 0.2 : 0.9}
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {node.totalErrors > 999 ? '999+' : node.totalErrors}
              </text>
            )}
          </g>
        )
      })}

      {/* ── tooltip ── */}
      {tooltip && (
        <g>
          <rect
            x={tooltip.x - 4}
            y={tooltip.y - tooltip.lines.length * 14 - 6}
            width={Math.max(...tooltip.lines.map(l => l.length)) * 6.2 + 16}
            height={tooltip.lines.length * 14 + 10}
            rx="4" ry="4"
            fill="#18181b"
            stroke="#3f3f46"
            strokeWidth="1"
          />
          {tooltip.lines.map((line, i) => (
            <text
              key={i}
              x={tooltip.x + 4}
              y={tooltip.y - tooltip.lines.length * 14 + i * 14 + 4}
              fontSize={i === 0 ? '11' : '9'}
              fontWeight={i === 0 ? '600' : '400'}
              fill={i === 0 ? '#d4d4d8' : '#a1a1aa'}
            >
              {line}
            </text>
          ))}
        </g>
      )}
    </svg>
  )
}
