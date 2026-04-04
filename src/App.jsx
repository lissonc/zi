import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header.jsx'
import WelcomeView from './components/WelcomeView.jsx'
import LibraryView from './components/LibraryView.jsx'
import EditorView from './components/EditorView.jsx'
import ReviewView from './components/ReviewView.jsx'

function generateId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
}

function loadFromStorage() {
  try {
    const saved = localStorage.getItem('radix_library')
    if (saved) {
      const data = JSON.parse(saved)
      return { primitives: data.primitives || [], characters: data.characters || [] }
    }
  } catch {
    // ignore
  }
  return null
}

export default function App() {
  const [currentView, setCurrentView] = useState('welcome')
  const [primitives, setPrimitives] = useState([])
  const [characters, setCharacters] = useState([])
  // editing: { type: 'primitive'|'character', item: object|null }
  const [editing, setEditing] = useState(null)

  // On mount, check localStorage for a saved library
  useEffect(() => {
    const saved = loadFromStorage()
    if (saved) {
      setPrimitives(saved.primitives)
      setCharacters(saved.characters)
      setCurrentView('library')
    }
  }, [])

  // Persist to localStorage whenever library changes
  useEffect(() => {
    if (currentView !== 'welcome') {
      localStorage.setItem('radix_library', JSON.stringify({ primitives, characters }))
    }
  }, [primitives, characters, currentView])

  // ── Database actions ─────────────────────────────────────────────────────────

  const loadDatabase = useCallback((file) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result)
        setPrimitives(data.primitives || [])
        setCharacters(data.characters || [])
        setCurrentView('library')
      } catch {
        alert('Could not parse file. Make sure it is a valid Radix JSON library.')
      }
    }
    reader.readAsText(file)
  }, [])

  const createNewLibrary = useCallback(() => {
    setPrimitives([])
    setCharacters([])
    setCurrentView('library')
  }, [])

  const downloadDatabase = useCallback(() => {
    const data = { primitives, characters, exportedAt: new Date().toISOString() }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'radix_library.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [primitives, characters])

  // ── Primitive actions ────────────────────────────────────────────────────────

  const savePrimitive = useCallback((data) => {
    if (data.id) {
      setPrimitives(prev => prev.map(p => p.id === data.id ? data : p))
    } else {
      setPrimitives(prev => [...prev, { ...data, id: generateId() }])
    }
    setEditing(null)
    setCurrentView('library')
  }, [])

  const deletePrimitive = useCallback((id) => {
    const inUse = characters.some(c => c.primitiveIds.includes(id))
    if (inUse) {
      alert('Cannot delete: this primitive is used by one or more characters.')
      return
    }
    setPrimitives(prev => prev.filter(p => p.id !== id))
  }, [characters])

  // ── Character actions ────────────────────────────────────────────────────────

  const saveCharacter = useCallback((data) => {
    if (data.id) {
      setCharacters(prev => prev.map(c => c.id === data.id ? data : c))
    } else {
      setCharacters(prev => [...prev, { ...data, id: generateId(), isMastered: false }])
    }
    setEditing(null)
    setCurrentView('library')
  }, [])

  const deleteCharacter = useCallback((id) => {
    setCharacters(prev => prev.filter(c => c.id !== id))
  }, [])

  const toggleMastered = useCallback((id) => {
    setCharacters(prev => prev.map(c => c.id === id ? { ...c, isMastered: !c.isMastered } : c))
  }, [])

  // ── Navigation helpers ───────────────────────────────────────────────────────

  const goToEditor = useCallback((type, item = null) => {
    setEditing({ type, item })
    setCurrentView('editor')
  }, [])

  const cancelEdit = useCallback(() => {
    setEditing(null)
    setCurrentView('library')
  }, [])

  // ── Render ───────────────────────────────────────────────────────────────────

  const isReview = currentView === 'review'

  return (
    <div className="app">
      {!isReview && (
        <Header
          currentView={currentView}
          hasLibrary={currentView !== 'welcome'}
          onNavigate={setCurrentView}
          onDownload={downloadDatabase}
          primitiveCount={primitives.length}
          characterCount={characters.length}
        />
      )}

      <main className={isReview ? 'main-review' : 'main'}>
        {currentView === 'welcome' && (
          <WelcomeView onLoad={loadDatabase} onCreate={createNewLibrary} />
        )}
        {currentView === 'library' && (
          <LibraryView
            primitives={primitives}
            characters={characters}
            onEditPrimitive={(p) => goToEditor('primitive', p)}
            onEditCharacter={(c) => goToEditor('character', c)}
            onDeletePrimitive={deletePrimitive}
            onDeleteCharacter={deleteCharacter}
            onToggleMastered={toggleMastered}
            onNewPrimitive={() => goToEditor('primitive')}
            onNewCharacter={() => goToEditor('character')}
            onReview={() => setCurrentView('review')}
          />
        )}
        {currentView === 'editor' && (
          <EditorView
            type={editing?.type}
            item={editing?.item}
            primitives={primitives}
            onSavePrimitive={savePrimitive}
            onSaveCharacter={saveCharacter}
            onCancel={cancelEdit}
          />
        )}
        {currentView === 'review' && (
          <ReviewView
            characters={characters}
            primitives={primitives}
            onToggleMastered={toggleMastered}
            onExit={() => setCurrentView('library')}
          />
        )}
      </main>
    </div>
  )
}
