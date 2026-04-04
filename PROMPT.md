# Radix — Project Specification Prompt

Build **Radix**: a local-first, single-page React app for learning Chinese/Japanese characters using the Heisig method. Zero backend, zero server — all data lives in the browser's `localStorage` and can be exported/imported as a JSON file.

---

## Tech Stack

| Concern | Choice |
|---------|--------|
| Framework | React 18 with hooks, no class components |
| Build tool | Vite 5 |
| Styling | A single `src/App.css` file; no CSS modules, no Tailwind |
| State | `useState` / `useReducer` in `App.jsx`; props drilled to children |
| Persistence | `localStorage` key `radix_library`; export as `.json` |
| Dependencies | React + ReactDOM only — **no router, no UI library, no state library** |
| Language | Plain JavaScript (`.jsx`), no TypeScript |

---

## Data Model

One unified type for both characters and primitives:

```js
{
  id: string,                  // random alphanumeric, generated at creation
  character: string,           // CJK glyph, e.g. "人" (may be empty string)
  keyword: string,             // standalone English meaning, e.g. "Person" (may be empty)
  primitiveKeywords: string[], // name(s) used as a building block, e.g. ["person", "human"]
  heisigNumber: number | null,
  bookNumber: number | null,   // 1 or 2
  lessonNumber: number | null,
  story: string,               // mnemonic story (may contain [[name]] references)
  componentIds: string[],      // ids of component entries used in the story
  isMastered: boolean,
}
```

**Derived type** (never stored, computed on the fly):

```js
function entryType(entry) {
  const hasKw    = Boolean(entry.keyword?.trim())
  const hasPrimKw = entry.primitiveKeywords?.length > 0
  if (hasKw && hasPrimKw) return 'dual'
  if (hasKw) return 'character'
  return 'primitive'
}
// → 'character' | 'primitive' | 'dual'
```

- `character` — has only `keyword`. Shown in blue.
- `primitive` — has only `primitiveKeywords`. Shown in violet/purple.
- `dual` — has both. Shown in teal.

---

## File Structure

```
src/
  App.jsx                   ← central state + routing
  App.css                   ← all styles, dark theme
  main.jsx                  ← ReactDOM.createRoot
  utils.js                  ← entryType, entryDisplayName, migrateData, storyToHtml
  components/
    Header.jsx
    WelcomeView.jsx
    LibraryView.jsx          ← list view + graph toggle
    EditorView.jsx           ← create/edit form
    ReviewView.jsx           ← flash-card session
    GraphView.jsx            ← canvas force-directed graph
tools/
  vault-to-radix/
    index.js                 ← Node.js CLI: Obsidian vault → radix_library.json
```

---

## `src/utils.js`

Export these four functions:

```js
export function entryType(entry) { /* see above */ }

export function entryDisplayName(entry) {
  if (entry.keyword?.trim()) return entry.keyword
  if (entry.primitiveKeywords?.length > 0) return entry.primitiveKeywords[0]
  return entry.character || 'Unnamed'
}

export function migrateData(data) {
  // Old format: { primitives[], characters[] } → flatten to entries[]
  if (data.entries) return data.entries
  // ... migration logic for legacy format
}

export function storyToHtml(text) {
  // Escape HTML, then wrap [[name]] in <span class="story-mention-chip">
  const escaped = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return escaped.replace(
    /\[\[([^\]]*)\]\]/g,
    (_, name) => `<span class="story-mention-chip">[[${name}]]</span>`
  )
}
```

---

## `src/App.jsx`

Central state owner. Key responsibilities:

- `entries: Entry[]` — the full library
- `currentView: 'welcome' | 'library' | 'editor' | 'review'`
- `editingItem: Entry | null`

**Performance — compute two derived Maps once and pass to all children:**

