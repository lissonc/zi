export default function Header({ currentView, hasLibrary, onNavigate, onDownload, entryCount }) {
  return (
    <header className="header">
      <div className="header-brand">
        <span className="header-logo">字</span>
        <span className="header-title">Radix</span>
        <span className="mode-badge">Mode: Traditional Hanzi</span>
      </div>

      {hasLibrary && (
        <nav className="header-nav">
          <button
            className={`nav-btn ${currentView === 'library' ? 'active' : ''}`}
            onClick={() => onNavigate('library')}
          >
            Library
            <span className="nav-count">{entryCount}</span>
          </button>
          <button
            className={`nav-btn ${currentView === 'editor' ? 'active' : ''}`}
            onClick={() => onNavigate('editor')}
          >
            + Add
          </button>
          <button
            className={`nav-btn ${currentView === 'review' ? 'active' : ''}`}
            onClick={() => onNavigate('review')}
          >
            Review
          </button>
          <button className="nav-btn save-btn" onClick={onDownload}>
            ↓ Save
          </button>
        </nav>
      )}
    </header>
  )
}
