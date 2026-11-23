import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import { storyToHtml, hasStory } from '../utils.js'
import { useSwipe } from '../hooks/useSwipe.js'
import EntryChip from './EntryChip.jsx'

const REPEAT_AFTER = 4 // a missed card comes back after this many other cards

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ── Session setup ─────────────────────────────────────────────────────────────

function ConfigScreen({ reviewable, onStart, onExit }) {
  const [mode, setMode] = useState('random')
  const [randomCount, setRandomCount] = useState(20)
  const [direction, setDirection] = useState('keyword')
  const [repeatMissed, setRepeatMissed] = useState(true)
  const [filterBook, setFilterBook] = useState('all')
  const [lessonStart, setLessonStart] = useState('')
  const [lessonEnd, setLessonEnd] = useState('')
  const [pool, setPool] = useState('all')

  // the first lesson that still has characters you have not mastered
  const nextLesson = useMemo(() => {
    let best = null
    for (const e of reviewable) {
      if (e.isMastered || e.lessonNumber == null) continue
      if (best === null || e.lessonNumber < best) best = e.lessonNumber
    }
    return best
  }, [reviewable])
  const hasBooks = useMemo(() => new Set(reviewable.map(e => e.bookNumber).filter(Boolean)).size > 1, [reviewable])

  const eligible = useMemo(() => {
    return reviewable.filter(e => {
      const matchBook = filterBook === 'all' || String(e.bookNumber) === filterBook
      const matchStart = lessonStart === '' || (e.lessonNumber ?? 0) >= Number(lessonStart)
      const matchEnd = lessonEnd === '' || (e.lessonNumber ?? Infinity) <= Number(lessonEnd)
      const matchPool =
        pool === 'all' ||
        (pool === 'mastered' && e.isMastered) ||
        (pool === 'unmastered' && !e.isMastered)
      return matchBook && matchStart && matchEnd && matchPool
    })
  }, [reviewable, filterBook, lessonStart, lessonEnd, pool])

  const effectiveCount = Math.max(1, Math.min(randomCount || 1, eligible.length))

  function handleStart() {
    let queue = shuffle(eligible)
    if (mode === 'random') queue = queue.slice(0, effectiveCount)
    onStart(queue.map(e => e.id), { mode, direction, repeatMissed })
  }

  const handleStartRef = useRef(handleStart)
  useEffect(() => { handleStartRef.current = handleStart })

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') { e.preventDefault(); onExit(); return }
      if (e.key === 'Enter' && e.target.tagName !== 'BUTTON' && eligible.length > 0) {
        e.preventDefault(); handleStartRef.current(); return
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [eligible.length]) // eslint-disable-line react-hooks/exhaustive-deps

  const preset = (from, to) => { setLessonStart(from === null ? '' : String(from)); setLessonEnd(to === null ? '' : String(to)) }
  const isPreset = (from, to) => lessonStart === (from === null ? '' : String(from)) && lessonEnd === (to === null ? '' : String(to))

  return (
    <div className="review-config">
      <button className="review-exit-top" onClick={onExit}>← Library</button>
      <div className="review-config-card">
        <h2 className="review-config-title">Review</h2>

        <div className="config-section">
          <h3 className="config-label">Lessons</h3>
          <div className="preset-row">
            {nextLesson != null && (
              <>
                <button className={`btn btn-sm${isPreset(nextLesson, nextLesson) ? ' active' : ''}`} onClick={() => preset(nextLesson, nextLesson)}>
                  Lesson {nextLesson} (next)
                </button>
                <button className={`btn btn-sm${isPreset(null, nextLesson) ? ' active' : ''}`} onClick={() => preset(null, nextLesson)}>
                  Up to lesson {nextLesson}
                </button>
              </>
            )}
            <button className={`btn btn-sm${isPreset(null, null) ? ' active' : ''}`} onClick={() => preset(null, null)}>All lessons</button>
          </div>
          <div className="lesson-range">
            <input className="form-input range-input" type="number" placeholder="From" value={lessonStart} onChange={e => setLessonStart(e.target.value)} min="1" aria-label="From lesson" />
            <span className="range-dash">–</span>
            <input className="form-input range-input" type="number" placeholder="To" value={lessonEnd} onChange={e => setLessonEnd(e.target.value)} min="1" aria-label="To lesson" />
          </div>
        </div>

        <div className="config-section">
          <h3 className="config-label">Characters</h3>
          <div className="radio-group">
            {[['all', 'All'], ['unmastered', 'Not mastered'], ['mastered', 'Mastered']].map(([v, label]) => (
              <label key={v} className="radio-label">
                <input type="radio" value={v} checked={pool === v} onChange={() => setPool(v)} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="config-section">
          <h3 className="config-label">Direction</h3>
          <div className="radio-group">
            <label className="radio-label">
              <input type="radio" checked={direction === 'keyword'} onChange={() => setDirection('keyword')} />
              Keyword → character
            </label>
            <label className="radio-label">
              <input type="radio" checked={direction === 'character'} onChange={() => setDirection('character')} />
              Character → keyword
            </label>
          </div>
        </div>

        <div className="config-section">
          <h3 className="config-label">Length</h3>
          <div className="radio-group">
            <label className="radio-label">
              <input type="radio" value="random" checked={mode === 'random'} onChange={() => setMode('random')} />
              Random
              {mode === 'random' && (
                <input
                  className="form-input count-input"
                  type="number"
                  min="1"
                  max={eligible.length || 999}
                  value={randomCount}
                  onChange={e => setRandomCount(Math.max(1, parseInt(e.target.value) || 1))}
                  aria-label="Number of cards"
                />
              )}
            </label>
            <label className="radio-label">
              <input type="radio" value="infinite" checked={mode === 'infinite'} onChange={() => setMode('infinite')} />
              Until I stop
            </label>
          </div>
          <label className="radio-label check-label">
            <input type="checkbox" checked={repeatMissed} onChange={e => setRepeatMissed(e.target.checked)} />
            Bring missed cards back in the same session
          </label>
        </div>

        {hasBooks && (
          <div className="config-section">
            <h3 className="config-label">Book</h3>
            <div className="radio-group">
              {[['all', 'All'], ['1', 'Book 1'], ['2', 'Book 2']].map(([v, label]) => (
                <label key={v} className="radio-label">
                  <input type="radio" value={v} checked={filterBook === v} onChange={() => setFilterBook(v)} />
                  {label}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="config-eligible">
          <span className="eligible-count">{eligible.length.toLocaleString()}</span> characters to draw from
          {mode === 'random' && eligible.length > effectiveCount && (
            <span className="eligible-note"> · {effectiveCount} picked at random</span>
          )}
        </div>

        <button className="btn btn-primary btn-lg" onClick={handleStart} disabled={eligible.length === 0}>
          Start
        </button>
      </div>
    </div>
  )
}

// ── One card ──────────────────────────────────────────────────────────────────

function FlipCard({ card, again, entryMap, position, total, toRepeat, mode, direction, onSuccess, onFail, onExit }) {
  const [revealed, setRevealed] = useState(false)
  const components = (card.componentIds || []).map(id => entryMap.get(id)).filter(Boolean)
  const swipe = useSwipe({ onRight: onSuccess, onLeft: onFail, enabled: revealed })

  useEffect(() => {
    function onKeyDown(e) {
      if (e.target.tagName === 'BUTTON') return
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault(); setRevealed(true); return
      }
      if (revealed && (e.key === 'y' || e.key === 'Y' || e.key === '1' || e.key === 'ArrowRight')) {
        e.preventDefault(); onSuccess(); return
      }
      if (revealed && (e.key === 'n' || e.key === 'N' || e.key === '2' || e.key === 'ArrowLeft')) {
        e.preventDefault(); onFail(); return
      }
      if (e.key === 'Escape') { e.preventDefault(); onExit(); return }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [revealed, onSuccess, onFail, onExit])

  const meta = [
    card.lessonNumber && `Lesson ${card.lessonNumber}`,
    card.heisigNumber && `#${card.heisigNumber}`,
  ].filter(Boolean).join(' · ')
  const fromKeyword = direction === 'keyword'

  return (
    <div className="review-session">
      <div className="review-progress">
        <span>
          {position} / {mode === 'infinite' ? '∞' : total}
          {toRepeat > 0 && <span className="repeat-note"> · {toRepeat} to repeat</span>}
        </span>
        <button className="review-exit-btn" onClick={onExit}>End session</button>
      </div>

      <div
        className={`flip-card${swipe.lean ? ` lean-${swipe.lean}` : ''}`}
        style={swipe.style}
        {...swipe.handlers}
        onClick={() => { if (!revealed) setRevealed(true) }}
      >
        {again && <p className="card-again">Again</p>}

        {fromKeyword ? (
          <div className="card-keyword-area">
            <p className="card-label">Keyword</p>
            <h2 className="card-keyword">{card.keyword}</h2>
            {meta && <p className="card-meta">{meta}</p>}
          </div>
        ) : (
          <div className="card-keyword-area">
            <p className="card-label">Character</p>
            <div className="card-character-display">{card.character}</div>
          </div>
        )}

        {!revealed ? (
          <div className="card-think-area">
            <p className="card-hint">{fromKeyword ? 'Recall the story and write the character.' : 'What is its keyword?'}</p>
            <button className="btn btn-primary btn-lg reveal-btn" onClick={e => { e.stopPropagation(); setRevealed(true) }}>
              {fromKeyword ? 'Show character' : 'Show keyword'}
            </button>
          </div>
        ) : (
          <div className="card-reveal-area">
            {fromKeyword
              ? <div className="card-character-display">{card.character}</div>
              : (
                <div>
                  <h2 className="card-keyword">{card.keyword}</h2>
                  {meta && <p className="card-meta">{meta}</p>}
                </div>
              )}

            {components.length > 0 && (
              <div className="card-components">
                {components.map(c => <EntryChip key={c.id} entry={c} />)}
              </div>
            )}

            {hasStory(card) && (
              <p className="card-story" dangerouslySetInnerHTML={{ __html: storyToHtml(card.story) }} />
            )}

            <div className="grade-buttons">
              <button className="btn btn-fail" onClick={e => { e.stopPropagation(); onFail() }}>Missed</button>
              <button className="btn btn-success" onClick={e => { e.stopPropagation(); onSuccess() }}>Got it</button>
            </div>
            <p className="swipe-hint">Swipe left for missed, right for got it</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Summary ───────────────────────────────────────────────────────────────────

function SessionSummary({ results, entryMap, onRestart, onExit }) {
  const total = results.length
  const correct = results.filter(r => r.success).length
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0
  // missed ones first: they are the stories to strengthen
  const ordered = useMemo(() => [...results].sort((a, b) => Number(a.success) - Number(b.success)), [results])

  useEffect(() => {
    function onKeyDown(e) {
      if (e.target.tagName === 'BUTTON') return
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRestart(); return }
      if (e.key === 'Escape') { e.preventDefault(); onExit(); return }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onRestart, onExit])

  return (
    <div className="review-summary">
      <div className="summary-card">
        <h2 className="summary-title">Session complete</h2>
        <div className="summary-score">
          <span className="score-number">{pct}%</span>
          <span className="score-label">{correct} of {total} right the first time</span>
        </div>
        <div className="summary-list">
          {ordered.map((r, i) => {
            const card = entryMap.get(r.id)
            if (!card) return null
            return (
              <div key={i} className={`summary-item ${r.success ? 'success' : 'fail'}`}>
                <span className="summary-char">{card.character}</span>
                <span className="summary-kw">{card.keyword}</span>
                <span className="summary-mark">{r.success ? 'Got it' : 'Missed'}</span>
              </div>
            )
          })}
        </div>
        <div className="summary-actions">
          <button className="btn btn-primary" onClick={onRestart}>New session</button>
          <button className="btn" onClick={onExit}>Back to library</button>
        </div>
      </div>
    </div>
  )
}

// ── Session ───────────────────────────────────────────────────────────────────

export default function ReviewView({ entries, entryMap, onSetMastered, onExit }) {
  // Only entries with a standalone keyword are reviewable
  const reviewable = useMemo(() => entries.filter(e => e.keyword?.trim()), [entries])

  const [phase, setPhase] = useState('config')
  const [options, setOptions] = useState({ mode: 'random', direction: 'keyword', repeatMissed: true })
  // queue items: { id, again } — `again` marks a missed card that came back
  const [queue, setQueue] = useState([])
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState([])
  const [firstCount, setFirstCount] = useState(0)

  function startSession(ids, opts) {
    setOptions(opts)
    setQueue(ids.map(id => ({ id, again: false })))
    setFirstCount(ids.length)
    setIndex(0)
    setResults([])
    setPhase('session')
  }

  const item = queue[index]
  const card = item ? entryMap.get(item.id) : null

  const advance = useCallback((q) => {
    const next = index + 1
    if (next < q.length) { setIndex(next); return }
    if (options.mode === 'infinite') {
      setQueue(shuffle(q.filter(x => !x.again)))
      setIndex(0)
    } else {
      setPhase('summary')
    }
  }, [index, options.mode])

  const handleSuccess = useCallback(() => {
    if (!item) return
    if (!item.again) {
      setResults(r => [...r, { id: item.id, success: true }])
      // right the first time: mastered
      if (card && !card.isMastered) onSetMastered(item.id, true)
    }
    advance(queue)
  }, [item, card, queue, advance, onSetMastered])

  const handleFail = useCallback(() => {
    if (!item) return
    if (!item.again) setResults(r => [...r, { id: item.id, success: false }])
    if (card?.isMastered) onSetMastered(item.id, false)
    let q = queue
    if (options.repeatMissed) {
      const at = Math.min(index + 1 + REPEAT_AFTER, queue.length)
      q = [...queue.slice(0, at), { id: item.id, again: true }, ...queue.slice(at)]
      setQueue(q)
    }
    advance(q)
  }, [item, card, queue, index, options.repeatMissed, advance, onSetMastered])

  // a card whose entry was deleted meanwhile: skip it
  useEffect(() => {
    if (phase === 'session' && item && !card) advance(queue)
  }, [phase, item, card, queue, advance])

  if (phase === 'config') {
    return <ConfigScreen reviewable={reviewable} onStart={startSession} onExit={onExit} />
  }
  if (phase === 'summary') {
    return <SessionSummary results={results} entryMap={entryMap} onRestart={() => setPhase('config')} onExit={onExit} />
  }
  if (!card) return null

  const toRepeat = queue.slice(index + 1).filter(x => x.again).length
  return (
    <FlipCard
      key={`${index}-${item.id}`}
      card={card}
      again={item.again}
      entryMap={entryMap}
      position={Math.min(results.length + (item.again ? 0 : 1), firstCount)}
      total={firstCount}
      toRepeat={toRepeat}
      mode={options.mode}
      direction={options.direction}
      onSuccess={handleSuccess}
      onFail={handleFail}
      onExit={onExit}
    />
  )
}
