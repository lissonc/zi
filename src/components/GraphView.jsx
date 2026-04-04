import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { entryType, entryDisplayName } from '../utils.js'

// ── Physics constants ─────────────────────────────────────────────────────────

const W = 900
const H = 620

const REPULSION        = 1600
const REPULSION_CUT    = 80          // px — reduced from 240; cutoff radius
const REPULSION_CUT_SQ = REPULSION_CUT * REPULSION_CUT
const SPRING_K         = 0.06
const SPRING_LEN       = 80
const CENTER_K         = 0.016
const VELOCITY_DECAY   = 0.38
const MAX_V            = 12
const ALPHA_INIT       = 1.0
const ALPHA_DECAY      = 0.0228
const ALPHA_MIN        = 0.001

const GRAPH_NODE_LIMIT = 500

const TYPE_FILL   = { primitive: '#4c1d95', dual: '#134e4a', character: '#1e3a8a' }
const TYPE_STROKE = { primitive: '#a78bfa', dual: '#2dd4bf', character: '#60a5fa' }
const TYPE_STROKE_RGB = { primitive: '167,139,250', dual: '45,212,191', character: '96,165,250' }

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

// ── Spatial grid for O(1) neighbour lookup ────────────────────────────────────

function buildGrid(nodes) {
  const cellSize = REPULSION_CUT
  const cols = Math.ceil(W / cellSize) + 1
  const rows = Math.ceil(H / cellSize) + 1
  const cells = new Array(cols * rows).fill(null).map(() => [])
  for (const n of nodes) {
    const ci = Math.max(0, Math.min(cols - 1, Math.floor(n.x / cellSize)))
    const ri = Math.max(0, Math.min(rows - 1, Math.floor(n.y / cellSize)))
    cells[ri * cols + ci].push(n)
  }
  return { cells, cols, rows, cellSize }
}

// ── Physics tick ──────────────────────────────────────────────────────────────

