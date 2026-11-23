import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { GraphEngine } from '../graph/engine.js'
import { entryType, entryDisplayName, storyToHtml, hasStory, entryMeta } from '../utils.js'
import { computeLevels, familyOf, chainOf, connectedGroups, largestFamilies } from '../lib/graphAnalysis.js'
import { useKeyboard } from '../hooks/useKeyboard.js'
import EntryChip from './EntryChip.jsx'

export default function GraphView({ entries, entryMap, usedByMap, onEdit, onCheckComponents, theme, focusId, onFocusHandled }) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)
  const engineRef = useRef(null)
  const searchRef = useRef(null)

  const [selectedId, setSelectedId] = useState(null)
  const [nodeScale, setNodeScale] = useState(1)
  const [labelMode, setLabelMode] = useState('glyph')
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  // What is shown: everything, one family, or one build chain
  const [scope, setScope] = useState({ kind: 'all', id: null })
  const [rows, setRows] = useState(false)        // level layout for "everything"
  const [explore, setExplore] = useState(null)   // null | 'families' | 'groups'

  const maxLesson = useMemo(() => entries.reduce((m, e) => Math.max(m, e.lessonNumber || 0), 0), [entries])
  const [upTo, setUpTo] = useState(null) // null = everything
  const lessonLimit = upTo ?? maxLesson

  const scopeEntry = scope.id ? entryMap.get(scope.id) : null
  const kind = scopeEntry ? scope.kind : 'all'

  const visible = useMemo(() => {
    if (kind === 'family') {
      const set = familyOf(scope.id, usedByMap)
      return entries.filter(e => set.has(e.id))
    }
    if (kind === 'chain') {
      const set = chainOf(scope.id, entryMap)
      return entries.filter(e => set.has(e.id))
    }
    if (!maxLesson || lessonLimit >= maxLesson) return entries
    return entries.filter(e => (e.lessonNumber || 0) <= lessonLimit)
  }, [kind, scope.id, entries, entryMap, usedByMap, lessonLimit, maxLesson])

  // Families and chains are always drawn in rows by level
  const inRows = kind !== 'all' || rows
  const levels = useMemo(() => (inRows ? computeLevels(visible) : null), [inRows, visible])
  const levelCount = useMemo(() => (levels ? Math.max(0, ...levels.values()) : 0), [levels])

  // The layout only depends on which nodes and edges exist and how they are
  // arranged. Editing a story must not restart the simulation, so data is
  // pushed to the engine only when this signature changes.
  const signature = useMemo(() => {
    let h = visible.length
    for (const e of visible) h = (h * 31 + e.id.length + (e.componentIds?.length || 0) * 7 + e.id.charCodeAt(e.id.length - 1)) | 0
    return `${kind}:${scope.id || ''}:${inRows ? 'rows' : 'free'}:${visible.length}:${h}`
  }, [visible, kind, scope.id, inRows])
  const layoutKey = `${kind}:${scope.id || ''}:${inRows}`

  useEffect(() => {
    const engine = new GraphEngine(canvasRef.current, { onSelect: setSelectedId })
    engineRef.current = engine
    if (import.meta.env.DEV) window.__radixGraph = engine
    const ro = new ResizeObserver(() => engine.resize())
    ro.observe(wrapRef.current)
    return () => { ro.disconnect(); engine.destroy(); engineRef.current = null }
  }, [])

  const lastLayout = useRef(null)
  useEffect(() => {
    const engine = engineRef.current
    if (!engine) return
    const relayout = lastLayout.current !== null && lastLayout.current !== layoutKey
    lastLayout.current = layoutKey
    const fresh = engine.setData(visible, { levels, reset: relayout })
    if (fresh) {
      // fit now and again once the layout has had time to spread out
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
    setQuery(''); setOpen(false)
    // an entry outside the current family / chain: go back to everything
    if (kind !== 'all' && !visible.some(e => e.id === entry.id)) setScope({ kind: 'all', id: null })
    setSelectedId(entry.id)
    setTimeout(() => {
      const engine = engineRef.current
      if (!engine) return
      engine.setSelected(entry.id)
      engine.focus(entry.id)
    }, 80)
  }, [kind, visible])

  // open with nothing selected: a selection dims everything not directly
  // linked to it, which would hide most of a family or chain
  const showFamily = useCallback((entry) => { setScope({ kind: 'family', id: entry.id }); setSelectedId(null); setExplore(null) }, [])
  const showChain = useCallback((entry) => { setScope({ kind: 'chain', id: entry.id }); setSelectedId(null); setExplore(null) }, [])
  const showAll = useCallback(() => setScope({ kind: 'all', id: null }), [])

  // "Show in graph" from the library
  useEffect(() => {
    if (!focusId) return
    const e = entryMap.get(focusId)
    onFocusHandled?.()
    if (!e) return
    setScope({ kind: 'all', id: null })
    if (upTo != null && (e.lessonNumber || 0) > upTo) setUpTo(null)
    const t = setTimeout(() => {
      setSelectedId(e.id)
      engineRef.current?.setSelected(e.id)
      engineRef.current?.focus(e.id)
    }, 120)
    return () => clearTimeout(t)
  }, [focusId]) // eslint-disable-line react-hooks/exhaustive-deps

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const out = []
    for (const e of entries) {
      if (e.character?.includes(q) || e.keyword?.toLowerCase().includes(q) ||
          e.primitiveKeywords?.some(pk => pk.toLowerCase().includes(q)) || String(e.heisigNumber ?? '') === q) {
        out.push(e)
        if (out.length >= 8) break
      }
    }
    return out
  }, [query, entries])

  // Explore panel data, computed only while it is open
  const families = useMemo(() => (explore === 'families' ? largestFamilies(entries, usedByMap, 60) : []), [explore, entries, usedByMap])
  const groups = useMemo(() => (explore === 'groups' ? connectedGroups(entries, usedByMap) : []), [explore, entries, usedByMap])

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
      case 'l': case 'L': if (kind === 'all') { e.preventDefault(); setRows(r => !r) } break
      case '/': e.preventDefault(); searchRef.current?.focus(); break
      case 'Escape':
        e.preventDefault()
        if (explore) setExplore(null)
        else if (selectedId) setSelectedId(null)
        else if (kind !== 'all') showAll()
        break
      case 'e': case 'E': if (selected) { e.preventDefault(); onEdit(selected) } break
      default: break
    }
  }, [selected, selectedId, onEdit, kind, explore, showAll])

  const scopeLabel = kind === 'family'
    ? `Family of ${scopeEntry.character || ''} ${entryDisplayName(scopeEntry)}`
    : kind === 'chain' ? `Build chain of ${scopeEntry.character || ''} ${entryDisplayName(scopeEntry)}` : null

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
        <button className={`btn btn-sm${explore ? ' active' : ''}`} onClick={() => setExplore(x => (x ? null : 'families'))} aria-expanded={Boolean(explore)}>
          Explore
        </button>
        {scopeLabel ? (
          <span className="scope-pill">
            <span className="scope-text">{scopeLabel} · {visible.length.toLocaleString()} {visible.length === 1 ? 'entry' : 'entries'} · {levelCount} level{levelCount === 1 ? '' : 's'}</span>
            <button className="scope-close" onClick={showAll} title="Back to everything (Esc)">Show everything</button>
          </span>
        ) : (
          <span className="graph-count">{visible.length.toLocaleString()} entries{inRows ? ` · ${levelCount} levels, simplest at the top` : ''}</span>
        )}
      </div>

      {explore && (
        <aside className="graph-explore">
          <div className="explore-tabs">
            <button className={`seg-btn${explore === 'families' ? ' active' : ''}`} onClick={() => setExplore('families')}>Families</button>
            <button className={`seg-btn${explore === 'groups' ? ' active' : ''}`} onClick={() => setExplore('groups')}>Connections</button>
            <button className="panel-close" onClick={() => setExplore(null)} aria-label="Close">✕</button>
          </div>

          {explore === 'families' && (
            <>
              <p className="hint">Components by how many entries are built directly from them. Pick one to see only its family.</p>
              <ul className="family-list">
                {families.map(({ entry, direct }) => (
                  <li key={entry.id}>
                    <button className="family-row" onClick={() => showFamily(entry)}>
                      <span className={`family-glyph t-${entryType(entry)}`}>{entry.character || '·'}</span>
                      <span className="family-name">{entryDisplayName(entry)}</span>
                      <span className="family-count">{direct}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {explore === 'groups' && groups.length > 0 && (
            <>
              <p className="explore-lead">
                <b>{groups.length}</b> separate group{groups.length === 1 ? '' : 's'}. The largest holds{' '}
                <b>{groups[0].length.toLocaleString()}</b> of {entries.length.toLocaleString()} entries
                ({Math.round((groups[0].length / entries.length) * 100)}%).
              </p>
              {groups.length > 1 ? (
                <>
                  <p className="hint">
                    Everything below is cut off from the main group. For characters that usually means
                    components are missing.
                  </p>
                  {onCheckComponents && (
                    <button className="btn btn-sm" onClick={onCheckComponents}>Check components</button>
                  )}
                  <ul className="group-list">
                    {groups.slice(1, 80).map((g, i) => (
                      <li key={i} className="group-row">
                        {g.length > 1 && <span className="group-size">{g.length} linked</span>}
                        <div className="chips">
                          {g.map(id => entryMap.get(id)).filter(Boolean).map(e => <EntryChip key={e.id} entry={e} onClick={goTo} />)}
                        </div>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="hint">Every entry is linked to every other by some path.</p>
              )}
            </>
          )}
        </aside>
      )}

      <div className="graph-controls">
        {kind === 'all' && maxLesson > 1 && (
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
        </div>
        <div className="ctrl-row">
          <button
            className={`btn btn-sm${labelMode === 'keyword' ? ' active' : ''}`}
            onClick={() => setLabelMode(m => m === 'glyph' ? 'keyword' : 'glyph')}
            title="Show keywords instead of characters (K)" aria-pressed={labelMode === 'keyword'}
          >Keywords</button>
          {kind === 'all' && (
            <button
              className={`btn btn-sm${rows ? ' active' : ''}`}
              onClick={() => setRows(r => !r)}
              title="Arrange in rows by level: simplest entries at the top (L)" aria-pressed={rows}
            >Levels</button>
          )}
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
          <div className="panel-actions">
            {usedBy.length > 0 && !(kind === 'family' && scope.id === selected.id) && (
              <button className="btn btn-sm" onClick={() => showFamily(selected)}>Show family</button>
            )}
            {components.length > 0 && !(kind === 'chain' && scope.id === selected.id) && (
              <button className="btn btn-sm" onClick={() => showChain(selected)}>Show build chain</button>
            )}
            <button className="btn btn-sm" onClick={() => onEdit(selected)}>Edit</button>
          </div>
        </aside>
      )}
    </div>
  )
}
