import { useState, useMemo } from 'react'
import { entryDisplayName, entryType } from '../utils.js'

export default function EditorView({ item, entries, onSave, onCancel }) {
  const isEditing = Boolean(item?.id)

  const [character, setCharacter] = useState(item?.character || '')
  const [keyword, setKeyword] = useState(item?.keyword || '')
  const [primKwInput, setPrimKwInput] = useState(item?.primitiveKeywords?.join(', ') || '')
  const [heisigNumber, setHeisigNumber] = useState(item?.heisigNumber ?? '')
  const [bookNumber, setBookNumber] = useState(item?.bookNumber ?? 1)
  const [lessonNumber, setLessonNumber] = useState(item?.lessonNumber ?? '')
  const [story, setStory] = useState(item?.story || '')
  const [componentIds, setComponentIds] = useState(item?.componentIds || [])
  const [compSearch, setCompSearch] = useState('')

  const primitiveKeywords = primKwInput.split(',').map(s => s.trim()).filter(Boolean)
  const hasKeyword = keyword.trim().length > 0
  const hasPrimKw = primitiveKeywords.length > 0
  const derivedType = hasKeyword && hasPrimKw ? 'dual' : hasKeyword ? 'character' : 'primitive'

  // Exclude self from component candidates
  const candidates = useMemo(() =>
    entries.filter(e => e.id !== item?.id),
    [entries, item?.id]
  )

  const filteredCandidates = useMemo(() => {
    const q = compSearch.toLowerCase()
    const matches = q
      ? candidates.filter(e =>
          e.character?.includes(q) ||
          e.keyword?.toLowerCase().includes(q) ||
          e.primitiveKeywords?.some(pk => pk.toLowerCase().includes(q))
        )
      : candidates
    // Selected entries float to the top
    return [...matches].sort((a, b) => {
      const aOn = componentIds.includes(a.id)
      const bOn = componentIds.includes(b.id)
      if (aOn && !bOn) return -1
      if (!aOn && bOn) return 1
      return 0
    })
  }, [candidates, compSearch, componentIds])

  function toggleComponent(id) {
    setComponentIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!hasKeyword && !hasPrimKw) {
      alert('An entry must have at least a keyword or one primitive keyword.')
      return
    }
    onSave({
      ...(item || {}),
      character: character.trim(),
      keyword: keyword.trim(),
      primitiveKeywords,
      heisigNumber: heisigNumber !== '' ? Number(heisigNumber) : null,
      bookNumber: hasKeyword ? Number(bookNumber) : null,
      lessonNumber: lessonNumber !== '' ? Number(lessonNumber) : null,
      story: story.trim(),
      componentIds,
      isMastered: item?.isMastered || false,
    })
  }

  const typeLabel = { primitive: 'Primitive', character: 'Character', dual: 'Dual' }[derivedType]
  const typeClass = { primitive: 'type-pill-primitive', character: 'type-pill-character', dual: 'type-pill-dual' }[derivedType]

  return (
    <div className="editor">
      <div className="editor-header">
        <h2 className="editor-title">
          {isEditing ? 'Edit Entry' : 'Add Entry'}
        </h2>
        <span className={`type-pill ${typeClass}`}>{typeLabel}</span>
      </div>

      <form className="editor-form" onSubmit={handleSubmit}>

        {/* Glyph + keyword row */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Character</label>
            <input
              className="form-input form-input-char"
              value={character}
              onChange={e => setCharacter(e.target.value)}
              placeholder="e.g. 人"
              maxLength={2}
              autoFocus
            />
          </div>
          <div className="form-group flex-1">
            <label className="form-label">Standalone Keyword</label>
            <input
              className="form-input"
              value={keyword}
              onChange={e => setKeyword(e.target.value)}
              placeholder="e.g. Person  (leave blank if pure primitive)"
            />
            <p className="form-hint">The English meaning when this is a standalone character.</p>
          </div>
        </div>

        {/* Primitive keywords */}
        <div className="form-group">
          <label className="form-label">Primitive Keywords</label>
          <input
            className="form-input"
            value={primKwInput}
            onChange={e => setPrimKwInput(e.target.value)}
            placeholder="e.g. person, human, walking legs  (comma-separated)"
          />
          <p className="form-hint">
            The name(s) used when this entry appears as a building block in stories.
            Leave blank if this character is never used as a component.
          </p>
        </div>

        {/* Metadata — only relevant for standalone characters */}
        {hasKeyword && (
          <div className="form-row">
            <div className="form-group flex-1">
              <label className="form-label">Heisig #</label>
              <input
                className="form-input"
                type="number"
                value={heisigNumber}
                onChange={e => setHeisigNumber(e.target.value)}
                placeholder="e.g. 45"
                min="1"
              />
            </div>
            <div className="form-group flex-1">
              <label className="form-label">Book</label>
              <select className="form-input" value={bookNumber} onChange={e => setBookNumber(e.target.value)}>
                <option value={1}>Book 1</option>
                <option value={2}>Book 2</option>
              </select>
            </div>
            <div className="form-group flex-1">
              <label className="form-label">Lesson</label>
              <input
                className="form-input"
                type="number"
                value={lessonNumber}
                onChange={e => setLessonNumber(e.target.value)}
                placeholder="e.g. 5"
                min="1"
              />
            </div>
          </div>
        )}

        {/* Mnemonic story */}
        <div className="form-group">
          <label className="form-label">Mnemonic Story</label>
          <textarea
            className="form-input form-textarea"
            value={story}
            onChange={e => setStory(e.target.value)}
            placeholder="Describe a vivid scene linking the keyword to the character's components…"
            rows={4}
          />
        </div>

        {/* Component picker */}
        <div className="form-group">
          <label className="form-label">Components</label>
          {candidates.length === 0 ? (
            <p className="form-hint">No other entries in the library yet.</p>
          ) : (
            <>
              <input
                className="form-input"
                value={compSearch}
                onChange={e => setCompSearch(e.target.value)}
                placeholder="Search entries…"
              />
              <div className="component-picker">
                {filteredCandidates.map(e => {
                  const t = entryType(e)
                  const selected = componentIds.includes(e.id)
                  return (
                    <button
                      key={e.id}
                      type="button"
                      className={`comp-chip comp-chip-${t} ${selected ? 'selected' : ''}`}
                      onClick={() => toggleComponent(e.id)}
                      title={e.primitiveKeywords?.join(', ') || e.keyword}
                    >
                      {e.character && <span className="comp-chip-glyph">{e.character}</span>}
                      <span>{entryDisplayName(e)}</span>
                    </button>
                  )
                })}
                {filteredCandidates.length === 0 && (
                  <p className="form-hint">No matching entries.</p>
                )}
              </div>
            </>
          )}
          {componentIds.length > 0 && (
            <p className="form-hint">
              Selected:{' '}
              {componentIds
                .map(id => entries.find(e => e.id === id))
                .filter(Boolean)
                .map(entryDisplayName)
                .join(', ')}
            </p>
          )}
        </div>

        <div className="form-actions">
          <button type="submit" className={`btn btn-${derivedType === 'character' ? 'character' : derivedType === 'primitive' ? 'primitive' : 'dual'}`}>
            {isEditing ? 'Update Entry' : 'Add Entry'}
          </button>
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
