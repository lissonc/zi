import { entryType, canonicalName } from '../utils.js'

/** Small pill naming an entry: glyph + the name it carries inside stories. */
export default function EntryChip({ entry, onClick, title }) {
  const type = entryType(entry)
  const Tag = onClick ? 'button' : 'span'
  return (
    <Tag
      className={`chip chip-${type}${onClick ? ' chip-btn' : ''}`}
      onClick={onClick ? () => onClick(entry) : undefined}
      title={title ?? ((entry.primitiveKeywords || []).join(', ') || entry.keyword)}
      type={onClick ? 'button' : undefined}
    >
      {entry.character && <span className="chip-glyph">{entry.character}</span>}
      <span>{canonicalName(entry)}</span>
    </Tag>
  )
}
