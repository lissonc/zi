// Force-directed graph engine: simulation + canvas renderer, no React.
//
// Built to stay smooth with a few thousand nodes:
//   - positions/velocities live in typed arrays, no per-tick allocation
//   - repulsion uses a counting-sort spatial grid (only neighbouring cells)
//   - several ticks per frame inside a time budget, so layout settles fast
//   - drawing is batched (one path per edge set / node type), culled to the
//     viewport, and level-of-detail: dots when far, glyphs from a pre-rendered
//     atlas when near, real text only for the handful of large nodes
//   - renders on demand; the loop stops when nothing moves

const TYPE_INDEX = { character: 0, dual: 1, primitive: 2 }
const CUTOFF = 110
const CUTOFF_SQ = CUTOFF * CUTOFF
const REPULSION = 1500
const GRAVITY = 0.009
const DAMPING = 0.58
const MAX_V = 22
const ALPHA_MIN = 0.004
const ALPHA_DECAY = 0.985
const FRAME_BUDGET_MS = 7
const CELL = 64 // node atlas cell, px
const DISC = 29 // disc radius inside a cell, px
const TILE = 128 // nodes per atlas tile
const TILE_COLS = 16
const MIN_ZOOM = 0.04
const MAX_ZOOM = 6
const GLYPH_FONT = '"Noto Serif TC", "Noto Serif CJK TC", "Songti TC", "PMingLiU", "Source Han Serif TC", serif'
const UI_FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'

function nodeType(e) {
  const kw = Boolean(e.keyword?.trim())
  const pk = e.primitiveKeywords?.length > 0
  return kw && pk ? 1 : kw ? 0 : 2
}

function displayName(e) {
  return e.keyword?.trim() || e.primitiveKeywords?.[0] || e.character || '?'
}

export class GraphEngine {
  constructor(canvas, { onSelect } = {}) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.onSelect = onSelect || (() => {})

    this.n = 0
    this.ids = []
    this.index = new Map()
    this.entries = []
    this.x = this.y = this.vx = this.vy = this.r = new Float32Array(0)
    this.type = new Uint8Array(0)
    this.deg = new Uint16Array(0)
    this.es = this.et = new Int32Array(0)
    this.m = 0

    this.cellOf = new Int32Array(0)
    this.sorted = new Int32Array(0)
    this.cellStart = new Int32Array(0)
    this.cursor = new Int32Array(0)

    this.alpha = 0
    this.panX = 0
    this.panY = 0
    this.zoom = 1
    this.anim = null
    this.nodeScale = 1
    this.labelMode = 'glyph'
    this.selected = -1
    this.hover = -1
    this.active = null // Uint8Array flags for highlighted neighbourhood
    this.dragNode = -1
    this.pointers = new Map()
    this.gesture = null
    this.raf = 0
    this.dirty = true
    this.cssW = 1
    this.cssH = 1
    this.dpr = 1
    this.atlas = null
    this.atlasCount = 0
    this.stats = { frameMs: 0, tickMs: 0, frames: 0 }

