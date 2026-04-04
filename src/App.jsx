import { useState, useEffect, useCallback, useMemo } from 'react'
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

  // Derived lookup structures — O(1) id→entry and id→usedBy lookups
  const entryMap = useMemo(() => {
    const m = new Map()
    for (const e of entries) m.set(e.id, e)
    return m
  }, [entries])

  const usedByMap = useMemo(() => {
    const m = new Map()
    for (const e of entries) {
      for (const cid of e.componentIds) {
        if (!m.has(cid)) m.set(cid, [])
        m.get(cid).push(e.id)
      }
    }
    return m
  }, [entries])

  useEffect(() => {
    const saved = loadFromStorage()
    if (saved) {
      setEntries(saved)
      setCurrentView('library')
    }
  }, [])

  useEffect(() => {
    if (currentView !== 'welcome') {
      localStorage.setItem('radix_library', JSON.stringify({ entries, savedAt: new Date().toISOString() }))
    }
  }, [entries, currentView])

  // ── Database ─────────────────────────────────────────────────────────────────

  const loadDatabase = useCallback((file, { confirmReplace = false } = {}) => {
    if (confirmReplace && entries.length > 0) {
      if (!window.confirm(`Replace the current library (${entries.length} entries) with the contents of "${file.name}"?`)) return
    }
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
  }, [entries.length])

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
    const usedByIds = usedByMap.get(id)
    if (usedByIds?.length > 0) {
      const names = usedByIds.map(uid => {
        const e = entryMap.get(uid)
        return e ? (e.keyword || e.primitiveKeywords?.[0] || e.character) : uid
      }).join(', ')
      alert(`Cannot delete: used as a component in — ${names}`)
      return
    }
    setEntries(prev => prev.filter(e => e.id !== id))
  }, [entryMap, usedByMap])

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
          onLoad={(file) => loadDatabase(file, { confirmReplace: true })}
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
            entryMap={entryMap}
            usedByMap={usedByMap}
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
            entryMap={entryMap}
            onSave={saveEntry}
            onCancel={cancelEdit}
          />
        )}
        {currentView === 'review' && (
          <ReviewView
            entries={entries}
            entryMap={entryMap}
            onToggleMastered={toggleMastered}
            onExit={() => setCurrentView('library')}
          />
        )}
      </main>
    </div>
  )
}
