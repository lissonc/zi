import { useState, useMemo, memo, useDeferredValue, useRef, useEffect } from 'react'
import { entryType, entryDisplayName, storyToHtml, hasStory, entryMeta } from '../utils.js'
import { useKeyboard } from '../hooks/useKeyboard.js'
import { componentIssue } from '../lib/graphAnalysis.js'
import EntryChip from './EntryChip.jsx'

const PAGE = 60

const EntryRow = memo(function EntryRow({ entry, entryMap, onEdit, onDelete, onToggleMastered, onShowInGraph }) {
  const type = entryType(entry)
  const components = (entry.componentIds || []).map(id => entryMap.get(id)).filter(Boolean)
  const real = hasStory(entry)
  const meta = [entryMeta(entry), entry.sourcePage ? `p. ${entry.sourcePage}` : ''].filter(Boolean).join(' · ')

  function confirmDelete() {
    if (window.confirm(`Delete “${entryDisplayName(entry)}”?`)) onDelete(entry.id)
  }

  return (
    <li className={`entry entry-${type}${entry.isMastered ? ' is-mastered' : ''}`}>
      <button className="entry-glyph" onClick={() => onEdit(entry)} title="Edit">
        {entry.character || <span className="entry-glyph-none">·</span>}
      </button>
      <div className="entry-body">
        <div className="entry-head">
          <span className="entry-name">{entryDisplayName(entry)}</span>
          {entry.keyword && entry.primitiveKeywords?.length > 0 && (
            <span className="entry-prim">as a part: {entry.primitiveKeywords.join(', ')}</span>
          )}
          {!entry.keyword && entry.primitiveKeywords?.length > 1 && (
            <span className="entry-prim">also {entry.primitiveKeywords.slice(1).join(', ')}</span>
          )}
        </div>
        {real && <p className="entry-story" dangerouslySetInnerHTML={{ __html: storyToHtml(entry.story) }} />}
        {(components.length > 0 || meta) && (
          <div className="entry-foot">
            {components.map(c => <EntryChip key={c.id} entry={c} />)}
            {meta && <span className="entry-meta">{meta}</span>}
          </div>
        )}
      </div>
      <div className="entry-actions">
        {type !== 'primitive' && (
          <button
            className={`icon-btn${entry.isMastered ? ' on' : ''}`}
            onClick={() => onToggleMastered(entry.id)}
            title={entry.isMastered ? 'Mark as not mastered' : 'Mark as mastered'}
            aria-pressed={entry.isMastered}
          >{entry.isMastered ? '★' : '☆'}</button>
        )}
        <button className="icon-btn" onClick={() => onShowInGraph(entry)} title="Show in graph">◎</button>
        <button className="icon-btn" onClick={() => onEdit(entry)} title="Edit">✎</button>
        <button className="icon-btn danger" onClick={confirmDelete} title="Delete">✕</button>
      </div>
    </li>
  )
})