    this.readTheme()
    this.bind()
    this.resize()
  }

  // ── Data ────────────────────────────────────────────────────────────────────

  setData(entries) {
    const oldIndex = this.index
    const ox = this.x, oy = this.y
    const n = entries.length
    const ids = new Array(n)
    const index = new Map()
    for (let i = 0; i < n; i++) { ids[i] = entries[i].id; index.set(ids[i], i) }

    const x = new Float32Array(n), y = new Float32Array(n)
    const deg = new Uint16Array(n), usedBy = new Uint16Array(n)
    const type = new Uint8Array(n)
    const es = [], et = []
    for (let i = 0; i < n; i++) {
      type[i] = nodeType(entries[i])
      for (const cid of entries[i].componentIds || []) {
        const j = index.get(cid)
        if (j === undefined || j === i) continue
        es.push(i); et.push(j)
        deg[i]++; deg[j]++; usedBy[j]++
      }
    }

    // Placement: keep old positions; otherwise start next to the components
    // (entries come in learning order, so components are usually placed
    // already). Roots go on a golden-angle spiral.
    const placed = new Uint8Array(n)
    let roots = 0, fresh = 0
    for (let i = 0; i < n; i++) {
      const o = oldIndex.get(ids[i])
      if (o !== undefined) { x[i] = ox[o]; y[i] = oy[o]; placed[i] = 1 }
    }
    const spread = 34 * Math.sqrt(n)
    for (let i = 0; i < n; i++) {
      if (placed[i]) continue
      fresh++
      let sx = 0, sy = 0, c = 0
      for (const cid of entries[i].componentIds || []) {
        const j = index.get(cid)
        if (j !== undefined && placed[j]) { sx += x[j]; sy += y[j]; c++ }
      }
      if (c) {
        const a = Math.random() * Math.PI * 2
        x[i] = sx / c + Math.cos(a) * 40
        y[i] = sy / c + Math.sin(a) * 40
      } else {
        const rr = spread * Math.sqrt((roots + 0.5) / Math.max(n * 0.25, 1)) * 0.5
        const a = roots * 2.39996323
        x[i] = Math.cos(a) * rr
        y[i] = Math.sin(a) * rr
        roots++
      }
      placed[i] = 1
    }

    const r = new Float32Array(n)
    for (let i = 0; i < n; i++) r[i] = 7 + Math.min(Math.sqrt(usedBy[i]) * 2.4, 17)

    const selId = this.selected >= 0 ? this.ids[this.selected] : null
    this.n = n; this.ids = ids; this.index = index; this.entries = entries
    this.x = x; this.y = y; this.vx = new Float32Array(n); this.vy = new Float32Array(n)
    this.r = r; this.type = type; this.deg = deg
    this.es = Int32Array.from(es); this.et = Int32Array.from(et); this.m = es.length
    this.cellOf = new Int32Array(n); this.sorted = new Int32Array(n)
    this.hover = -1
    this.selected = selId != null && index.has(selId) ? index.get(selId) : -1
    this.updateActive()
    this.atlas = null
    this.atlasCount = 0
    if (fresh > 0) this.alpha = fresh > n * 0.5 ? 1 : Math.max(this.alpha, 0.3)
    this.start()
    return fresh === n
  }

  /** Update entry objects (names, stories) without touching the layout. */
  updateEntries(entries) {
    this.entries = entries
  }

  // ── Simulation ──────────────────────────────────────────────────────────────

  tick() {
    const { n, x, y, vx, vy, alpha } = this
    if (!n) return

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (let i = 0; i < n; i++) {
      if (x[i] < minX) minX = x[i]
      if (x[i] > maxX) maxX = x[i]
      if (y[i] < minY) minY = y[i]
      if (y[i] > maxY) maxY = y[i]
    }
    const cols = Math.floor((maxX - minX) / CUTOFF) + 1
    const rows = Math.floor((maxY - minY) / CUTOFF) + 1
    const cells = cols * rows
    if (this.cellStart.length < cells + 1) this.cellStart = new Int32Array(cells + 1)
    const start = this.cellStart, cellOf = this.cellOf, sorted = this.sorted
    start.fill(0, 0, cells + 1)
    for (let i = 0; i < n; i++) {
      const c = Math.floor((y[i] - minY) / CUTOFF) * cols + Math.floor((x[i] - minX) / CUTOFF)
      cellOf[i] = c
      start[c + 1]++
    }
    for (let c = 0; c < cells; c++) start[c + 1] += start[c]
    // start[c]..start[c+1] is now the slice of `sorted` for cell c
    if (this.cursor.length < cells) this.cursor = new Int32Array(cells)
    const cursor = this.cursor
    for (let c = 0; c < cells; c++) cursor[c] = start[c]
    for (let i = 0; i < n; i++) sorted[cursor[cellOf[i]]++] = i
    const k = REPULSION * alpha
    for (let cy = 0; cy < rows; cy++) {
      for (let cx = 0; cx < cols; cx++) {
        const c = cy * cols + cx
        const a0 = start[c], a1 = start[c + 1]
        if (a0 === a1) continue
        // same cell
        for (let p = a0; p < a1; p++) {
          const i = sorted[p]
          for (let q = p + 1; q < a1; q++) this.repel(i, sorted[q], k)
        }
        // forward neighbours: E, SW, S, SE
        for (let d = 0; d < 4; d++) {
          const nx = cx + (d === 0 ? 1 : d - 2), ny = cy + (d === 0 ? 0 : 1)
          if (nx < 0 || nx >= cols || ny >= rows) continue
          const o = ny * cols + nx
          const b0 = start[o], b1 = start[o + 1]
          for (let p = a0; p < a1; p++) {
            const i = sorted[p]
            for (let q = b0; q < b1; q++) this.repel(i, sorted[q], k)
          }
        }
      }
    }

    // Springs along component edges; the lower-degree end moves more, so hubs
    // (口, 一, 木 …) stay put instead of being dragged around by their leaves.
    const { es, et, m, deg, r } = this
    for (let e = 0; e < m; e++) {
      const a = es[e], b = et[e]
      let dx = x[b] - x[a], dy = y[b] - y[a]
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01
      const rest = 46 + r[a] + r[b]
      const da = deg[a], db = deg[b]
      const strength = 0.9 / Math.min(da, db)
      const f = ((d - rest) / d) * alpha * strength
      dx *= f; dy *= f
      const bias = da / (da + db)
      vx[b] -= dx * bias; vy[b] -= dy * bias
      vx[a] += dx * (1 - bias); vy[a] += dy * (1 - bias)
    }

    const g = GRAVITY * alpha
    const drag = this.dragNode
    for (let i = 0; i < n; i++) {
      if (i === drag) { vx[i] = 0; vy[i] = 0; continue }
      let ax = (vx[i] - x[i] * g) * DAMPING
      let ay = (vy[i] - y[i] * g) * DAMPING
      const sp = ax * ax + ay * ay
      if (sp > MAX_V * MAX_V) { const s = MAX_V / Math.sqrt(sp); ax *= s; ay *= s }
      vx[i] = ax; vy[i] = ay
      x[i] += ax; y[i] += ay
    }
    this.alpha *= ALPHA_DECAY
  }

  repel(i, j, k) {
    const { x, y, vx, vy } = this
    let dx = x[j] - x[i], dy = y[j] - y[i]
    let d2 = dx * dx + dy * dy
    if (d2 > CUTOFF_SQ) return
    if (d2 < 1) { dx = (Math.random() - 0.5) * 2; dy = (Math.random() - 0.5) * 2; d2 = dx * dx + dy * dy + 0.01 }
    // falls to zero at the cutoff so nodes don't jitter across the boundary
    const f = k * (1 / d2 - 1 / CUTOFF_SQ)
    dx *= f; dy *= f
    vx[i] -= dx; vy[i] -= dy
    vx[j] += dx; vy[j] += dy
  }

  // ── Loop ────────────────────────────────────────────────────────────────────

  start() {
    this.dirty = true
    if (!this.raf) this.raf = requestAnimationFrame(this.frame)
  }

  requestRender() { this.start() }

  frame = () => {
    this.raf = 0
    const t0 = performance.now()
    if (this.alpha > ALPHA_MIN && this.n) {
      let ticks = 0
      do { this.tick(); ticks++ }
      while (this.alpha > ALPHA_MIN && ticks < 12 && performance.now() - t0 < FRAME_BUDGET_MS)
      this.dirty = true
      this.stats.tickMs = (performance.now() - t0) / ticks
    }
    if (this.anim) { this.stepAnim(); this.dirty = true }
    if (this.n && (!this.atlas || this.atlasCount < this.n)) {
      if (!this.atlas) this.initAtlas()
      this.fillAtlas(4)
      this.dirty = true
    }
    if (this.dirty) {
      const t1 = performance.now()
      this.render()
      this.stats.frameMs = performance.now() - t1
      this.stats.frames++
      this.dirty = false
    }
    if (this.alpha > ALPHA_MIN || this.anim || (this.n && this.atlasCount < this.n)) this.raf = requestAnimationFrame(this.frame)
  }

  get settled() { return this.alpha <= ALPHA_MIN }

  reheat(a = 0.25) {
    this.alpha = Math.max(this.alpha, a)
    this.start()
  }

  // ── View ────────────────────────────────────────────────────────────────────

  resize() {
    const rect = this.canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.max(1, Math.round(rect.width)), h = Math.max(1, Math.round(rect.height))
    const first = this.cssW <= 1
    // keep the centre of the view fixed
    if (!first) { this.panX += (w - this.cssW) / 2; this.panY += (h - this.cssH) / 2 }
    this.cssW = w; this.cssH = h; this.dpr = dpr
    if (this.canvas.width !== Math.round(w * dpr) || this.canvas.height !== Math.round(h * dpr)) {
      this.canvas.width = Math.round(w * dpr)
      this.canvas.height = Math.round(h * dpr)
    }
    if (first) { this.panX = w / 2; this.panY = h / 2 }
    this.start()
  }

  bounds() {
    const { n, x, y, r } = this
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (let i = 0; i < n; i++) {
      const rr = r[i] * this.nodeScale
      if (x[i] - rr < minX) minX = x[i] - rr
      if (x[i] + rr > maxX) maxX = x[i] + rr
      if (y[i] - rr < minY) minY = y[i] - rr
      if (y[i] + rr > maxY) maxY = y[i] + rr
    }
    return { minX, minY, maxX, maxY }
  }

  fit(animate = true) {
    if (!this.n) return
    const b = this.bounds()
    const pad = 40
    const zoom = Math.max(MIN_ZOOM, Math.min(2.5,
      (this.cssW - pad * 2) / Math.max(b.maxX - b.minX, 1),
      (this.cssH - pad * 2) / Math.max(b.maxY - b.minY, 1)))
    const panX = this.cssW / 2 - ((b.minX + b.maxX) / 2) * zoom
    const panY = this.cssH / 2 - ((b.minY + b.maxY) / 2) * zoom
    this.moveTo(panX, panY, zoom, animate)
  }

  focus(id, minZoom = 1.4) {
    const i = this.index.get(id)
    if (i === undefined) return
    const zoom = Math.max(this.zoom, minZoom)
    this.moveTo(this.cssW / 2 - this.x[i] * zoom, this.cssH / 2 - this.y[i] * zoom, zoom, true)
  }

  moveTo(panX, panY, zoom, animate) {
    if (!animate) {
      this.panX = panX; this.panY = panY; this.zoom = zoom; this.anim = null
      this.start()
      return
    }
    this.anim = { fx: this.panX, fy: this.panY, fz: this.zoom, tx: panX, ty: panY, tz: zoom, t0: performance.now(), dur: 320 }
    this.start()
  }

  stepAnim() {
    const a = this.anim
    let t = (performance.now() - a.t0) / a.dur
    if (t >= 1) t = 1
    const e = 1 - Math.pow(1 - t, 3)
    // interpolate zoom geometrically so it feels even
    this.zoom = a.fz * Math.pow(a.tz / a.fz, e)
    this.panX = a.fx + (a.tx - a.fx) * e
    this.panY = a.fy + (a.ty - a.fy) * e
    if (t === 1) this.anim = null
  }

  zoomAt(factor, cx = this.cssW / 2, cy = this.cssH / 2, animate = false) {
    const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, this.zoom * factor))
    const wx = (cx - this.panX) / this.zoom, wy = (cy - this.panY) / this.zoom
    this.moveTo(cx - wx * z, cy - wy * z, z, animate)
  }

  setOptions({ nodeScale, labelMode }) {
    if (nodeScale !== undefined) this.nodeScale = nodeScale
    if (labelMode !== undefined) this.labelMode = labelMode
    this.start()
  }

  setSelected(id) {
    const i = id == null ? -1 : (this.index.get(id) ?? -1)
    if (i === this.selected) return
    this.selected = i
    this.updateActive()
    this.start()
  }

  updateActive() {
    const c = this.selected >= 0 ? this.selected : this.hover
    if (c < 0) { this.active = null; return }
    const f = new Uint8Array(this.n)
    f[c] = 1
    const { es, et, m } = this
    for (let e = 0; e < m; e++) {
      if (es[e] === c) f[et[e]] = 1
      else if (et[e] === c) f[es[e]] = 1
    }
    this.active = f
    this.activeCenter = c
  }

  readTheme() {
    const cs = getComputedStyle(this.canvas)
    const v = (name, fallback) => cs.getPropertyValue(name).trim() || fallback
    this.theme = {
      ink: v('--ink', '#1c1b19'),
      muted: v('--muted', '#6b6862'),
      surface: v('--surface', '#ffffff'),
      bg: v('--bg', '#faf9f6'),
      edge: v('--graph-edge', 'rgba(0,0,0,0.12)'),
      edgeActive: v('--graph-edge-active', '#555'),
      types: [v('--character', '#2f5d9b'), v('--dual', '#1f7a6d'), v('--primitive', '#6b4fa3')],
      fills: [v('--character-soft', '#e8eef7'), v('--dual-soft', '#e3f1ee'), v('--primitive-soft', '#eee9f6')],
    }
    this.atlas = null
    this.atlasCount = 0
    this.start()
  }

  // ── Glyph atlas ─────────────────────────────────────────────────────────────

  // The atlas is filled a slice per frame: rasterising ~1,700 CJK glyphs in
  // one go would stall a frame for well over 100 ms.
  // Nodes are pre-rendered into small tiles (TILE nodes each). A tile is only
  // drawn from once it is complete: drawing from a canvas that is still being
  // modified makes the browser re-copy it every frame.
  initAtlas() {
    this.atlas = []
    this.atlasCount = 0

    // one strip of plain sprites per type: [disc with ring, flat dot]
    const sp = document.createElement('canvas')
    sp.width = CELL * 3
    sp.height = CELL * 2
    const q = sp.getContext('2d')
    for (let t = 0; t < 3; t++) {
      this.paintDisc(q, t * CELL + CELL / 2, CELL / 2, t)
      q.beginPath()
      q.arc(t * CELL + CELL / 2, CELL + CELL / 2, DISC, 0, Math.PI * 2)
      q.fillStyle = this.theme.types[t]
      q.fill()
    }
    this.sprites = sp
  }

  paintDisc(g, cx, cy, t) {
    g.beginPath()
    g.arc(cx, cy, DISC, 0, Math.PI * 2)
    g.fillStyle = this.theme.fills[t]
    g.fill()
    g.lineWidth = 2.4
    g.strokeStyle = this.theme.types[t]
    g.stroke()
  }

  fillAtlas(budgetMs) {
    const n = this.n
    const t0 = performance.now()
    let i = this.atlasCount
    while (i < n) {
      const ti = Math.floor(i / TILE), j = i % TILE
      if (!this.atlas[ti]) {
        const c = document.createElement('canvas')
        c.width = TILE_COLS * CELL
        c.height = Math.ceil(Math.min(TILE, n - ti * TILE) / TILE_COLS) * CELL
        const g = c.getContext('2d')
        g.textAlign = 'center'
        g.textBaseline = 'middle'
        this.atlas[ti] = c
        this.atlasCtx = g
      }
      const g = this.atlasCtx
      const e = this.entries[i]
      const cx = (j % TILE_COLS) * CELL + CELL / 2, cy = Math.floor(j / TILE_COLS) * CELL + CELL / 2
      this.paintDisc(g, cx, cy, this.type[i])
      if (e.character) {
        g.fillStyle = this.theme.ink
        g.font = `${DISC * 1.25}px ${GLYPH_FONT}`
        g.fillText(e.character, cx, cy + DISC * 0.06)
      } else {
        g.fillStyle = this.theme.types[2]
        g.font = `italic 600 ${DISC * 0.72}px ${UI_FONT}`
        g.fillText(displayName(e).slice(0, 2), cx, cy)
      }
      i++
      if ((i & 7) === 0 && performance.now() - t0 > budgetMs) break
    }
    this.atlasCount = i
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  render() {
    const { ctx, n, x, y, r, type, theme, zoom, panX, panY, dpr, cssW, cssH } = this
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, cssW, cssH)
    if (!n) return
    ctx.translate(panX, panY)
    ctx.scale(zoom, zoom)

    const scale = this.nodeScale
    const pad = 30 * scale
    const x0 = -panX / zoom - pad, x1 = (cssW - panX) / zoom + pad
    const y0 = -panY / zoom - pad, y1 = (cssH - panY) / zoom + pad
    const active = this.active
    const px = 1 / zoom // one screen pixel in world units

    // Edges. Drawn in screen coordinates and in batches: one scaled path with
    // thousands of segments gets re-tessellated on every zoom step and stalls.
    const { es, et, m } = this
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.lineWidth = 1
    ctx.strokeStyle = theme.edge
    ctx.globalAlpha = active ? 0.35 : 1
    let inPath = 0
    ctx.beginPath()
    for (let e = 0; e < m; e++) {
      const a = es[e], b = et[e]
      const ax = x[a], ay = y[a], bx = x[b], by = y[b]
      if ((ax < x0 && bx < x0) || (ax > x1 && bx > x1) || (ay < y0 && by < y0) || (ay > y1 && by > y1)) continue
      ctx.moveTo(ax * zoom + panX, ay * zoom + panY)
      ctx.lineTo(bx * zoom + panX, by * zoom + panY)
      if (++inPath === 200) { ctx.stroke(); ctx.beginPath(); inPath = 0 }
    }
    if (inPath) ctx.stroke()
    ctx.globalAlpha = 1
    ctx.translate(panX, panY)
    ctx.scale(zoom, zoom)

    if (active) {
      const c = this.activeCenter
      ctx.strokeStyle = theme.edgeActive
      ctx.fillStyle = theme.edgeActive
      ctx.lineWidth = 1.5 * px
      ctx.beginPath()
      for (let e = 0; e < m; e++) {
        const a = es[e], b = et[e]
        if (a !== c && b !== c) continue
        ctx.moveTo(x[a], y[a]); ctx.lineTo(x[b], y[b])
      }
      ctx.stroke()
      // arrowheads point at the component
      const ah = Math.min(7 * px, 9)
      ctx.beginPath()
      for (let e = 0; e < m; e++) {
        const a = es[e], b = et[e]
        if (a !== c && b !== c) continue
        const dx = x[b] - x[a], dy = y[b] - y[a]
        const d = Math.sqrt(dx * dx + dy * dy) || 1
        const tr = r[b] * scale + px
        const ex = x[b] - (dx / d) * tr, ey = y[b] - (dy / d) * tr
        const ang = Math.atan2(dy, dx)
        ctx.moveTo(ex, ey)
        ctx.lineTo(ex - ah * Math.cos(ang - 0.42), ey - ah * Math.sin(ang - 0.42))
        ctx.lineTo(ex - ah * Math.cos(ang + 0.42), ey - ah * Math.sin(ang + 0.42))
        ctx.closePath()
      }
      ctx.fill()
    }

    // Visible nodes, bucketed by type and by dim/normal
    const vis = this.visBuf && this.visBuf.length >= n ? this.visBuf : (this.visBuf = new Int32Array(n))
    let vc = 0
    for (let i = 0; i < n; i++) {
      if (x[i] < x0 || x[i] > x1 || y[i] < y0 || y[i] > y1) continue
      vis[vc++] = i
    }

    // Nodes are blitted from pre-rendered sprites: rasterising hundreds of
    // vector circles per frame is far slower than copying small images.
    const TAU = Math.PI * 2
    // nodes in completed tiles only
    const ready = this.atlasCount >= n ? n : Math.floor(this.atlasCount / TILE) * TILE
    const atlas = this.atlas, sprites = this.sprites
    const glyphs = this.labelMode === 'glyph'
    const k = CELL / (2 * DISC) // cell size relative to the disc diameter
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (let pass = 0; atlas && pass < (active ? 2 : 1); pass++) {
      // pass 0: dimmed (or everything when nothing is highlighted); pass 1: highlighted
      ctx.globalAlpha = active && pass === 0 ? 0.16 : 1
      for (let p = 0; p < vc; p++) {
        const i = vis[p]
        if (active && (active[i] === 1) !== (pass === 1)) continue
        const rr = r[i] * scale
        const sr = rr * zoom
        const t = type[i]
        const s = rr * 2 * k
        if (sr < 3.2) {
          ctx.drawImage(sprites, t * CELL, CELL, CELL, CELL, x[i] - s / 2, y[i] - s / 2, s, s)
        } else if (sr > 30) {
          // big on screen: draw as vectors so ring and glyph stay crisp
          ctx.beginPath()
          ctx.arc(x[i], y[i], rr, 0, TAU)
          ctx.fillStyle = theme.fills[t]
          ctx.fill()
          ctx.strokeStyle = theme.types[t]
          ctx.lineWidth = Math.max(1.4 * px, rr * 0.07)
          ctx.stroke()
          if (glyphs) {
            const e = this.entries[i]
            if (e.character) {
              ctx.fillStyle = theme.ink
              ctx.font = `${rr * 1.25}px ${GLYPH_FONT}`
              ctx.fillText(e.character, x[i], y[i] + rr * 0.06)
            } else {
              ctx.fillStyle = theme.types[2]
              ctx.font = `italic 600 ${rr * 0.72}px ${UI_FONT}`
              ctx.fillText(displayName(e).slice(0, 2), x[i], y[i])
            }
          }
        } else if (glyphs && i < ready) {
          const j = i % TILE
          ctx.drawImage(atlas[Math.floor(i / TILE)], (j % TILE_COLS) * CELL, Math.floor(j / TILE_COLS) * CELL, CELL, CELL, x[i] - s / 2, y[i] - s / 2, s, s)
        } else {
          ctx.drawImage(sprites, t * CELL, 0, CELL, CELL, x[i] - s / 2, y[i] - s / 2, s, s)
        }
      }
    }
    ctx.globalAlpha = 1

    // Text labels under nodes: all visible ones when zoomed in far enough,
    // plus the highlighted neighbourhood
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const fs = 11 * px
    ctx.font = `${fs}px ${UI_FONT}`
    const labelAll = this.labelMode === 'keyword' ? zoom * scale > 0.75 : zoom * scale > 1.9
    if (labelAll || active) {
      let drawn = 0
      for (let p = 0; p < vc && drawn < 500; p++) {
        const i = vis[p]
        const isActive = active && active[i] === 1
        if (!isActive && (!labelAll || active)) continue
        if (i === this.hover || i === this.selected) continue
        ctx.fillStyle = isActive ? theme.ink : theme.muted
        ctx.fillText(displayName(this.entries[i]), x[i], y[i] + r[i] * scale + 3 * px)
        drawn++
      }
    }

    // Selected / hovered: ring + name on a small plate
    for (const i of this.hover === this.selected ? [this.selected] : [this.selected, this.hover]) {
      if (i < 0) continue
      const rr = r[i] * scale
      ctx.beginPath()
      ctx.arc(x[i], y[i], rr + 3.5 * px, 0, TAU)
      ctx.strokeStyle = theme.types[type[i]]
      ctx.lineWidth = (i === this.selected ? 2.2 : 1.4) * px
      ctx.stroke()
      const name = displayName(this.entries[i])
      ctx.font = `600 ${12 * px}px ${UI_FONT}`
      const tw = ctx.measureText(name).width
      const ty = y[i] + rr + 7 * px
      ctx.fillStyle = theme.surface
      ctx.globalAlpha = 0.92
      ctx.fillRect(x[i] - tw / 2 - 5 * px, ty - 2 * px, tw + 10 * px, 18 * px)
      ctx.globalAlpha = 1
      ctx.fillStyle = theme.ink
      ctx.fillText(name, x[i], ty + px)
      ctx.font = `${fs}px ${UI_FONT}`
    }
  }

  // ── Interaction ─────────────────────────────────────────────────────────────

  toWorld(cx, cy) { return [(cx - this.panX) / this.zoom, (cy - this.panY) / this.zoom] }

  hit(cx, cy) {
    const [wx, wy] = this.toWorld(cx, cy)
    const { n, x, y, r } = this
    const slack = 5 / this.zoom
    let best = -1, bestD = Infinity
    for (let i = 0; i < n; i++) {
      const dx = wx - x[i], dy = wy - y[i]
      const rr = r[i] * this.nodeScale + slack
      const d = dx * dx + dy * dy
      if (d <= rr * rr && d < bestD) { best = i; bestD = d }
    }
    return best
  }

  local(e) {
    const rect = this.canvas.getBoundingClientRect()
    return [e.clientX - rect.left, e.clientY - rect.top]
  }

  bind() {
    const c = this.canvas
    this.onDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return
      c.setPointerCapture?.(e.pointerId)
      const [cx, cy] = this.local(e)
      this.pointers.set(e.pointerId, { x: cx, y: cy })
      this.anim = null
      if (this.pointers.size === 1) {
        const node = this.hit(cx, cy)
        this.gesture = { kind: node >= 0 ? 'node' : 'pan', node, sx: cx, sy: cy, lx: cx, ly: cy, moved: false }
      } else if (this.pointers.size === 2) {
        const [a, b] = [...this.pointers.values()]
        this.dragNode = -1
        this.gesture = {
          kind: 'pinch', dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: this.zoom,
          mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, moved: true,
        }
      }
    }
    this.onMove = (e) => {
      const [cx, cy] = this.local(e)
      const g = this.gesture
      if (!this.pointers.has(e.pointerId) || !g) {
        if (e.pointerType !== 'mouse') return
        const h = this.hit(cx, cy)
        if (h !== this.hover) {
          this.hover = h
          c.style.cursor = h >= 0 ? 'pointer' : 'grab'
          if (this.selected < 0) this.updateActive()
          this.start()
        }
        return
      }
      this.pointers.set(e.pointerId, { x: cx, y: cy })
      if (g.kind === 'pinch' && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()]
        const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2
        const z = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, g.zoom * dist / g.dist))
        const wx = (g.mx - this.panX) / this.zoom, wy = (g.my - this.panY) / this.zoom
        this.zoom = z
        this.panX = mx - wx * z; this.panY = my - wy * z
        g.mx = mx; g.my = my
        this.start()
        return
      }
      const dx = cx - g.lx, dy = cy - g.ly
      if (!g.moved && Math.hypot(cx - g.sx, cy - g.sy) > 4) g.moved = true
      if (!g.moved) return
      g.lx = cx; g.ly = cy
      if (g.kind === 'node') {
        this.dragNode = g.node
        this.x[g.node] += dx / this.zoom
        this.y[g.node] += dy / this.zoom
        this.alpha = Math.max(this.alpha, 0.12)
        c.style.cursor = 'grabbing'
      } else if (g.kind === 'pan') {
        this.panX += dx; this.panY += dy
        c.style.cursor = 'grabbing'
      }
      this.start()
    }
    this.onUp = (e) => {
      if (!this.pointers.has(e.pointerId)) return
      this.pointers.delete(e.pointerId)
      const g = this.gesture
      if (!g) return
      if (g.kind === 'pinch') {
        if (this.pointers.size < 2) this.gesture = null
        return
      }
      this.gesture = null
      this.dragNode = -1
      c.style.cursor = 'grab'
      if (!g.moved) {
        const id = g.kind === 'node' ? this.ids[g.node] : null
        this.setSelected(id)
        this.onSelect(id)
      } else if (g.kind === 'node') {
        this.reheat(0.12)
      }
    }
    this.onLeave = () => {
      if (this.hover >= 0) {
        this.hover = -1
        if (this.selected < 0) this.updateActive()
        this.start()
      }
    }
    this.onWheel = (e) => {
      e.preventDefault()
      let delta = e.deltaY
      if (e.deltaMode === 1) delta *= 20
      else if (e.deltaMode === 2) delta *= 300
      const cap = e.ctrlKey ? 20 : 150
      delta = Math.sign(delta) * Math.min(Math.abs(delta), cap)
      const [cx, cy] = this.local(e)
      this.anim = null
      this.zoomAt(Math.exp(-delta * (e.ctrlKey ? 0.012 : 0.0022)), cx, cy, false)
    }
    c.addEventListener('pointerdown', this.onDown)
    c.addEventListener('pointermove', this.onMove)
    c.addEventListener('pointerup', this.onUp)
    c.addEventListener('pointercancel', this.onUp)
    c.addEventListener('pointerleave', this.onLeave)
    c.addEventListener('wheel', this.onWheel, { passive: false })
  }

  destroy() {
    const c = this.canvas
    if (this.raf) cancelAnimationFrame(this.raf)
    this.raf = 0
    c.removeEventListener('pointerdown', this.onDown)
    c.removeEventListener('pointermove', this.onMove)
    c.removeEventListener('pointerup', this.onUp)
    c.removeEventListener('pointercancel', this.onUp)
    c.removeEventListener('pointerleave', this.onLeave)
    c.removeEventListener('wheel', this.onWheel)
  }
}