function tick(sim) {
  const { nodes, edges } = sim
  const alpha = sim.alpha
  const map = {}
  for (const n of nodes) map[n.id] = n

  // Repulsion via spatial grid — only check nodes in adjacent cells
  const grid = buildGrid(nodes)
  const { cells, cols, rows, cellSize } = grid

  for (let ri = 0; ri < rows; ri++) {
    for (let ci = 0; ci < cols; ci++) {
      const cell = cells[ri * cols + ci]
      if (!cell.length) continue
      // Gather candidate cells: self + 8 neighbours (avoid double-counting)
      for (let dri = 0; dri <= 1; dri++) {
        for (let dci = (dri === 0 ? 1 : -1); dci <= 1; dci++) {
          const nri = ri + dri, nci = ci + dci
          if (nri < 0 || nri >= rows || nci < 0 || nci >= cols) continue
          const other = cells[nri * cols + nci]
          for (const a of cell) {
            for (const b of other) {
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
        }
      }
      // Same cell: check all pairs within it
      for (let i = 0; i < cell.length; i++) {
        for (let j = i + 1; j < cell.length; j++) {
          const a = cell[i], b = cell[j]
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

// ── Canvas draw ───────────────────────────────────────────────────────────────

function drawFrame(canvas, phys, pan, zoom, radiusMap, selectedId, hoverId, connectedIds, showCircles, entryLookup) {
  const ctx = canvas.getContext('2d')
  const dpr = window.devicePixelRatio || 1
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  ctx.scale(dpr, dpr)
  ctx.translate(pan.x, pan.y)
  ctx.scale(zoom, zoom)

  const { nodes, edges } = phys
  const nodeMap = {}
  for (const n of nodes) nodeMap[n.id] = n

  // Draw edges
  for (const { source, target } of edges) {
    const s = nodeMap[source], t = nodeMap[target]
    if (!s || !t) continue
    const active = connectedIds ? (connectedIds.has(source) && connectedIds.has(target)) : false
    ctx.beginPath()
    ctx.moveTo(s.x, s.y)
    const tr = (radiusMap[target] ?? 12) + 2
    const dx = t.x - s.x, dy = t.y - s.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    ctx.lineTo(t.x - (dx / len) * tr, t.y - (dy / len) * tr)
    ctx.strokeStyle = active ? 'rgba(148,163,184,0.9)' : 'rgba(71,85,105,0.45)'
    ctx.lineWidth = active ? 1.5 : 1
    ctx.stroke()

    // Arrowhead
    if (len > tr + 4) {
      const ex = t.x - (dx / len) * tr
      const ey = t.y - (dy / len) * tr
      const angle = Math.atan2(dy, dx)
      ctx.beginPath()
      ctx.moveTo(ex, ey)
      ctx.lineTo(ex - 7 * Math.cos(angle - 0.4), ey - 7 * Math.sin(angle - 0.4))
      ctx.lineTo(ex - 7 * Math.cos(angle + 0.4), ey - 7 * Math.sin(angle + 0.4))
      ctx.closePath()
      ctx.fillStyle = active ? 'rgba(148,163,184,0.9)' : 'rgba(71,85,105,0.45)'
      ctx.fill()
    }
  }

  // Draw nodes
  for (const n of nodes) {
    const entry = entryLookup[n.id]
    if (!entry) continue
    const type   = entryType(entry)
    const r      = radiusMap[n.id] ?? 10
    const isSelected = selectedId === n.id
    const isHovered  = hoverId === n.id
    const dim    = connectedIds ? !connectedIds.has(n.id) : false
    const alpha  = dim ? 0.18 : 1

    ctx.globalAlpha = alpha

    if (showCircles) {
      // Selection ring
      if (isSelected) {
        ctx.beginPath()
        ctx.arc(n.x, n.y, r + 6, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${TYPE_STROKE_RGB[type]},0.5)`
        ctx.lineWidth = 2
        ctx.stroke()
      }
      // Main circle
      ctx.beginPath()
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2)
      ctx.fillStyle = TYPE_FILL[type]
      ctx.fill()
      ctx.strokeStyle = TYPE_STROKE[type]
      ctx.lineWidth = isSelected ? 2.5 : 1.5
      ctx.stroke()

      // Glyph or abbreviation
      ctx.fillStyle = '#f1f5f9'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (entry.character) {
        ctx.font = `${r * 1.05}px serif`
        ctx.fillText(entry.character, n.x, n.y + 0.5)
      } else {
        ctx.font = `bold ${r * 0.75}px sans-serif`
        ctx.fillText(entryDisplayName(entry).slice(0, 2), n.x, n.y)
      }
    } else {
      // Character-only mode
      if (isSelected) {
        ctx.beginPath()
        ctx.arc(n.x, n.y, r * 0.72, 0, Math.PI * 2)
        ctx.strokeStyle = `rgba(${TYPE_STROKE_RGB[type]},0.7)`
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
      ctx.fillStyle = isSelected ? '#fff' : isHovered ? '#e2e8f0' : TYPE_STROKE[type]
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      if (entry.character) {
        ctx.font = `${r * 1.6}px serif`
        ctx.fillText(entry.character, n.x, n.y + 0.5)
      } else {
        ctx.font = `bold ${r * 0.85}px sans-serif`
        ctx.fillText(entryDisplayName(entry).slice(0, 2), n.x, n.y)
      }
    }

    // Hover/select label
    if (isHovered || isSelected) {
      ctx.globalAlpha = 1
      const label = entryDisplayName(entry)
      ctx.font = `11px sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      const tw = ctx.measureText(label).width
      ctx.fillStyle = 'rgba(15,23,42,0.85)'
      ctx.fillRect(n.x - tw / 2 - 3, n.y + r + 5, tw + 6, 16)
      ctx.fillStyle = '#e2e8f0'
      ctx.fillText(label, n.x, n.y + r + 7)
    }
  }

  ctx.globalAlpha = 1
  ctx.restore()
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function GraphView({ entries, entryMap, usedByMap, onEdit }) {
  const physRef  = useRef({ nodes: [], edges: [], alpha: ALPHA_INIT })
  const frameRef = useRef(null)
  const canvasRef = useRef(null)
  const nodeMapRef   = useRef({})   // id → phys node, O(1) lookup in drag handlers
  const hasFittedRef = useRef(false) // auto-fit once on first load
  const wrapRef  = useRef(null)

  const [selectedId, setSelectedId] = useState(null)
  const [hoverId, setHoverId]       = useState(null)

  // View options
  const [showCircles, setShowCircles] = useState(true)
  const [nodeScale,   setNodeScale]   = useState(1.0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [showAll, setShowAll] = useState(false)

  // Pan / zoom
  const [pan,  setPan]  = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const panRef        = useRef({ x: 0, y: 0 })
  const zoomRef       = useRef(1)
  const zoomTargetRef = useRef(1)
  const zoomRafRef    = useRef(null)
  const zoomOriginRef = useRef(null)   // canvas-space cursor pos at last wheel event
  const worldOriginRef = useRef(null)  // world-space point under cursor at last wheel event
  useEffect(() => { panRef.current = pan }, [pan])

  const canvasDragRef = useRef(null)   // background pan drag
  const nodeDragRef   = useRef(null)   // node drag

  // Track fullscreen
  useEffect(() => {
    function onChange() { setIsFullscreen(Boolean(document.fullscreenElement)) }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // ── Visible entries (node limit) ─────────────────────────────────────────────

  const visibleEntries = useMemo(() => {
    if (showAll || entries.length <= GRAPH_NODE_LIMIT) return entries
    // Show most-linked nodes first for the most informative subgraph
    return [...entries]
      .sort((a, b) => {
        const aCount = usedByMap.get(a.id)?.length ?? 0
        const bCount = usedByMap.get(b.id)?.length ?? 0
        return bCount - aCount
      })
      .slice(0, GRAPH_NODE_LIMIT)
  }, [entries, usedByMap, showAll])

  // ── Derived maps ─────────────────────────────────────────────────────────────

  const radiusMap = useMemo(() => {
    const m = {}
    for (const e of visibleEntries) {
      const usedByCount = usedByMap.get(e.id)?.length ?? 0
      m[e.id] = baseRadius(usedByCount) * nodeScale
    }
    return m
  }, [visibleEntries, usedByMap, nodeScale])

  // Flat lookup object for drawFrame (avoids Map.get overhead in hot loop)
  const entryLookup = useMemo(() => {
    const o = {}
    for (const e of visibleEntries) o[e.id] = e
    return o
  }, [visibleEntries])

  // ── Simulation ───────────────────────────────────────────────────────────────

  // Refs that drawFrame needs, updated each render
  const panZoomRef = useRef({ pan, zoom })
  const showCirclesRef = useRef(showCircles)
  const radiusMapRef = useRef(radiusMap)
  const entryLookupRef = useRef(entryLookup)
  const selectedIdRef = useRef(selectedId)
  const hoverIdRef = useRef(hoverId)
  const connectedIdsRef = useRef(null)

  useEffect(() => { panZoomRef.current = { pan, zoom } }, [pan, zoom])
  useEffect(() => { showCirclesRef.current = showCircles }, [showCircles])
  useEffect(() => { radiusMapRef.current = radiusMap }, [radiusMap])
  useEffect(() => { entryLookupRef.current = entryLookup }, [entryLookup])
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])
  useEffect(() => { hoverIdRef.current = hoverId }, [hoverId])

  // connectedIds for highlight — memoized
  const activeId = selectedId || hoverId
  const connectedIds = useMemo(() => {
    if (!activeId) return null
    const entry = entryMap.get(activeId)
    const ids = new Set([activeId, ...(entry?.componentIds ?? [])])
    for (const id of (usedByMap.get(activeId) ?? [])) ids.add(id)
    return ids
  }, [activeId, entryMap, usedByMap])

  useEffect(() => { connectedIdsRef.current = connectedIds }, [connectedIds])

  function redraw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const { pan: p, zoom: z } = panZoomRef.current
    drawFrame(canvas, physRef.current, p, z, radiusMapRef.current,
      selectedIdRef.current, hoverIdRef.current, connectedIdsRef.current,
      showCirclesRef.current, entryLookupRef.current)
  }

  const startSim = useCallback((resetAlpha = true) => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    if (!physRef.current.nodes.length) return
    if (resetAlpha) physRef.current.alpha = ALPHA_INIT

    function animate() {
      const alpha = tick(physRef.current)
      redraw()
      if (alpha > ALPHA_MIN) {
        frameRef.current = requestAnimationFrame(animate)
      } else {
        frameRef.current = null
        redraw()
      }
    }
    frameRef.current = requestAnimationFrame(animate)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const oldPos = {}
    for (const n of physRef.current.nodes) oldPos[n.id] = { x: n.x, y: n.y }

    const cx = W / 2, cy = H / 2
    const N  = visibleEntries.length

    const nodes = visibleEntries.map((e, i) => {
      const prev = oldPos[e.id]
      if (prev) return { id: e.id, x: prev.x, y: prev.y, vx: 0, vy: 0, pinned: false }
      const pos = fibonacciPos(i, N, cx, cy)
      return { id: e.id, ...pos, vx: 0, vy: 0, pinned: false }
    })

    // Build nodeMapRef for O(1) drag lookup
    const nmap = {}
    for (const n of nodes) nmap[n.id] = n
    nodeMapRef.current = nmap

    const ids   = new Set(visibleEntries.map(e => e.id))
    const edges = visibleEntries.flatMap(e =>
      e.componentIds.filter(cid => ids.has(cid)).map(cid => ({ source: e.id, target: cid }))
    )

    physRef.current = { nodes, edges, alpha: ALPHA_INIT }
    startSim(false)
    // Centre the view on the node cluster on first load
    if (!hasFittedRef.current) { hasFittedRef.current = true; requestAnimationFrame(fitView) }
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [visibleEntries, startSim])

  // Redraw whenever visual state changes (no physics tick needed)
  useEffect(() => { redraw() }, [pan, zoom, showCircles, nodeScale, selectedId, hoverId, connectedIds, radiusMap]) // eslint-disable-line react-hooks/exhaustive-deps

  // Non-passive wheel listener — must be added via addEventListener so we can
  // call e.preventDefault() (React's onWheel is passive in Chrome, which ignores it)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    function handleWheel(e) {
      e.preventDefault()
      let delta = e.deltaY
      if (e.deltaMode === 1) delta *= 20
      else if (e.deltaMode === 2) delta *= 300
      const cap = e.ctrlKey ? 15 : 120
      delta = Math.sign(delta) * Math.min(Math.abs(delta), cap)
      const factor = Math.exp(-delta * (e.ctrlKey ? 0.015 : 0.001))
      zoomTargetRef.current = Math.max(0.15, Math.min(6, zoomTargetRef.current * factor))

      // Capture the world point under the cursor so we can zoom towards it
      const rect   = canvas.getBoundingClientRect()
      const cx     = e.clientX - rect.left
      const cy     = e.clientY - rect.top
      const { pan: p } = panZoomRef.current
      zoomOriginRef.current  = { x: cx, y: cy }
      worldOriginRef.current = { x: (cx - p.x) / zoomRef.current, y: (cy - p.y) / zoomRef.current }

      if (!zoomRafRef.current) zoomRafRef.current = requestAnimationFrame(animateZoom)
    }
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Canvas DPR sizing — use ResizeObserver so fullscreen / window resize work
  useEffect(() => {
    const canvas = canvasRef.current
    const wrap   = wrapRef.current
    if (!canvas || !wrap) return

    function syncSize() {
      const dpr  = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      const cssW = rect.width  || W
      const cssH = rect.height || H
      if (canvas.width  !== Math.round(cssW * dpr) ||
          canvas.height !== Math.round(cssH * dpr)) {
        canvas.width  = Math.round(cssW * dpr)
        canvas.height = Math.round(cssH * dpr)
      }
      redraw()
    }

    syncSize()
    const ro = new ResizeObserver(syncSize)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Info panel derived data ──────────────────────────────────────────────────

  const selectedEntry = useMemo(() =>
    selectedId ? entryMap.get(selectedId) ?? null : null,
    [selectedId, entryMap]
  )
  const selComponents = useMemo(() =>
    selectedEntry ? selectedEntry.componentIds.map(id => entryMap.get(id)).filter(Boolean) : [],
    [selectedEntry, entryMap]
  )
  const selUsedBy = useMemo(() =>
    selectedId ? (usedByMap.get(selectedId) ?? []).map(id => entryMap.get(id)).filter(Boolean) : [],
    [selectedId, entryMap, usedByMap]
  )

  // ── View controls ────────────────────────────────────────────────────────────

  function animateZoom() {
    const current = zoomRef.current
    const target  = zoomTargetRef.current
    const diff    = target - current
    const done    = Math.abs(diff) < 0.0008
    const next    = done ? target : current + diff * 0.18

    zoomRef.current = next

    // Keep the cursor world-point fixed under the cursor while zooming
    const origin  = zoomOriginRef.current
    const worldPt = worldOriginRef.current
    if (origin && worldPt) {
      const newPan = {
        x: origin.x - worldPt.x * next,
        y: origin.y - worldPt.y * next,
      }
      panRef.current     = newPan
      panZoomRef.current = { pan: newPan, zoom: next }
    } else {
      panZoomRef.current = { ...panZoomRef.current, zoom: next }
    }

    redraw()

    if (done) {
      zoomRafRef.current = null
      setZoom(next)
      if (origin && worldPt) setPan(panRef.current)
    } else {
      zoomRafRef.current = requestAnimationFrame(animateZoom)
    }
  }

  function fitView() {
    const nodes = physRef.current.nodes
    if (!nodes.length) return
    const rect = canvasRef.current?.getBoundingClientRect()
    const cw = rect?.width  || W
    const ch = rect?.height || H
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of nodes) {
      const r = radiusMapRef.current[n.id] ?? 10
      minX = Math.min(minX, n.x - r); minY = Math.min(minY, n.y - r)
      maxX = Math.max(maxX, n.x + r); maxY = Math.max(maxY, n.y + r)
    }
    const pad = 48
    const newZoom = Math.min(cw / (maxX - minX + pad * 2), ch / (maxY - minY + pad * 2), 4)
    const newPan = {
      x: cw / 2 - ((minX + maxX) / 2) * newZoom,
      y: ch / 2 - ((minY + maxY) / 2) * newZoom,
    }
    setPan(newPan)
    zoomTargetRef.current = newZoom
    setZoom(newZoom)
    zoomRef.current = newZoom
  }

  function resetView() {
    setPan({ x: 0, y: 0 })
    zoomTargetRef.current = 1
    setZoom(1)
    zoomRef.current = 1
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) wrapRef.current?.requestFullscreen()
    else document.exitFullscreen()
  }

  // ── Canvas mouse handlers ────────────────────────────────────────────────────

  function getCanvasXY(e) {
    const rect = canvasRef.current.getBoundingClientRect()
    return [
      e.clientX - rect.left,
      e.clientY - rect.top,
    ]
  }

  function worldXY(cx, cy) {
    const { pan: p, zoom: z } = panZoomRef.current
    return [(cx - p.x) / z, (cy - p.y) / z]
  }

  function hitTest(wx, wy) {
    let best = null, bestDSq = Infinity
    for (const n of physRef.current.nodes) {
      const r = radiusMapRef.current[n.id] ?? 10
      const dx = wx - n.x, dy = wy - n.y
      const dSq = dx * dx + dy * dy
      if (dSq <= r * r * 2.5 && dSq < bestDSq) { best = n.id; bestDSq = dSq }
    }
    return best
  }

  function onMouseDown(e) {
    const [cx, cy] = getCanvasXY(e)
    const [wx, wy] = worldXY(cx, cy)
    const hit = hitTest(wx, wy)
    if (hit) {
      const phys = nodeMapRef.current[hit]
      if (phys) phys.pinned = true
      nodeDragRef.current = { nodeId: hit, prevCX: e.clientX, prevCY: e.clientY }
      setSelectedId(hit)
    } else {
      canvasDragRef.current = { startCX: e.clientX, startCY: e.clientY, startPan: { ...panRef.current } }
      setSelectedId(null)
    }
  }

  function onMouseMove(e) {
    if (nodeDragRef.current) {
      const dx = (e.clientX - nodeDragRef.current.prevCX) / zoomRef.current
      const dy = (e.clientY - nodeDragRef.current.prevCY) / zoomRef.current
      const phys = nodeMapRef.current[nodeDragRef.current.nodeId]
      if (phys) { phys.x += dx; phys.y += dy; phys.vx = 0; phys.vy = 0 }
      nodeDragRef.current.prevCX = e.clientX
      nodeDragRef.current.prevCY = e.clientY
      redraw()
      return
    }
    if (canvasDragRef.current) {
      const { startCX, startCY, startPan } = canvasDragRef.current
      const newPan = {
        x: startPan.x + (e.clientX - startCX),
        y: startPan.y + (e.clientY - startCY),
      }
      panRef.current = newPan
      panZoomRef.current = { ...panZoomRef.current, pan: newPan }
      setPan(newPan)
      return
    }
    // Hover hit test
    const [cx, cy] = getCanvasXY(e)
    const [wx, wy] = worldXY(cx, cy)
    const hit = hitTest(wx, wy)
    if (hit !== hoverId) setHoverId(hit)
  }

  function onMouseUp() {
    if (nodeDragRef.current) {
      const phys = nodeMapRef.current[nodeDragRef.current.nodeId]
      if (phys) phys.pinned = false
      nodeDragRef.current = null
      startSim()
    }
    canvasDragRef.current = null
  }

  function onMouseLeave() {
    onMouseUp()
    setHoverId(null)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  const isCapped = !showAll && entries.length > GRAPH_NODE_LIMIT

  return (
    <div ref={wrapRef} className={`graph-wrap ${isFullscreen ? 'graph-wrap-fs' : ''}`}>
      {isCapped && (
        <div className="graph-cap-banner">
          Showing {GRAPH_NODE_LIMIT} of {entries.length} entries (most-linked first).{' '}
          <button className="graph-cap-btn" onClick={() => setShowAll(true)}>
            Show all {entries.length}
          </button>
        </div>
      )}

      <canvas
        ref={canvasRef}
        className="graph-canvas"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      />

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
        <button className="ctrl-btn" onClick={() => { zoomOriginRef.current = null; zoomTargetRef.current = Math.max(0.15, zoomTargetRef.current * 0.8); if (!zoomRafRef.current) zoomRafRef.current = requestAnimationFrame(animateZoom) }} title="Zoom out">−</button>
        <button className="ctrl-btn" onClick={fitView} title="Fit all nodes">⊡</button>
        <button className="ctrl-btn" onClick={() => { zoomOriginRef.current = null; zoomTargetRef.current = Math.min(6, zoomTargetRef.current * 1.25); if (!zoomRafRef.current) zoomRafRef.current = requestAnimationFrame(animateZoom) }} title="Zoom in">+</button>

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
        {[['primitive','💠 Primitive'],['dual','💠 Dual'],['character','Character']].map(([t, label]) => (
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
                <p className="graph-info-sub">💠 {selectedEntry.primitiveKeywords.join(' · ')}</p>
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
                    {c.primitiveKeywords?.length > 0 ? <>💠 {c.primitiveKeywords[0]}</> : entryDisplayName(c)}
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
