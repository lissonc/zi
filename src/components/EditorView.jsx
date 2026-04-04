import { useState, useEffect } from 'react'

function PrimitiveForm({ initial, onSave, onCancel }) {
  const [name, setName] = useState(initial?.name || '')
  const [meanings, setMeanings] = useState(initial?.meanings?.join(', ') || '')
  const [isStandalone, setIsStandalone] = useState(initial?.isStandalone || false)
  const [character, setCharacter] = useState(initial?.character || '')

  function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return
    onSave({
      ...(initial || {}),
      name: name.trim(),
      meanings: meanings.split(',').map(m => m.trim()).filter(Boolean),
      isStandalone,
      character: isStandalone ? character.trim() : null,
    })
  }

  return (
    <form className="editor-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label">Name <span className="required">*</span></label>
        <input
          className="form-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="e.g. Walking Legs"
          required
          autoFocus
        />
        <p className="form-hint">The name used in mnemonic stories.</p>
      </div>

      <div className="form-group">
        <label className="form-label">Meanings</label>
        <input
          className="form-input"
          value={meanings}
          onChange={e => setMeanings(e.target.value)}
          placeholder="e.g. legs, walking, movement (comma-separated)"
        />
      </div>

      <div className="form-group">
        <label className="form-label checkbox-label">
          <input
            type="checkbox"
            checked={isStandalone}
            onChange={e => setIsStandalone(e.target.checked)}
          />
          Also a standalone character
        </label>
      </div>

      {isStandalone && (
        <div className="form-group">
          <label className="form-label">Character</label>
          <input
            className="form-input form-input-char"
            value={character}
            onChange={e => setCharacter(e.target.value)}
            placeholder="e.g. 人"
            maxLength={2}
          />
        </div>
      )}

      <div className="form-actions">
        <button type="submit" className="btn btn-primitive">
          {initial ? 'Update Primitive' : 'Add Primitive'}
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function CharacterForm({ initial, primitives, onSave, onCancel }) {
  const [keyword, setKeyword] = useState(initial?.keyword || '')
  const [character, setCharacter] = useState(initial?.character || '')
  const [heisigNumber, setHeisigNumber] = useState(initial?.heisigNumber || '')
  const [bookNumber, setBookNumber] = useState(initial?.bookNumber || 1)
  const [lessonNumber, setLessonNumber] = useState(initial?.lessonNumber || '')
  const [story, setStory] = useState(initial?.story || '')
  const [selectedPrimIds, setSelectedPrimIds] = useState(initial?.primitiveIds || [])
  const [primSearch, setPrimSearch] = useState('')

  const filteredPrims = primitives.filter(p => {
    const q = primSearch.toLowerCase()
    return (
      q === '' ||
      p.name.toLowerCase().includes(q) ||
      p.meanings.some(m => m.toLowerCase().includes(q))
    )
  })

  function togglePrimitive(id) {
    setSelectedPrimIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!keyword.trim() || !character.trim()) return
    onSave({
      ...(initial || {}),
      keyword: keyword.trim(),
      character: character.trim(),
      heisigNumber: heisigNumber ? Number(heisigNumber) : null,
      bookNumber: Number(bookNumber),
      lessonNumber: lessonNumber ? Number(lessonNumber) : null,
      story: story.trim(),
      primitiveIds: selectedPrimIds,
      isMastered: initial?.isMastered || false,
    })
  }

  return (
    <form className="editor-form" onSubmit={handleSubmit}>
      <div className="form-row">
        <div className="form-group flex-1">
          <label className="form-label">Keyword <span className="required">*</span></label>
          <input
            className="form-input"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="e.g. Sword"
            required
            autoFocus
          />
        </div>
        <div className="form-group">
          <label className="form-label">Character <span className="required">*</span></label>
          <input
            className="form-input form-input-char"
            value={character}
            onChange={e => setCharacter(e.target.value)}
            placeholder="e.g. 刀"
            required
            maxLength={2}
          />
        </div>
      </div>

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

      <div className="form-group">
        <label className="form-label">Mnemonic Story</label>
        <textarea
          className="form-input form-textarea"
          value={story}
          onChange={e => setStory(e.target.value)}
          placeholder="Describe a vivid scene linking the keyword to the character's primitives…"
          rows={4}
        />
      </div>

      <div className="form-group">
        <label className="form-label">Primitives</label>
        {primitives.length === 0 ? (
          <p className="form-hint warning">No primitives in the library yet. Add primitives first.</p>
        ) : (
          <>
            <input
              className="form-input"
              value={primSearch}
              onChange={e => setPrimSearch(e.target.value)}
              placeholder="Search primitives…"
            />
            <div className="primitive-picker">
              {filteredPrims.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className={`prim-chip ${selectedPrimIds.includes(p.id) ? 'selected' : ''}`}
                  onClick={() => togglePrimitive(p.id)}
                >
                  {p.isStandalone && p.character ? `${p.character} ` : ''}{p.name}
                </button>
              ))}
              {filteredPrims.length === 0 && (
                <p className="form-hint">No matching primitives.</p>
              )}
            </div>
          </>
        )}
        {selectedPrimIds.length > 0 && (
          <p className="form-hint">
            Selected: {selectedPrimIds.map(id => primitives.find(p => p.id === id)?.name).filter(Boolean).join(', ')}
          </p>
        )}
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-character">
          {initial ? 'Update Character' : 'Add Character'}
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

export default function EditorView({ type, item, primitives, onSavePrimitive, onSaveCharacter, onCancel }) {
  const [activeType, setActiveType] = useState(type || 'primitive')

  useEffect(() => {
    if (type) setActiveType(type)
  }, [type])

  const isEditing = !!item

  return (
    <div className="editor">
      <div className="editor-header">
        <h2 className="editor-title">
          {isEditing ? `Edit ${activeType === 'primitive' ? 'Primitive' : 'Character'}` : 'Add to Library'}
        </h2>
        {!isEditing && (
          <div className="type-toggle">
            <button
              className={`type-btn ${activeType === 'primitive' ? 'active primitive-active' : ''}`}
              onClick={() => setActiveType('primitive')}
            >
              Primitive
            </button>
            <button
              className={`type-btn ${activeType === 'character' ? 'active character-active' : ''}`}
              onClick={() => setActiveType('character')}
            >
              Character
            </button>
          </div>
        )}
      </div>

      {activeType === 'primitive' ? (
        <PrimitiveForm
          key={item?.id || 'new-prim'}
          initial={item}
          onSave={onSavePrimitive}
          onCancel={onCancel}
        />
      ) : (
        <CharacterForm
          key={item?.id || 'new-char'}
          initial={item}
          primitives={primitives}
          onSave={onSaveCharacter}
          onCancel={onCancel}
        />
      )}
    </div>
  )
}
