// Structure of the component graph: levels, families, build chains, groups.

/**
 * Level of every entry: 1 for entries built from nothing, otherwise one more
 * than the deepest component. Only components present in `entries` count.
 * Cycles (bad data) are cut where they are met.
 */
export function computeLevels(entries) {
  const byId = new Map(entries.map(e => [e.id, e]))
  const level = new Map()
  const visiting = new Set()
  function visit(id) {
    if (level.has(id)) return level.get(id)
    if (visiting.has(id)) return 0
    visiting.add(id)
    let deepest = 0
    for (const cid of byId.get(id).componentIds || []) {
      if (cid !== id && byId.has(cid)) deepest = Math.max(deepest, visit(cid))
    }
    visiting.delete(id)
    level.set(id, deepest + 1)
    return deepest + 1
  }
  for (const e of entries) visit(e.id)
  return level
}

/** The entry and everything built from it, directly or through other characters. */
export function familyOf(id, usedByMap) {
  const out = new Set([id])
  const stack = [id]
  while (stack.length) {
    for (const u of usedByMap.get(stack.pop()) || []) {
      if (!out.has(u)) { out.add(u); stack.push(u) }
    }
  }
  return out
}

/** The entry and everything it is built from, down to entries with no components. */
export function chainOf(id, entryMap) {
  const out = new Set([id])
  const stack = [id]
  while (stack.length) {
    const e = entryMap.get(stack.pop())
    for (const c of e?.componentIds || []) {
      if (entryMap.has(c) && !out.has(c)) { out.add(c); stack.push(c) }
    }
  }
  return out
}

/** Groups of entries linked to each other by any path, largest first. */
export function connectedGroups(entries, usedByMap) {
  const byId = new Map(entries.map(e => [e.id, e]))
  const seen = new Set()
  const groups = []
  for (const e of entries) {
    if (seen.has(e.id)) continue
    const group = []
    const stack = [e.id]
    seen.add(e.id)
    while (stack.length) {
      const id = stack.pop()
      group.push(id)
      const node = byId.get(id)
      const next = [...(node.componentIds || []), ...(usedByMap.get(id) || [])]
      for (const n of next) {
        if (byId.has(n) && !seen.has(n)) { seen.add(n); stack.push(n) }
      }
    }
    groups.push(group)
  }
  return groups.sort((a, b) => b.length - a.length)
}

/** Components ranked by how many entries use them directly. */
export function largestFamilies(entries, usedByMap, limit = 40) {
  return entries
    .map(e => ({ entry: e, direct: usedByMap.get(e.id)?.length || 0 }))
    .filter(f => f.direct > 0)
    .sort((a, b) => b.direct - a.direct)
    .slice(0, limit)
}

/**
 * Heuristic check of an entry's components against stroke counts.
 * Returns null when nothing looks wrong, else { kind, label }.
 */
export function componentIssue(entry, entryMap) {
  if (!entry.keyword?.trim() || entry.componentsChecked) return null
  const comps = (entry.componentIds || []).map(id => entryMap.get(id)).filter(Boolean)
  const strokes = entry.strokeCount
  if (comps.length === 0) {
    // one- to three-stroke characters are usually not built from anything
    if (strokes != null && strokes <= 3) return null
    return { kind: 'none', label: 'No components' }
  }
  if (strokes == null || comps.some(c => c.strokeCount == null)) return null
  const sum = comps.reduce((s, c) => s + c.strokeCount, 0)
  if (sum < strokes * 0.6) return { kind: 'few', label: `Components cover ${sum} of ${strokes} strokes` }
  if (sum > strokes + 3) return { kind: 'many', label: `Components add up to ${sum} strokes, the character has ${strokes}` }
  return null
}
