import { useState, useEffect, useRef, useCallback } from 'react'
import { entryType, entryDisplayName } from '../utils.js'

// ── Physics constants ─────────────────────────────────────────────────────────

const W = 900
const H = 620

const REPULSION        = 1600
const REPULSION_CUT_SQ = 240 * 240
const SPRING_K         = 0.06
const SPRING_LEN       = 80
const CENTER_K         = 0.016
const VELOCITY_DECAY   = 0.38
const MAX_V            = 12
const ALPHA_INIT       = 1.0
const ALPHA_DECAY      = 0.0228
const ALPHA_MIN        = 0.001

const TYPE_FILL   = { primitive: '#4c1d95', dual: '#134e4a', character: '#1e3a8a' }
const TYPE_STROKE = { primitive: '#a78bfa', dual: '#2dd4bf', character: '#60a5fa' }

// ── Helpers ───────────────────────────────────────────────────────────────────

function baseRadius(usedByCount) {
  return 10 + Math.min(usedByCount * 4, 18)
}

function fibonacciPos(i, N, cx, cy) {
  const golden = Math.PI * (3 - Math.sqrt(5))
  const r = Math.min(W, H) * 0.44 * Math.sqrt((i + 0.5) / Math.max(N, 1))
  const theta = i * golden
  return {
    x: cx + r * Math.cos(theta) + (Math.random() - 0.5) * 4,
    y: cy + r * Math.sin(theta) + (Math.random() - 0.5) * 4,
  }
}

// ── Physics tick ──────────────────────────────────────────────────────────────