```js
const entryMap = useMemo(() => {
  const m = new Map()
  for (const e of entries) m.set(e.id, e)
  return m
}, [entries])

const usedByMap = useMemo(() => {
  const m = new Map()
  for (const e of entries) {
    for (const cid of e.componentIds) {
      if (!m.has(cid)) m.set(cid, [])
      m.get(cid).push(e.id)
    }
  }
  return m
}, [entries])
```

Pass `entryMap` and `usedByMap` as props to LibraryView, EditorView, ReviewView, GraphView.

**Delete guard:** before deleting, check `usedByMap.get(id)` — if non-empty, show an alert listing which entries use it as a component.

**Persistence:**
- On mount: read `localStorage.getItem('radix_library')`, run through `migrateData()`, call `setEntries()` and navigate to `'library'`.
- On entries/view change: `localStorage.setItem('radix_library', JSON.stringify({ entries }))` (skip on welcome view).

**Export:** `URL.createObjectURL(new Blob([JSON.stringify({entries, exportedAt})]))`, trigger `<a>` click.

**Import:** `FileReader.readAsText()`, parse JSON, run through `migrateData()`.

---

## `src/components/Header.jsx`

Sticky top bar (`position: sticky; top: 0; z-index: 100`).

Props: `currentView`, `hasLibrary`, `onNavigate`, `onDownload`, `onLoad`, `entryCount`

Left side — brand (clicking logo **字** or title "Radix" navigates home):

```jsx
<div
  className="header-brand header-brand-link"
  onClick={() => onNavigate(hasLibrary ? 'library' : 'welcome')}
  role="button" tabIndex={0}
>
  <span className="header-logo">字</span>
  <span className="header-title">Radix</span>
  <span className="mode-badge">Mode: Traditional Hanzi</span>
</div>
```

Right side — nav buttons: Library (with entry count badge), + Add, Review, ↑ Load (file input), ↓ Save. Nav buttons are hidden on the welcome view. The header is hidden entirely during a review session.

---

## `src/components/WelcomeView.jsx`

Full-page centred layout. Large 字 logo, title, subtitle. Two actions:

- **Start Fresh** → `onCreate()` (sets empty library, navigates to library view)
- **Load Library** (styled as secondary) → `onLoad(file)` via hidden `<input type="file" accept=".json">`

Below the CTA, a small info block with three coloured dots explaining the three entry types.

---

## `src/components/LibraryView.jsx`

### Toolbar

Stats row: `💠 N Primitives` (violet), `💠 N Dual` (teal), `N Characters` (blue), `N Mastered` (gold). Computed in a single `useMemo` pass.

View toggle: ☰ List / ⬡ Graph buttons.

Action buttons: `+ Add Entry`, `Review`.

### Filters (list mode only)

- Search input (keyword / character / story text)
- Filter tabs: All · 💠 Primitives · 💠 Dual · Characters
- Book select (All / Book 1 / Book 2)
- Lesson number input
- Mastered/Unmastered select

Use `useDeferredValue` on the filtered list so the search input stays responsive with 3000+ entries.

### Entry card

Wrap in `React.memo`. Left-border colour = entry type. Fields shown:

- CJK glyph (large, left)
- Keyword + type badge
- `💠 kw1 · kw2` (primitive keywords, if any)
- Book/Lesson/Heisig# metadata
- Story preview (2-line clamp, with `[[...]]` rendered as styled spans via `storyToHtml`)
- Component chips (`comp-tag comp-tag-{type}`) — show primitive name or keyword

Action buttons: ☆/★ mastered toggle (characters/dual only), ✏️ edit, 🗑 delete.

Apply `content-visibility: auto; contain-intrinsic-size: auto 100px` to `.item-list > *` in CSS for virtual rendering of off-screen cards.

### Graph mode

When the view toggle is set to Graph, render `<GraphView>` in place of the list.

---

## `src/components/EditorView.jsx`

Max-width 640px centred form. Header shows `Add Entry` / `Edit Entry` with a live type pill (updates as fields are filled).

### Fields

**Character** — short text input, large font, max 2 chars.

**Standalone Keyword** — text input. Hint: "leave blank if pure primitive."

