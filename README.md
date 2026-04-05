# Radix

A local-first web application for learning Chinese (Hanzi) and Japanese (Kanji) using the **imaginative memory method** — mnemonic encoding over rote repetition.

---

## The Method

Chinese and Japanese characters are built from recurring visual sub-elements. Rather than memorising strokes through repetition, the imaginative memory method assigns each sub-element a vivid, concrete meaning — a *primitive* — and then encodes every character as a short story woven from the meanings of its components.

### Why invented stories work better than real etymology

The stories are not etymologically accurate. That is the point.

Real etymologies are often opaque, contradictory, or require specialist knowledge to appreciate. An invented story that fits the *visual* shape of the character activates several memory systems simultaneously:

- **Episodic memory** — a story with characters, location, and action is stored far more durably than an isolated fact. The brain is a narrative machine; even a single absurd image is many times more memorable than a translation pair.
- **Spatial and visual memory** — decomposing a character into named parts forces active visual analysis of its structure. The story then anchors that structure in long-term memory.
- **Elaborative encoding** — the more connections a memory has to existing knowledge and imagery, the more retrieval paths exist. A false but vivid etymology creates dozens of such hooks; a simple translation pair creates one.
- **Generation effect** — writing or reading a story you authored is more memorable than reading one you were given, because the effort of composition deepens the encoding.

The false etymology is not a crutch to be discarded once the character is learned. It remains the retrieval cue forever. As long as the story reliably produces the correct keyword, the story has done its job.

---

## How to Use Radix

### 1. Set up your primitives

A **primitive** is any recurring visual element that will appear in stories — it may or may not correspond to an actual character. Create a primitive entry by leaving the *Keyword* field blank and filling in one or more *Primitive Keywords* instead. Give it a name that evokes the visual shape clearly.

Example primitives: `sun`, `tree`, `mountain`, `walking legs`, `sword`.

Primitives without a corresponding character have no glyph. That is fine — they still appear in the component picker and autocomplete.

### 2. Build character entries

A **character** entry has a *Keyword* — the single English meaning you want to recall when you see it. Fill in:

- **Character** — the glyph itself (e.g. `明`)
- **Keyword** — the meaning you will be tested on (e.g. `Bright`)
- **Primitive Keywords** — only if this character also serves as a building block inside other characters' stories. The entry becomes a **dual** type.
- **Components** — select the entries whose meanings appear in the story. These create the graph edges and appear in review cards for reference.
- **Story** — the mnemonic. Type `[[` to search the library and insert a link to any entry. Linked entries are highlighted and shown as chips on review cards.

### 3. Write the story

The story should:
- Mention each component by its primitive name, enclosed in `[[double brackets]]`
- Place the components in a concrete scene with movement or absurdity
- End with the keyword, ideally as a consequence of the scene

> `[[Sun]] seen through a [[moon]] window — so **bright** you have to shield your eyes.`

Brevity is a virtue. A single vivid image beats a paragraph.

### 4. Review

Open the **Review** view and configure a session:

- **Random N** — a fixed-size batch drawn at random from the pool (default 20; adjust the number)
- **Infinite loop** — cycles through the pool indefinitely, reshuffling after each pass

On each card you see the keyword. Recall the story and the character, then press **Show Character** (or `Space`) to reveal. Mark **Got it** (`Y`) or **Missed** (`N`). Marking *Got it* sets the entry as mastered.

There is no spaced-repetition scheduler. A sufficiently vivid story makes an entry immediately reliable; the review session is for finding which stories need strengthening, not for managing a queue.

### 5. Strengthen weak entries

When a card is missed, return to the editor and rewrite the story. A missed card almost always means the story lacked a strong enough visual hook, or two similar stories are being confused. Change the imagery entirely rather than adding words.

---

## Keyboard Shortcuts

### Global

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+N` | New entry |
| `Ctrl+Shift+L` | Go to Library |
| `Ctrl+Shift+R` | Go to Review |
| `Ctrl+S` / `Cmd+S` | Download library |

### Library

| Shortcut | Action |
|---|---|
| `/` | Focus the search box |
| `Escape` | Clear search and blur |

### Editor

| Shortcut | Action |
|---|---|
| `Ctrl+S` / `Cmd+S` | Save entry |
| `Ctrl+Enter` | Save entry |
| `Escape` | Cancel (when autocomplete is closed) |
| `Alt+←` | Previous entry |
| `Alt+→` | Next entry |

Inside the story field, `[[` triggers the autocomplete dropdown:

| Key | Action |
|---|---|
| `↑` / `↓` | Navigate suggestions |
| `Enter` or `Tab` | Insert mention |
| `Escape` | Close dropdown |

### Review — flip card

| Shortcut | Action |
|---|---|
| `Space` or `Enter` | Reveal character |
| `Y` or `1` | Got it |
| `N` or `2` | Missed |
| `Escape` | End session |

### Review — config & summary

| Shortcut | Action |
|---|---|
| `Enter` | Start session / New session |
| `Escape` | Back to Library |

### Graph

| Shortcut | Action |
|---|---|
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `F` | Fit all nodes |
| `C` | Toggle circles |
| `K` | Toggle keywords |
| `E` | Edit selected node |
| `Escape` | Deselect node |

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
│   ├── hooks/
│   │   └── useKeyboard.js      # Shared keydown hook (skips inputs/textareas)
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
  bookNumber: number | null   // 1 or 2
  lessonNumber: number | null
  strokeCount: number | null
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

On every library change, state is serialised to `localStorage` under the key `radix_library`. On startup this data is restored automatically.

The **↓ Save** button downloads a timestamped `radix_library_YYYY-MM-DDTHH-MM-SS.json` — the canonical format for sharing and backup. The **↑ Load** button imports a previously saved file, replacing the current library after a confirmation prompt.

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

| Control | Action |
|---|---|
| Size slider | Scale all node radii |
| −/⊡/+ | Zoom out / fit all / zoom in |
| ◉ Circles | Toggle filled circles on/off |
| Aa Keywords | Show keyword text in nodes instead of character glyphs; hover reveals the character |
| ⛶ | Fullscreen |

Drag any node to reposition it; drag the background to pan; scroll or pinch to zoom (smooth lerp animation).

Click a node to open a panel showing its keyword, story, components, and which characters use it. Press `E` or click *Edit entry* to open the editor.

**Scale:** defaults to the 500 most-connected nodes when the library exceeds that count, with a "Show all N" override. The canvas pixel buffer is kept in sync with the container via `ResizeObserver`, so fullscreen and window-resize work correctly.

---

## Obsidian Vault Converter

`tools/vault-to-radix/index.js` is a zero-dependency Node.js CLI that converts a vault of Obsidian markdown files into the Radix JSON format.

```bash
node tools/vault-to-radix/index.js /path/to/vault output.json
```

**File conventions it understands:**
- Filename stem: `N character keyword` (e.g. `1 一 one.md`) or `character keyword` or bare `keyword`
- Frontmatter fields: `aliases`, `lesson`, `book`, `story`
- Component links: Obsidian `[[wikilinks]]` in the `story` field are resolved to `componentIds`
- Primitive indicators: aliases prefixed with 💠 become `primitiveKeywords`; a file with only 💠 aliases becomes a pure Primitive

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