function tick(sim) {
  const { nodes, edges } = sim
  const alpha = sim.alpha
  const map = {}
  for (const n of nodes) map[n.id] = n

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j]
      const dx = b.x - a.x, dy = b.y - a.y
      const dSq = dx * dx + dy * dy
      if (dSq > REPULSION_CUT_SQ) continue
      const dist = Math.sqrt(dSq) || 0.5
      const f  = (REPULSION / (dist * dist)) * alpha
      const fx = (dx / dist) * f, fy = (dy / dist) * f
      a.vx -= fx; a.vy -= fy
      b.vx += fx; b.vy += fy
    }
  }

  for (const { source, target } of edges) {
    const a = map[source], b = map[target]
    if (!a || !b) continue
    const dx = b.x - a.x, dy = b.y - a.y
    const dist = Math.sqrt(dx * dx + dy * dy) || 0.5
    const f  = SPRING_K * (dist - SPRING_LEN) * alpha
    const fx = (dx / dist) * f, fy = (dy / dist) * f
    a.vx += fx; a.vy += fy
    b.vx -= fx; b.vy -= fy
  }

  const cx = W / 2, cy = H / 2
  for (const n of nodes) {
    n.vx += (cx - n.x) * CENTER_K * alpha
    n.vy += (cy - n.y) * CENTER_K * alpha
  }

  for (const n of nodes) {
    if (n.pinned) { n.vx = 0; n.vy = 0; continue }
    n.vx *= (1 - VELOCITY_DECAY)
    n.vy *= (1 - VELOCITY_DECAY)
    const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy)
    if (speed > MAX_V) { n.vx *= MAX_V / speed; n.vy *= MAX_V / speed }
    n.x += n.vx
    n.y += n.vy
  }

  sim.alpha *= (1 - ALPHA_DECAY)
  return sim.alpha
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GraphView({ entries, onEdit }) {
  const physRef  = useRef({ nodes: [], edges: [], alpha: ALPHA_INIT })
  const frameRef = useRef(null)
  const ticksRef = useRef(0)
  const wrapRef  = useRef(null)

  const [nodePos, setNodePos]       = useState({})
  const [selectedId, setSelectedId] = useState(null)
  const [hoverId, setHoverId]       = useState(null)

  // View options
  const [showCircles, setShowCircles] = useState(true)
  const [nodeScale,   setNodeScale]   = useState(1.0)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Pan / zoom
  const [pan,  setPan]  = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const panRef  = useRef({ x: 0, y: 0 })
  const zoomRef = useRef(1)
  useEffect(() => { panRef.current  = pan  }, [pan])
  useEffect(() => { zoomRef.current = zoom }, [zoom])

  const svgRef    = useRef(null)
  const dragRef   = useRef(null)
  const bgDragRef = useRef(null)

  // Track fullscreen state
  useEffect(() => {
    function onChange() { setIsFullscreen(Boolean(document.fullscreenElement)) }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // ── Simulation ───────────────────────────────────────────────────────────────

  const startSim = useCallback((resetAlpha = true) => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    if (!physRef.current.nodes.length) return
    if (resetAlpha) physRef.current.alpha = ALPHA_INIT
    ticksRef.current = 0

    function animate() {
      const alpha = tick(physRef.current)
      ticksRef.current++
      if (ticksRef.current % 3 === 0) {
        const snap = {}
        for (const n of physRef.current.nodes) snap[n.id] = { x: n.x, y: n.y }
        setNodePos(snap)
      }
      if (alpha > ALPHA_MIN) {
        frameRef.current = requestAnimationFrame(animate)
      } else {
        frameRef.current = null
        const snap = {}
        for (const n of physRef.current.nodes) snap[n.id] = { x: n.x, y: n.y }
        setNodePos(snap)
      }
    }

    frameRef.current = requestAnimationFrame(animate)
  }, [])

  useEffect(() => {
    const oldPos = {}
    for (const n of physRef.current.nodes) oldPos[n.id] = { x: n.x, y: n.y }

    const cx = W / 2, cy = H / 2
    const N  = entries.length

    const nodes = entries.map((e, i) => {
      const prev = oldPos[e.id]
      if (prev) return { id: e.id, x: prev.x, y: prev.y, vx: 0, vy: 0, pinned: false }
      const pos = fibonacciPos(i, N, cx, cy)
      return { id: e.id, ...pos, vx: 0, vy: 0, pinned: false }
    })

    const ids   = new Set(entries.map(e => e.id))
    const edges = entries.flatMap(e =>
      e.componentIds.filter(cid => ids.has(cid)).map(cid => ({ source: e.id, target: cid }))
    )

    physRef.current = { nodes, edges, alpha: ALPHA_INIT }
    startSim(false)
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [entries, startSim])

  // Precompute radii (avoids per-render O(n) scan)
  const radiusMap = {}
  for (const e of entries) {
    const usedBy = entries.filter(x => x.componentIds.includes(e.id)).length
    radiusMap[e.id] = baseRadius(usedBy) * nodeScale
  }

  // ── View controls ────────────────────────────────────────────────────────────

  function fitView() {
    const nodes = physRef.current.nodes
    if (!nodes.length) return
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of nodes) {
      const r = radiusMap[n.id] ?? 10
      minX = Math.min(minX, n.x - r); minY = Math.min(minY, n.y - r)
      maxX = Math.max(maxX, n.x + r); maxY = Math.max(maxY, n.y + r)
    }
    const pad = 48
    const newZoom = Math.min(W / (maxX - minX + pad * 2), H / (maxY - minY + pad * 2), 4)
    setPan({
      x: W / 2 - ((minX + maxX) / 2) * newZoom,
      y: H / 2 - ((minY + maxY) / 2) * newZoom,
    })
    setZoom(newZoom)
  }

  function resetView() { setPan({ x: 0, y: 0 }); setZoom(1) }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      wrapRef.current?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }

  // ── Mouse handlers ───────────────────────────────────────────────────────────

  function onNodeDown(e, id) {
    e.stopPropagation()
    const phys = physRef.current.nodes.find(n => n.id === id)
    if (phys) phys.pinned = true
    dragRef.current = { nodeId: id, prevCX: e.clientX, prevCY: e.clientY }
    setSelectedId(id)
  }

  function onBgDown(e) {
    if (e.target !== svgRef.current && !e.target.classList.contains('graph-bg')) return
    bgDragRef.current = { startCX: e.clientX, startCY: e.clientY, startPan: { ...panRef.current } }
    setSelectedId(null)
  }

  function onMouseMove(e) {
    if (dragRef.current) {
      const rect   = svgRef.current.getBoundingClientRect()
      const scaleX = W / rect.width, scaleY = H / rect.height
      const dx = (e.clientX - dragRef.current.prevCX) * scaleX / zoomRef.current
      const dy = (e.clientY - dragRef.current.prevCY) * scaleY / zoomRef.current
      const phys = physRef.current.nodes.find(n => n.id === dragRef.current.nodeId)
      if (phys) { phys.x += dx; phys.y += dy; phys.vx = 0; phys.vy = 0 }
      dragRef.current.prevCX = e.clientX
      dragRef.current.prevCY = e.clientY
      const snap = {}
      for (const n of physRef.current.nodes) snap[n.id] = { x: n.x, y: n.y }
      setNodePos(snap)
      return
    }
    if (bgDragRef.current) {
      const { startCX, startCY, startPan } = bgDragRef.current
      const rect   = svgRef.current.getBoundingClientRect()
      const scaleX = W / rect.width, scaleY = H / rect.height
      setPan({ x: startPan.x + (e.clientX - startCX) * scaleX, y: startPan.y + (e.clientY - startCY) * scaleY })
    }
  }

  function onMouseUp() {
    if (dragRef.current) {
      const phys = physRef.current.nodes.find(n => n.id === dragRef.current.nodeId)
      if (phys) phys.pinned = false
      dragRef.current = null
      startSim()
    }
    bgDragRef.current = null
  }

  function onWheel(e) {
    e.preventDefault()
    const factor = e.deltaY > 0 ? 0.88 : 1 / 0.88
    setZoom(z => Math.max(0.15, Math.min(6, z * factor)))
  }

  // ── Derived render values ────────────────────────────────────────────────────

  const activeId = selectedId || hoverId
  const connectedIds = activeId ? new Set([
    activeId,
    ...(entries.find(e => e.id === activeId)?.componentIds ?? []),
    ...entries.filter(e => e.componentIds.includes(activeId)).map(e => e.id),
  ]) : null

  const selectedEntry = selectedId ? entries.find(e => e.id === selectedId) : null
  const selComponents = selectedEntry
    ? selectedEntry.componentIds.map(id => entries.find(e => e.id === id)).filter(Boolean)
    : []
  const selUsedBy = selectedId ? entries.filter(e => e.componentIds.includes(selectedId)) : []

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div ref={wrapRef} className={`graph-wrap ${isFullscreen ? 'graph-wrap-fs' : ''}`}>
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
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" className="graph-arrow" />
          </marker>
        </defs>

        <rect className="graph-bg" x="0" y="0" width={W} height={H} fill="transparent" />

        <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
          {/* Edges */}
          {physRef.current.edges.map(({ source, target }) => {
            const s = nodePos[source], t = nodePos[target]
            if (!s || !t) return null
            const active = connectedIds ? (connectedIds.has(source) && connectedIds.has(target)) : false
            const tr  = showCircles ? (radiusMap[target] ?? 12) + 2 : 8
            const dx  = t.x - s.x, dy = t.y - s.y
            const len = Math.sqrt(dx * dx + dy * dy) || 1
            return (
              <line
                key={`${source}-${target}`}
                x1={s.x} y1={s.y}
                x2={t.x - (dx / len) * tr}
                y2={t.y - (dy / len) * tr}
                className={`graph-edge ${active ? 'graph-edge-active' : ''}`}
                markerEnd="url(#arrow)"
              />
            )
          })}

          {/* Nodes */}
          {entries.map(entry => {
            const pos = nodePos[entry.id]
            if (!pos) return null
            const type       = entryType(entry)
            const r          = radiusMap[entry.id] ?? 10
            const isSelected = selectedId === entry.id
            const isHovered  = hoverId === entry.id
            const dim        = connectedIds ? !connectedIds.has(entry.id) : false
            const name       = entryDisplayName(entry)
            const showLabel  = isHovered || isSelected

            return (
              <g
                key={entry.id}
                transform={`translate(${pos.x} ${pos.y})`}
                className="graph-node"
                style={{ opacity: dim ? 0.18 : 1, cursor: 'pointer' }}
                onMouseDown={e => onNodeDown(e, entry.id)}
                onMouseEnter={() => setHoverId(entry.id)}
                onMouseLeave={() => setHoverId(null)}
              >
                {showCircles ? (
                  <>
                    {isSelected && <circle r={r + 6} className="graph-node-ring" />}
                    <circle
                      r={r}
                      fill={TYPE_FILL[type]}
                      stroke={TYPE_STROKE[type]}
                      strokeWidth={isSelected ? 2.5 : 1.5}
                      className="graph-node-circle"
                    />
                    {entry.character ? (
                      <text textAnchor="middle" dominantBaseline="central"
                        className="graph-glyph" fontSize={r * 1.05} y={0.5}>
                        {entry.character}
                      </text>
                    ) : (
                      <text textAnchor="middle" dominantBaseline="central"
                        className="graph-glyph-abbr" fontSize={r * 0.75}>
                        {name.slice(0, 2)}
                      </text>
                    )}
                  </>
                ) : (
                  <>
                    {/* Character-only mode: glyph as the node, no coloured circle */}
                    <circle r={r} fill="transparent" stroke="none" /> {/* invisible hit area */}
                    {isSelected && (
                      <circle r={r * 0.72} fill="none"
                        stroke={TYPE_STROKE[type]} strokeWidth={1.5} strokeOpacity={0.7} />
                    )}
                    {entry.character ? (
                      <text textAnchor="middle" dominantBaseline="central"
                        className="graph-glyph-raw"
                        fontSize={r * 1.6}
                        fill={isSelected ? '#fff' : isHovered ? '#e2e8f0' : TYPE_STROKE[type]}
                        y={0.5}>
                        {entry.character}
                      </text>
                    ) : (
                      <text textAnchor="middle" dominantBaseline="central"
                        className="graph-glyph-abbr"
                        fontSize={r * 0.85}
                        fill={isSelected ? '#fff' : TYPE_STROKE[type]}>
                        {name.slice(0, 2)}
                      </text>
                    )}
                  </>
                )}
                {showLabel && (
                  <text y={r + 14} textAnchor="middle" className="graph-label">
                    {name}
                  </text>
                )}
              </g>
            )
          })}
        </g>
      </svg>

      {/* ── Obsidian-style control bar ────────────────────────────────────────── */}
      <div className="graph-controls">
        {/* Node size */}
        <div className="ctrl-group">
          <span className="ctrl-label">Size</span>
          <input
            type="range" min="0.4" max="2.5" step="0.05"
            value={nodeScale}
            className="ctrl-slider"
            onChange={e => setNodeScale(parseFloat(e.target.value))}
            title="Node size"
          />
        </div>

        <div className="ctrl-divider" />

        {/* Zoom */}
        <button className="ctrl-btn" onClick={() => setZoom(z => Math.max(0.15, z * 0.8))} title="Zoom out">−</button>
        <button className="ctrl-btn" onClick={fitView} title="Fit all nodes">⊡</button>
        <button className="ctrl-btn" onClick={() => setZoom(z => Math.min(6, z * 1.25))} title="Zoom in">+</button>

        <div className="ctrl-divider" />

        {/* Circles toggle */}
        <button
          className={`ctrl-btn ctrl-toggle ${showCircles ? 'ctrl-toggle-on' : ''}`}
          onClick={() => setShowCircles(v => !v)}
          title={showCircles ? 'Character-only mode' : 'Show circles'}
        >
          {showCircles ? '◉' : '◯'} Circles
        </button>

        <div className="ctrl-divider" />

        {/* Fullscreen */}
        <button
          className="ctrl-btn"
          onClick={toggleFullscreen}
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? '⊠' : '⛶'}
        </button>
      </div>

      {/* Legend */}
      <div className="graph-legend">
        {[['primitive','Primitive'],['dual','Dual'],['character','Character']].map(([t, label]) => (
          <span key={t} className="legend-item">
            <span className={`legend-dot legend-dot-${t}`} />
            {label}
          </span>
        ))}
        <span className="legend-hint">Scroll to zoom · Drag nodes or background</span>
      </div>

      {/* ── Selected entry info panel ─────────────────────────────────────────── */}
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
              {(selectedEntry.bookNumber || selectedEntry.heisigNumber) && (
                <p className="graph-info-meta">
                  {selectedEntry.bookNumber && `Book ${selectedEntry.bookNumber}`}
                  {selectedEntry.lessonNumber && ` · Lesson ${selectedEntry.lessonNumber}`}
                  {selectedEntry.heisigNumber && ` · #${selectedEntry.heisigNumber}`}
                </p>
              )}
            </div>
          </div>

          {selectedEntry.story && (
            <p className="graph-info-story">{selectedEntry.story}</p>
          )}

          {selComponents.length > 0 && (
            <div className="graph-info-row">
              <span className="graph-info-label">Components</span>
              <div className="graph-info-chips">
                {selComponents.map(c => (
                  <span key={c.id} className={`comp-tag comp-tag-${entryType(c)}`}>
                    {c.character && <span>{c.character}</span>}
                    {entryDisplayName(c)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {selUsedBy.length > 0 && (
            <div className="graph-info-row">
              <span className="graph-info-label">Used in</span>
              <div className="graph-info-chips">
                {selUsedBy.map(c => (
                  <span key={c.id} className={`comp-tag comp-tag-${entryType(c)}`}>
                    {c.character && <span>{c.character}</span>}
                    {entryDisplayName(c)}
                  </span>
                ))}
              </div>
            </div>
          )}

          <button className="btn btn-outline btn-sm" onClick={() => onEdit(selectedEntry)}>
            Edit entry
          </button>
        </div>
      )}
    </div>
  )
}
