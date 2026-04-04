#!/usr/bin/env node
/**
 * vault-to-radix
 *
 * Converts an Obsidian vault of Heisig character notes into a radix_library.json
 * file ready to upload into the Radix app.
 *
 * Usage:
 *   node index.js <vault-path> [output.json]
 *
 * ── File naming convention ───────────────────────────────────────────────────
 *
 *   Full entry:     "45 刀 Sword.md"        → heisig=45, char=刀, keyword=Sword
 *   No number:      "人 Person.md"          → char=人, keyword=Person
 *   No glyph:       "Walking Legs.md"       → keyword=Walking Legs (primitive)
 *
 * ── Frontmatter conventions ──────────────────────────────────────────────────
 *
 *   aliases:
 *     - 💠 Person            → primitiveKeyword "Person"
 *     - 💠 Human Figure      → primitiveKeyword "Human Figure"
 *     - Katana               → ignored (non-primitive alias)
 *   book: 1                  → bookNumber
 *   lesson: 5                → lessonNumber
 *   mastered: true           → isMastered
 *
 *   An alias prefixed with 💠 marks the name(s) used when this entry
 *   appears as a building block inside another character's mnemonic story.
 *   Entries with ONLY 💠 aliases (no standalone keyword from the filename)
 *   become pure Primitives in Radix. Entries with both become Dual.
 *
 * ── Component linking ────────────────────────────────────────────────────────
 *
 *   Obsidian wiki links [[...]] found in the note body are resolved to
 *   componentIds. The resolver tries each link target against:
 *     - keyword (e.g. [[Sword]])
 *     - character glyph (e.g. [[刀]])
 *     - Heisig number (e.g. [[45]])
 *     - primitive keywords (e.g. [[Walking Legs]])
 *     - full filename stem (e.g. [[45 刀 Sword]])
 *   Unresolved links are silently skipped.
 */

'use strict'

const fs   = require('fs')
const path = require('path')
const matter = require('gray-matter')

// ── Helpers ──────────────────────────────────────────────────────────────────

let _idSeq = 0
function makeId() {
  return `r${Date.now().toString(36)}${(++_idSeq).toString(36)}`
}

/** Parse the stem of a .md filename into {heisigNumber, character, keyword}. */
function parseStem(stem) {
  // "123 字 Some Keyword"
  let m = stem.match(/^(\d+)\s+([\u4e00-\u9fff\u3400-\u4dbf\uff00-\uffef]+)\s+(.+)$/)
  if (m) return { heisigNumber: parseInt(m[1], 10), character: m[2], keyword: m[3].trim() }

  // "字 Some Keyword"
  m = stem.match(/^([\u4e00-\u9fff\u3400-\u4dbf\uff00-\uffef]+)\s+(.+)$/)
  if (m) return { heisigNumber: null, character: m[1], keyword: m[2].trim() }

  // "123 Some Keyword"  (no glyph in filename)
  m = stem.match(/^(\d+)\s+(.+)$/)
  if (m) return { heisigNumber: parseInt(m[1], 10), character: null, keyword: m[2].trim() }

  // Anything else — treat entire stem as the keyword
  return { heisigNumber: null, character: null, keyword: stem.trim() }
}

/** Return all 💠-prefixed aliases as plain strings. */
function extractPrimitiveKeywords(aliases) {
  if (!aliases) return []
  const list = Array.isArray(aliases) ? aliases : [aliases]
  return list
    .map(a => String(a))
    .filter(a => a.includes('💠'))
    .map(a => a.replace(/💠/g, '').trim())
    .filter(Boolean)
}

const WIKI_RE = /\[\[([^\]|]+?)(?:\|[^\]]+)?\]\]/g

/** Return the raw target strings of all [[wiki links]] in text. */
function extractWikiTargets(text) {
  const targets = []
  let m
  WIKI_RE.lastIndex = 0
  while ((m = WIKI_RE.exec(text)) !== null) targets.push(m[1].trim())
  return targets
}

