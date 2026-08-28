# PRD: Mero × MyOb — Semantic Canvas for Notes

**Version:** 0.3 (Draft — API surface synced, smoke tests added, credential verify-gate on P0-6)
**Owner:** Taylor (sole user, sole developer)
**Date:** August 2026
**Status:** For review

---

## 1. Summary

Merge MyOb (AI note system, FastAPI + SQLite + embeddings) and Mero (infinite canvas, React 19 + Express) into a single personal knowledge tool. **Mero is the host application.** MyOb's FastAPI backend survives as the note + embedding service. The headline capability neither app has today: notes rendered as canvas items, auto-arranged and connected by semantic similarity — an editable, spatial graph view of the note vault.

This is a personal tool. One user, one machine, Windows-first. No multi-tenancy, no scaling, no collaborative features. Decisions below are biased toward "shortest path that doesn't create maintenance debt for future-me."

---

## 2. Problem

- Notes live in MyOb; visual/spatial thinking lives in Mero. Moving ideas between them means copy-paste.
- MyOb has embeddings for 103+ notes but only uses them for search ranking — the semantic structure is invisible.
- Mero already has an `ObsidianNotes` item type in its export path, but no live connection to real notes.
- Two React codebases, two backends, two AI provider integrations = double maintenance for one person.
- MyOb has a known bug (v3.3.0): base64 images don't render in markdown preview. Mero solved image handling properly (blob storage, real compositor).

## 3. Goals

1. **One app to open.** Mero's UI is the front door for both canvas work and note editing.
2. **Notes as first-class canvas items.** Drag a note from a sidebar onto the canvas; edit it in place or in a focused editor; changes persist to the MyOb database.
3. **Semantic canvas.** Auto-layout notes by embedding distance, draw similarity edges, cluster visually. Make the embeddings *visible*.
4. **Fix the image pipeline** by adopting Mero's blob-based approach for note images, retiring MyOb's base64-in-markdown embedding.
5. **Reduce to one frontend codebase.** MyOb's React frontend is eventually retired; its editor components migrate into Mero.

## 4. Non-Goals

- Rewriting the FastAPI backend in Node (or Express in Python). Both backends stay, at least through v1.
- Multi-user support beyond the existing single-account JWT.
- Mobile support.
- Real-time collaboration.
- Preserving MyOb's frontend long-term (it stays runnable during migration only).
- Obsidian *sync*. One-time import/export remains; live vault sync stays out of scope.

---

## 5. Architecture

### 5.1 Decision: Two backends, one frontend, Express proxies notes

```
┌─────────────────────────────────────────────┐
│  Mero Frontend (React 19, Vite, :3001)      │
│  - Canvas, boards, toolbar (existing)       │
│  - Note sidebar + editor (ported from MyOb) │
│  - Semantic layout engine (new)             │
└──────────────────┬──────────────────────────┘
                   │  single origin, JWT
┌──────────────────▼──────────────────────────┐
│  Express (:3000)                            │
│  - Auth, boards, canvas items, uploads      │
│  - NEW: /api/notes/* → proxy → FastAPI      │
└──────────────────┬──────────────────────────┘
                   │  localhost only
┌──────────────────▼──────────────────────────┐
│  FastAPI (:8000)  — note & AI service       │
│  - Note CRUD, semantic search, embeddings   │
│  - YouTube/URL/PDF import pipeline          │
│  - NEW: /similarity endpoints for canvas    │
└─────────────┬───────────────┬───────────────┘
        notes.db         canvas.db (Mero's SQLite)
```

**Why proxy through Express rather than the frontend calling :8000 directly:**
- One origin — no CORS config, no second base URL in the frontend.
- Mero's JWT gates everything; FastAPI can stay auth-naive and bind to `127.0.0.1` only.
- The frontend never needs to know there are two backends, which makes a future backend consolidation invisible to the UI.

**Cost accepted:** two processes forever (well, three with Vite in dev). `start.bat` already launches multiple processes; add one more line.

