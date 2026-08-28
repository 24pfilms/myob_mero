# Mero × MyOb Integration Plan

## Outcome

Ship one local-first application where Mero remains the authenticated React canvas and Express remains the only browser-facing API, while MyOb runs as a loopback-only Python service for notes, imports, search, AI, and durable note storage. Preserve Mero’s dark infinite-canvas identity; integrate MyOb as native canvas workflows rather than embedding its standalone frontend.

## Scope and Defaults

- Implement the PRD through Phase 5 in ordered, independently verifiable milestones; do not migrate or re-embed real notes until backups and the OpenAI credential gate pass.
- Keep Mero’s existing top and bottom toolbars. Add a **Notes** tool to the bottom toolbar and reuse the existing AI control with an explicit **Canvas / Notes** scope toggle.
- Open the note finder as a bottom drawer; double-click opens a resizable editor drawer. Deleting a `NOTE_CARD` removes only the canvas reference, never the underlying note.
- Update every visible card for a note after save. Keep related-note ribbons off by default and expose them as a view preference.
- Treat Mero accounts as separate tenants. MyOb rows receive an immutable Mero `user_uuid`; Express passes that identity plus an ephemeral internal service token to FastAPI.
- Store attachments as content-addressed files under a configurable local data directory; keep database metadata and note references, not new base64 blobs.
- Preserve the standalone MyOb frontend as a diagnostic client, but Mero is the shipped host UI.

## Architecture

### Browser → Express

Create `Mero/services/myobApi.ts` as the only notes client. It calls authenticated `/api/myob/*` routes using the existing Mero bearer token and exposes typed note, folder, similarity, import, chat, and suggestion contracts. It never receives OpenAI credentials.

### Express → FastAPI

Add `Mero/server/routes/myob.js` and a small allowlisted proxy service. The proxy:

- requires `authenticateToken` before every route;
- allows only declared MyOb paths/methods rather than accepting an arbitrary upstream URL;
- sets `X-Mero-User-Id`, `X-Mero-Service-Token`, request ID, and the server-decrypted AI credential;
- strips browser authorization, cookies, hop-by-hop headers, and upstream internals;
- applies body limits, timeouts, normalized 401/429/5xx errors, and one refresh/retry only when a verified refresh-capable credential exists;
- never logs credential headers or response bodies containing secrets.

### FastAPI trust boundary

Change `MyOb/backend/runner.py` to default to `127.0.0.1:8001`. Add middleware/dependencies under `MyOb/backend/security.py` that compare the internal service token in constant time, validate the Mero UUID, and expose a request-scoped tenant/AI credential. All data-layer queries filter by tenant; AI code reads credentials only from request/job context. CORS is removed from the normal Mero path and remains opt-in for standalone development.

### Credentials

Replace Mero’s fallback JWT/encryption secrets with fail-closed startup validation. Add versioned Mero migrations for immutable user UUIDs and provider credentials encrypted with AES-256-GCM (random nonce and authentication tag), while retaining backward read support for existing Gemini ciphertext until it is explicitly re-saved. New endpoints expose credential status and verification—not plaintext secrets.

The repository contains no OpenAI OAuth handoff implementation. Current official OpenAI documentation supports standard API keys and workload-identity access tokens; it does not establish the refresh-token contract assumed by the PRD. Therefore the credential adapter will support `api_key` immediately and a typed `refreshable_token` provider only after its real handoff/refresh contract is supplied and proven against `POST /v1/embeddings`. No token shape will be guessed.

## Data Safety

### Versioned migrations

- Replace Mero’s ad-hoc `ALTER TABLE` logic in `Mero/server/config/database.js` with ordered SQL files and a transactional `schema_migrations` table; keep fresh-schema creation compatible.
- Add a checked-in MyOb migration runner and ordered SQL migrations under `MyOb/backend/migrations/`; stop relying on `Base.metadata.create_all()` for changes to existing databases.
- Enable SQLite `WAL`, `busy_timeout`, and `foreign_keys` on every connection in both services.
- Rebuild MyOb user-owned tables with `owner_id` in their keys/constraints where required; migrate legacy rows only through an explicit `--legacy-owner <user_uuid>` command.
- Add `note_versions`, attachment metadata, embedding model/dimension/status, job checkpoints, and uniqueness/foreign-key constraints. Note saves write the new note version and current note atomically.