/** Clean markdown body for use as a mnemonic story string. */
function cleanBody(body) {
  return body
    .replace(/^---+\s*$/gm, '')                              // thematic breaks
    .replace(/^#{1,6}\s+.+$/gm, '')                          // headings
    .replace(WIKI_RE, (_, target) =>                          // [[links]] → plain text
      target.split(/[/|]/).pop().trim()
    )
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')                 // [text](url)
    .replace(/[*_~]{1,3}([^*_~\n]+)[*_~]{1,3}/g, '$1')      // bold / italic / strikethrough
    .replace(/`[^`]+`/g, s => s.slice(1, -1))                // inline code
    .replace(/^[ \t]*[-*+>]\s*/gm, '')                       // bullets / blockquotes
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** True if this parsed file looks like a character/primitive entry. */
function isEntryFile({ heisigNumber, character }, primitiveKeywords) {
  return heisigNumber !== null || character !== null || primitiveKeywords.length > 0
}

/** Walk a directory recursively, yielding .md file paths. */
function* walkMd(dir) {
  for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (dirent.name.startsWith('.')) continue          // skip .obsidian, .trash, etc.
    const full = path.join(dir, dirent.name)
    if (dirent.isDirectory()) {
      yield* walkMd(full)
    } else if (dirent.isFile() && dirent.name.toLowerCase().endsWith('.md')) {
      yield full
    }
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

function run() {
  const [,, vaultArg, outArg] = process.argv
  if (!vaultArg) {
    console.error('Usage: node index.js <vault-path> [output.json]')
    process.exit(1)
  }

  const vaultDir = path.resolve(vaultArg)
  if (!fs.existsSync(vaultDir) || !fs.statSync(vaultDir).isDirectory()) {
    console.error(`Not a directory: ${vaultDir}`)
    process.exit(1)
  }

  const outFile = outArg
    ? path.resolve(outArg)
    : path.join(process.cwd(), 'radix_library.json')

  console.log(`\nvault-to-radix`)
  console.log(`  Vault : ${vaultDir}`)
  console.log(`  Output: ${outFile}\n`)

  // ── Pass 1: parse each .md file ─────────────────────────────────────────

  const raw = []       // fully parsed entries (with _wikiTargets temp field)
  let skippedCount = 0
  let errorCount = 0

  for (const filePath of walkMd(vaultDir)) {
    const stem = path.basename(filePath, '.md')
    const parsed = parseStem(stem)

    let fm = {}
    let bodyRaw = ''
    try {
      const file = matter(fs.readFileSync(filePath, 'utf8'))
      fm = file.data ?? {}
      bodyRaw = file.content ?? ''
    } catch (err) {
      console.warn(`  [warn] Parse error in ${stem}: ${err.message}`)
      errorCount++
      continue
    }

    const primitiveKeywords = extractPrimitiveKeywords(fm.aliases)

    if (!isEntryFile(parsed, primitiveKeywords)) {
      skippedCount++
      continue
    }

    // If the filename has no CJK glyph and no Heisig number, but the file
    // has 💠 aliases, this is a pure primitive — its filename stem is a
    // primitive label, not a standalone character keyword.
    let standaloneKeyword = parsed.keyword ?? ''
    if (!parsed.heisigNumber && !parsed.character && primitiveKeywords.length > 0) {
      // Fold the stem into primitiveKeywords (if not already present)
      const stemLower = standaloneKeyword.toLowerCase()
      if (!primitiveKeywords.some(pk => pk.toLowerCase() === stemLower)) {
        primitiveKeywords.unshift(standaloneKeyword)
      }
      standaloneKeyword = ''
    }

    // Coerce frontmatter numbers (they may be strings if quoted in YAML)
    const fmHeisig  = fm.heisig  != null ? parseInt(fm.heisig,  10) : null
    const fmBook    = fm.book    != null ? parseInt(fm.book,    10) : null
    const fmLesson  = fm.lesson  != null ? parseInt(fm.lesson,  10) : null

    raw.push({
      id:               makeId(),
      character:        parsed.character ?? '',
      keyword:          standaloneKeyword,
      primitiveKeywords,
      heisigNumber:     parsed.heisigNumber ?? fmHeisig ?? null,
      bookNumber:       fmBook   ?? null,
      lessonNumber:     fmLesson ?? null,
      story:            cleanBody(bodyRaw),
      isMastered:       fm.mastered === true,
      _wikiTargets:     extractWikiTargets(bodyRaw),
    })
  }

  // ── Pass 2: build lookup map ─────────────────────────────────────────────

  // Every way a note might be referenced → its id
  const lookup = new Map()

  const addLookup = (key, id) => {
    if (key) lookup.set(key.toLowerCase().trim(), id)
  }

  for (const e of raw) {
    addLookup(e.keyword,                      e.id)
    addLookup(e.character,                    e.id)
    if (e.heisigNumber) addLookup(String(e.heisigNumber), e.id)
    for (const pk of e.primitiveKeywords)     addLookup(pk, e.id)
    // Full filename-style reference: "45 刀 Sword"
    const full = [e.heisigNumber, e.character, e.keyword].filter(Boolean).join(' ')
    addLookup(full, e.id)
  }

  // ── Pass 3: resolve wiki links → componentIds ────────────────────────────

  let totalLinksFound    = 0
  let totalLinksResolved = 0

  const entries = raw.map(e => {
    const componentIds = []

    for (const target of e._wikiTargets) {
      totalLinksFound++
      // Try the whole target, then the last segment after | or /
      const candidates = [target, ...target.split(/[|/]/).slice(1)]
      for (const c of candidates) {
        const id = lookup.get(c.toLowerCase().trim())
        if (id && id !== e.id && !componentIds.includes(id)) {
          componentIds.push(id)
          totalLinksResolved++
          break
        }
      }
    }

    const { _wikiTargets, ...entry } = e
    return { ...entry, componentIds }
  })

  // ── Write output ─────────────────────────────────────────────────────────

  const output = {
    entries,
    exportedAt: new Date().toISOString(),
    generatedBy: 'vault-to-radix',
    sourceVault: vaultDir,
  }

  fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf8')

  // ── Summary ──────────────────────────────────────────────────────────────

  const nPrimitive = entries.filter(e =>  !e.keyword && e.primitiveKeywords.length > 0).length
  const nDual      = entries.filter(e =>   e.keyword && e.primitiveKeywords.length > 0).length
  const nCharacter = entries.filter(e =>   e.keyword && e.primitiveKeywords.length === 0).length
  const nLinked    = entries.filter(e => e.componentIds.length > 0).length

  console.log('Results')
  console.log('  ──────────────────────────────────')
  console.log(`  Entries written : ${entries.length}`)
  console.log(`    Primitives    : ${nPrimitive}`)
  console.log(`    Dual          : ${nDual}`)
  console.log(`    Characters    : ${nCharacter}`)
  console.log(`  Component links : ${totalLinksResolved} resolved / ${totalLinksFound} found`)
  console.log(`  Entries linked  : ${nLinked} have ≥1 component`)
  console.log(`  Skipped (non-entry files) : ${skippedCount}`)
  if (errorCount) console.warn(`  Parse errors    : ${errorCount}`)
  console.log(`\n  → ${outFile}\n`)
}

run()
