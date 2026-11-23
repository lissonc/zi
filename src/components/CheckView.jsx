import { useState, useMemo, useEffect, useRef, memo } from 'react'
import { entryDisplayName, entryMeta, canonicalName, isScaffold } from '../utils.js'
import { componentIssue } from '../lib/graphAnalysis.js'
import EntryChip from './EntryChip.jsx'

const PAGE = 30

/** The placeholder story lists the components; keep it in step when they change. */
function withComponents(entry, ids, entryMap) {
  const changes = { componentIds: ids }
  if (isScaffold(entry.story)) {
    changes.story = ids.map(id => entryMap.get(id)).filter(Boolean).map(c => `[[${canonicalName(c)}]]`).join(' + ')
  }
  return changes
}

const CheckRow = memo(function CheckRow({ entry, issue, entries, entryMap, onPatch, onEdit }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const comps = (entry.componentIds || []).map(id => entryMap.get(id)).filter(Boolean)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    const have = new Set(entry.componentIds || [])
    const out = []
    for (const e of entries) {
      if (e.id === entry.id || have.has(e.id)) continue
      if (e.character === q || e.keyword?.toLowerCase().includes(q) ||
          e.primitiveKeywords?.some(pk => pk.toLowerCase().includes(q)) || e.character?.includes(q)) {
        out.push(e)
        if (out.length >= 7) break
      }
    }
    return out
  }, [query, entries, entry.id, entry.componentIds])

  function add(c) {
    onPatch(entry.id, withComponents(entry, [...(entry.componentIds || []), c.id], entryMap))
    setQuery(''); setOpen(false)
  }
  function remove(c) {
    onPatch(entry.id, withComponents(entry, (entry.componentIds || []).filter(id => id !== c.id), entryMap))
  }

  return (
    <li className="check-row">
      <button className="entry-glyph" onClick={() => onEdit(entry)} title="Open in the editor">{entry.character}</button>
      <div className="check-body">
        <div className="entry-head">
          <span className="entry-name">{entryDisplayName(entry)}</span>
          <span className="entry-meta">{entryMeta(entry)}</span>
        </div>
        <p className={`check-issue check-${issue.kind}`}>{issue.label}</p>
        <div className="check-comps">
          {comps.map(c => (
            <span key={c.id} className="chip-removable">
              <EntryChip entry={c} />
              <button className="chip-x" onClick={() => remove(c)} aria-label={`Remove ${canonicalName(c)}`}>✕</button>
            </span>
          ))}
          <span className="check-add">
            <input
              className="input"
              type="text"
              placeholder="Add a component…"
              value={query}
              onChange={e => { setQuery(e.target.value); setOpen(true) }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              onKeyDown={e => {
                if (e.key === 'Enter' && results[0]) { e.preventDefault(); add(results[0]) }
                if (e.key === 'Escape') { setQuery(''); e.target.blur() }
              }}
              aria-label={`Add a component to ${entryDisplayName(entry)}`}
            />
            {open && results.length > 0 && (
              <div className="menu">
                {results.map(r => (
                  <button key={r.id} className="menu-item" onMouseDown={ev => { ev.preventDefault(); add(r) }}>
                    <span className="menu-glyph">{r.character}</span>
                    <span>{canonicalName(r)}</span>
                    {r.strokeCount != null && <span className="menu-meta">{r.strokeCount} str.</span>}
                  </button>
                ))}
              </div>
            )}
          </span>
        </div>
      </div>
      <button className="btn btn-sm" onClick={() => onPatch(entry.id, { componentsChecked: true })} title="Take this character off the list">
        Looks right
      </button>
    </li>
  )
})

export default function CheckView({ entries, entryMap, onPatch, onEdit, onBack }) {
  const [filter, setFilter] = useState('all')
  const [shown, setShown] = useState(PAGE)
  const sentinelRef = useRef(null)

  // The list is frozen while you work: an entry stays put after it is fixed,
  // so rows don't jump away under your finger. "Refresh" re-runs the check.
  const [stamp, setStamp] = useState(0)
  const flagged = useMemo(() => {
    const out = []
    for (const e of entries) {
      const issue = componentIssue(e, entryMap)
      if (issue) out.push({ id: e.id, kind: issue.kind })
    }
    return out
  }, [stamp]) // eslint-disable-line react-hooks/exhaustive-deps

  const counts = useMemo(() => {
    const c = { all: flagged.length, none: 0, few: 0, many: 0 }
    for (const f of flagged) c[f.kind]++
    return c
  }, [flagged])

  const list = useMemo(() => flagged.filter(f => filter === 'all' || f.kind === filter), [flagged, filter])
  const remaining = useMemo(
    () => list.filter(f => { const e = entryMap.get(f.id); return e && componentIssue(e, entryMap) }).length,
    [list, entryMap],
  )

  useEffect(() => { setShown(PAGE) }, [filter, stamp])
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(([en]) => { if (en.isIntersecting) setShown(s => s + PAGE) }, { rootMargin: '500px' })
    io.observe(el)
    return () => io.disconnect()
  }, [list, shown >= list.length])

  return (
    <div className="page check">
      <button className="link-btn" onClick={onBack}>← Library</button>
      <div className="page-head">
        <div>
          <h1 className="page-title">Check components</h1>
          <p className="page-sub">
            {remaining.toLocaleString()} character{remaining === 1 ? '' : 's'} left to look at
            {remaining !== list.length && ` (of ${list.length.toLocaleString()} listed)`}
          </p>
        </div>
        <button className="btn" onClick={() => setStamp(s => s + 1)}>Refresh list</button>
      </div>
      <p className="hint check-intro">
        Characters whose components look wrong, judged by stroke counts: none listed, too few strokes
        covered, or more strokes than the character has. A component used twice (森 is 木 three times)
        is flagged too; mark those “Looks right”.
      </p>

      <div className="filters">
        <div className="seg" role="group" aria-label="Problem">
          {[['all', 'All'], ['none', 'No components'], ['few', 'Too few'], ['many', 'Too many']].map(([v, label]) => (
            <button key={v} className={`seg-btn${filter === v ? ' active' : ''}`} onClick={() => setFilter(v)} aria-pressed={filter === v}>
              {label} <span className="seg-count">{counts[v]}</span>
            </button>
          ))}
        </div>
      </div>

      {list.length === 0 ? (
        <div className="empty">Nothing to check here.</div>
      ) : (
        <ul className="entry-list">
          {list.slice(0, shown).map(f => {
            const e = entryMap.get(f.id)
            if (!e) return null
            const issue = componentIssue(e, entryMap)
            if (!issue) {
              return (
                <li key={f.id} className="check-row check-done">
                  <span className="entry-glyph">{e.character}</span>
                  <div className="check-body">
                    <span className="entry-name">{entryDisplayName(e)}</span>
                    <p className="check-issue check-ok">{e.componentsChecked ? 'Marked as right' : 'Fixed'}</p>
                  </div>
                  {e.componentsChecked && (
                    <button className="link-btn" onClick={() => onPatch(e.id, { componentsChecked: false })}>Undo</button>
                  )}
                </li>
              )
            }
            return <CheckRow key={f.id} entry={e} issue={issue} entries={entries} entryMap={entryMap} onPatch={onPatch} onEdit={onEdit} />
          })}
        </ul>
      )}
      {shown < list.length && <div ref={sentinelRef} className="list-sentinel">Loading more…</div>}
    </div>
  )
}