### Backup and restore

Add backup/restore commands that use SQLite’s online backup API (never copy a live database), include attachments, produce a manifest with hashes, and restore only into a separate target by default. Before any real migration:

1. inventory row/file counts;
2. create a timestamped backup outside the live data directory;
3. restore it into a separate verification directory;
4. verify row counts and hashes and record elapsed restore time;
5. only then apply migrations to a copy before touching the live database.

No real MyOb database exists in the cloned repository, so real-note backup, ownership assignment, migration, and restore verification remain an execution gate rather than a claim.

### Embeddings and attachments

Replace the OpenRouter chat-generated 256-number pseudo-embeddings and zero-vector fallback with the pinned OpenAI embeddings endpoint. Store model, dimensions, and status; reject mixed dimensions. Re-embedding runs in bounded, resumable batches with durable checkpoints, retries for 429/5xx, and explicit per-note failures—never silent zero vectors.

Base64-image migration decodes only allowlisted MIME types within byte limits, verifies content, writes temp→fsync→atomic rename using SHA-256 names, records metadata transactionally, creates a note version, and replaces markdown only after the file is durable. The job is idempotent and resumable; originals remain recoverable from note history and the verified backup.

## Backend Contracts

Refactor `MyOb/backend/app.py` incrementally rather than rewriting it:

- move static/nested routes before `/{note_id:path}` and `/{folder_id:path}` catch-alls, with route-resolution regression tests;
- add `GET /api/notes/{id}/similar?limit=5` and bounded `POST /api/notes/similarity-matrix` with deduplicated IDs and a hard maximum;
- tenant-scope note/folder CRUD, imports, videos, generated images, conversations, links, suggestions, and settings at the query layer;
- centralize OpenAI calls in a request-aware service with explicit timeouts, typed error mapping, request IDs, pinned configurable models, and no credential globals/import-time secret requirement;
- preserve successful note writes when asynchronous embedding refresh fails, but record `embedding_status=failed` and expose retry state;
- bound URL/file imports, validate protocols and resolved paths, block private-network URL fetches unless explicitly enabled for localhost development, and keep uploads within configured storage roots.

## Mero UI Integration

### Canvas model

Extend `Mero/types.ts` with `NOTE_CARD` and `NoteCardData` (`noteId`, title, tags, excerpt, updated timestamp, embedding state). Update `Mero/hooks/useBoard.ts`, board serialization, history, duplication, clipboard, and export code so note cards behave like first-class items without embedding full note content into every card.

### Components

- `Mero/components/NoteCard.tsx`: scale-aware title/excerpt/tags, explicit loading/error/stale states, semantic similarity emphasis, keyboard selection, and accessible labels.
- `Mero/components/NoteFinderDrawer.tsx`: debounced search, folder/tag filters, result virtualization or pagination, drag payloads, empty/error/offline states, and focus restoration.
- `Mero/components/NoteEditorPanel.tsx`: resizable bottom drawer, title/tags/content editing, sanitized markdown preview via `react-markdown` without raw HTML, dirty-state protection, version-aware saves, conflicts, and save/retry status.
- `Mero/components/RelatedNotesPanel.tsx`: top related notes with score context and drag-to-canvas.
- `Mero/components/AiAssistantModal.tsx`: Canvas/Notes scope, note citations, and explicit “AI unavailable” credential state.
- `Mero/components/Board.tsx` and `BoardItemComponent.tsx`: note drop handling, card rendering, selected-note context, and connector/heatmap layers behind normal items.
- `Mero/components/Toolbar.tsx` and `App.tsx`: Notes entry point, drawers, feature flags, and orchestration.

