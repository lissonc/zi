import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header.jsx'
import WelcomeView from './components/WelcomeView.jsx'
import LibraryView from './components/LibraryView.jsx'
import EditorView from './components/EditorView.jsx'
import ReviewView from './components/ReviewView.jsx'
import { migrateData } from './utils.js'

function generateId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
}

function loadFromStorage() {
  try {
    const saved = localStorage.getItem('radix_library')
    if (saved) return migrateData(JSON.parse(saved))
  } catch { /* ignore */ }
  return null
}

export default function App() {
  const [currentView, setCurrentView] = useState('welcome')
  const [entries, setEntries] = useState([])
  // editing: the entry object being edited, or null for new
  const [editingItem, setEditingItem] = useState(null)

  useEffect(() => {
    const saved = loadFromStorage()
    if (saved) {
      setEntries(saved)
      setCurrentView('library')
    }
  }, [])

  useEffect(() => {
    if (currentView !== 'welcome') {
      localStorage.setItem('radix_library', JSON.stringify({ entries }))
    }
  }, [entries, currentView])

  // ── Database ─────────────────────────────────────────────────────────────────

  const loadDatabase = useCallback((file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        setEntries(migrateData(JSON.parse(e.target.result)))
        setCurrentView('library')
      } catch {
        alert('Could not parse file. Make sure it is a valid Radix JSON library.')
      }
    }
    reader.readAsText(file)
  }, [])

  const createNewLibrary = useCallback(() => {
    setEntries([])
    setCurrentView('library')
  }, [])

  const downloadDatabase = useCallback(() => {
    const blob = new Blob(
      [JSON.stringify({ entries, exportedAt: new Date().toISOString() }, null, 2)],
      { type: 'application/json' }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'radix_library.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [entries])

  // ── Entry CRUD ───────────────────────────────────────────────────────────────

  const saveEntry = useCallback((data) => {
    if (data.id) {
      setEntries(prev => prev.map(e => e.id === data.id ? data : e))
    } else {
      setEntries(prev => [...prev, { ...data, id: generateId(), isMastered: false }])
    }
    setEditingItem(null)
    setCurrentView('library')
  }, [])

  const deleteEntry = useCallback((id) => {
    const usedBy = entries.filter(e => e.componentIds.includes(id))
    if (usedBy.length > 0) {
      const names = usedBy.map(e => e.keyword || e.primitiveKeywords?.[0] || e.character).join(', ')
      alert(`Cannot delete: used as a component in — ${names}`)
      return
    }
    setEntries(prev => prev.filter(e => e.id !== id))
  }, [entries])

  const toggleMastered = useCallback((id) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, isMastered: !e.isMastered } : e))
  }, [])

  // ── Navigation ───────────────────────────────────────────────────────────────

  const goToEditor = useCallback((item = null) => {
    setEditingItem(item)
    setCurrentView('editor')
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingItem(null)
    setCurrentView('library')
  }, [])

  const isReview = currentView === 'review'

  return (
    <div className="app">
      {!isReview && (
        <Header
          currentView={currentView}
          hasLibrary={currentView !== 'welcome'}
          onNavigate={setCurrentView}
          onDownload={downloadDatabase}
          entryCount={entries.length}
        />
      )}

      <main className={isReview ? 'main-review' : 'main'}>
        {currentView === 'welcome' && (
          <WelcomeView onLoad={loadDatabase} onCreate={createNewLibrary} />
        )}
        {currentView === 'library' && (
          <LibraryView
            entries={entries}
            onEdit={goToEditor}
            onDelete={deleteEntry}
            onToggleMastered={toggleMastered}
            onNew={() => goToEditor(null)}
            onReview={() => setCurrentView('review')}
          />
        )}
        {currentView === 'editor' && (
          <EditorView
            item={editingItem}
            entries={entries}
            onSave={saveEntry}
            onCancel={cancelEdit}
          />
        )}
        {currentView === 'review' && (
          <ReviewView
            entries={entries}
            onToggleMastered={toggleMastered}
            onExit={() => setCurrentView('library')}
          />
        )}
      </main>
    </div>
  )
}
