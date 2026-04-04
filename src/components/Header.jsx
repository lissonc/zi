import { useRef } from 'react'

export default function Header({ currentView, hasLibrary, onNavigate, onDownload, onLoad, entryCount }) {
  const fileRef = useRef(null)

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    // Reset so the same file can be re-imported if needed
    e.target.value = ''
    onLoad(file)
  }

  return (
    <header className="header">
      <div
        className="header-brand header-brand-link"
        onClick={() => onNavigate(hasLibrary ? 'library' : 'welcome')}
        role="button"
        tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && onNavigate(hasLibrary ? 'library' : 'welcome')}
      >
        <span className="header-logo">字</span>
        <span className="header-title">Radix</span>
        <span className="mode-badge">Traditional Hanzi</span>
      </div>

      {hasLibrary && (
        <nav className="header-nav">
          <button
            className={`nav-btn ${currentView === 'library' ? 'active' : ''}`}
            onClick={() => onNavigate('library')}
            title="Library (Ctrl+Shift+L)"
          >
            Library
            <span className="nav-count">{entryCount}</span>
          </button>
          <button
            className={`nav-btn ${currentView === 'editor' ? 'active' : ''}`}
            onClick={() => onNavigate('editor')}
            title="New entry (Ctrl+Shift+N)"
          >
            + Add
          </button>
          <button
            className={`nav-btn ${currentView === 'review' ? 'active' : ''}`}
            onClick={() => onNavigate('review')}
            title="Review (Ctrl+Shift+R)"
          >
            Review
          </button>
          <button className="nav-btn load-btn" onClick={() => fileRef.current.click()}>
            ↑ Load
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={handleFile}
          />
          <button className="nav-btn save-btn" onClick={onDownload} title="Download library (Ctrl+S)">
            ↓ Save
          </button>
        </nav>
      )}
    </header>
  )
}
