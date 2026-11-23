import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { migrateData, downloadJson, timestamp, readJsonFile, entryDisplayName } from '../utils.js'

const KEY = 'radix_library'

function generateId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36)
}

function loadFromStorage() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) return migrateData(JSON.parse(saved))
  } catch { /* ignore */ }
  return null
}

/**
 * Owns the library: the entry list, derived lookup maps, persistence and CRUD.
 * `entries === null` means no library is open yet (welcome screen).
 */
export function useLibrary() {
  const [entries, setEntries] = useState(loadFromStorage)

  const entryMap = useMemo(() => {
    const m = new Map()
    for (const e of entries || []) m.set(e.id, e)
    return m
  }, [entries])

  const usedByMap = useMemo(() => {
    const m = new Map()
    for (const e of entries || []) {
      for (const cid of e.componentIds || []) {
        if (!m.has(cid)) m.set(cid, [])
        m.get(cid).push(e.id)
      }
    }
    return m
  }, [entries])

  // Persist, debounced: serialising a 1,500-entry library on every keystroke
  // or star-toggle would block the main thread.
  const timer = useRef(null)
  useEffect(() => {
    if (entries === null) return
    clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify({ entries, savedAt: new Date().toISOString() }))
      } catch { /* quota exceeded — the user can still download */ }
    }, 400)
    return () => clearTimeout(timer.current)
  }, [entries])

  const loadFile = useCallback(async (file) => {
    try {
      const data = await readJsonFile(file)
      if (!data || (!data.entries && !data.characters && !data.primitives)) throw new Error('not a library')
      setEntries(migrateData(data))
      return true
    } catch {
      alert('Could not read that file. Make sure it is a Radix library (.json).')
      return false
    }
  }, [])

  const replaceAll = useCallback((list) => setEntries(list), [])

  const download = useCallback(() => {
    if (!entries) return
    downloadJson(`radix_library_${timestamp()}.json`, { entries, exportedAt: new Date().toISOString() })
  }, [entries])

  const upsert = useCallback((data) => {
    if (data.id) {
      setEntries(prev => prev.map(e => e.id === data.id ? data : e))
    } else {
      setEntries(prev => [...prev, { ...data, id: generateId(), isMastered: false }])
    }
  }, [])

  const patch = useCallback((id, changes) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...changes } : e))
  }, [])

  const remove = useCallback((id) => {
    const usedByIds = usedByMap.get(id)
    if (usedByIds?.length > 0) {
      const names = usedByIds.slice(0, 8).map(uid => {
        const e = entryMap.get(uid)
        return e ? entryDisplayName(e) : uid
      }).join(', ')
      const more = usedByIds.length > 8 ? ` and ${usedByIds.length - 8} more` : ''
      alert(`This entry is a component of ${names}${more}. Remove it from those entries first.`)
      return false
    }
    setEntries(prev => prev.filter(e => e.id !== id))
    return true
  }, [entryMap, usedByMap])

  const toggleMastered = useCallback((id) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, isMastered: !e.isMastered } : e))
  }, [])

  return { entries, entryMap, usedByMap, loadFile, replaceAll, download, upsert, patch, remove, toggleMastered }
}