export default function LibraryView({ entries, entryMap, onEdit, onDelete, onToggleMastered, onNew, onShowInGraph, onCheckComponents, presetLesson }) {
  const [search, setSearch] = useState('')
  const [type, setType] = useState('all')
  const [story, setStory] = useState('all')       // all | with | without
  const [mastered, setMastered] = useState('all') // all | yes | no
  const [lesson, setLesson] = useState(presetLesson != null ? String(presetLesson) : '')
  const [sort, setSort] = useState('order')       // order | strokes | name
  const [shown, setShown] = useState(PAGE)
  const searchRef = useRef(null)
  const sentinelRef = useRef(null)

  useKeyboard(e => {
    if (e.key === '/') { e.preventDefault(); searchRef.current?.focus() }
  }, [])

  const counts = useMemo(() => {
    const c = { all: entries.length, character: 0, dual: 0, primitive: 0, withStory: 0, reviewable: 0, mastered: 0 }
    for (const e of entries) {
      c[entryType(e)]++
      if (e.keyword?.trim()) { c.reviewable++; if (hasStory(e)) c.withStory++ }
      if (e.isMastered) c.mastered++
    }
    return c
  }, [entries])

  const toCheck = useMemo(() => {
    let n = 0
    for (const e of entries) if (componentIssue(e, entryMap)) n++
    return n
  }, [entries, entryMap])

  const q = useDeferredValue(search.trim().toLowerCase())

  const filtered = useMemo(() => {
    const list = entries.filter(e => {
      const t = entryType(e)
      if (type !== 'all' && t !== type) return false
      if (lesson !== '' && String(e.lessonNumber) !== lesson) return false
      if (story !== 'all' && (t === 'primitive' || hasStory(e) !== (story === 'with'))) return false
      if (mastered !== 'all' && (t === 'primitive' || Boolean(e.isMastered) !== (mastered === 'yes'))) return false
      if (q) {
        const hit = e.character?.includes(q) ||
          e.keyword?.toLowerCase().includes(q) ||
          e.primitiveKeywords?.some(pk => pk.toLowerCase().includes(q)) ||
          (hasStory(e) && e.story.toLowerCase().includes(q)) ||
          String(e.heisigNumber ?? '') === q
        if (!hit) return false
      }
      return true
    })
    if (sort === 'strokes') {
      return [...list].sort((a, b) => (a.strokeCount ?? 99) - (b.strokeCount ?? 99))
    }
    if (sort === 'name') {
      return [...list].sort((a, b) => entryDisplayName(a).localeCompare(entryDisplayName(b)))
    }
    return list
  }, [entries, q, type, story, mastered, lesson, sort])

  // Render in pages: only the first PAGE rows mount; more are added as the
  // sentinel at the end of the list scrolls into view.
  useEffect(() => { setShown(PAGE) }, [q, type, story, mastered, lesson, sort])
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(([en]) => {
      if (en.isIntersecting) setShown(s => s + PAGE)
    }, { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [filtered, shown >= filtered.length])

  const visible = filtered.slice(0, shown)
  const filtersOn = q || type !== 'all' || story !== 'all' || mastered !== 'all' || lesson !== ''

  function clearFilters() {
    setSearch(''); setType('all'); setStory('all'); setMastered('all'); setLesson('')
  }

  return (
    <div className="page library">
      <div className="page-head">
        <div>
          <h1 className="page-title">Library</h1>
          <p className="page-sub">
            {counts.reviewable.toLocaleString()} characters · {counts.withStory.toLocaleString()} with a story · {counts.mastered.toLocaleString()} mastered
          </p>
        </div>
        <div className="page-actions">
          {toCheck > 0 && onCheckComponents && (
            <button className="btn" onClick={onCheckComponents} title="Characters whose components look wrong">
              Check components <span className="seg-count">{toCheck.toLocaleString()}</span>
            </button>
          )}
          <button className="btn btn-primary" onClick={onNew}>New entry</button>
        </div>
      </div>

      <div className="searchbar">
        <input
          ref={searchRef}
          className="search-input"
          type="search"
          placeholder="Search character, keyword, number or story  ( / )"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') { setSearch(''); e.target.blur() } }}
        />
      </div>

      <div className="filters">
        <div className="seg" role="group" aria-label="Type">
          {[['all', 'All', counts.all], ['character', 'Characters', counts.character], ['dual', 'Dual', counts.dual], ['primitive', 'Primitives', counts.primitive]].map(([v, label, n]) => (
            <button key={v} className={`seg-btn seg-${v}${type === v ? ' active' : ''}`} onClick={() => setType(v)} aria-pressed={type === v}>
              {label} <span className="seg-count">{n.toLocaleString()}</span>
            </button>
          ))}
        </div>
        <select className="select" value={story} onChange={e => setStory(e.target.value)} aria-label="Story">
          <option value="all">Any story state</option>
          <option value="with">With a story</option>
          <option value="without">Without a story</option>
        </select>
        <select className="select" value={mastered} onChange={e => setMastered(e.target.value)} aria-label="Mastered">
          <option value="all">Mastered or not</option>
          <option value="yes">Mastered</option>
          <option value="no">Not mastered</option>
        </select>
        <input
          className="input input-narrow" type="number" min="1" placeholder="Lesson"
          value={lesson} onChange={e => setLesson(e.target.value)} aria-label="Lesson"
        />
        <select className="select" value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort">
          <option value="order">Library order</option>
          <option value="strokes">Stroke count</option>
          <option value="name">Name</option>
        </select>
      </div>

      {filtersOn && (
        <p className="result-line">
          {filtered.length.toLocaleString()} of {entries.length.toLocaleString()} entries
          <button className="link-btn" onClick={clearFilters}>Clear filters</button>
        </p>
      )}

      {filtered.length === 0 ? (
        <div className="empty">
          {entries.length === 0
            ? <>The library is empty. <button className="link-btn" onClick={onNew}>Add the first entry</button></>
            : 'Nothing matches these filters.'}
        </div>
      ) : (
        <ul className="entry-list">
          {visible.map(entry => (
            <EntryRow
              key={entry.id}
              entry={entry}
              entryMap={entryMap}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggleMastered={onToggleMastered}
              onShowInGraph={onShowInGraph}
            />
          ))}
        </ul>
      )}
      {shown < filtered.length && <div ref={sentinelRef} className="list-sentinel">Loading more…</div>}
    </div>
  )
}
