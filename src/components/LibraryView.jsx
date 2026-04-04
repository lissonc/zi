import { useState, useMemo, memo, useDeferredValue } from 'react'
import { entryType, entryDisplayName } from '../utils.js'
import GraphView from './GraphView.jsx'

function TypeBadge({ type }) {
  const labels = { primitive: 'Primitive', character: 'Character', dual: 'Dual' }
  return <span className={`type-badge type-badge-${type}`}>{labels[type]}</span>
}

const EntryCard = memo(function EntryCard({ entry, entryMap, onEdit, onDelete, onToggleMastered }) {
  const type = entryType(entry)
  const components = entry.componentIds
    .map(id => entryMap.get(id))
    .filter(Boolean)

  function confirmDelete() {
    const name = entryDisplayName(entry)
    if (window.confirm(`Delete "${name}"?`)) onDelete(entry.id)
  }

  return (
    <div className={`item-card entry-card-${type} ${type !== 'primitive' && entry.isMastered ? 'mastered' : ''}`}>
      <div className="item-main">
        {entry.character && (
          <span className="item-character">{entry.character}</span>
        )}
        <div className="item-info">
          <div className="item-headline">
            <span className="item-keyword">{entryDisplayName(entry)}</span>
            <TypeBadge type={type} />
          </div>

          {entry.primitiveKeywords?.length > 0 && (
            <span className="item-prim-keywords">
              As primitive: {entry.primitiveKeywords.join(', ')}
            </span>
          )}

          {type !== 'primitive' && (entry.bookNumber || entry.heisigNumber) && (
            <span className="item-meta">
              {entry.bookNumber && `Book ${entry.bookNumber}`}
              {entry.lessonNumber && ` · Lesson ${entry.lessonNumber}`}
              {entry.heisigNumber && ` · #${entry.heisigNumber}`}
            </span>
          )}

          {entry.story && (
            <span className="item-story">{entry.story}</span>
          )}

          {components.length > 0 && (
            <div className="item-components">
              {components.map(c => (
                <span
                  key={c.id}
                  className={`comp-tag comp-tag-${entryType(c)}`}
                  title={c.primitiveKeywords?.join(', ') || c.keyword}
                >
                  {c.character && <span>{c.character}</span>}
                  {entryDisplayName(c)}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="item-actions">
        {type !== 'primitive' && (
          <button
            className={`icon-btn ${entry.isMastered ? 'mastered-btn' : ''}`}
            onClick={() => onToggleMastered(entry.id)}
            title={entry.isMastered ? 'Mark unmastered' : 'Mark mastered'}
          >
            {entry.isMastered ? '★' : '☆'}
          </button>
        )}
        <button className="icon-btn" onClick={() => onEdit(entry)} title="Edit">✏️</button>
        <button className="icon-btn danger" onClick={confirmDelete} title="Delete">🗑</button>
      </div>
    </div>
  )
})

export default function LibraryView({ entries, entryMap, usedByMap, onEdit, onDelete, onToggleMastered, onNew, onReview }) {
  const [viewMode, setViewMode] = useState('list') // 'list' | 'graph'
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState('all') // 'all'|'primitive'|'character'|'dual'
  const [filterBook, setFilterBook] = useState('all')
  const [filterLesson, setFilterLesson] = useState('')
  const [filterMastered, setFilterMastered] = useState('all')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return entries.filter(entry => {
      const type = entryType(entry)

      const matchSearch =
        q === '' ||
        entry.character?.includes(q) ||
        entry.keyword?.toLowerCase().includes(q) ||
        entry.primitiveKeywords?.some(pk => pk.toLowerCase().includes(q)) ||
        entry.story?.toLowerCase().includes(q)

      const matchType = filterType === 'all' || type === filterType

      const matchBook =
        filterBook === 'all' ||
        !entry.bookNumber ||
        String(entry.bookNumber) === filterBook

      const matchLesson =
        filterLesson === '' || String(entry.lessonNumber) === filterLesson

      const matchMastered =
        filterMastered === 'all' ||
        (filterMastered === 'mastered' && entry.isMastered) ||
        (filterMastered === 'unmastered' && !entry.isMastered && type !== 'primitive')

      return matchSearch && matchType && matchBook && matchLesson && matchMastered
    })
  }, [entries, search, filterType, filterBook, filterLesson, filterMastered])

  const counts = useMemo(() => {
    const c = { primitive: 0, character: 0, dual: 0, mastered: 0 }
    for (const e of entries) {
      c[entryType(e)]++
      if (e.isMastered) c.mastered++
    }
    return c
  }, [entries])

  const reviewable = entries.filter(e => e.keyword?.trim())

  // Defer list rendering so search input stays responsive
  const deferredFiltered = useDeferredValue(filtered)

  return (
    <div className="library">
      {/* Toolbar */}
      <div className="library-toolbar">
        <div className="library-stats">
          <span className="stat primitive-stat">{counts.primitive} Primitives</span>
          <span className="stat dual-stat">{counts.dual} Dual</span>
          <span className="stat character-stat">{counts.character} Characters</span>
          <span className="stat mastered-stat">{counts.mastered} Mastered</span>
        </div>
        <div className="library-actions">
          <div className="view-toggle">
            <button
              className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >
              ☰ List
            </button>
            <button
              className={`view-btn ${viewMode === 'graph' ? 'active' : ''}`}
              onClick={() => setViewMode('graph')}
              title="Graph view"
            >
              ⬡ Graph
            </button>
          </div>
          <button className="btn btn-primary" onClick={onNew}>+ Add Entry</button>
          {reviewable.length > 0 && (
            <button className="btn btn-outline" onClick={onReview}>Review</button>
          )}
        </div>
      </div>

      {/* Graph view */}
      {viewMode === 'graph' && (
        <GraphView entries={entries} entryMap={entryMap} usedByMap={usedByMap} onEdit={onEdit} />
      )}

      {/* List view */}
      {viewMode === 'list' && (
        <>
          <div className="library-filters">
            <input
              className="search-input"
              type="text"
              placeholder="Search keyword, character, story…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <div className="filter-tabs">
              {[['all', 'All'], ['primitive', 'Primitives'], ['dual', 'Dual'], ['character', 'Characters']].map(([v, label]) => (
                <button
                  key={v}
                  className={`filter-tab ${filterType === v ? 'active' : ''}`}
                  onClick={() => setFilterType(v)}
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              className="filter-select"
              value={filterBook}
              onChange={e => setFilterBook(e.target.value)}
            >
              <option value="all">All Books</option>
              <option value="1">Book 1</option>
              <option value="2">Book 2</option>
            </select>
            <input
              className="filter-input"
              type="number"
              placeholder="Lesson #"
              value={filterLesson}
              onChange={e => setFilterLesson(e.target.value)}
              min="1"
            />
            <select
              className="filter-select"
              value={filterMastered}
              onChange={e => setFilterMastered(e.target.value)}
            >
              <option value="all">All</option>
              <option value="mastered">Mastered</option>
              <option value="unmastered">Unmastered</option>
            </select>
          </div>

          {deferredFiltered.length === 0 ? (
            <div className="empty-state">
              {entries.length === 0
                ? 'Your library is empty. Click "+ Add Entry" to begin.'
                : 'No entries match your filters.'}
            </div>
          ) : (
            <div className="item-list">
              {deferredFiltered.map(entry => (
                <EntryCard
                  key={entry.id}
                  entry={entry}
                  entryMap={entryMap}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onToggleMastered={onToggleMastered}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
