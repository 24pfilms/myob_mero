# Journal Layer — Phase 1 Build Plan

Scope, from `PRD_Journal_Layer.md` line 676: migration 006, clients and projects, entry fields on note routes, Journal view with text capture, Work/Personal switch, name-match hints, word counts on save, first version of Export everything. No AI, no live-AI gate, no voice, no attachments work.

**Done when:** an entry typed in Mero saves with date, space and project in under 15 seconds, reappears on the correct day after a backend restart, shows a hint when it names an unassigned active project, and one button produces a zip containing every note and entry as markdown plus clients and projects as CSV.

## Decisions taken before building

These resolve ambiguities in the PRD. Each is a deliberate call, not an oversight.

1. **`jobs` table lands in 006, not phase 3.** The PRD lists `jobs` under the 006 table set (line 95) but line 687 says it "arrives in phase 3 for transcription". Phase 1 already needs a durable job row for the export progress bar. Building it once, in its final shape (`type`, `target_id`, `needs_signin`, `status`, `attempts`, `error`, `run_after`), avoids a throwaway `export_jobs` table and a rewrite in phase 3. Phase 3 then only adds a new `type` value.
2. **Validation lives in Pydantic, not SQLite CHECKs, for the `notes` columns.** SQLite cannot add a CHECK constraint with `ALTER TABLE ADD COLUMN`, and rebuilding `notes` would rewrite every row — which the PRD's own rule (line 147) forbids. New tables (`clients`, `projects`, `jobs`) get full CHECK constraints; the new `notes` columns are constrained by `Literal` types on the request models and by a single shared validator.
3. **`entry_date` is computed by the client, not the server.** The PRD wants the local calendar date with no late-night shift; the backend runs on `datetime.utcnow()` throughout. The Journal view sends `entry_date` explicitly. The server falls back to the UTC date only when the field is absent, and never rewrites a date the client sent.
4. **No client column on entries.** Client is reached through `projects.client_id`; `GET /api/entries?client_id=` joins. Matches PRD line 148.
5. **No `/api/settings/journal` in phase 1.** Every setting in that table (line 126) belongs to phases 3–6. Adding the endpoint now would ship an empty screen.
6. **Export runs in a thread with a `jobs` row, mirroring `update_embedding_async`** in `app.py:381` — same `run_with_request_context` pattern, same tenant scoping. No new concurrency machinery.
7. **The Journal view is a Mero panel**, built on the `NoteFinderDrawer` pattern (`Mero/components/NoteFinderDrawer.tsx`): a boolean in `App.tsx`, a `ToolButton` in `Toolbar.tsx`, data through `services/myobApi.ts`. Not a new route, not a new app.

## Backend — MyOb/backend

### Migration `migrations/006_journal_entries.sql`

Follows the `005_attachments.sql` shape: composite `(owner_id, id)` primary keys, composite foreign keys to `notes(owner_id, id)`, explicit indexes.

- `ALTER TABLE notes ADD COLUMN` for: `kind TEXT NOT NULL DEFAULT 'note'`, `entry_date DATE`, `space TEXT NOT NULL DEFAULT 'work'`, `project_id TEXT`, `assignment TEXT NOT NULL DEFAULT 'manual'`, `source TEXT NOT NULL DEFAULT 'text'`, `word_count INTEGER NOT NULL DEFAULT 0`, `extracted JSON`, `period_type TEXT`, `period_start DATE`.
- `ALTER TABLE note_versions ADD COLUMN space TEXT`, `project_id TEXT` (PRD line 139, so a restore brings assignment back).
- `CREATE TABLE clients` — `owner_id`, `id`, `name`, `archived INTEGER NOT NULL DEFAULT 0`, `created_at`; `PRIMARY KEY (owner_id, id)`; `UNIQUE (owner_id, name)`.
- `CREATE TABLE projects` — `owner_id`, `id`, `client_id` (nullable, FK to `clients(owner_id, id)`), `name`, `status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','done'))`, `stale_after_days INTEGER NOT NULL DEFAULT 7`, `created_at`; `UNIQUE (owner_id, name)`.
- `CREATE TABLE jobs` — full phase-3 column set per decision 1, with `CHECK (status IN ('pending','running','done','failed'))` and an index on `(owner_id, status, run_after)`.
- Indexes per PRD line 143: `(owner_id, kind, entry_date)`, `(owner_id, project_id, entry_date)`, and a **unique** index on `(owner_id, kind, period_type, period_start)` where `kind = 'summary'` (partial index, so it does not collide with the thousands of rows holding NULL period columns).
- No backfill, no content rewrite (PRD line 147).

### `database.py`

- Add the ten columns to `class Note`, and `space`/`project_id` to `class NoteVersion`.
- Add `class Client`, `class Project`, `class Job`, each inheriting `TenantOwned` so the existing `do_orm_execute` / `before_flush` tenant guards cover them with no extra code.

### `journal.py` (new, small)

Shared helpers, so no rule is implemented twice:

