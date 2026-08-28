# Mero × MyOb Product Context

## Product

Mero × MyOb is a Windows-first, local-first knowledge workspace. Mero remains the authenticated React host and infinite canvas. MyOb remains a loopback-only note service for durable notes, imports, semantic search, AI, and attachments. Express is the only browser-facing API.

## Audience and primary job

The primary user is an individual knowledge worker organizing a personal note vault on one machine. The product's single most important job is to turn durable notes into a spatial workspace where ideas can be found, opened, edited, compared, and connected without switching applications.

Frequent actions such as finding, placing, moving, and opening notes must be immediate. Note saves, restores, imports, attachment migration, and AI edits have a high error cost because they can affect durable source material.

## Product principles

1. **One front door.** Mero owns authentication, navigation, canvas interaction, and every browser request.
2. **Notes stay durable.** A canvas note card is a reference to a MyOb note, not another copy of its body. Removing a card never deletes its note.
3. **Spatial suggestions stay reversible.** Similarity, layout, and related-note features suggest arrangements; they never fight later manual placement.
4. **AI stays scoped and attributable.** The assistant explicitly operates on Canvas or Notes, cites note sources, exposes unavailable and failure states, and never receives credentials in the browser.
5. **Local-first does not mean trust-free.** Mero accounts are separate tenants. FastAPI accepts only authenticated internal requests from Express and binds to loopback by default.
6. **Recovery precedes migration.** Backups, separate-target restores, manifests, ownership assignment, and credential verification gate any work on real notes.

## Core workflows

- Authenticate, open a board, and continue spatial work.
- Open the Notes finder, search or filter the note vault, then drag a result to the canvas or use its non-drag placement action.
- Select or double-click a note card to inspect related notes or open the resizable editor drawer.
- Save a note once and refresh every visible card that references it without rewriting board history.
- Toggle semantic connectors or heatmap context without blocking normal canvas interaction.
- Ask the existing assistant about the Canvas or Notes and inspect note citations.
- Import bounded files or URLs and recover clearly from offline, rate-limit, credential, or partial-job failures.

## Scope

The integration delivers authenticated proxying, tenant-safe durable storage, migrations and backups, note and folder contracts, OpenAI-backed embeddings, first-class note cards, finder and editor drawers, scoped AI, relationship visualization, attachment migration, dependency hardening, and a unified launcher.

The standalone MyOb frontend remains a diagnostic client. It is not embedded in Mero and is not the shipped host UI.

## Explicit non-goals

- Rewriting either backend into the other runtime.
- Sharing one SQLite database between services.
- Storing full note content inside every canvas card.
- Guessing an OpenAI refresh-token or OAuth contract.
- Migrating or re-embedding real notes before backup, owner, and live credential gates pass.
- Persistent auto-layout that continuously moves user-positioned cards.
- Live Obsidian vault synchronization.

## Success signals

- A user can authenticate, find a note, place it, edit it, restart the application, and recover the same note and card position.
- Duplicate cards for one note refresh after a successful save.
- Undo and redo affect the canvas reference but never revert durable note content.
- Semantic relationships produce useful context while remaining optional and interaction-safe.
- A failed AI or embedding request preserves successful note writes and exposes retry state.
- Backup restore verification records matching counts and hashes before any real migration.

## Hard gates

- Live AI remains disabled until a valid OpenAI credential succeeds against `POST /v1/embeddings`.
- Real-note migration remains disabled until the database or vault path, immutable Mero owner UUID, verified external backup, separate restore, counts, hashes, and measured restore time are known.
- Missing JWT, encryption, or internal service secrets fail startup rather than falling back to repository defaults.
