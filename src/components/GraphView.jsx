import { useState, useEffect, useRef, useCallback } from 'react'
import { entryType, entryDisplayName } from '../utils.js'

// ── Constants ────────────────────────────────────────────────────────────────

const W = 900
const H = 620
const REPULSION = 4000
const SPRING_K = 0.055
const SPRING_LEN = 130
const CENTER_K = 0.012
const DAMPING = 0.80
const KE_THRESHOLD = 0.08
const MAX_TICKS = 700

const TYPE_FILL = { primitive: '#4c1d95', dual: '#134e4a', character: '#1e3a8a' }
const TYPE_STROKE = { primitive: '#a78bfa', dual: '#2dd4bf', character: '#60a5fa' }

function baseRadius(entry, entries) {
  const usedByCount = entries.filter(e => e.componentIds.includes(entry.id)).length
  return 10 + Math.min(usedByCount * 4, 18)
}

// ── Physics ──────────────────────────────────────────────────────────────────

function tick(nodes, edges) {
  const map = {}
  for (const n of nodes) map[n.id] = n

  // Repulsion between every pair
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      let dx = b.x - a.x, dy = b.y - a.y
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.5
      const f = REPULSION / (dist * dist)
      const fx = (dx / dist) * f, fy = (dy / dist) * f
      a.vx -= fx; a.vy -= fy
      b.vx += fx; b.vy += fy
    }
  }

  // Spring forces along edges
  for (const { source, target } of edges) {
    const a = map[source], b = map[target]
    if (!a || !b) continue
    const dx = b.x - a.x, dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.5
    const f = SPRING_K * (dist - SPRING_LEN)
    const fx = (dx / dist) * f, fy = (dy / dist) * f
    a.vx += fx; a.vy += fy
    b.vx -= fx; b.vy -= fy
  }

  // Gravity toward center
  const cx = W / 2, cy = H / 2
  for (const n of nodes) {
    n.vx += (cx - n.x) * CENTER_K
    n.vy += (cy - n.y) * CENTER_K
  }

  // Integrate & dampen
  let ke = 0
  for (const n of nodes) {
    if (n.pinned) { n.vx = 0; n.vy = 0; continue }
    n.vx *= DAMPING; n.vy *= DAMPING
    n.x += n.vx; n.y += n.vy
    ke += n.vx * n.vx + n.vy * n.vy
  }
  return ke
}

// ── Component ────────────────────────────────────────────────────────────────

