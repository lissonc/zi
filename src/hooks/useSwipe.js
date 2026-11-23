import { useRef, useState, useCallback } from 'react'

const TRIGGER = 90   // px of horizontal travel that counts as a decision
const START = 12     // px before the card starts to follow the finger

/**
 * Horizontal swipe on a card (touch and pen only; the mouse keeps selecting text).
 * Returns handlers to spread on the element, a style that makes it follow the
 * finger, and `lean`: 'left' | 'right' | null once the swipe would trigger.
 * The element needs `touch-action: pan-y` so vertical scrolling still works.
 */
export function useSwipe({ onLeft, onRight, enabled = true }) {
  const start = useRef(null)
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)

  const onPointerDown = useCallback((e) => {
    if (!enabled || e.pointerType === 'mouse') return
    if (e.target.closest('button, a, input, textarea, select, summary')) return
    start.current = { x: e.clientX, y: e.clientY, id: e.pointerId, active: false }
  }, [enabled])

  const onPointerMove = useCallback((e) => {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    const mx = e.clientX - s.x, my = e.clientY - s.y
    if (!s.active) {
      if (Math.abs(my) > START && Math.abs(my) > Math.abs(mx)) { start.current = null; return } // scrolling
      if (Math.abs(mx) < START) return
      s.active = true
      setDragging(true)
    }
    setDx(mx)
  }, [])

  const finish = useCallback((e, cancelled) => {
    const s = start.current
    if (!s || s.id !== e.pointerId) return
    start.current = null
    const mx = e.clientX - s.x
    setDragging(false)
    setDx(0)
    if (cancelled || !s.active) return
    if (mx > TRIGGER) onRight?.()
    else if (mx < -TRIGGER) onLeft?.()
  }, [onLeft, onRight])

  const onPointerUp = useCallback((e) => finish(e, false), [finish])
  const onPointerCancel = useCallback((e) => finish(e, true), [finish])

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel },
    style: {
      transform: dx ? `translateX(${dx}px) rotate(${dx / 45}deg)` : undefined,
      transition: dragging ? 'none' : 'transform 0.18s ease-out',
    },
    lean: dx > TRIGGER ? 'right' : dx < -TRIGGER ? 'left' : null,
  }
}