- `body_word_count(content)` — strips frontmatter with the already-installed `python-frontmatter`, then counts whitespace-separated tokens. Used by both create and update.
- `name_hints(db, note)` — case-insensitive, word-boundary match of the note body against active (`archived = 0`, `status != 'done'`) client and project names; skips the project already assigned; returns name, id, kind and the matching line as preview. Plain text, no AI (PRD line 182).
- `ENTRY_FIELDS` validation constants shared by the Pydantic models.

### `app.py` — routes

Entry fields on existing routes (PRD line 518):

- `NoteCreate` and `NoteUpdate` gain `kind`, `entry_date`, `space`, `project_id`, `source`, typed as `Literal[...]` where the PRD lists a fixed set. `create_note` and `update_note` set `word_count` on every save; `record_note_version` (`app.py:44`) copies `space` and `project_id`.
- The list route `GET /api/notes` (`app.py:87`) returns the entry fields in each row, so the Journal view needs no second call.

New routes, all registered **above** the `GET /api/notes/{note_id:path}` catch-all at `app.py:1803` (the ordering rule `test_route_order.py` already enforces):

- `GET /api/entries` — filters `from`, `to`, `space`, `project_id`, `client_id`, `assignment`; `client_id` joins `projects`. Ordered by `entry_date` then `created_at`.
- `GET /api/entries/{id}/hints` — one entry's name-match hints.
- `PUT /api/entries/{id}/assignment` — set `space` and `project_id`, mark `assignment = 'manual'`. This is also the "one tap assigns, and the change can be undone" path: the response returns the previous values so the client can send them straight back.
- `GET /api/projects/{id}/unlinked` — entries mentioning a project but not linked to it, each with its matching line.
- `GET, POST, PUT /api/clients` and `GET, POST, PUT /api/projects` — create, rename, archive only (PRD line 302).
- `POST /api/exports` — creates a `jobs` row with `type = 'export'`, starts the worker thread, returns the job id immediately.
- `GET /api/exports/{id}` — status, processed/total counts for the progress bar.

### `journal_export.py` (new)

- Writes a zip under `DATA_DIR/exports/` (never served over HTTP, never uploaded — PRD line 668).
- Layout: `work/entries/<year>/<entry_date>-<title>.md`, `work/notes/<title>.md`, the same under `personal/`, plus `tables/clients.csv` and `tables/projects.csv`. Work and personal stay separable (PRD line 668).
- Every markdown file carries frontmatter including the entry fields (PRD line 149).
- **Path safety:** note titles are attacker-influenced text used to build archive member names. Reuse and harden `sanitize_filename` from `export_markdown.py` — strip separators and drive letters, reject `.`/`..`, reject Windows reserved names (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`LPT9`), cap length, fall back to the note id when nothing usable remains, then de-duplicate with a counter. Member paths are assembled from sanitized segments only, never from raw titles.
- Updates the `jobs` row as it goes so the progress bar has real numbers; a failure sets `status = 'failed'` and `error` without losing an already-written partial zip.

### Fix while here

`export_markdown.py:113` and `:118` use `"\\n"` where `"\n"` is meant, so the existing CLI writes literal backslash-n into every exported file instead of newlines — the frontmatter block is one unreadable line. One-character fix, same feature area, covered by the new export test.

## Frontend — Mero

- `services/myobApi.ts` — add `listEntries`, `createEntry`, `updateAssignment`, `entryHints`, `listClients`, `listProjects`, `createClient`, `createProject`, `startExport`, `exportStatus`, with types matching the new responses. Follows the existing `listNotes` shape.
- `components/JournalPanel.tsx` (new) — today's entries at the top, capture box, date picker, Work/Personal switch, project select, hint chips with Assign and Undo, and an Export button with a progress bar. Built on the `NoteFinderDrawer` structure: focus management on open, `role="status"` for loading and errors, retry on failure, keyboard-reachable controls.
- `App.tsx` — `isJournalOpen` state beside `isNoteFinderOpen` (line 760), panel mounted in the same block, entries opening in the existing `NoteEditorPanel` so editing and canvas placement work unchanged.
- `components/Toolbar.tsx` — `onOpenJournal` prop and a `ToolButton` beside the existing Notes button (line 388).

## Mero server — the proxy gate

`Mero/server/routes/myob.js` refuses anything not in `ALLOWED`, so every new route needs an entry or the Journal view gets 404s:

- `['GET', /^\/entries(?:\/.*)?$/]`, `['PUT', /^\/entries\/[^/]+\/assignment$/]`
- `['GET', /^\/clients$/]`, `['POST', /^\/clients$/]`, `['PUT', /^\/clients\/[^/]+$/]`
- `['GET', /^\/projects(?:\/[^/]+\/unlinked)?$/]`, `['POST', /^\/projects$/]`, `['PUT', /^\/projects\/[^/]+$/]`
- `['POST', /^\/exports$/]`, `['GET', /^\/exports\/[^/]+$/]`

