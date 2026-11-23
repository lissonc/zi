import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { GraphEngine } from '../graph/engine.js'
import { entryType, entryDisplayName, storyToHtml, hasStory, entryMeta } from '../utils.js'
import { useKeyboard } from '../hooks/useKeyboard.js'
import EntryChip from './EntryChip.jsx'

export default function GraphView({ entries, entryMap, usedByMap, onEdit, theme, focusId, onFocusHandled }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const engineRef = useRef(null)
  const searchRef = useRef(null)

  const [selectedId, setSelectedId] = useState(null)
  const [nodeScale, setNodeScale] = useState(1)
  const [labelMode, setLabelMode] = useState('glyph')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const maxLesson = useMemo(() => entries.reduce((m, e) => Math.max(m, e.lessonNumber || 0), 0), [entries])
  const [upTo, setUpTo] = useState(null) // null = everything
  const lessonLimit = upTo ?? maxLesson

  const visible = useMemo(() => {
    if (!maxLesson || lessonLimit >= maxLesson) return entries
    return entries.filter(e => (e.lessonNumber || 0) <= lessonLimit)
  }, [entries, lessonLimit, maxLesson])

  // The layout only depends on which nodes and edges exist. Editing a story
  // must not restart the simulation, so data is pushed to the engine only when
  // this signature changes.
  const signature = useMemo(() => {
    let h = visible.length
    for (const e of visible) h = (h * 31 + e.id.length + (e.componentIds?.length || 0) * 7 + e.id.charCodeAt(e.id.length - 1)) | 0
    return `${visible.length}:${h}`
  }, [visible])

  useEffect(() => {
    const engine = new GraphEngine(canvasRef.current, { onSelect: setSelectedId })
    engineRef.current = engine
    if (import.meta.env.DEV) window.__radixGraph = engine
    const ro = new ResizeObserver(() => engine.resize())
    ro.observe(wrapRef.current)
    return () => { ro.disconnect(); engine.destroy(); engineRef.current = null }
  }, [])

  const firstFit = useRef(true)
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const fresh = engine.setData(visible)
    if (fresh || firstFit.current) {
      firstFit.current = false
      // fit once now and again when the layout has had time to spread out
      engine.fit(false)
      const t1 = setTimeout(() => engine.fit(true), 700)
      const t2 = setTimeout(() => engine.fit(true), 2200)
      return () => { clearTimeout(t1); clearTimeout(t2) }
    }
  }, [signature]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { engineRef.current?.updateEntries(visible) }, [visible])
  useEffect(() => { engineRef.current?.setOptions({ nodeScale, labelMode }) }, [nodeScale, labelMode])
  useEffect(() => {
    // wait a frame so the new CSS variables are in effect
    const id = requestAnimationFrame(() => engineRef.current?.readTheme())
    return () => cancelAnimationFrame(id)
  }, [theme])
  useEffect(() => { engineRef.current?.setSelected(selectedId) }, [selectedId])

  const goTo = useCallback((entry) => {
    setSelectedId(entry.id)
    setQuery(''); setOpen(false)
    const engine = engineRef.current
    if (!engine) return
    engine.setSelected(entry.id)
    engine.focus(entry.id)
  }, [])

  // "Show in graph" from the library
  useEffect(() => {
    if (!focusId) return
    const e = entryMap.get(focusId)
    if (e) {
      if (upTo != null && (e.lessonNumber || 0) > upTo) setUpTo(null)
      const t = setTimeout(() => goTo(e), 60)
      onFocusHandled?.()
      return () => clearTimeout(t)
    }
    onFocusHandled?.()
  }, [focusId]) // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const out = []
    for (const e of visible) {
      if (e.character?.includes(q) || e.keyword?.toLowerCase().includes(q) ||
          e.primitiveKeywords?.some(pk => pk.toLowerCase().includes(q)) || String(e.heisigNumber ?? '') === q) {
        out.push(e)
        if (out.length >= 8) break
      }
    }
    return out
  }, [query, visible])

  const selected = selectedId ? entryMap.get(selectedId) ?? null : null
  const components = selected ? (selected.componentIds || []).map(id => entryMap.get(id)).filter(Boolean) : []
  const usedBy = selected ? (usedByMap.get(selected.id) || []).map(id => entryMap.get(id)).filter(Boolean) : []

  useKeyboard(e => {
    const engine = engineRef.current
    if (!engine) return
    switch (e.key) {
      case '+': case '=': e.preventDefault(); engine.zoomAt(1.3, undefined, undefined, true); break
      case '-': e.preventDefault(); engine.zoomAt(1 / 1.3, undefined, undefined, true); break
      case 'f': case 'F': e.preventDefault(); engine.fit(true); break
      case 'k': case 'K': e.preventDefault(); setLabelMode(m => m === 'glyph' ? 'keyword' : 'glyph'); break
      case '/': e.preventDefault(); searchRef.current?.focus(); break
      case 'Escape': e.preventDefault(); setSelectedId(null); break
      case 'e': case 'E': if (selected) { e.preventDefault(); onEdit(selected) } break
      default: break
    }
  }, [selected, onEdit])

  return (
    <div className="graph" ref={wrapRef}>
      <canvas ref={canvasRef} className="graph-canvas" />

      <div className="graph-top">
        <div className="graph-search">
          <input
            ref={searchRef}
            className="search-input"
            type="search"
            placeholder="Find a character  ( / )"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            onKeyDown={e => {
              if (e.key === 'Enter' && results[0]) { goTo(results[0]); e.target.blur() }
              if (e.key === 'Escape') { setQuery(''); e.target.blur() }
            }}
          />
          {open && results.length > 0 && (
            <div className="menu">
              {results.map(e => (
                <button key={e.id} className="menu-item" onMouseDown={ev => { ev.preventDefault(); goTo(e) }}>
                  <span className="menu-glyph">{e.character}</span>
                  <span>{entryDisplayName(e)}</span>
                  {e.heisigNumber && <span className="menu-meta">#{e.heisigNumber}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className="graph-count">{visible.length.toLocaleString()} entries</span>
      </div>

      <div className="graph-controls">
        {maxLesson > 1 && (
          <label className="ctrl">
            <span className="ctrl-label">Up to lesson {lessonLimit}</span>
            <input
              type="range" min="1" max={maxLesson} step="1" value={lessonLimit}
              onChange={e => { const v = Number(e.target.value); setUpTo(v >= maxLesson ? null : v) }}
            />
          </label>
        )}
        <label className="ctrl">
          <span className="ctrl-label">Size</span>
          <input type="range" min="0.5" max="2.5" step="0.05" value={nodeScale} onChange={e => setNodeScale(parseFloat(e.target.value))} />
        </label>
        <div className="ctrl-row">
          <button className="btn btn-sm" onClick={() => engineRef.current?.zoomAt(1 / 1.3, undefined, undefined, true)} title="Zoom out (−)">−</button>
          <button className="btn btn-sm" onClick={() => engineRef.current?.fit(true)} title="Fit everything (F)">Fit</button>
          <button className="btn btn-sm" onClick={() => engineRef.current?.zoomAt(1.3, undefined, undefined, true)} title="Zoom in (+)">+</button>
          <button
            className={`btn btn-sm${labelMode === 'keyword' ? ' active' : ''}`}
            onClick={() => setLabelMode(m => m === 'glyph' ? 'keyword' : 'glyph')}
            title="Show keywords instead of characters (K)" aria-pressed={labelMode === 'keyword'}
          >Keywords</button>
        </div>
      </div>

      <div className="graph-legend">
        <span><i className="dot dot-character" />Character</span>
        <span><i className="dot dot-dual" />Dual</span>
        <span><i className="dot dot-primitive" />Primitive</span>
      </div>

      {selected && (
        <aside className="graph-panel">
          <button className="panel-close" onClick={() => setSelectedId(null)} aria-label="Close">✕</button>
          <div className="panel-head">
            {selected.character && <span className={`panel-glyph t-${entryType(selected)}`}>{selected.character}</span>}
            <div>
              <h2 className="panel-name">{entryDisplayName(selected)}</h2>
              {selected.keyword && selected.primitiveKeywords?.length > 0 && (
                <p className="panel-sub">as a part: {selected.primitiveKeywords.join(', ')}</p>
              )}
              <p className="panel-meta">{entryMeta(selected)}</p>
            </div>
          </div>

          {hasStory(selected) && (
            <p className="panel-story" dangerouslySetInnerHTML={{ __html: storyToHtml(selected.story) }} />
          )}

          {components.length > 0 && (
            <div className="panel-section">
              <h3>Built from</h3>
              <div className="chips">{components.map(c => <EntryChip key={c.id} entry={c} onClick={goTo} />)}</div>
            </div>
          )}
          {usedBy.length > 0 && (
            <div className="panel-section">
              <h3>Used in {usedBy.length}</h3>
              <div className="chips chips-scroll">{usedBy.map(c => <EntryChip key={c.id} entry={c} onClick={goTo} />)}</div>
            </div>
          )}
          <button className="btn btn-sm" onClick={() => onEdit(selected)}>Edit entry</button>
        </aside>
      )}
    </div>
  )
}