### 5.2 Databases stay separate

`notes.db` (MyOb) and Mero's server SQLite remain separate files. Canvas items of type `note` store only a `noteId` reference, never note content. This avoids the concurrent-write and sync-drift problems of sharing one file, and means deleting a board never touches notes.

**Referential integrity rule:** if a note is deleted in the note sidebar, any canvas items referencing it render as a tombstone ("note deleted") rather than breaking the board.

### 5.3 AI providers

Two providers, scoped by job:
- **OpenAI** (replaces OpenRouter in MyOb's role): embeddings via `text-embedding-3-small` (upgrade to `-large` only if similarity quality disappoints), note/URL-import summaries and cluster labels via a current GPT chat model.
- **Gemini** (existing Mero): image editing, image generation, Veo video, canvas AI assistant.

**Auth: OAuth handoff, not static keys.** The existing OAuth handoff setup is the credential source for OpenAI, **subject to the P0-6 verify-gate** (one curl call proving the token authenticates against `/v1/embeddings` before anything is built on it). It lives on the **Express side**, reusing Mero's already-built AES-256-CBC encrypted credential storage (`/auth/api-key` endpoints generalize to token + refresh-token storage). Express injects the current access token as an `X-OpenAI-Token` header on every proxied `/api/notes/*` request (full contract in §8). Consequences:

- FastAPI holds **zero secrets** — no `.env` key, nothing to rotate there. It uses whatever token arrives per-request.
- Token refresh logic exists in exactly one place (Express), with a single retry-on-401 path in the proxy.
- The `OPENROUTER_API_KEY` env var and OpenRouter client code in `ai.py` are deleted, not deprecated.

**This swap also resolves the v0.1 review's biggest flagged risk:** OpenRouter/Claude has no true embeddings API, so the existing vectors are of unknown provenance and quality. OpenAI's embedding endpoint is purpose-built, cheap (re-embedding ~100 notes costs well under a cent), and standard to integrate.

**Consequence:** all existing embeddings are invalid — vectors from different models are not comparable. Full re-embed is mandatory before any Phase 2 work (P0-6).

---

## 6. Feature Requirements

### Phase 0 — Plumbing (foundation, no visible features)

| ID | Requirement | Notes |
|----|-------------|-------|
| P0-1 | Express proxies `/api/notes/*` to FastAPI :8000 | Thin `http-proxy-middleware` or manual fetch passthrough; strip/ignore auth headers downstream |
| P0-2 | FastAPI binds to `127.0.0.1` only | It currently has no auth; must not be LAN-exposed |
| P0-3 | `start.bat` launches FastAPI + Express + Vite | Keep the [1/5]…[5/5] progress pattern; add health checks for both backends |
| P0-4 | FastAPI adds `GET /notes/{id}/similar?limit=N` | Returns note IDs + cosine scores; embeddings already exist |
| P0-5 | FastAPI adds `POST /notes/similarity-matrix` | Body: list of note IDs → pairwise scores. Needed for canvas layout without N² round trips |
| P0-6 | Wire OAuth handoff into Express; proxy injects `X-OpenAI-Token`; single retry-on-401 refresh path | **Verify-gate first:** before writing any code, prove the handoff's token works with one curl call to `POST /v1/embeddings`. OpenAI's standard API auth is key-based — an OAuth-issued token working there is an assumption, not a given. If it fails, fallback: the handoff exchanges for / stores a standard API key in the same encrypted store; rest of the architecture is unchanged |
| P0-7 | Rewrite `ai.py` for OpenAI SDK; re-embed entire vault with `text-embedding-3-small`; store `embedding_model` per note; delete OpenRouter code | One-command script; old vectors discarded |
| P0-8 | **Validation gate:** similarity spot-check on ~20 known notes — related pairs must score clearly above unrelated pairs | If this fails, Phase 2 is rescoped *before* any canvas work is built on top of it |

### Phase 1 — Notes on the canvas (MVP)

| ID | Requirement | Notes |
|----|-------------|-------|
| P1-1 | Note sidebar panel in Mero | Collapsible; folder tree ported from MyOb's `FileBrowser.tsx`; search box uses existing semantic search endpoint |
| P1-2 | Drag note from sidebar → canvas creates a `note` item | Item stores `noteId`, position, size. Card shows title + rendered markdown preview (truncated) |
| P1-3 | Double-click note item → focused editor | Port `EnhancedMarkdownEditor` (CodeMirror 6) into a Mero modal/panel. Split edit/preview modes carry over |
| P1-4 | Edits persist via `PUT /api/notes/{id}` | Auto-save with the same visual dirty-indicator pattern MyOb uses |
| P1-5 | Create new note from canvas | Toolbar item + voice command ("create a note card"); creates in MyOb DB, places on canvas |
| P1-6 | Note items participate in existing canvas machinery | Move, resize, z-order, multi-select, undo/redo, export via compositor — no special-casing |
| P1-7 | Same note on multiple boards | Allowed; it's a reference. Edits reflect everywhere on next load (live sync across boards not required in v1) |
| P1-8 | Tombstone rendering for deleted notes | See §5.2 |
| P1-9 | Note version snapshots | Before any save that changes a note body, write the previous body to `note_versions` (cap: last 20 per note). Protects against bad auto-saves or AI edits. v1 UI is just a "restore previous version" context action |

**Explicitly deferred from P1:** transclusion/backlinks between notes, editing note content inline on the tiny canvas card (double-click editor only — inline editing on a zoomable canvas is a rabbit hole).

### Phase 2 — Semantic canvas (the reason to do this)

| ID | Requirement | Notes |
|----|-------------|-------|
| P2-1 | "Arrange semantically" action on selected note items | Force-directed layout where spring length ∝ (1 − cosine similarity). Uses P0-5 matrix endpoint. Animated transition; **undoable as a single action** |
| P2-2 | Similarity edges | Toggleable overlay: lines between note items above a similarity threshold. Threshold slider (default ~0.75). Line opacity/weight maps to score |
| P2-3 | "Show related" on a note item | Context-menu action: fetches top-N similar notes (P0-4) and places them as new items in a ring around the source, with edges |
| P2-4 | Semantic clusters | Optional: k-means or threshold-based grouping; render cluster hulls as Mero frames with auto-labels (label = AI-summarized theme via the OpenAI chat integration) |
| P2-5 | Seed board from search | Type a query → semantic search → top N results placed on a fresh board, pre-arranged |

**Design constraint:** all semantic actions are *suggestions applied to the canvas*, then fully manual. The layout engine never fights the user — once arranged, items are ordinary movable items. No persistent "auto-layout mode."

### Phase 3 — Image pipeline unification + retirement of MyOb frontend

| ID | Requirement | Notes |
|----|-------------|-------|
| P3-1 | Note images stored as blobs, referenced by URL | New FastAPI table/endpoint (`/api/notes/images/{id}`) or reuse Mero's multer upload path — decide by whichever is less code. Markdown references become `![alt](/api/notes/images/{id})` |
| P3-2 | Migration script: extract existing base64 images from note bodies → blob store, rewrite markdown | Fixes the v3.3.0 rendering bug at the root instead of patching the preview renderer |
| P3-3 | Port remaining MyOb features worth keeping | Import Hotspot (Ctrl+Shift+I) incl. YouTube/GitHub/article/PDF import; bulk .txt URL import; image gallery |
| P3-4 | Retire MyOb frontend | Archive the repo; export/import scripts remain in the backend |

### Feature triage from existing apps

**Keep (already in host app):** everything Mero has — canvas, AI image edit/gen, voice commands, compositor export, boards/folders, auth.
**Port from MyOb:** editor, file browser, semantic search UI, Import Hotspot, command palette (merge with Mero's shortcuts), image gallery.
**Drop:** MyOb's session persistence (Mero has board memory), MyOb's standalone drag-drop import UI (fold into Mero's existing drag-drop), duplicate theme toggle.

---

## 7. Data Model Changes

### Mero (`types.ts`, canvas DB)

```ts
// New BoardItem variant
interface NoteItem extends BoardItemBase {
  type: 'note';
  noteId: string;        // UUID from MyOb notes.db
  displayMode: 'card' | 'title-only';
  // no content stored here — always fetched/cached by noteId
}

interface SemanticEdge {   // ephemeral or per-board persisted overlay
  sourceItemId: string;
  targetItemId: string;
  score: number;
}
```

### MyOb (FastAPI)

- Notes gain an `embedding_model` column (P0-7) so any future model swap is detectable rather than a silent quality regression.
- New `note_versions` table (P1-9): `id`, `note_id`, `body`, `saved_at`.
- New `note_images` table for blob storage (P3-1): `id`, `note_id`, `mime`, `data`, `created_at`.
- Similarity endpoints (P0-4/P0-5) compute from the re-embedded vectors; consider caching the matrix for the ~100-note scale (trivial) and revisit if the vault grows past ~5k notes.

---

## 8. API Surface (new/changed only)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/notes` | List notes + folder tree (proxied, exists) |
| GET/PUT/POST/DELETE | `/api/notes/{id}` | Note CRUD (proxied, exists) |
| POST | `/api/notes/search` | Semantic search (proxied, exists) |
| GET | `/api/notes/{id}/similar?limit=10` | **New** — top-N similar notes |
| POST | `/api/notes/similarity-matrix` | **New** — pairwise scores for a set of IDs |
| POST | `/api/notes/import-url` | Import Hotspot backend (proxied, exists) |
| GET | `/api/notes/{id}/versions` | **New (P1-9)** — list snapshots (id, saved_at, excerpt) |
| POST | `/api/notes/{id}/restore/{version_id}` | **New (P1-9)** — restore a snapshot (current body is itself snapshotted first) |
| POST | `/api/notes/images` / GET `/api/notes/images/{id}` | **New (P3)** — blob image store |

All routed through Express with JWT; FastAPI trusts localhost.

**Proxy header contract:** Express strips the client's `Authorization` header and attaches `X-OpenAI-Token: <current access token>` to every proxied request. FastAPI reads it only when a route needs an OpenAI call (embed, summarize, import) and never logs or persists it. On an OpenAI 401, FastAPI returns `502 {"reason": "openai_auth"}`; the proxy refreshes the token and retries once.

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| CodeMirror editor port drags in half of MyOb's component tree | P1 slips | Port editor + preview only; leave gallery/palette for P3. Timebox: if the editor fights Mero's styling for >2 sessions, embed it in an isolated panel with its own CSS scope |
| Force-directed layout feels bad at canvas scale | P2 loses its magic | Prototype with the existing D3 dependency on a throwaway board before wiring undo/persistence |
| Two backends drift (dependency rot in whichever is touched less) | Slow decay | Pin versions; `start.bat` health checks fail loudly; note in README which backend owns what |
| Stale note previews on canvas after editing elsewhere | Confusing UX | Refetch note content on board load + after editor close; add manual refresh on the item context menu. Good enough for one user |
| OpenAI deprecates the embedding model | Similarity breaks on next re-embed | `embedding_model` column + one-command re-embed script (P0-7) make a model swap a 5-minute job |
| OAuth token expiry mid-bulk-import breaks a long job | Partial imports | Proxy's retry-on-401 refresh path (P0-6); bulk importer treats per-URL failures as resumable, not fatal |
| Auto-save or AI edit silently corrupts a note body | Data loss with no recovery | `note_versions` snapshots (P1-9) + full markdown export before every migration |
| Base64 migration script corrupts notes | Data loss | Script writes to a copy of `notes.db`; keep original until verified. Export-to-markdown before running (tool exists) |

---

## 10. Milestones

Sequenced for a solo developer working in sessions; each milestone ends in a usable state.

1. **M0 — Plumbing** (Phase 0) — *est. 2–3 sessions.* Proxy, OAuth handoff wiring, OpenAI swap + full re-embed, similarity endpoints, unified `start.bat`. *Done when: Mero frontend fetches a note list through Express AND the similarity spot-check (P0-8) passes.*
2. **M1 — Notes on canvas** (P1-1…P1-4) — *est. 3–4 sessions; the CodeMirror port is the wildcard.* Sidebar, drag-to-place, editor modal, persistence. *Done when: a note can be placed, edited, and survives restart.*
3. **M2 — Full note item** (P1-5…P1-9) — *est. 1–2 sessions.* Creation, undo/export integration, tombstones, version snapshots. *Done when: note items are indistinguishable from native items in canvas behavior.*
4. **M3 — Semantic v1** (P2-1, P2-2) — *est. 2–3 sessions, prototype layout first.* Arrange + edges. *Done when: "arrange semantically" on 20 notes produces a layout that visibly groups related topics.*
5. **M4 — Semantic v2** (P2-3…P2-5) — *est. 2–3 sessions.*
6. **M5 — Images & consolidation** (Phase 3) — *est. 2–4 sessions.* Blob migration, Import Hotspot port, MyOb frontend archived.

Ship/stop checkpoint after **M3**: if the semantic layout isn't delightful with real notes, stop there — M1/M2 alone (one app, notes on canvas) already justify the merge.

### 10.1 Smoke-test checklist

Run after completing any milestone and after any session that touches plumbing. For a project worked in bursts weeks apart, this list is the memory. Five minutes, in order:

1. `start.bat` → both backends pass health checks, browser opens, login works.
2. Note list loads in the sidebar (proxy path alive end-to-end).
3. Open a note → edit one line → close → reopen → edit persisted; a new row exists in `note_versions` (post-M2).
4. Drag a note onto a board → move it → refresh page → item is where you left it.
5. Undo (Ctrl+Z) removes the placed item; redo restores it.
6. Semantic search returns sane results for a query you know the answer to.
7. Trigger one OpenAI-dependent action (e.g. "show related" or URL import) → completes without auth errors (proves token + refresh path).
8. Export the board to PNG → note cards render, no selection handles.
9. Delete a test note from the sidebar → its canvas item shows the tombstone, board doesn't error.
10. Kill and restart FastAPI only → frontend recovers on next note action (proxy surfaces a clean error, no white screen).

Any failure blocks calling the milestone done. Items 3, 7, and 10 are the ones most likely to rot silently.

---

## 11. Open Questions

1. **Note card rendering depth** — full markdown render on canvas cards (heavier, prettier) vs. plain-text excerpt (cheap)? Proposal: plain excerpt at zoom < 100%, rendered markdown when zoomed in past a threshold.
2. **Where does semantic search live in the UI** — sidebar search box only, or also merged into Mero's command surface / a global Ctrl+P palette?
3. **Voice command vocabulary** — extend Mero's parser with "create a note about X" that also triggers AI content generation, or keep voice creation content-free?
4. **Similarity edges persistence** — recompute per session (always fresh) or persist per board (stable but stale-able)? Proposal: recompute, it's ~100 notes.
5. **Two AI chat surfaces** — Mero's Gemini canvas assistant and MyOb's AI side panel overlap. Merge into one panel with a provider/context switch, or keep Gemini-only on canvas and route note-context questions through it via the proxy?
6. **Config consolidation** — currently three env files (`.env.local`, `server/.env`, `backend/.env`). With FastAPI now secret-free (P0-6), can this collapse to a single root `.env` read by Express + Vite only?

---

## 12. Success Criteria (personal-tool edition)

- I open one app in the morning instead of choosing between two.
- Placing 15–20 notes on a board and hitting "arrange semantically" surfaces at least one non-obvious connection per session.
- Zero instances of "which app has the newer version of this note."
- The image bug is gone because the architecture changed, not because the renderer got patched.
