import { useEffect } from 'react'

/**
 * Attach a keydown listener on `window` that is automatically skipped when the
 * user is typing inside an <input>, <textarea>, or contenteditable element.
 * Use this for single-key shortcuts.  For modifier-key shortcuts (Ctrl/Cmd+*)
 * that should work even inside form fields, add your own useEffect directly.
 */
export function useKeyboard(handler, deps = []) {
  useEffect(() => {
    function onKeyDown(e) {
      const t = e.target
      if (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable) return
      handler(e)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}
