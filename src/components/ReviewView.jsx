import { useState, useMemo, useEffect, useRef } from 'react'
import { entryType, entryDisplayName, storyToHtml } from '../utils.js'

function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function ConfigScreen({ reviewable, onStart, onExit }) {
  const [mode, setMode] = useState('random')
  const [randomCount, setRandomCount] = useState(20)
  const [filterBook, setFilterBook] = useState('all')
  const [lessonStart, setLessonStart] = useState('')
  const [lessonEnd, setLessonEnd] = useState('')
  const [pool, setPool] = useState('all')

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
    onStart(queue, mode)
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

  return (
    <div className="review-config">
      <button className="review-exit-top" onClick={onExit}>← Back to Library</button>
      <div className="review-config-card">
        <h2 className="review-config-title">Configure Review Session</h2>

        <div className="config-section">
          <h3 className="config-label">Mode</h3>
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
                />
              )}
            </label>
            <label className="radio-label">
              <input type="radio" value="infinite" checked={mode === 'infinite'} onChange={() => setMode('infinite')} />
              Infinite Loop
            </label>
          </div>
        </div>

        <div className="config-section">
          <h3 className="config-label">Character Pool</h3>
          <div className="radio-group">
            {['all', 'mastered', 'unmastered'].map(v => (
              <label key={v} className="radio-label">
                <input type="radio" value={v} checked={pool === v} onChange={() => setPool(v)} />
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </label>
            ))}
          </div>
        </div>

        <div className="config-section">
          <h3 className="config-label">Filter by Book</h3>
          <div className="radio-group">
            {[['all', 'All'], ['1', 'Book 1'], ['2', 'Book 2']].map(([v, label]) => (
              <label key={v} className="radio-label">
                <input type="radio" value={v} checked={filterBook === v} onChange={() => setFilterBook(v)} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="config-section">
          <h3 className="config-label">Filter by Lesson Range</h3>
          <div className="lesson-range">
            <input className="form-input range-input" type="number" placeholder="From" value={lessonStart} onChange={e => setLessonStart(e.target.value)} min="1" />
            <span className="range-dash">–</span>
            <input className="form-input range-input" type="number" placeholder="To" value={lessonEnd} onChange={e => setLessonEnd(e.target.value)} min="1" />
          </div>
        </div>

        <div className="config-eligible">
          <span className="eligible-count">{eligible.length}</span> characters in pool
          {mode === 'random' && eligible.length > effectiveCount && (
            <span className="eligible-note"> ({effectiveCount} will be selected randomly)</span>
          )}
        </div>

        <button className="btn btn-primary btn-lg" onClick={handleStart} disabled={eligible.length === 0}>
          Start Session
        </button>
      </div>
    </div>
  )
}

function FlipCard({ card, entryMap, cardIndex, total, mode, onSuccess, onFail, onExit }) {
  const [revealed, setRevealed] = useState(false)

  const components = card.componentIds
    .map(id => entryMap.get(id))
    .filter(Boolean)

  useEffect(() => {
    function onKeyDown(e) {
      if (e.target.tagName === 'BUTTON') return
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault(); setRevealed(true); return
      }
      if (revealed && (e.key === 'y' || e.key === 'Y' || e.key === '1')) {
        e.preventDefault(); onSuccess(); return
      }
      if (revealed && (e.key === 'n' || e.key === 'N' || e.key === '2')) {
        e.preventDefault(); onFail(); return
      }
      if (e.key === 'Escape') { e.preventDefault(); onExit(); return }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [revealed, onSuccess, onFail, onExit])

  return (
    <div className="review-session">
      <div className="review-progress">
        <span>{cardIndex + 1} / {mode === 'infinite' ? '∞' : total}</span>
        <button className="review-exit-btn" onClick={onExit}>End Session</button>
      </div>

      <div className="flip-card">
        <div className="card-keyword-area">
          <p className="card-label">Keyword</p>
          <h2 className="card-keyword">{card.keyword}</h2>
          {(card.bookNumber || card.heisigNumber) && (
            <p className="card-meta">
              {card.bookNumber && `Book ${card.bookNumber}`}
              {card.lessonNumber && ` · Lesson ${card.lessonNumber}`}
              {card.heisigNumber && ` · #${card.heisigNumber}`}
            </p>
          )}
        </div>

        {!revealed ? (
          <div className="card-think-area">
            <p className="card-hint">Think of the character and its story…</p>
            <button className="btn btn-primary btn-lg reveal-btn" onClick={() => setRevealed(true)}>
              Show Character
            </button>
          </div>
        ) : (
          <div className="card-reveal-area">
            <div className="card-character-display">{card.character}</div>

            {components.length > 0 && (
              <div className="card-components">
                {components.map(c => (
                  <span key={c.id} className={`comp-tag comp-tag-${entryType(c)}`}>
                    {c.character && <span>{c.character}</span>}
                    {c.primitiveKeywords?.length > 0 ? <>💠 {c.primitiveKeywords[0]}</> : entryDisplayName(c)}
                  </span>
                ))}
              </div>
            )}

            {card.story && (
              <p
                className="card-story"
                dangerouslySetInnerHTML={{ __html: storyToHtml(card.story) }}
              />
            )}

            <div className="grade-buttons">
              <button className="btn btn-fail" onClick={onFail}>✗ Missed</button>
              <button className="btn btn-success" onClick={onSuccess}>✓ Got it</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function SessionSummary({ results, onRestart, onExit }) {
  const total = results.length
  const correct = results.filter(r => r.success).length
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0

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
        <h2 className="summary-title">Session Complete</h2>
        <div className="summary-score">
          <span className="score-number">{pct}%</span>
          <span className="score-label">{correct} / {total}</span>
        </div>
        <div className="summary-list">
          {results.map((r, i) => (
            <div key={i} className={`summary-item ${r.success ? 'success' : 'fail'}`}>
              <span className="summary-char">{r.card.character}</span>
              <span className="summary-kw">{r.card.keyword}</span>
              <span className="summary-mark">{r.success ? '✓' : '✗'}</span>
            </div>
          ))}
        </div>
        <div className="summary-actions">
          <button className="btn btn-primary" onClick={onRestart}>New Session</button>
          <button className="btn btn-outline" onClick={onExit}>Back to Library</button>
        </div>
      </div>
    </div>
  )
}

export default function ReviewView({ entries, entryMap, onToggleMastered, onExit }) {
  // Only entries with a standalone keyword are reviewable
  const reviewable = useMemo(() => entries.filter(e => e.keyword?.trim()), [entries])

  const [phase, setPhase] = useState('config')
  const [queue, setQueue] = useState([])
  const [mode, setMode] = useState('random')
  const [cardIndex, setCardIndex] = useState(0)
  const [results, setResults] = useState([])

  function startSession(q, m) {
    setQueue(q)
    setMode(m)
    setCardIndex(0)
    setResults([])
    setPhase('session')
  }

  function advance() {
    const next = cardIndex + 1
    if (mode === 'infinite') {
      if (next >= queue.length) {
        setQueue(q => shuffle(q))
        setCardIndex(0)
      } else {
        setCardIndex(next)
      }
    } else {
      next >= queue.length ? setPhase('summary') : setCardIndex(next)
    }
  }

  function handleSuccess() {
    const card = queue[cardIndex]
    const newResults = [...results, { card, success: true }]
    setResults(newResults)
    if (!card.isMastered) onToggleMastered(card.id)
    advance()
  }

  function handleFail() {
    const newResults = [...results, { card: queue[cardIndex], success: false }]
    setResults(newResults)
    advance()
  }

  if (phase === 'config') {
    return <ConfigScreen reviewable={reviewable} onStart={startSession} onExit={onExit} />
  }

  if (phase === 'summary') {
    return <SessionSummary results={results} onRestart={() => setPhase('config')} onExit={onExit} />
  }

  return (
    <FlipCard
      key={`${cardIndex}-${queue[cardIndex]?.id}`}
      card={queue[cardIndex]}
      entryMap={entryMap}
      cardIndex={cardIndex}
      total={queue.length}
      mode={mode}
      onSuccess={handleSuccess}
      onFail={handleFail}
      onExit={onExit}
    />
  )
}