export default function GraphView({ entries, onEdit }) {
  const physRef = useRef([])      // mutable physics nodes {id,x,y,vx,vy,pinned}
  const edgesRef = useRef([])     // {source, target}
  const frameRef = useRef(null)
  const ticksRef = useRef(0)

  const [nodePos, setNodePos] = useState({})   // {id: {x,y}} for rendering
  const [selectedId, setSelectedId] = useState(null)
  const [hoverId, setHoverId] = useState(null)

  // Pan / zoom state (committed values)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  // Transient refs so event handlers always see latest without stale closures
  const panRef = useRef({ x: 0, y: 0 })
  const zoomRef = useRef(1)
  useEffect(() => { panRef.current = pan }, [pan])
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  const svgRef = useRef(null)
  const dragRef = useRef(null)   // {nodeId, startCX, startCY}
  const bgDragRef = useRef(null) // {startCX, startCY, startPan}

  // ── Simulation start / restart ─────────────────────────────────────────────

  const startSim = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    ticksRef.current = 0

    function animate() {
      const ke = tick(physRef.current, edgesRef.current)
      ticksRef.current++

      if (ticksRef.current % 2 === 0) {
        const snap = {}
        for (const n of physRef.current) snap[n.id] = { x: n.x, y: n.y }
        setNodePos(snap)
      }

      if (ke > KE_THRESHOLD && ticksRef.current < MAX_TICKS) {
        frameRef.current = requestAnimationFrame(animate)
      } else {
        frameRef.current = null
        // Final sync
        const snap = {}
        for (const n of physRef.current) snap[n.id] = { x: n.x, y: n.y }
        setNodePos(snap)
      }
    }

    frameRef.current = requestAnimationFrame(animate)
  }, [])

  // ── Init physics when entries change ───────────────────────────────────────

  useEffect(() => {
    const oldPos = {}
    for (const n of physRef.current) oldPos[n.id] = { x: n.x, y: n.y }

    physRef.current = entries.map((e, i) => {
      const prev = oldPos[e.id]
      if (prev) return { id: e.id, x: prev.x, y: prev.y, vx: 0, vy: 0, pinned: false }
      const angle = (i / Math.max(entries.length, 1)) * 2 * Math.PI
      const r = Math.min(W, H) * 0.28
      return {
        id: e.id,
        x: W / 2 + r * Math.cos(angle) + (Math.random() - 0.5) * 40,
        y: H / 2 + r * Math.sin(angle) + (Math.random() - 0.5) * 40,
        vx: 0, vy: 0, pinned: false,
      }
    })

    const ids = new Set(entries.map(e => e.id))
    edgesRef.current = entries.flatMap(e =>
      e.componentIds.filter(cid => ids.has(cid)).map(cid => ({ source: e.id, target: cid }))
    )

    startSim()
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [entries, startSim])

  // ── Coordinate helpers ─────────────────────────────────────────────────────

  function clientToSvg(cx, cy) {
    const rect = svgRef.current.getBoundingClientRect()
    const svgW = rect.width, svgH = rect.height
    const scaleX = W / svgW, scaleY = H / svgH
    return {
      x: (cx - rect.left) * scaleX / zoomRef.current - panRef.current.x / zoomRef.current,
      y: (cy - rect.top)  * scaleY / zoomRef.current - panRef.current.y / zoomRef.current,
    }
  }

  // ── Mouse handlers ─────────────────────────────────────────────────────────

  function onNodeDown(e, id) {
    e.stopPropagation()
    const phys = physRef.current.find(n => n.id === id)
    if (phys) phys.pinned = true
    dragRef.current = { nodeId: id, prevCX: e.clientX, prevCY: e.clientY }
    setSelectedId(id)
  }

  function onBgDown(e) {
    if (e.target !== svgRef.current && !e.target.classList.contains('graph-bg')) return
    bgDragRef.current = {
      startCX: e.clientX, startCY: e.clientY,
      startPan: { ...panRef.current },
    }
    setSelectedId(null)
  }

  function onMouseMove(e) {
    if (dragRef.current) {
      const { nodeId, prevCX, prevCY } = dragRef.current
      const rect = svgRef.current.getBoundingClientRect()
      const scaleX = W / rect.width, scaleY = H / rect.height
      const dx = (e.clientX - prevCX) * scaleX / zoomRef.current
      const dy = (e.clientY - prevCY) * scaleY / zoomRef.current
      const phys = physRef.current.find(n => n.id === nodeId)
      if (phys) { phys.x += dx; phys.y += dy; phys.vx = 0; phys.vy = 0 }
      dragRef.current.prevCX = e.clientX
      dragRef.current.prevCY = e.clientY
      const snap = {}
      for (const n of physRef.current) snap[n.id] = { x: n.x, y: n.y }
      setNodePos(snap)
      return
    }

    if (bgDragRef.current) {
      const { startCX, startCY, startPan } = bgDragRef.current
      const rect = svgRef.current.getBoundingClientRect()
      const scaleX = W / rect.width, scaleY = H / rect.height
      setPan({
        x: startPan.x + (e.clientX - startCX) * scaleX,
        y: startPan.y + (e.clientY - startCY) * scaleY,
      })
    }
  }

  function onMouseUp(e) {
    if (dragRef.current) {
      const phys = physRef.current.find(n => n.id === dragRef.current.nodeId)
      if (phys) phys.pinned = false
      dragRef.current = null
      startSim()
    }
    bgDragRef.current = null
  }

  function onWheel(e) {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.88 : 1 / 0.88
    setZoom(z => Math.max(0.25, Math.min(4, z * factor)))
  }

  // ── Derived render data ────────────────────────────────────────────────────

  const activeId = selectedId || hoverId

  const connectedIds = activeId ? new Set([
    activeId,
    ...entries.find(e => e.id === activeId)?.componentIds ?? [],
    ...entries.filter(e => e.componentIds.includes(activeId)).map(e => e.id),
  ]) : null

  const selectedEntry = selectedId ? entries.find(e => e.id === selectedId) : null
  const selComponents = selectedEntry
    ? selectedEntry.componentIds.map(id => entries.find(e => e.id === id)).filter(Boolean)
    : []
  const selUsedBy = selectedId
    ? entries.filter(e => e.componentIds.includes(selectedId))
    : []

  const transform = `translate(${pan.x} ${pan.y}) scale(${zoom})`

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="graph-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className="graph-svg"
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onMouseDown={onBgDown}
        onWheel={onWheel}
      >
        {/* Arrow marker */}
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" className="graph-arrow" />
          </marker>
        </defs>

        {/* Background catch-all */}
        <rect className="graph-bg" x="0" y="0" width={W} height={H} fill="transparent" />

        <g transform={transform}>
          {/* Edges */}
          {edgesRef.current.map(({ source, target }) => {
            const s = nodePos[source], t = nodePos[target]
            if (!s || !t) return null
            const active = connectedIds ? (connectedIds.has(source) && connectedIds.has(target)) : false
            const tEntry = entries.find(e => e.id === target)
            const tr = tEntry ? baseRadius(tEntry, entries) + 2 : 12
            // Shorten line so arrowhead sits just outside the target node
            const dx = t.x - s.x, dy = t.y - s.y
            const len = Math.sqrt(dx * dx + dy * dy) || 1
            const ex = t.x - (dx / len) * tr
            const ey = t.y - (dy / len) * tr
            return (
              <line
                key={`${source}-${target}`}
                x1={s.x} y1={s.y} x2={ex} y2={ey}
                className={`graph-edge ${active ? 'graph-edge-active' : ''}`}
                markerEnd="url(#arrow)"
              />
            )
          })}

          {/* Nodes */}
          {entries.map(entry => {
            const pos = nodePos[entry.id]
            if (!pos) return null
            const type = entryType(entry)
            const r = baseRadius(entry, entries)
            const isSelected = selectedId === entry.id
            const dim = connectedIds ? !connectedIds.has(entry.id) : false
            const name = entryDisplayName(entry)
            const showLabel = hoverId === entry.id || isSelected

            return (
              <g
                key={entry.id}
                transform={`translate(${pos.x} ${pos.y})`}
                className="graph-node"
                style={{ opacity: dim ? 0.2 : 1, cursor: 'pointer' }}
                onMouseDown={e => onNodeDown(e, entry.id)}
                onMouseEnter={() => setHoverId(entry.id)}
                onMouseLeave={() => setHoverId(null)}
              >
                {isSelected && (
                  <circle r={r + 6} className="graph-node-ring" />
                )}
                <circle
                  r={r}
                  fill={TYPE_FILL[type]}
                  stroke={TYPE_STROKE[type]}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  className="graph-node-circle"
                />
                {/* Character glyph */}
                {entry.character ? (
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="graph-glyph"
                    fontSize={r * 1.05}
                    y={0.5}
                  >
                    {entry.character}
                  </text>
                ) : (
                  <text
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="graph-glyph-abbr"
                    fontSize={r * 0.75}
                  >
                    {name.slice(0, 2)}
                  </text>
                )}
                {/* Label below on hover/select */}
                {showLabel && (
                  <text
                    y={r + 13}
                    textAnchor="middle"
                    className="graph-label"
                  >
                    {name}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* Legend */}
      <div className="graph-legend">
        {[['primitive', 'Primitive'], ['dual', 'Dual'], ['character', 'Character']].map(([type, label]) => (
          <span key={type} className="legend-item">
            <span className={`legend-dot legend-dot-${type}`} />
            {label}
          </span>
        ))}
        <span className="legend-hint">Scroll to zoom · Drag nodes or background</span>
      </div>

      {/* Info panel */}
      {selectedEntry && (
        <div className="graph-info">
          <button className="graph-info-close" onClick={() => setSelectedId(null)}>×</button>
          <div className="graph-info-main">
            {selectedEntry.character && (
              <span className="graph-info-glyph">{selectedEntry.character}</span>
            )}
            <div>
              <p className="graph-info-name">{entryDisplayName(selectedEntry)}</p>
              {selectedEntry.primitiveKeywords?.length > 0 && (
                <p className="graph-info-sub">Also: {selectedEntry.primitiveKeywords.join(', ')}</p>
              )}
            </div>
          </div>
          {selComponents.length > 0 && (
            <p className="graph-info-row">
              <span className="graph-info-label">Components</span>
              {selComponents.map(c => (
                <span key={c.id} className={`comp-tag comp-tag-${entryType(c)}`}>
                  {c.character && <span>{c.character}</span>}
                  {entryDisplayName(c)}
                </span>
              ))}
            </p>
          )}
          {selUsedBy.length > 0 && (
            <p className="graph-info-row">
              <span className="graph-info-label">Used in</span>
              {selUsedBy.map(c => (
                <span key={c.id} className={`comp-tag comp-tag-${entryType(c)}`}>
                  {c.character && <span>{c.character}</span>}
                  {entryDisplayName(c)}
                </span>
              ))}
            </p>
          )}
          <button className="btn btn-outline btn-sm" onClick={() => onEdit(selectedEntry)}>
            Edit entry
          </button>
        </div>
      )}
    </div>
  )
}
