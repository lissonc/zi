import { useState, useMemo } from 'react'

export default function LibraryView({
  primitives,
  characters,
  onEditPrimitive,
  onEditCharacter,
  onDeletePrimitive,
  onDeleteCharacter,
  onToggleMastered,
  onNewPrimitive,
  onNewCharacter,
  onReview,
}) {
  const [tab, setTab] = useState('all') // 'all' | 'primitives' | 'characters'
  const [search, setSearch] = useState('')
  const [filterBook, setFilterBook] = useState('all') // 'all' | '1' | '2'
  const [filterLesson, setFilterLesson] = useState('')
  const [filterMastered, setFilterMastered] = useState('all') // 'all' | 'mastered' | 'unmastered'

  const filteredPrimitives = useMemo(() => {
    if (tab === 'characters') return []
    return primitives.filter(p => {
      const q = search.toLowerCase()
      return (
        q === '' ||
        p.name.toLowerCase().includes(q) ||
        (p.character && p.character.includes(q)) ||
        p.meanings.some(m => m.toLowerCase().includes(q))
      )
    })
  }, [primitives, tab, search])

  const filteredCharacters = useMemo(() => {
    if (tab === 'primitives') return []
    return characters.filter(c => {
      const q = search.toLowerCase()
      const matchSearch =
        q === '' ||
        c.keyword.toLowerCase().includes(q) ||
        c.character.includes(q) ||
        (c.story && c.story.toLowerCase().includes(q))

      const matchBook = filterBook === 'all' || String(c.bookNumber) === filterBook

      const matchLesson =
        filterLesson === '' || String(c.lessonNumber) === filterLesson

      const matchMastered =
        filterMastered === 'all' ||
        (filterMastered === 'mastered' && c.isMastered) ||
        (filterMastered === 'unmastered' && !c.isMastered)

      return matchSearch && matchBook && matchLesson && matchMastered
    })
  }, [characters, tab, search, filterBook, filterLesson, filterMastered])

  const masteredCount = characters.filter(c => c.isMastered).length

  function confirmDelete(type, id, name) {
    if (window.confirm(`Delete "${name}"?`)) {
      type === 'primitive' ? onDeletePrimitive(id) : onDeleteCharacter(id)
    }
  }

  return (
    <div className="library">
      {/* Toolbar */}
      <div className="library-toolbar">
        <div className="library-stats">
          <span className="stat primitive-stat">{primitives.length} Primitives</span>
          <span className="stat character-stat">{characters.length} Characters</span>
          <span className="stat mastered-stat">{masteredCount} Mastered</span>
        </div>
        <div className="library-actions">
          <button className="btn btn-primitive" onClick={onNewPrimitive}>+ Primitive</button>
          <button className="btn btn-character" onClick={onNewCharacter}>+ Character</button>
          {characters.length > 0 && (
            <button className="btn btn-primary" onClick={onReview}>Review</button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="library-filters">
        <input
          className="search-input"
          type="text"
          placeholder="Search keyword, character, meaning…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="filter-tabs">
          {['all', 'primitives', 'characters'].map(t => (
            <button
              key={t}
              className={`filter-tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
        {tab !== 'primitives' && (
          <>
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
          </>
        )}
      </div>

      {/* Empty state */}
      {filteredPrimitives.length === 0 && filteredCharacters.length === 0 && (
        <div className="empty-state">
          <p>
            {primitives.length === 0 && characters.length === 0
              ? 'Your library is empty. Start by adding Primitives.'
              : 'No items match your search.'}
          </p>
        </div>
      )}

      {/* Primitives list */}
      {filteredPrimitives.length > 0 && (
        <section className="list-section">
          <h2 className="list-heading primitive-heading">Primitives</h2>
          <div className="item-list">
            {filteredPrimitives.map(p => (
              <div key={p.id} className="item-card primitive-card">
                <div className="item-main">
                  {p.isStandalone && p.character && (
                    <span className="item-character">{p.character}</span>
                  )}
                  <div className="item-info">
                    <span className="item-keyword">{p.name}</span>
                    {p.meanings.length > 0 && (
                      <span className="item-meta">{p.meanings.join(', ')}</span>
                    )}
                  </div>
                  {p.isStandalone && (
                    <span className="badge badge-standalone">Standalone</span>
                  )}
                </div>
                <div className="item-actions">
                  <button className="icon-btn" onClick={() => onEditPrimitive(p)} title="Edit">✏️</button>
                  <button className="icon-btn danger" onClick={() => confirmDelete('primitive', p.id, p.name)} title="Delete">🗑</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Characters list */}
      {filteredCharacters.length > 0 && (
        <section className="list-section">
          <h2 className="list-heading character-heading">Characters</h2>
          <div className="item-list">
            {filteredCharacters.map(c => (
              <div key={c.id} className={`item-card character-card ${c.isMastered ? 'mastered' : ''}`}>
                <div className="item-main">
                  <span className="item-character">{c.character}</span>
                  <div className="item-info">
                    <span className="item-keyword">{c.keyword}</span>
                    <span className="item-meta">
                      Book {c.bookNumber} · Lesson {c.lessonNumber}
                      {c.heisigNumber && ` · #${c.heisigNumber}`}
                    </span>
                    {c.story && (
                      <span className="item-story">{c.story}</span>
                    )}
                  </div>
                  {c.primitiveIds.length > 0 && (
                    <div className="item-primitives">
                      {c.primitiveIds.map(pid => {
                        const prim = primitives.find(p => p.id === pid)
                        return prim ? (
                          <span key={pid} className="primitive-chip">{prim.name}</span>
                        ) : null
                      })}
                    </div>
                  )}
                </div>
                <div className="item-actions">
                  <button
                    className={`icon-btn ${c.isMastered ? 'mastered-btn' : ''}`}
                    onClick={() => onToggleMastered(c.id)}
                    title={c.isMastered ? 'Mark unmastered' : 'Mark mastered'}
                  >
                    {c.isMastered ? '★' : '☆'}
                  </button>
                  <button className="icon-btn" onClick={() => onEditCharacter(c)} title="Edit">✏️</button>
                  <button className="icon-btn danger" onClick={() => confirmDelete('character', c.id, c.keyword)} title="Delete">🗑</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
