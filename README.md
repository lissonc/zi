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

### 4. Get story proposals and approve them one by one

The **Stories** view runs a loop that never puts a story in your library unseen:

1. **Ask for a batch.** Download a request file for the characters that still
   need a story (by lesson, by batch size, or only the ones you rejected).
2. **Have the stories written.** Give the file to Claude Code in this
   repository. It follows [`docs/story-guidelines.md`](docs/story-guidelines.md)
   and returns a proposals file.
3. **Import and review.** Each proposal is shown alone with its character and
   components. Approve it, edit it and approve, or reject it with an optional
   reason. Rejections and approvals are carried into the next request, so later
   batches follow your taste.

File formats and details: [`tools/stories/README.md`](tools/stories/README.md).

### 5. Review

Open the **Review** view and configure a session:

- **Random N** — a fixed-size batch drawn at random from the pool (default 20)
- **Infinite loop** — cycles through the pool indefinitely, reshuffling after each pass

- **Lessons** — the next lesson you have not finished, everything up to it, or a range
- **Direction** — keyword → character, or character → keyword
- **Bring missed cards back** — a missed card returns a few cards later, until you get it

On each card recall the other side, then reveal it (`Space`, or tap the card) and
mark **Got it** (`Y`) or **Missed** (`N`); on a touch screen swipe right or left.
A card you get right the first time is marked as mastered; a card you miss loses
the mark.

There is no spaced-repetition scheduler. A sufficiently vivid story makes an entry
immediately reliable; the review session is for finding which stories need
strengthening, not for managing a queue.

### 6. Strengthen weak entries

When a card is missed, return to the editor and rewrite the story. A missed card
almost always means the story lacked a strong enough visual hook, or two similar
stories are being confused. Change the imagery entirely rather than adding words.

---

## Keyboard Shortcuts

### Global

| Shortcut | Action |
|---|---|
| `Ctrl+Shift+L` / `G` / `S` / `R` | Library / Graph / Stories / Review |
| `Ctrl+Shift+N` | New entry |
| `Ctrl+S` / `Cmd+S` | Download library |

### Library

| Shortcut | Action |
|---|---|
| `/` | Focus the search box |
| `Escape` | Clear search and blur |

### Graph

| Shortcut | Action |
|---|---|
| `/` | Find a character and jump to it |
| `+` / `-` | Zoom in / out |
| `F` | Fit everything |
| `K` | Keywords instead of characters |
| `L` | Arrange in rows by level |
| `E` | Edit the selected entry |
| `Escape` | Close the panel, deselect, or leave a family / chain |

### Stories — reviewing proposals

| Shortcut | Action |
|---|---|
| `A` or `Enter` | Approve |
| `E` | Edit, then `Ctrl+Enter` to approve the edited text |
| `R` | Reject; `1`–`6` toggle reasons, `Enter` confirms |
| `S` or `→` | Decide later |
| `Z` or `←` | Undo the last decision |
| `Escape` | Cancel / leave the review |

### Editor

| Shortcut | Action |
|---|---|
| `Ctrl+S` / `Ctrl+Enter` | Save entry |
| `Escape` | Cancel (when autocomplete is closed) |
| `Alt+←` / `Alt+→` | Previous / next entry |
| `[[` in the story field | Link a component (`↑` `↓` to choose, `Enter` or `Tab` to insert) |

### Review — flash cards

| Shortcut | Action |
|---|---|
| `Space` or `Enter` | Reveal character |
| `Y`, `1` or `→` / `N`, `2` or `←` | Got it / Missed |
| `Escape` | End session |

---

## Stack

| Layer | Choice | Notes |
|---|---|---|
| UI framework | **React 18** | Functional components, hooks only |
| Build tool | **Vite 5** | Dev server + production bundler |
| Styling | **Plain CSS** (`src/App.css`) | Custom properties; light and dark theme, following the system unless set by hand |
| Graph | **Canvas 2D**, own engine | No graph library |
| Persistence | **Browser `localStorage`** + **JSON files** | No server, no database |

---

## Project Structure

```
src/
├── main.jsx
├── App.jsx                  # shell: which view is shown, global shortcuts
├── App.css                  # all styles and both themes
├── utils.js                 # entry helpers, story → HTML, file helpers
├── store/
│   ├── useLibrary.js        # entries, lookup maps, CRUD, load/save
│   ├── useStories.js        # pending proposals and decision history
│   └── useTheme.js          # system / light / dark
├── lib/
│   ├── stories.js           # request export, proposal import, link → component
│   └── graphAnalysis.js     # levels, families, build chains, groups, component check
├── graph/
│   └── engine.js            # simulation + canvas renderer (no React)
├── hooks/
│   ├── useKeyboard.js
│   └── useSwipe.js         # swipe to decide on touch screens
└── components/
    ├── Header.jsx           # tabs, load/save, theme toggle
    ├── WelcomeView.jsx
    ├── LibraryView.jsx      # search, filters, paged entry list
    ├── GraphView.jsx        # React wrapper around the engine, side panel
    ├── StoriesView.jsx      # request → import → one-by-one review
    ├── EditorView.jsx
    ├── ReviewView.jsx       # flash cards
    ├── CheckView.jsx        # characters whose components look wrong
    ├── ProgressView.jsx     # stories and mastery per lesson
    └── EntryChip.jsx
docs/story-guidelines.md     # what makes a good story
tools/stories/README.md      # request / proposals file formats
tools/vault-to-radix/        # CLI: Obsidian vault → Radix JSON
```