**💠 Primitive Keywords** — chip/tag input:
- State: `primKwList: string[]`, `primKwDraft: string`
- Render confirmed keywords as chips (styled violet, with 💠 prefix and × remove button)
- Draft input after the chips; on `,` keystroke, commit all complete segments to the list; on blur, commit draft if non-empty
- `handleSubmit` also commits any in-progress draft before saving

**Heisig #, Book, Lesson** — only shown when keyword is non-empty.

**Mnemonic Story** — overlay-mirror textarea with `[[name]]` mention highlighting:
- Wrapper div `position: relative`
- Mirror `<div>` (absolutely positioned behind, pointer-events none) renders `storyToHtml(story)` via `dangerouslySetInnerHTML`; mirror text is `color: var(--text)` and `[[...]]` spans are underlined blue
- Textarea sits on top with `color: transparent; caret-color: var(--text); background: transparent`
- Scroll sync: `mirrorRef.scrollTop = textarea.scrollTop` on scroll event
- Typing `[[` triggers a live search dropdown (see below)

**`[[` autocomplete dropdown:**
- State: `mentionSearch: string|null`, `mentionStart: number`, `mentionIndex: number`
- `onChange`: detect `[[` before cursor (no `]]` after it) → set `mentionSearch` to the text after `[[`
- Dropdown shows top 8 matching candidates (by keyword / primitiveKeywords / character)
- Keyboard: ArrowDown/Up navigate, Enter/Tab inserts, Escape closes
- `onMouseDown` on option: `ev.preventDefault()` + insert (prevents blur from closing before click fires)
- `onBlur`: `setTimeout(() => setMentionSearch(null), 150)` for the same reason
- Inserting: replaces `[[draft` with `[[name]]`, places cursor after it via `requestAnimationFrame` + `setSelectionRange`

**Components picker** — scrollable chip grid of all other entries. Selected entries float to top (use a `Set` for O(1) comparator). Filter by search string. Show selected summary below.

---

## `src/components/ReviewView.jsx`

Three sub-screens: **ConfigScreen → FlipCard session → SessionSummary**.

### ConfigScreen
Mode: Random 20 / Infinite Loop. Pool: All / Mastered / Unmastered. Filter by book and lesson range. Shows eligible count.

### FlipCard
Front: keyword + Book/Lesson/Heisig#. Prompt to think, then reveal button.
Back: large CJK glyph, component chips (with 💠 primitive name pattern), mnemonic story (with `[[...]]` rendered via `storyToHtml`), ✗ Missed / ✓ Got it buttons.
Marking "Got it" also sets `isMastered = true` via `onToggleMastered`.

### SessionSummary
Score percentage, correct/total, per-card list with ✓/✗ marks. New Session / Back buttons.

---

## `src/components/GraphView.jsx`

Canvas-based force-directed graph. No SVG, no React re-renders during physics.

### Physics constants

```js
const REPULSION        = 1600
const REPULSION_CUT    = 80     // px cutoff radius
const SPRING_K         = 0.06
const SPRING_LEN       = 80
const CENTER_K         = 0.016
const VELOCITY_DECAY   = 0.38
const MAX_V            = 12
const ALPHA_INIT       = 1.0
const ALPHA_DECAY      = 0.0228
const ALPHA_MIN        = 0.001
const GRAPH_NODE_LIMIT = 500
```

### Initial placement

Fibonacci spiral: `r = min(W,H)*0.44 * sqrt((i+0.5)/N)`, `theta = i * golden` where `golden = π*(3−√5)`. Small random jitter to prevent zero-length edges.

### Spatial grid (tick-level optimisation)

Each tick, build a grid with `cellSize = REPULSION_CUT`. Each node checks only its own cell + 8 neighbours. Combined with the 80px cutoff this gives ~35× fewer pair checks vs. naïve O(n²). Self-cell pairs are checked with `i < j` to avoid double-counting.

### Physics tick