Replace the unsafe regex-to-HTML path in `ObsidianNoteComponent.tsx`; React-rendered markdown must escape raw HTML. Bundle Tailwind locally instead of loading its runtime CDN/import map, preserving the incumbent gray/purple/blue visual language and existing interaction model.

### Relationship visualization

`RelationshipLayer.tsx` requests only visible note IDs. Connector mode draws symmetric pairs once, uses cubic curves, ignores invalid/zero embeddings, and keeps `pointer-events:none`. Heatmap mode computes a coarse offscreen grid, applies Gaussian falloff, normalizes opacity, and redraws only when visible note IDs, positions, thresholds, or viewport settle—not on every pointermove. Both modes have legends, thresholds, reduced-motion behavior, and a disabled fallback.

## Dependency and Runtime Work

- Pin Node 22 for Mero’s `better-sqlite3@9.6.0` compatibility and add launcher/runtime preflight.
- Upgrade the direct vulnerable `jsPDF` dependency in both frontends to the audited fixed major, adjust API usage, and test representative export flows.
- Upgrade Mero server `multer` to the patched major and validate upload behavior.
- Add only necessary pinned dependencies: OpenAI Python SDK after confirming its current release/API, backend test/migration tooling, `react-markdown`/`remark-gfm`, and local Tailwind build tooling.
- Keep lockfiles updated; inspect lifecycle scripts before execution; run current dependency and secret scans without claiming they prove absence of defects.

## Unified Launcher

Replace Mero’s launcher internals with `Mero/scripts/start-all.ps1` called by `Mero/start.bat`. It validates Node 22, Python 3.12, required directories, secrets, ports, and dependencies; generates an ephemeral shared service token; starts FastAPI, Express, and Vite by exact PID; waits for health checks; opens the browser only after all are ready; and terminates only its own children on failure or exit. `MYOB_BACKEND_DIR` supports non-sibling layouts.

## Verification Gates

- **Unit/contract:** Node server auth, credential encryption, proxy allowlist/header stripping, tenant isolation, retry mapping; Python route order, tenant isolation, embeddings, similarity, migrations, backups/restores, note versions, and attachment migration; React hooks/components/API contracts and relationship geometry.
- **Build/static:** separate Mero and MyOb frontend tests, TypeScript checks, production builds; Mero server tests on Node 22; Python compile, lint/type check where configured, and backend tests on Python 3.12.
- **Data:** migration against seeded legacy databases, interrupted-job resume, online backup plus timed restore to a separate location, and before/after row/hash counts.
- **Security:** full-history secret scan, production dependency audits, unauthenticated/forged-tenant requests denied, FastAPI inaccessible beyond loopback, secret responses/logs absent, upload/path/URL boundaries exercised.
- **Performance:** 50 visible note cards, matrix size limit, pan/zoom interaction sampling, backend p95 timings for CRUD/search, and bundle/chunk review; lazy-load editor/AI surfaces.
- **UI:** one bounded desktop/mobile screenshot pass of auth, canvas, finder, editor, relationship modes, empty/loading/error states; batch-fix defects, then one confirmation pass. Keyboard navigation, focus management, contrast, reduced motion, and screen-reader labels are acceptance criteria.
- **E2E:** launcher starts all three services; register/login; find and drag a note; save and refresh all duplicate cards; undo/redo canvas actions without reverting note content; semantic connectors/heatmap; Notes-scoped AI with citations; graceful AI failure; clean shutdown.

## Risks and Hard Gates

- **OpenAI credential:** no usable credential or refresh contract exists in the repository. Live embeddings/chat and P0-6 require either a valid standard OpenAI API key or the exact existing handoff source/refresh contract. Until then, tests use injected fake clients and no real notes are re-embedded.
- **Real notes:** no `notes.db` or vault exists in the clone. The real database/vault path and target Mero owner must be identified before backup or migration. Migration tooling can be completed and proven on seeded copies first.
- **Scope size:** phases land sequentially; each gate must pass before the next phase. No UI polish will hide a failing auth, migration, or AI contract.
- **Compatibility:** existing `OBSIDIAN_NOTE` cards remain readable; migration to `NOTE_CARD` is additive and reversible.

