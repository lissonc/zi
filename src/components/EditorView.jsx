import { useState, useMemo, useRef, useLayoutEffect, useEffect } from 'react'
import { entryDisplayName, entryType, storyToHtmlMirror } from '../utils.js'

export default function EditorView({ item, entries, entryMap, onSave, onCancel, onSaveAndNavigate }) {
  const isEditing = Boolean(item?.id)

  const [character, setCharacter] = useState(item?.character || '')
  const [keyword, setKeyword] = useState(item?.keyword || '')
  const [primKwList, setPrimKwList] = useState(item?.primitiveKeywords || [])
  const [primKwDraft, setPrimKwDraft] = useState('')
  const [heisigNumber, setHeisigNumber] = useState(item?.heisigNumber ?? '')
  const [bookNumber, setBookNumber] = useState(item?.bookNumber ?? 1)
  const [lessonNumber, setLessonNumber] = useState(item?.lessonNumber ?? '')
  const [strokeCount, setStrokeCount] = useState(item?.strokeCount ?? '')
  const [story, setStory] = useState(item?.story || '')
  const [componentIds, setComponentIds] = useState(item?.componentIds || [])

  const formRef = useRef(null)

  // Story mention state
  const storyTextareaRef = useRef(null)
  const storyMirrorRef   = useRef(null)
  const [mentionSearch, setMentionSearch] = useState(null)
  const [mentionStart,  setMentionStart]  = useState(-1)
  const [mentionIndex,  setMentionIndex]  = useState(0)

  // Sync mirror geometry from the textarea's actual computed DOM state.
  // Using clientWidth (excludes border + scrollbar) guarantees the mirror's
  // text-content area is identical to the textarea's, regardless of browser
  // scrollbar behaviour. Copying the resolved lineHeight px value prevents
  // rounding-mode differences between <div> and <textarea>.
  useLayoutEffect(() => {
    const ta = storyTextareaRef.current
    const mirror = storyMirrorRef.current
    if (!ta || !mirror) return

    function syncMirror() {
      const cs = getComputedStyle(ta)
      mirror.style.fontFamily    = cs.fontFamily
      mirror.style.fontSize      = cs.fontSize
      mirror.style.fontWeight    = cs.fontWeight
      mirror.style.fontStyle     = cs.fontStyle
      mirror.style.letterSpacing = cs.letterSpacing
      mirror.style.lineHeight    = cs.lineHeight
      mirror.style.paddingTop    = cs.paddingTop
      mirror.style.paddingBottom = cs.paddingBottom
      mirror.style.paddingLeft   = cs.paddingLeft
      mirror.style.paddingRight  = cs.paddingRight
      mirror.style.width  = ta.clientWidth  + 'px'
      mirror.style.height = ta.clientHeight + 'px'
      mirror.style.top    = ta.clientTop    + 'px'
      mirror.style.left   = ta.clientLeft   + 'px'
    }

    // Auto-expand for any pre-filled content (editing an existing entry)
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'
    syncMirror()
    const ro = new ResizeObserver(syncMirror)
    ro.observe(ta)
    return () => ro.disconnect()
  }, [])
  const [compSearch, setCompSearch] = useState('')

  const hasKeyword = keyword.trim().length > 0
  const hasPrimKw = primKwList.length > 0 || primKwDraft.trim().length > 0
  const derivedType = hasKeyword && hasPrimKw ? 'dual' : hasKeyword ? 'character' : 'primitive'

  // Prev / next navigation
  const entryIndex = useMemo(() =>
    item?.id ? entries.findIndex(e => e.id === item.id) : -1,
    [entries, item?.id]
  )
  const prevEntry = entryIndex > 0 ? entries[entryIndex - 1] : null
  const nextEntry = entryIndex >= 0 && entryIndex < entries.length - 1 ? entries[entryIndex + 1] : null

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
    // Selected entries float to the top — use Set for O(1) lookup in comparator
    const selectedSet = new Set(componentIds)
    return [...matches].sort((a, b) => {
      const aOn = selectedSet.has(a.id)
      const bOn = selectedSet.has(b.id)
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

  // Each result is { entry, matchKw } — one per matching keyword so all
  // primitive keywords are independently selectable. Empty query shows the
  // first keyword of up to 8 entries; non-empty expands to per-keyword rows.
  const mentionResults = useMemo(() => {
    if (mentionSearch === null) return []
    const q = mentionSearch.toLowerCase()

    if (!q) {
      return candidates.slice(0, 8).map(e => ({
        entry: e,
        matchKw: e.primitiveKeywords?.[0] || e.keyword || e.character || '',
      }))
    }

    const results = []
    for (const e of candidates) {
      for (const pk of (e.primitiveKeywords || [])) {
        if (pk.toLowerCase().includes(q)) {
          results.push({ entry: e, matchKw: pk })
          if (results.length >= 8) return results
        }
      }
      if (e.keyword?.toLowerCase().includes(q)) {
        results.push({ entry: e, matchKw: e.keyword })
        if (results.length >= 8) return results
      }
      if (!e.primitiveKeywords?.length && !e.keyword && e.character?.includes(q)) {
        results.push({ entry: e, matchKw: e.character })
        if (results.length >= 8) return results
      }
    }
    return results
  }, [candidates, mentionSearch])

  function handleStoryChange(e) {
    const val = e.target.value
    setStory(val)
    setMentionIndex(0)
    // Auto-expand the textarea then immediately sync mirror height so there
    // is no visible lag between the textarea growing and the mirror following
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = ta.scrollHeight + 'px'
    if (storyMirrorRef.current)
      storyMirrorRef.current.style.height = ta.clientHeight + 'px'
    const cursor = e.target.selectionStart
    const before = val.slice(0, cursor)
    const lastOpen  = before.lastIndexOf('[[')
    const lastClose = before.lastIndexOf(']]')
    if (lastOpen > lastClose) {
      const fragment = before.slice(lastOpen + 2)
      // Stop autocomplete once | is typed — user is writing a display alias
      if (fragment.includes('|')) {
        setMentionSearch(null)
        setMentionStart(-1)
      } else {
        setMentionSearch(fragment)
        setMentionStart(lastOpen)
      }
    } else {
      setMentionSearch(null)
      setMentionStart(-1)
    }
  }

  // entry   — the library entry being referenced
  // matchKw — the specific primitive keyword the user picked
  // Inserts [[matchKw]] if matchKw is the canonical name, or
  // [[canonical|matchKw]] if it is an alias of a different primary keyword.
  function insertMention({ entry, matchKw }) {
    const canonical = entry.primitiveKeywords?.[0] || entry.keyword || entry.character || ''
    const ref = (matchKw === canonical || !matchKw)
      ? `[[${matchKw || canonical}]]`
      : `[[${canonical}|${matchKw}]]`
    const draftLen = mentionSearch?.length ?? 0
    const newStory = story.slice(0, mentionStart) + ref + story.slice(mentionStart + 2 + draftLen)
    setStory(newStory)
    setComponentIds(prev => prev.includes(entry.id) ? prev : [...prev, entry.id])
    setMentionSearch(null)
    setMentionStart(-1)
    requestAnimationFrame(() => {
      const ta = storyTextareaRef.current
      if (!ta) return
      ta.setSelectionRange(mentionStart + ref.length, mentionStart + ref.length)
      ta.focus()
    })
  }

  function handleStoryKeyDown(e) {
    if (mentionSearch === null || mentionResults.length === 0) return
    if (e.key === 'Escape') {
      e.preventDefault()
      setMentionSearch(null)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setMentionIndex(i => Math.min(i + 1, mentionResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setMentionIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (mentionSearch !== null && mentionResults.length > 0) {
        e.preventDefault()
        insertMention(mentionResults[mentionIndex])
      }
    }
  }

  function handleStoryScroll(e) {
    if (storyMirrorRef.current)
      storyMirrorRef.current.scrollTop = e.target.scrollTop
  }

  function handlePrimKwChange(e) {
    const val = e.target.value
    if (val.includes(',')) {
      const parts = val.split(',')
      const toCommit = parts.slice(0, -1).map(s => s.trim()).filter(Boolean)
      const remaining = parts[parts.length - 1]
      if (toCommit.length > 0) setPrimKwList(prev => [...prev, ...toCommit])
      setPrimKwDraft(remaining)
    } else {
      setPrimKwDraft(val)
    }
  }

  function handlePrimKwBlur() {
    const trimmed = primKwDraft.trim()
    if (trimmed) {
      setPrimKwList(prev => [...prev, trimmed])
      setPrimKwDraft('')
    }
  }

  function buildData() {
    const finalList = primKwDraft.trim()
      ? [...primKwList, primKwDraft.trim()]
      : primKwList
    return {
      ...(item || {}),
      character: character.trim(),
      keyword: keyword.trim(),
      primitiveKeywords: finalList,
      heisigNumber: heisigNumber !== '' ? Number(heisigNumber) : null,
      bookNumber: hasKeyword ? Number(bookNumber) : null,
      lessonNumber: lessonNumber !== '' ? Number(lessonNumber) : null,
      strokeCount: strokeCount !== '' ? Number(strokeCount) : null,
      story: story.trim(),
      componentIds,
      isMastered: item?.isMastered || false,
    }
  }

  function handleSubmit(e) {
    e.preventDefault()
    const data = buildData()
    const hasFinalPrimKw = data.primitiveKeywords.length > 0
    if (!data.keyword && !hasFinalPrimKw) {
      alert('An entry must have at least a keyword or one primitive keyword.')
      return
    }
    onSave(data)
  }

  function handleNavigate(target) {
    const data = buildData()
    const hasFinalPrimKw = data.primitiveKeywords.length > 0
    if (!data.keyword && !hasFinalPrimKw) {
      alert('An entry must have at least a keyword or one primitive keyword.')
      return
    }
    onSaveAndNavigate(data, target)
  }

  // Keep a stable ref to handleNavigate so the keyboard handler always calls
  // the latest version (which captures current form state) without needing to
  // re-register the event listener on every keystroke.
  const handleNavigateRef = useRef(handleNavigate)
  useEffect(() => { handleNavigateRef.current = handleNavigate })

  // Editor keyboard shortcuts (fire even when inputs are focused)
  useEffect(() => {
    function onKeyDown(e) {
      const mod = e.ctrlKey || e.metaKey
      // Ctrl/Cmd+S or Ctrl/Cmd+Enter — save
      if (mod && (e.key === 's' || e.key === 'Enter')) {
        e.preventDefault()
        formRef.current?.requestSubmit()
        return
      }
      // Escape — cancel (only when autocomplete dropdown is closed)
      if (e.key === 'Escape' && mentionSearch === null) {
        e.preventDefault()
        onCancel()
        return
      }
      // Alt+ArrowLeft / Alt+ArrowRight — prev / next entry
      if (e.altKey && e.key === 'ArrowLeft' && prevEntry) {
        e.preventDefault(); handleNavigateRef.current(prevEntry); return
      }
      if (e.altKey && e.key === 'ArrowRight' && nextEntry) {
        e.preventDefault(); handleNavigateRef.current(nextEntry); return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [mentionSearch, onCancel, prevEntry, nextEntry]) // eslint-disable-line react-hooks/exhaustive-deps

  const typeLabel = { primitive: '💠 Primitive', character: 'Character', dual: 'Dual' }[derivedType]
  const typeClass = { primitive: 'type-pill-primitive', character: 'type-pill-character', dual: 'type-pill-dual' }[derivedType]

  return (
    <div className="editor">
      <div className="editor-header">
        <h2 className="editor-title">
          {isEditing ? 'Edit Entry' : 'Add Entry'}
        </h2>
        <span className={`type-pill ${typeClass}`}>{typeLabel}</span>
        {isEditing && onSaveAndNavigate && (prevEntry || nextEntry) && (
          <div className="editor-nav">
            <button
              type="button"
              className="editor-nav-btn"
              disabled={!prevEntry}
              onClick={() => prevEntry && handleNavigate(prevEntry)}
              title={prevEntry ? `Previous: ${prevEntry.keyword || prevEntry.primitiveKeywords?.[0] || prevEntry.character}` : undefined}
            >←</button>
            <span className="editor-nav-pos">{entryIndex + 1} / {entries.length}</span>
            <button
              type="button"
              className="editor-nav-btn"
              disabled={!nextEntry}
              onClick={() => nextEntry && handleNavigate(nextEntry)}
              title={nextEntry ? `Next: ${nextEntry.keyword || nextEntry.primitiveKeywords?.[0] || nextEntry.character}` : undefined}
            >→</button>
          </div>
        )}
      </div>

      <form ref={formRef} className="editor-form" onSubmit={handleSubmit}>

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
          <label className="form-label">💠 Primitive Keywords</label>
          <div className="prim-kw-field">
            {primKwList.map((kw, i) => (
              <span key={i} className="prim-kw-chip">
                💠 {kw}
                <button
                  type="button"
                  className="prim-kw-chip-remove"
                  onClick={() => setPrimKwList(prev => prev.filter((_, j) => j !== i))}
                  aria-label={`Remove ${kw}`}
                >×</button>
              </span>
            ))}
            <input
              className="prim-kw-draft"
              value={primKwDraft}
              onChange={handlePrimKwChange}
              onBlur={handlePrimKwBlur}
              placeholder={primKwList.length === 0 ? 'e.g. person, human, walking legs' : 'Add another…'}
            />
          </div>
          <p className="form-hint">
            The 💠 name(s) used when this entry appears as a building block in stories.
            Type a name and press <kbd>,</kbd> or leave the field to add it as a chip.
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
            <div className="form-group flex-1">
              <label className="form-label">Strokes</label>
              <input
                className="form-input"
                type="number"
                value={strokeCount}
                onChange={e => setStrokeCount(e.target.value)}
                placeholder="e.g. 6"
                min="1"
              />
            </div>
          </div>
        )}

        {/* Stroke count for primitives (no Heisig metadata row) */}
        {!hasKeyword && (
          <div className="form-row">
            <div className="form-group" style={{ maxWidth: 120 }}>
              <label className="form-label">Strokes</label>
              <input
                className="form-input"
                type="number"
                value={strokeCount}
                onChange={e => setStrokeCount(e.target.value)}
                placeholder="e.g. 2"
                min="1"
              />
            </div>
          </div>
        )}

        {/* Mnemonic story */}
        <div className="form-group">
          <label className="form-label">Mnemonic Story</label>
          <div className="story-field-wrap">
            <div
              ref={storyMirrorRef}
              className="story-mirror"
              aria-hidden="true"
              dangerouslySetInnerHTML={{ __html: storyToHtmlMirror(story) }}
            />
            <textarea
              ref={storyTextareaRef}
              className="form-input form-textarea story-textarea"
              value={story}
              onChange={handleStoryChange}
              onKeyDown={handleStoryKeyDown}
              onScroll={handleStoryScroll}
              onBlur={() => setTimeout(() => setMentionSearch(null), 150)}
              placeholder="Describe a vivid scene linking the keyword to the character's components…"
              rows={1}
            />
            {mentionSearch !== null && mentionResults.length > 0 && (
              <div className="story-mention-dropdown">
                {mentionResults.map(({ entry: e, matchKw }, i) => {
                  const canonical = e.primitiveKeywords?.[0] || e.keyword || e.character || ''
                  const isAlias = matchKw !== canonical
                  return (
                    <button
                      key={`${e.id}:${matchKw}`}
                      type="button"
                      className={`story-mention-opt ${i === mentionIndex ? 'active' : ''}`}
                      onMouseDown={ev => { ev.preventDefault(); insertMention({ entry: e, matchKw }) }}
                    >
                      {e.character && <span className="comp-chip-glyph">{e.character}</span>}
                      <span>
                        {e.primitiveKeywords?.length > 0 ? `💠 ${matchKw}` : matchKw}
                        {isAlias && (
                          <span className="mention-opt-alias"> → {canonical}</span>
                        )}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <p className="form-hint">Type <kbd>[[</kbd> to reference a component inline.</p>
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
                      <span>{e.primitiveKeywords?.length > 0 ? <>💠 {e.primitiveKeywords[0]}</> : entryDisplayName(e)}</span>
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
                .map(id => entryMap.get(id))
                .filter(Boolean)
                .map(e => e.primitiveKeywords?.length > 0 ? `💠 ${e.primitiveKeywords[0]}` : entryDisplayName(e))
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
