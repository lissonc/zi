# Radix

A local-first web application for learning Chinese (Hanzi) and Japanese (Kanji) using the **Heisig Method** — mnemonic encoding over rote repetition.

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| UI framework | **React 18** | Functional components, hooks only |
| Build tool | **Vite 5** | Dev server + production bundler |
| Styling | **Plain CSS** (single file) | CSS custom properties for theming; no framework |
| Persistence | **Browser `localStorage`** + **JSON file export/import** | No server, no database |
| Runtime | Any modern browser | Zero backend required |

---

## Project Structure

```
/
├── index.html                  # Vite entry point
├── vite.config.js
├── package.json
├── README.md
├── src/
│   ├── main.jsx                # React root mount
│   ├── App.jsx                 # Top-level state, routing, all CRUD actions
│   ├── App.css                 # Global styles (dark theme, CSS variables)
│   ├── utils.js                # Shared helpers: entryType, entryDisplayName, migrateData
│   └── components/
│       ├── Header.jsx          # Top bar: nav, ↓ Save, ↑ Load
│       ├── WelcomeView.jsx     # Initial screen: upload or create new library
│       ├── LibraryView.jsx     # Searchable/filterable list + graph view toggle
│       ├── GraphView.jsx       # Force-directed canvas graph of character relationships
│       ├── EditorView.jsx      # Add/edit form for any entry type
│       └── ReviewView.jsx      # Flash-card review sessions
└── tools/
    └── vault-to-radix/
        └── index.js            # CLI: converts an Obsidian vault to Radix JSON
```

---

## Data Model

Everything is a single **Entry** type. The role of an entry is derived from its fields at runtime — there is no stored `type` field.

```ts
interface Entry {
  id: string                  // generated on creation
  character: string           // the Hanzi/Kanji glyph (can be empty for abstract primitives)
  keyword: string             // standalone English meaning; empty → not a standalone character
  primitiveKeywords: string[] // names used when this entry appears inside another character's story
  componentIds: string[]      // IDs of entries that compose this character
  heisigNumber: number | null
  bookNumber: number | null   // 1 or 2
  lessonNumber: number | null
  story: string               // mnemonic text
  isMastered: boolean
}
```

### Derived types

| Condition | Type | Card colour |
|---|---|---|
| `keyword` only | **Character** | Blue |
| `primitiveKeywords` only | **Primitive** | Violet |
| Both `keyword` + `primitiveKeywords` | **Dual** | Teal |

Only entries with a `keyword` (Character + Dual) appear in review sessions.

---

## Persistence

On every library change, state is serialised to `localStorage` under the key `radix_library` as `{ entries: Entry[] }`. On startup this data is restored automatically.

The **↓ Save** button in the header downloads `radix_library.json` — the canonical format for sharing and backup. The **↑ Load** button imports a previously saved file, replacing the current library after a confirmation prompt.

A migration function (`migrateData` in `utils.js`) handles the legacy two-collection format (`{ primitives[], characters[] }`) transparently on load.

---

## State Architecture

All application state lives in `App.jsx`. Child components receive data and callbacks as props — no context or external state library.

```
App (state owner)
├── currentView: 'welcome' | 'library' | 'editor' | 'review'
├── entries: Entry[]                        (source of truth)
├── entryMap: Map<id, Entry>                (derived; memoised)
├── usedByMap: Map<id, id[]>               (derived; memoised)
└── editingItem: Entry | null
```

`entryMap` and `usedByMap` are built once per `entries` change and passed down to all views. They give every component O(1) id-to-entry and reverse-dependency lookups without array scans.

View transitions are handled by setting `currentView`. The header is hidden during review to keep the interface distraction-free.

---

## Graph View

The library has a **⬡ Graph** toggle that renders a force-directed graph of component relationships using an HTML `<canvas>` element.

**Physics:**
- Coulomb-style repulsion with a spatial grid (80 px cell size) — only adjacent cells are compared, giving ~35× fewer pair calculations than a naïve O(n²) loop
- Hooke spring attraction along component edges
- Centre gravity to prevent drift
- Simulated annealing (alpha decay) for guaranteed convergence

**Controls:**
- Node size slider, zoom −/+/fit, circles on/off, fullscreen
- Drag any node to reposition; drag the background to pan; scroll or pinch to zoom (smooth lerp animation)
- Click a node to see its keyword, story, components, and which characters use it

**Scale:** defaults to the 500 most-connected nodes when the library exceeds that count, with a "Show all N" override. The canvas pixel buffer is kept in sync with the container via `ResizeObserver`, so fullscreen and window-resize work correctly.

---

## Obsidian Vault Converter

`tools/vault-to-radix/index.js` is a zero-dependency Node.js CLI that converts a vault of Obsidian markdown files into the Radix JSON format.

```bash
node tools/vault-to-radix/index.js /path/to/vault output.json
```

**File conventions it understands:**
- Filename stem: `N character keyword` (e.g. `1 一 one.md`) or `character keyword` or bare `keyword`
- Frontmatter fields: `aliases`, `heisig-number`, `lesson`, `book`, `story`
- Component links: Obsidian `[[wikilinks]]` in the `story` field are resolved to `componentIds`
- Primitive indicators: aliases prefixed with 💠 become `primitiveKeywords`; a file with only 💠 aliases and no Heisig number becomes a pure Primitive

---

## Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

```bash
npm run build   # outputs to dist/
npm run preview # serves the production build locally
```

---

## Design Philosophy

- **No SRS.** Review order is randomised each session. A sufficiently vivid story locks a character in without spaced repetition.
- **Hierarchy enforced visually.** Components of a character are shown inline in the library, the graph, and during review — the compositional logic is always visible.
- **Local-first.** The app works entirely offline. Your data never leaves the browser unless you explicitly download it.
