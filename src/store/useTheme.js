import { useState, useEffect, useCallback } from 'react'

const KEY = 'radix_theme'
const ORDER = ['system', 'light', 'dark']

function systemDark() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

/** Theme preference: follows the system unless the user picks light or dark. */
export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try { const t = localStorage.getItem(KEY); if (ORDER.includes(t)) return t } catch { /* ignore */ }
    return 'system'
  })
  const [sysDark, setSysDark] = useState(systemDark)

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const on = e => setSysDark(e.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') root.removeAttribute('data-theme')
    else root.setAttribute('data-theme', theme)
    try { localStorage.setItem(KEY, theme) } catch { /* ignore */ }
  }, [theme])

  const cycle = useCallback(() => setTheme(t => ORDER[(ORDER.indexOf(t) + 1) % ORDER.length]), [])
  const resolved = theme === 'system' ? (sysDark ? 'dark' : 'light') : theme
  return { theme, resolved, cycle }
}