---

## Data Model

Everything is a single **Entry** type. The role of an entry is derived from its
fields at runtime — there is no stored `type` field.

```ts
interface Entry {
  id: string
  character: string           // the glyph (may be empty for abstract primitives)
  keyword: string             // standalone English meaning; empty → not a standalone character
  primitiveKeywords: string[] // names used when this entry appears inside another story
  componentIds: string[]      // entries this character is built from
  heisigNumber: number | null // position in the course
  bookNumber: number | null
  lessonNumber: number | null
  strokeCount: number | null
  story: string               // mnemonic; [[name]] / [[name|shown]] link components
  isMastered: boolean
  sourcePage?: number         // optional: page in your textbook
  sourceHasStory?: boolean    // optional: whether the textbook gives a story there
  componentsChecked?: boolean // optional: set by “Looks right” in Check components
}
```

| Condition | Type |
|---|---|
| `keyword` only | **Character** |
| `primitiveKeywords` only | **Primitive** |
| both | **Dual** |

Only entries with a `keyword` appear in review sessions and story requests. A
story that consists solely of links (`[[sun]] + [[moon]]`) is treated as a
placeholder, not as a story.

---

## Persistence

| `localStorage` key | Holds |
|---|---|
| `radix_library` | the entries (written shortly after each change) |
| `radix_stories` | proposals awaiting a decision, rejections with reasons, recent approvals |
| `radix_theme` | `system`, `light` or `dark` |

**↓ Save** downloads `radix_library_<time>.json`, the format for backup and
sharing. **↑ Load** replaces the current library after a confirmation. The
legacy two-collection format (`{ primitives[], characters[] }`) is migrated on load.

---

## Graph View

A force-directed graph of which characters are built from which, drawn on a
single `<canvas>` by `src/graph/engine.js`. It shows the whole library at once;
there is no node limit.

What keeps it smooth with thousands of entries:

- positions and velocities are typed arrays; a tick allocates nothing
- repulsion only looks at neighbouring cells of a spatial grid
- several ticks run per frame inside a time budget, so the layout settles in a
  second or two, then the loop stops until something changes
- nodes are copied from pre-rendered sprites (disc, ring and glyph), built a
  small tile at a time
- edges are stroked in screen coordinates in batches; everything outside the
  viewport is skipped
- React state is only touched when the selection changes, never per frame

Controls: drag the background to pan, scroll or pinch to zoom, drag a node to
move it, click a node for its story, components and uses. **Up to lesson**
limits the graph to what you have reached so far.

Ways to cut the graph down to something readable:

- **Levels** arranges everything in rows: entries built from nothing at the
  top, then entries built from those, and so on.
- **Show family** (on a selected entry, or from **Explore → Families**) shows
  only that component and everything built from it.
- **Show build chain** shows one character with everything it is built from,
  down to the simplest parts, one row per level.
- **Explore → Connections** lists the groups of entries that are not linked to
  the rest. For characters this usually means components are missing.

---

## Check components

**Library → Check components** lists characters whose components look wrong,
judged by stroke counts: none listed, too few strokes covered, or more strokes
than the character has. Add or remove components in place, or mark a character
“Looks right” to take it off the list (a component used twice, like 木 in 森,
is flagged too).

---

## Progress

The **Progress** view shows, per lesson, how many characters have a story and
how many are mastered, and marks the next lesson to work on. Click a lesson to
open it in the library.

---

## Obsidian Vault Converter

`tools/vault-to-radix/index.js` is a zero-dependency Node.js CLI that converts a
vault of Obsidian markdown files into the Radix JSON format.

```bash
node tools/vault-to-radix/index.js /path/to/vault output.json
```

- Filename stem: `N character keyword` (e.g. `1 一 one.md`), `character keyword`, or bare `keyword`
- Frontmatter fields: `aliases`, `lesson`, `book`, `story`
- `[[wikilinks]]` in the story are resolved to `componentIds`
- Aliases prefixed with 💠 become `primitiveKeywords`

---

## Running Locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs to dist/
npm run preview  # serves the production build
```

---

## Design Philosophy

- **No SRS.** Review order is random. A vivid story should hold without a schedule.
- **Nothing unseen.** Proposed stories enter the library only when you approve them.
- **Quiet interface.** Type and space carry the page; colour marks the three entry types and little else.
- **Local-first.** Everything runs in the browser. Data leaves it only when you download a file.
