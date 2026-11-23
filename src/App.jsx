import { useState, useEffect, useCallback } from 'react'
import Header from './components/Header.jsx'
import WelcomeView from './components/WelcomeView.jsx'
import LibraryView from './components/LibraryView.jsx'
import GraphView from './components/GraphView.jsx'
import StoriesView from './components/StoriesView.jsx'
import EditorView from './components/EditorView.jsx'
import ReviewView from './components/ReviewView.jsx'
import CheckView from './components/CheckView.jsx'
import ProgressView from './components/ProgressView.jsx'
import { useLibrary } from './store/useLibrary.js'
import { useStories } from './store/useStories.js'
import { useTheme } from './store/useTheme.js'
import exampleEntries from './exampleLibrary.js'

export default function App() {
  const lib = useLibrary()
  const stories = useStories()
  const { theme, resolved, cycle } = useTheme()

  const hasLibrary = lib.entries !== null
  const [view, setView] = useState('library')
  const [editing, setEditing] = useState(null)   // entry being edited, or null for a new one
  const [returnTo, setReturnTo] = useState('library')
  const [graphFocus, setGraphFocus] = useState(null)
  const [libraryLesson, setLibraryLesson] = useState(null) // lesson to open the library on

  const current = hasLibrary ? view : 'welcome'

  const openEditor = useCallback((item = null) => {
    setReturnTo(v => (view === 'editor' ? v : view))
    setEditing(item)
    setView('editor')
  }, [view])

  const closeEditor = useCallback(() => {
    setEditing(null)
    setView(returnTo === 'editor' ? 'library' : returnTo)
  }, [returnTo])

  const saveEntry = useCallback((data) => { lib.upsert(data); closeEditor() }, [lib, closeEditor])
  const saveAndNavigate = useCallback((data, nextItem) => { lib.upsert(data); setEditing(nextItem) }, [lib])

  const showInGraph = useCallback((entry) => { setGraphFocus(entry.id); setView('graph') }, [])
  const openLesson = useCallback((lesson) => { setLibraryLesson(lesson); setView('library') }, [])

  const navigate = useCallback((v) => {
    if (v === 'welcome') return
    setEditing(null)
    setLibraryLesson(null)
    setView(v)
  }, [])

  const loadFile = useCallback(async (file) => {
    if (hasLibrary && lib.entries.length > 0 &&
        !window.confirm(`Replace the current library (${lib.entries.length} entries) with “${file.name}”?`)) return
    if (await lib.loadFile(file)) setView('library')
  }, [hasLibrary, lib])

  // Global shortcuts (work inside form fields too)
  useEffect(() => {
    function onKeyDown(e) {
      if (!(e.ctrlKey || e.metaKey) || !hasLibrary) return
      const k = e.key.toLowerCase()
      if (e.shiftKey) {
        const target = { l: 'library', g: 'graph', s: 'stories', r: 'review' }[k]
        if (target) { e.preventDefault(); navigate(target); return }
        if (k === 'n' && view !== 'editor') { e.preventDefault(); openEditor(null) }
        return
      }
      // the editor handles its own Ctrl+S
      if (k === 's' && view !== 'editor') { e.preventDefault(); lib.download() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [hasLibrary, view, navigate, openEditor, lib])

  const pending = Object.keys(stories.proposals).length
  const immersive = current === 'review'

  return (
    <div className={`app app-${current}`}>
      {!immersive && (
        <Header
          view={current === 'check' ? 'library' : current}
          hasLibrary={hasLibrary}
          onNavigate={navigate}
          onDownload={lib.download}
          onLoad={loadFile}
          onNew={() => openEditor(null)}
          counts={{ entries: lib.entries?.length ?? 0, pending }}
          theme={theme}
          onCycleTheme={cycle}
        />
      )}

      <main className="main">
        {current === 'welcome' && (
          <WelcomeView
            onLoad={loadFile}
            onCreate={() => { lib.replaceAll([]); setView('library') }}
            onLoadExample={() => { lib.replaceAll(exampleEntries); setView('library') }}
          />
        )}
        {current === 'library' && (
          <LibraryView
            key={libraryLesson ?? 'all'}
            presetLesson={libraryLesson}
            onCheckComponents={() => setView('check')}
            entries={lib.entries}
            entryMap={lib.entryMap}
            onEdit={openEditor}
            onDelete={lib.remove}
            onToggleMastered={lib.toggleMastered}
            onNew={() => openEditor(null)}
            onShowInGraph={showInGraph}
          />
        )}
        {current === 'graph' && (
          <GraphView
            entries={lib.entries}
            entryMap={lib.entryMap}
            usedByMap={lib.usedByMap}
            onEdit={openEditor}
            onCheckComponents={() => setView('check')}
            theme={resolved}
            focusId={graphFocus}
            onFocusHandled={() => setGraphFocus(null)}
          />
        )}
        {current === 'stories' && (
          <StoriesView
            entries={lib.entries}
            entryMap={lib.entryMap}
            stories={stories}
            onPatchEntry={lib.patch}
          />
        )}
        {current === 'editor' && (
          <EditorView
            key={editing?.id ?? 'new'}
            item={editing}
            entries={lib.entries}
            entryMap={lib.entryMap}
            onSave={saveEntry}
            onCancel={closeEditor}
            onSaveAndNavigate={saveAndNavigate}
          />
        )}
        {current === 'review' && (
          <ReviewView
            entries={lib.entries}
            entryMap={lib.entryMap}
            onSetMastered={lib.setMastered}
            onExit={() => setView('library')}
          />
        )}
        {current === 'check' && (
          <CheckView
            entries={lib.entries}
            entryMap={lib.entryMap}
            onPatch={lib.patch}
            onEdit={openEditor}
            onBack={() => setView('library')}
          />
        )}
        {current === 'progress' && (
          <ProgressView entries={lib.entries} onOpenLesson={openLesson} />
        )}
      </main>
    </div>
  )
}
