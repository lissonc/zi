# Story proposals

A loop for filling the library with stories without accepting anything unseen:

```
Radix ──request──▶ Claude Code ──proposals──▶ Radix ──you approve / reject──▶ library
  ▲                                                        │
  └──────────── rejections with reasons, approvals ◀───────┘
```

1. **Stories → Ask for a batch → Download request.** Choose lessons, which
   characters, and a batch size. You get `radix_story_request_<time>.json`.
2. **Give the file to Claude Code** in this repository, e.g.
   *“Write story proposals for `radix_story_request_….json`.”*
   It follows [`docs/story-guidelines.md`](../../docs/story-guidelines.md) and
   writes `radix_story_proposals_<batch>.json`.
3. **Stories → Import proposals**, then **Start reviewing**. One story at a
   time: **A** approve, **E** edit then approve, **R** reject (optionally with
   reasons and a note), **S** decide later, **Z** undo.

Approving writes the story into the entry and sets its components from the
story's links. Rejecting discards the story and remembers why; the character
comes back in the next request with that feedback attached.

Both files hold your library's keywords, so keep them out of the repository
(`radix_story_*.json` is git-ignored).

## Request file

```jsonc
{
  "format": "radix-story-request",
  "version": 1,
  "items": [
    {
      "id": "…",                  // entry id, echo it back
      "character": "明",
      "keyword": "bright",
      "primitiveMeanings": [],    // names it carries inside other stories
      "number": 20, "lesson": 2,
      "components": [             // what the library currently lists
        { "id": "…", "character": "日", "name": "sun", "otherNames": ["day"] }
      ],
      "rejectedBefore": [         // earlier attempts and why they failed
        { "story": "…", "reasons": ["Too abstract"], "note": "" }
      ]
    }
  ],
  "feedback": {
    "approvedExamples": [ { "character": "…", "keyword": "…", "story": "…", "editedFrom": "…" } ],
    "rejectionReasonCounts": { "Too long": 4 }
  },
  "vocabulary": [ ["<id>", "日", "sun", "day"] ]   // every entry: id, glyph, link name, other names
}
```

`components` can be incomplete or wrong. Check the character itself; any entry
in `vocabulary` may be linked.

## Proposals file

```jsonc
{
  "format": "radix-story-proposals",
  "version": 1,
  "batch": "batch-02",
  "proposals": [
    {
      "id": "…",
      "story": "The [[sun]] and the [[moon]] rise together and the night turns bright.",
      "componentIds": ["…", "…"]   // optional; otherwise derived from the links
    }
  ]
}
```

Links are `[[name]]` or `[[name|shown text]]`, where `name` is the third field
of the entry's `vocabulary` row. Proposals for unknown ids, empty stories, or
characters that already have a story are skipped on import and listed.

## When writing a batch

- Read `feedback` first. `editedFrom` shows how a story was changed before it
  was approved; rejection reasons show what to avoid.
- For an item with `rejectedBefore`, change the image, not the wording.
- One sentence per character, following the guidelines.
