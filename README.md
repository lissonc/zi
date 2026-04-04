# Radix

A local-first web application for learning Chinese (Hanzi) and Japanese (Kanji) using the **Heisig Method** — mnemonic encoding over rote repetition.

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| UI framework | **React 18** | Functional components, hooks only |
| Build tool | **Vite 5** | Dev server + production bundler |
| Styling | **Plain CSS** (single file) | CSS custom properties for theming; no framework |
| Persistence | **Browser `localStorage`** + **JSON file download** | No server, no database |
| Runtime | Any modern browser | Zero backend required |

---

## Project Structure

```
/
├── index.html              # Vite entry point
├── vite.config.js
├── package.json
└── src/
    ├── main.jsx            # React root mount
    ├── App.jsx             # Top-level state, routing, all CRUD actions
    ├── App.css             # Global styles (dark theme, CSS variables)
    ├── utils.js            # Shared helpers: entryType, entryDisplayName, migrateData
    └── components/
        ├── Header.jsx      # Persistent top bar with nav + save button
        ├── WelcomeView.jsx # Initial screen: upload or create new library
        ├── LibraryView.jsx # Searchable/filterable list of all entries
        ├── EditorView.jsx  # Add/edit form for any entry type
        └── ReviewView.jsx  # Flash-card review sessions
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

On every library change, state is serialised to `localStorage` under the key `radix_library` as `{ entries: Entry[] }`. On startup, this data is restored automatically.

The **↓ Save** button in the header downloads `radix_library.json`, which is the canonical file format for sharing and backup. Uploading this file restores the full library.

A migration function (`migrateData` in `utils.js`) handles the legacy format (`{ primitives[], characters[] }`) that was used before entries were unified.

---

## State Architecture

All application state lives in `App.jsx`. Child components receive data and callbacks as props — there is no context or external state library.

```
App (state owner)
├── currentView: 'welcome' | 'library' | 'editor' | 'review'
├── entries: Entry[]
└── editingItem: Entry | null
```

View transitions are handled by setting `currentView`. The header is hidden during review sessions to keep the interface distraction-free.

---

## Running Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

To build for production:

```bash
npm run build   # outputs to dist/
npm run preview # serves the production build locally
```

---

## Design Philosophy (from the SRS)

- **No SRS.** Review order is randomised each session. A sufficiently vivid story locks a character in without spaced repetition.
- **Hierarchy enforced visually.** Components of a character are shown inline in both the library and during review, so the compositional logic is always visible.
- **Local-first.** The app works entirely offline. Your data never leaves the browser unless you explicitly download it.