## Steps

1. Record product/design context in `PRODUCT.md`, `DESIGN.md`, and an Operate-mode surface brief using the PRD and Mero’s incumbent visual system, with the defaults above.
2. Add runtime/version configuration and local Tailwind tooling to Mero, remove CDN/import-map dependencies, pin Node 22, and verify the unchanged baseline UI/build.
3. Replace Mero fallback JWT/encryption secrets with fail-closed configuration, AES-256-GCM credential storage, immutable user UUIDs, and versioned transactional SQLite migrations.
4. Enable SQLite WAL, busy timeout, and foreign keys in both services; add checked-in MyOb migrations, migration tests, and seeded legacy database fixtures.
5. Add online backup, separate-target restore, manifest/hash verification, and migration preflight commands; prove a timed restore on seeded Mero and MyOb databases.
6. Bind FastAPI to loopback, add internal service-token and tenant middleware, remove import-time credential globals, and add denial/route-resolution tests.
7. Tenant-scope every MyOb data query and write across notes, folders, imports, media, AI settings, conversations, links, suggestions, and generated images; migrate seeded legacy rows to a designated owner and prove cross-tenant isolation.
8. Reorder MyOb static/nested routes ahead of path catch-alls and add regression tests for note videos, note images, folder notes, and future similarity routes.
9. Implement the allowlisted authenticated Express→FastAPI proxy with identity/credential injection, header stripping, limits, timeouts, normalized errors, health checks, and proxy contract tests.
10. Implement and test the typed Mero `myobApi` client for notes, folders, imports, semantic endpoints, AI chat, suggestions, versions, and attachments.
11. Add the request-aware OpenAI provider abstraction and fake-client tests, then stop at the live credential gate to verify the real credential against `POST /v1/embeddings` before enabling AI or migration.
12. Replace pseudo-embeddings with validated OpenAI embeddings; add model/dimension/status metadata, similar-note and bounded matrix endpoints, resumable embedding jobs, and failure/retry tests.
13. Add note-version transactions, version retrieval/restore endpoints, and tests proving save/restore behavior and card-reference stability.
14. Extend Mero’s item model, persistence, clipboard, history, export, and renderer for additive `NOTE_CARD` support while preserving legacy `OBSIDIAN_NOTE` cards.
15. Build the Notes finder drawer, drag/drop creation, native note card, related-notes panel, and shared card refresh behavior with focused component and interaction tests.
16. Build the resizable note editor drawer with sanitized markdown, dirty/conflict states, tags, versions, keyboard/focus behavior, and save/retry tests.
17. Integrate Notes-scoped AI chat, citations, link suggestions, and explicit unavailable/rate-limit/error states without exposing credentials to the browser.
18. Implement connector and heatmap relationship layers with bounded visible-note requests, thresholds, legends, reduced-motion behavior, geometry tests, and redraw/performance guards.
19. Add content-addressed attachment storage and a resumable, idempotent base64-image migration with atomic writes, byte/MIME/path limits, note-version rollback, and seeded interruption tests.
20. Upgrade reachable vulnerable direct dependencies (`jsPDF`, `multer`) to audited fixed versions, adapt affected code, update lockfiles, and run representative export/upload tests plus dependency/secret scans.
21. Build the unified PowerShell launcher and batch wrapper with preflight, generated service token, readiness checks, browser launch, exact-PID cleanup, and startup/failure integration tests.
22. Run all unit, contract, migration, backup/restore, security, TypeScript, Python, production-build, launcher, and E2E gates; fix failures without weakening checks.
23. Run one bounded desktop/mobile visual and accessibility inspection across core and failure states, batch-fix all observed defects, then perform one confirmation pass.
24. Execute the verified backup→restore→migration→re-embedding workflow on the real notes only after the database path, owner mapping, and live OpenAI credential gates are satisfied; record counts, failures, checkpoint, RPO, and measured RTO.