Patterns stay anchored and segment-bounded (`[^/]+`, not `.+`) so no new path lets a caller reach further than intended. None of these are AI paths, so none touch `AI_PATH` or the OAuth credential.

## Tests

New backend files, both named in the PRD test table:

- `test_journal_migration.py` — 006 applies to a copy of a populated database; existing notes are unchanged by hash; defaults land as `kind = 'note'` with NULL entry fields; re-running applies nothing.
- `test_export.py` — the zip holds every note and table row by count; work and personal land in separate folders; frontmatter parses; special characters, `..`, path separators and reserved names in titles produce safe member paths and no file escapes the export directory.

Extended existing files:

- `test_migrations.py:23` asserts `[2, 3, 4, 5]` and `:30` asserts the exact migration list — both break on 006 and must be updated.
- `test_route_order.py` — the new `/api/entries` and `/api/projects` routes must resolve ahead of the notes catch-all.
- `test_tenant_isolation.py` — a second owner sees none of the first owner's clients, projects, entries or export jobs.
- `Mero/server/test/myob-proxy.test.js` — the new allowlist entries pass and near-misses (`/entries/../notes`, `/projects/x/y`, `/exports`) do not.

`AGENTS.md` and `.github/workflows/ci.yml:56` both list the backend test files by name; both need the two new files added or CI will not run them.

## Risks

- **`test_migrations.py` hard-codes the migration list.** Forgetting it turns CI red at the first push.
- **Partial index syntax.** The unique summary-period index must be `WHERE kind = 'summary'`; without the predicate it collides across every note with NULL period columns.
- **Proxy timeout.** `myob.js:59` allows 15s for non-AI paths. `POST /api/exports` must return the job id immediately and never build the zip inline, or large vaults time out at the proxy.
- **Backups already cover the new tables.** `data_safety.py:36` enumerates tables from `sqlite_schema`, so `clients`, `projects` and `jobs` are picked up with no change — but a backup must still be run before applying 006 (PRD line 666).

## Verification

Run after implementation, from the repo root unless noted:

- `npm test --prefix Mero/server`
- `npm run test:geometry --prefix Mero`
- From `MyOb/backend`: `uv run python -m unittest` over the AGENTS.md list plus `test_journal_migration.py test_export.py`
- `npm test --prefix MyOb/My_Obsidian_FrontEnd-main`
- `npm run build --prefix Mero` and `npm run build --prefix MyOb/My_Obsidian_FrontEnd-main`
- Manual: type an entry, restart the backend, confirm it appears on the correct day; name an active project in an unassigned entry and confirm the hint, the assign and the undo; run an export and open the zip.

## Steps

1. Run `npm run data:backup --prefix Mero/server` and confirm the backup manifest before touching the schema.
2. Write `MyOb/backend/migrations/006_journal_entries.sql`: the ten `notes` columns, the two `note_versions` columns, the `clients`, `projects` and `jobs` tables, and the three indexes.
3. Update `MyOb/backend/test_migrations.py` for the new migration list, and add `MyOb/backend/test_journal_migration.py` asserting existing notes are unchanged by hash.
4. Add the new columns and the `Client`, `Project` and `Job` models to `MyOb/backend/database.py`.
5. Add `MyOb/backend/journal.py` with `body_word_count`, `name_hints` and the shared field constants.
6. Extend `NoteCreate`, `NoteUpdate`, `create_note`, `update_note`, `record_note_version` and `GET /api/notes` in `MyOb/backend/app.py` for the entry fields and word counts.
7. Add the clients and projects routes to `MyOb/backend/app.py`, above the notes catch-all.
8. Add `GET /api/entries`, `GET /api/entries/{id}/hints`, `PUT /api/entries/{id}/assignment` and `GET /api/projects/{id}/unlinked`.
9. Add `MyOb/backend/journal_export.py` with the hardened filename sanitizer, the zip layout and the CSV writers.
10. Add `POST /api/exports` and `GET /api/exports/{id}`, backed by a `jobs` row and a `run_with_request_context` worker thread.
11. Fix the literal `\\n` frontmatter bug in `MyOb/backend/export_markdown.py`.
12. Add `MyOb/backend/test_export.py` covering counts, folder split, frontmatter parsing and hostile titles; extend `test_route_order.py` and `test_tenant_isolation.py`.
13. Add the new route patterns to `ALLOWED` in `Mero/server/routes/myob.js` and extend `Mero/server/test/myob-proxy.test.js` with pass and near-miss cases.
14. Add the new API methods and types to `Mero/services/myobApi.ts`.
15. Build `Mero/components/JournalPanel.tsx` with capture, date picker, space switch, project select, hint chips and the export progress bar.
16. Wire the panel into `Mero/App.tsx` and add the toolbar button in `Mero/components/Toolbar.tsx`.
17. Add `test_journal_migration.py` and `test_export.py` to the backend test lists in `AGENTS.md` and `.github/workflows/ci.yml`.
18. Run the full verification list above and fix what fails.
