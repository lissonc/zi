import { useRef } from 'react'

const THEME_LABEL = { system: 'Auto', light: 'Light', dark: 'Dark' }
const THEME_ICON = { system: '◐', light: '☀', dark: '☾' }

export default function Header({ view, hasLibrary, onNavigate, onDownload, onLoad, onNew, counts, theme, onCycleTheme }) {
  const fileRef = useRef(null)

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = '' // allow re-importing the same file
    onLoad(file)
  }

  const tabs = [
    ['library', 'Library', counts.entries, 'Ctrl+Shift+L'],
    ['graph', 'Graph', null, 'Ctrl+Shift+G'],
    ['stories', 'Stories', counts.pending || null, 'Ctrl+Shift+S'],
    ['review', 'Review', null, 'Ctrl+Shift+R'],
    ['progress', 'Progress', null, null],
  ]

  return (
    <header className="header">
      <button className="brand" onClick={() => onNavigate(hasLibrary ? 'library' : 'welcome')} aria-label="Radix home">
        <span className="brand-mark">字</span>
        <span className="brand-name">Radix</span>
      </button>

      {hasLibrary && (
        <nav className="tabs" aria-label="Views">
          {tabs.map(([id, label, count, key]) => (
            <button
              key={id}
              className={`tab${view === id ? ' active' : ''}`}
              onClick={() => onNavigate(id)}
              title={key ? `${label} (${key})` : label}
              aria-current={view === id ? 'page' : undefined}
            >
              {label}
              {count != null && <span className={`tab-count${id === 'stories' ? ' tab-count-accent' : ''}`}>{count}</span>}
            </button>
          ))}
        </nav>
      )}

      <div className="header-tools">
        {hasLibrary && (
          <>
            <button className="tool" onClick={onNew} title="New entry (Ctrl+Shift+N)">＋<span className="tool-text">New</span></button>
            <label className="tool" title="Load a library file">
              ↑<span className="tool-text">Load</span>
              <input ref={fileRef} type="file" accept=".json" className="sr-only" onChange={handleFile} />
            </label>
            <button className="tool" onClick={onDownload} title="Download library (Ctrl+S)">↓<span className="tool-text">Save</span></button>
          </>
        )}
        <button className="tool" onClick={onCycleTheme} title={`Theme: ${THEME_LABEL[theme]}`} aria-label={`Theme: ${THEME_LABEL[theme]}`}>
          {THEME_ICON[theme]}
        </button>
      </div>
    </header>
  )
}
