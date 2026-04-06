import { useRef } from 'react'

export default function WelcomeView({ onLoad, onCreate, onLoadExample }) {
  const fileRef = useRef(null)

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    onLoad(file)
  }

  return (
    <div className="welcome">
      <div className="welcome-content">
        <div className="welcome-logo">字</div>
        <h1 className="welcome-title">Radix</h1>
        <p className="welcome-subtitle">
          Learn Hanzi & Kanji through deep mnemonic encoding,
          not rote repetition.
        </p>

        <div className="welcome-actions">
          <label className="btn btn-primary btn-lg">
            Upload Library (.json)
            <input
              ref={fileRef}
              type="file"
              accept=".json"
              className="sr-only"
              onChange={handleFile}
            />
          </label>
          <button className="btn btn-outline btn-lg" onClick={onLoadExample}>
            Try Example Library
          </button>
          <p className="welcome-example-hint">15 sample entries to explore the app</p>
          <button className="btn btn-outline btn-lg" onClick={onCreate}>
            Create New Library
          </button>
        </div>

        <div className="welcome-info">
          <div className="welcome-info-item">
            <span className="info-dot" style={{background: 'var(--primitive)'}} />
            <span><strong>Primitive</strong> — building block only; has primitive keywords, no standalone meaning</span>
          </div>
          <div className="welcome-info-item">
            <span className="info-dot" style={{background: 'var(--dual)'}} />
            <span><strong>Dual</strong> — both a standalone character and a building block</span>
          </div>
          <div className="welcome-info-item">
            <span className="info-dot" style={{background: 'var(--character-light)'}} />
            <span><strong>Character</strong> — standalone character; assembled from components with a mnemonic</span>
          </div>
        </div>
      </div>
    </div>
  )
}