Per tick:
1. Repulsion via spatial grid
2. Spring attraction along edges (`SPRING_K * (dist − SPRING_LEN)`)
3. Centering force (`CENTER_K`) pulling all nodes toward canvas centre
4. Velocity decay, velocity cap (`MAX_V`), position update
5. Alpha decay; stop when `alpha < ALPHA_MIN`

### Canvas draw (`drawFrame`)

Pure function — no React state access. Uses a DPR-aware context (`ctx.scale(dpr, dpr)`), then applies pan/zoom transform before drawing.

Draw order:
1. Edges (lines with arrowheads toward target node's edge)
2. Nodes: circles with type-colour fill/stroke + CJK glyph or 2-char abbreviation
3. Hover/select label tooltip

Two display modes (toggled via control bar):
- **Circles mode**: filled circle + glyph inside
- **Glyph-only mode**: large glyph, no circle

Selected/hovered nodes: selection ring, brighter stroke. Non-connected nodes: dimmed (`globalAlpha = 0.18`).

Node radius: `10 + min(usedByCount * 4, 18)` × nodeScale slider.

### Interaction

**Pan**: mouse drag on background. `newPan = startPan + mouseDelta` (no zoom scaling in the drag delta).

**Node drag**: `dx = mouseDelta / zoom` applied to physics node position; node pinned while dragging.

**Zoom towards cursor**: non-passive wheel listener (`addEventListener('wheel', handler, { passive: false })`). On each wheel event, capture `zoomOriginRef` (canvas cursor position) and `worldOriginRef` (world-space point under cursor). `animateZoom` lerps zoom and adjusts pan each frame to keep the world point fixed under the cursor.

**Coordinate system**: pan/zoom in CSS pixel space. `getCanvasXY` returns raw `e.clientX − rect.left` (no scaling).

**Node hit-test**: iterate `physRef.current.nodes` on `mousedown`, find closest within radius. O(n) but only on click.

### ResizeObserver

Watch the wrapper div. On resize: `syncSize()` updates the canvas pixel buffer (width/height attributes × DPR), then if `fitAfterResizeRef` is set, run `fitView()`. No inline `style.width/height` on the canvas — let CSS control display size.

### Fullscreen

`document.addEventListener('fullscreenchange', ...)` — set `fitAfterResizeRef = true` so `fitView` fires after the canvas has been resized to fill the screen.

CSS:
```css
.graph-wrap:fullscreen {
  position: fixed !important;
  inset: 0;
  z-index: 9999;
  border-radius: 0 !important;
  border: none !important;
}
```

### Control bar (Obsidian-style)

Bottom-right overlay: zoom in/out buttons, fit-all button, fullscreen toggle, circles/glyph toggle, node size slider.

### Info panel

When a node is selected (click), show a panel (top-right overlay) with: glyph, name, primitive keywords, Book/Lesson/Heisig# metadata, story excerpt, components chips, used-by chips. Edit button opens the editor for that entry. Close button (×) deselects.

### Node cap

Default cap: 500 nodes (most-linked first). If the library exceeds this, show a banner: "Showing 500 of N entries. [Show all]". "Show all" button removes the cap.

---

## `src/App.css`

Single dark-theme stylesheet.

### CSS variables (`:root`)

```css
--bg: #0f172a;
--surface: #1e293b;
--surface-raised: #263246;
--border: #334155;
--border-light: #475569;
--text: #f1f5f9;
--text-muted: #94a3b8;
--text-dim: #64748b;
--primitive: #7c3aed;
--primitive-light: #a78bfa;
--primitive-bg: #1e1433;
--dual: #0d9488;
--dual-light: #2dd4bf;
--dual-bg: #0a1f1e;
--character: #1d4ed8;
--character-light: #60a5fa;
--character-bg: #0f1c3a;
--success: #22c55e;
--fail: #ef4444;
--warning: #f59e0b;
--mastered: #fbbf24;
--radius: 8px;
--radius-lg: 12px;
```

### Key classes

- `.entry-card-primitive/dual/character` — coloured left border + tinted background
- `.type-badge-*` / `.type-pill-*` — small type labels
- `.comp-tag-*` — component chips in library/review
- `.comp-chip-*` — component chips in the editor picker (larger, clickable)
- `.prim-kw-field` / `.prim-kw-chip` / `.prim-kw-draft` — primitive keyword tag input
- `.story-field-wrap` / `.story-mirror` / `.story-textarea` / `.story-mention-chip` — story overlay
- `.story-mention-dropdown` / `.story-mention-opt` — autocomplete dropdown
- `.graph-wrap` (`height: 540px`) / `.graph-canvas` (`width:100%; height:100%`)
- `.graph-controls` — bottom-right Obsidian-style control bar
- `.graph-info` — top-right info panel overlay
- `.graph-cap-banner` — node-limit warning banner

Performance: `content-visibility: auto; contain-intrinsic-size: auto 100px` on `.item-list > *`.

Custom scrollbar: thin (6px), transparent track.

---

## `tools/vault-to-radix/index.js`

Zero-dependency Node.js CLI. Converts an Obsidian vault of Heisig notes into `radix_library.json`.

```
node index.js <vault-path> [output.json]
```

### File naming convention

- `"45 刀 Sword.md"` → heisigNumber=45, character=刀, keyword=Sword
- `"人 Person.md"` → character=人, keyword=Person
- `"Walking Legs.md"` → pure primitive (no glyph, no Heisig number)

### Frontmatter conventions

```yaml
aliases:
  - 💠 Person          # → primitiveKeyword "Person"
  - 💠 Human Figure    # → primitiveKeyword "Human Figure"
book: 1
lesson: 5
mastered: true
```

Aliases prefixed with 💠 become `primitiveKeywords`. Non-💠 aliases are ignored.

### Two-pass processing

**Pass 1** — parse each `.md` file: extract frontmatter (custom minimal YAML parser — no `gray-matter` dependency), parse filename stem, collect `[[wikilink]]` targets from body text.

**Pass 2** — build a lookup map (keyword / character / heisig# / primitiveKeyword / full stem → id), then resolve each entry's wiki-link targets to `componentIds`. Unresolved links are silently skipped.

Story text is cleaned: headings, bullets, `[[links]]` (→ plain text), markdown formatting stripped. Stored as plain text.

---

## 💠 Emoji Convention

Use 💠 throughout the UI to represent "primitive" or "primitive use of a character":
- Type labels: `💠 Primitive`, `💠 Dual`
- Primitive keyword display: `💠 person · human`
- Component chips: `💠 {primitiveKeywords[0]}` when the component has primitive keywords
- Stats: `💠 N Primitives`, `💠 N Dual`
- Filter tabs: `💠 Primitives`, `💠 Dual`
- Form label: `💠 Primitive Keywords`

---

## Performance Requirements

Target: instantaneous feel for up to 3000 entries.

| Technique | Where |
|-----------|-------|
| `entryMap` (Map<id,entry>) | App.jsx — passed to all children, replaces all `.find()` calls |
| `usedByMap` (Map<id,id[]>) | App.jsx — O(1) reverse lookup for delete guard + graph |
| `React.memo` on EntryCard | LibraryView.jsx |
| `useDeferredValue` on filtered list | LibraryView.jsx |
| `content-visibility: auto` on list items | App.css |
| Canvas draw (no React reconciliation during physics) | GraphView.jsx |
| Spatial grid + 80px repulsion cutoff | GraphView.jsx physics |
| 500-node cap (most-linked first) | GraphView.jsx |

---

## Story `[[name]]` Mentions

Stories can contain `[[name]]` references. These are:
- Rendered as underlined blue text in the editor (overlay mirror technique), library cards, and review flip cards
- Autocompleted: typing `[[` in the story field opens a dropdown searching the library
- Stored as raw `[[name]]` strings in the `story` field — no ID resolution at storage time
