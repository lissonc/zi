import { useMemo } from 'react'
import { hasStory } from '../utils.js'

function Bar({ value, total, kind }) {
  const pct = total ? (value / total) * 100 : 0
  return (
    <span className="bar" role="img" aria-label={`${value} of ${total}`}>
      <span className={`bar-fill bar-${kind}`} style={{ width: `${pct}%` }} />
    </span>
  )
}

export default function ProgressView({ entries, onOpenLesson }) {
  const { lessons, total } = useMemo(() => {
    const map = new Map()
    const total = { count: 0, story: 0, mastered: 0 }
    for (const e of entries) {
      if (!e.keyword?.trim()) continue
      const key = e.lessonNumber ?? null
      if (!map.has(key)) map.set(key, { lesson: key, count: 0, story: 0, mastered: 0 })
      const row = map.get(key)
      row.count++; total.count++
      if (hasStory(e)) { row.story++; total.story++ }
      if (e.isMastered) { row.mastered++; total.mastered++ }
    }
    const lessons = [...map.values()].sort((a, b) => (a.lesson ?? Infinity) - (b.lesson ?? Infinity))
    return { lessons, total }
  }, [entries])

  // the lesson to work on next: the first one that is not fully mastered
  const current = lessons.find(l => l.lesson != null && l.mastered < l.count)?.lesson ?? null
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)

  return (
    <div className="page progress">
      <div className="page-head">
        <div>
          <h1 className="page-title">Progress</h1>
          <p className="page-sub">{total.count.toLocaleString()} characters in {lessons.length} lesson{lessons.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      <div className="totals">
        <div className="total">
          <span className="total-num">{pct(total.story, total.count)}%</span>
          <span className="total-label">have a story · {total.story.toLocaleString()} of {total.count.toLocaleString()}</span>
          <Bar value={total.story} total={total.count} kind="story" />
        </div>
        <div className="total">
          <span className="total-num">{pct(total.mastered, total.count)}%</span>
          <span className="total-label">mastered · {total.mastered.toLocaleString()} of {total.count.toLocaleString()}</span>
          <Bar value={total.mastered} total={total.count} kind="mastered" />
        </div>
      </div>

      {total.count === 0 ? (
        <div className="empty">No characters yet.</div>
      ) : (
        <table className="lessons">
          <thead>
            <tr>
              <th scope="col">Lesson</th>
              <th scope="col" className="num">Characters</th>
              <th scope="col">Story</th>
              <th scope="col">Mastered</th>
            </tr>
          </thead>
          <tbody>
            {lessons.map(l => (
              <tr key={l.lesson ?? 'none'} className={l.lesson === current ? 'is-current' : l.mastered === l.count ? 'is-done' : ''}>
                <th scope="row">
                  {l.lesson != null
                    ? <button className="link-btn" onClick={() => onOpenLesson(l.lesson)} title="Show this lesson in the library">{l.lesson}</button>
                    : 'None'}
                  {l.lesson === current && <span className="tag">next</span>}
                </th>
                <td className="num">{l.count}</td>
                <td><Bar value={l.story} total={l.count} kind="story" /><span className="bar-num">{l.story}</span></td>
                <td><Bar value={l.mastered} total={l.count} kind="mastered" /><span className="bar-num">{l.mastered}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
