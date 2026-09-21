# PRD: Journal Layer for Mero × MyOb

Version date: 2026-09-21 · Solo developer, private use

## Summary

This PRD adds a journal layer to the existing Mero × MyOb workspace so one person can log work and personal entries by text, voice or image, then ask AI about any day, week, month or year.

The repo already stores notes, imports files, builds embeddings and runs AI chat with citations. It lacks four things a journal needs: entry fields (date, space, project, client), voice capture, a review cycle, and phone access.

The work is thirteen features in six phases. Each phase ships something usable on its own. No existing note is changed without a verified backup, as `PRODUCT.md` already requires.

## Goals and constraints

**Goals**

1. Log an entry in under 15 seconds from phone or desktop, by typing, speaking or attaching a file.
2. Every entry carries a date, a space (work or personal), and optional project and client. AI suggests project and space so phone capture needs no picking.
3. Ask questions limited by date range, space, project or client, and get answers with citations.
4. Ask questions about one note, a hand-picked set of notes, or a saved group, and get answers from those notes only.
5. Get daily, weekly, monthly and annual summaries without asking for them.
6. Be asked useful questions at each review level, with the answers kept as entries.
7. Set goals for each week, month and year, and end each period with a record of goals met and accomplishments.
8. Add your own notes to any weekly, monthly or annual report, and have them survive rebuilds.
9. See graphs of your writing and progress, each one switchable on or off.
10. See current status for each project and client on one page.
11. Keep a personal space for thoughts and learning, where lessons come back for review, and track mood, energy, health, sleep, light, activity and anything else you choose.
12. Keep personal entries out of any work output unless explicitly included.

**Non-goals**

- Multi-user features, sharing, or client-facing portals.
- Public hosting. The system stays on one Windows machine.
- Offline sync or conflict merging between devices.
- Native mobile apps.
- Automatic screen or activity tracking, hours or time tracking, and importing health data from phones, watches or health apps.
- Text to speech, until OrcaVoice has it.
- Phone reminders or push notifications.
- Replacing the canvas. The journal is a new surface beside it.
- Anything already listed as a non-goal in `PRODUCT.md`.

**Constraints**

- One developer, private use. Prefer the simplest option that works; skip admin screens and settings that a config file can cover.
- Express stays the only browser-facing API. FastAPI stays on loopback.
- All schema changes go through the existing migration runner. CI must stay green.
- AI provider keys and sign-in tokens stay server-side.

## Current state

Most of the storage, import and AI groundwork exists. The table lists what the journal can reuse and what each piece lacks. Read from the `myob_mero` repo on 21 Sep 2026.

| Area | Exists today | Gap for the journal |
| --- | --- | --- |
| Notes | `notes` table: title, content, tags, folder, created and updated dates, version history | No entry date, space, project or client |
| Attachments | `attachments` table with hash, MIME type and storage path (migration 005) | Images only; 10 MB limit in `Mero/server/routes/upload.js`; no audio |
| Imports | URLs, YouTube, GitHub, PDFs, `.md`, `.txt`, images, Obsidian vaults | No text read from images into search |
| Embeddings | Local model `BAAI/bge-small-en-v1.5`, 384 dimensions, status per note | None |
| Search | `GET /api/semantic-search` compares the query with every ready note | No date, space, project or client filter; no keyword search |
| AI chat | `POST /api/ai/chat` with citations; request holds `query`, `current_note_id`, history | No filter fields |
| Text AI sign-in | `Mero/server/services/openaiOAuth.js` (ggcoder OAuth flow) and `codex_provider.py` | Token only reaches FastAPI during a browser request |
| Voice | `useSpeechRecognition.ts` and `useVoiceCommands.ts` use the Web Speech API for canvas commands | No audio kept, weak on Firefox and iOS, not used for notes. Separately, the OrcaVoice tray app dictates into any focused text box on Windows through Groq Whisper |
| Scheduling | None | No summaries, no daily prompt |
| Proxy | `Mero/server/routes/myob.js` forwards all authenticated calls to FastAPI | New FastAPI routes need no Express route work, except upload limits |
| Access | Loopback only, Windows-first, no PWA manifest or service worker | Phone cannot reach it |
| Migrations | `migration_runner.py` with numbered SQL files, 001 to 005 | Next file is `006` |

## Data model changes

An entry is a note with extra fields, not a new table. This keeps versions, embeddings, attachments, canvas cards and chat citations working without change. Everything lands in migration `006_journal_entries.sql`, or in later numbered migrations as each phase arrives.

### New columns on `notes`

| Column | Type | Default | Purpose |
| --- | --- | --- | --- |
| `kind` | TEXT | `'note'` | `note`, `entry` or `summary` |
| `entry_date` | DATE | NULL | The day the entry is about. Defaults to the calendar date at the moment of saving, in local time, with no late-night shift. Editable by hand. Differs from `created_at` when logging late |
| `space` | TEXT | `'work'` | `work` or `personal` |
| `project_id` | TEXT | NULL | Link to `projects` |
| `assignment` | TEXT | `'manual'` | `manual`, `suggested` or `unsorted`. How space and project were set (F1) |
| `source` | TEXT | `'text'` | `text`, `voice`, `image`, `mixed`, `import`, `checkin` or `review` |
| `word_count` | INTEGER | 0 | Set on every save from the body text, not counting frontmatter or extracted image text. In migration 006 so counts build from day one (F12) |
| `extracted` | JSON | NULL | AI output: tasks done, decisions, blockers, next steps, learnings. Each item carries `edited` (true or false); blockers and next steps also carry `resolved_at` |
| `period_type` | TEXT | NULL | For summaries: `day`, `week`, `month` or `year` |
| `period_start` | DATE | NULL | For summaries: first day of the period |

### New tables

All tenant-owned, with the same `owner_id` pattern as existing tables.

| Table | Columns | Feature |
| --- | --- | --- |
| `clients` | `id`, `name`, `archived`, `created_at` | F6 |
| `projects` | `id`, `client_id` (NULL for own projects), `name`, `status` (`active`, `paused`, `done`), `stale_after_days` (default 7), `created_at` | F6 |
| `jobs` | `id`, `type` (`transcribe`, `image_text`, `extract`, `summary`, `review_questions`, `project_status`, `suggest_questions`, `quiz_item`, `export`), `target_id`, `needs_signin` (0 or 1), `status` (`pending`, `running`, `done`, `failed`), `attempts`, `error`, `run_after`, `created_at` | All |
| `learnings` | `id`, `note_id`, `text`, `space`, `origin` (`entry` or `manual`), `step` (0 to 3), `next_review` (DATE), `status` (`active`, `kept`, `dropped`), `question`, `answer` (both NULL unless quiz mode is on), `quiz` (default 1; 0 means never quiz), `created_at` | F8 |
| `note_groups` | `id`, `name`, `mode` (`fixed` or `live`), `definition` (JSON: note ids, or folder, tags and filters), `created_at` | F9 |
| `personas` | `id`, `name`, `instructions` (up to 10,000 characters), `default_scope` (JSON, NULL), `is_default`, `created_at` | F9 |
| `suggested_questions` | `id`, `scope_key`, `text`, `note_ids` (JSON), `angle` (`theme`, `connection`, `contradiction`, `gap`), `status` (`new`, `used`, `dismissed`), `created_at` | F9 |
| `goals` | `id`, `space`, `period_type` (`week`, `month`, `year`), `period_start`, `text`, `project_id`, `parent_goal_id`, `status` (`open`, `done`, `partial`, `not_done`, `dropped`), `carried_from_id`, `created_at`, `closed_at` | F10 |
| `accomplishments` | `id`, `note_id`, `entry_date`, `text`, `space`, `project_id`, `goal_id`, `starred`, `origin` (`ai` or `manual`), `created_at` | F10 |
| `report_notes` | `id`, `space`, `period_type`, `period_start`, `anchor_type` (NULL, `goal`, `accomplishment`, `project`, `graph`), `anchor_id`, `body`, `source` (`text` or `voice`), `embedding`, `created_at`, `updated_at` | F11 |
| `trackers` | `id`, `name`, `type` (`scale`, `number`, `yes_no`, `choice`, `duration`), `unit`, `choices` (JSON), `daily_mode` (`many`, `once`, `sum`), `sort_order`, `active`, `created_at` | F13 |
| `tracker_logs` | `id`, `tracker_id`, `log_date`, `logged_at`, `value_num`, `value_text`, `note`, `entry_id` (NULL), `origin` (`manual`, `suggested`, `confirmed`), `created_at`. Index on `(owner_id, tracker_id, log_date)` | F13 |
| `attachment_chunks` | `id`, `attachment_id`, `chunk_index`, `locator` (page number, or start time in seconds), `text`, `embedding`. One row per page or transcript segment, so search can point to the exact page or minute. `text` is also in the FTS5 index | F4 |
| `provider_usage` | `id`, `month`, `provider` (`groq`, `gemini`), `units`, `unit_type` (`audio_seconds`, `images`), `est_cost_usd`, `created_at`. Summed per month for the spend limit | AI providers |
| Express `sessions` | `id`, `user_uuid`, `device_name`, `trusted`, `last_used_at`, `expires_at`, `revoked_at`. Lives in the Mero database, since Express owns login | F7 |

`trackers` and `tracker_logs` have no `space` column by design: every tracker row is personal, and no work query may join to them.

### Changes to `attachments`

| Column | Details |
| --- | --- |
| `kind` | `audio`, `pdf`, `image`, `document` |
| `origin` | `recorded` or `dropped`. Only `recorded` audio is deleted after transcription |
| `status`, `error` | `pending`, `processing`, `ready`, `failed` |
| `part_index` | INTEGER, NULL. Order of 15-minute audio parts within one entry |

The existing unique rule on `(owner_id, note_id, sha256)` already prevents double attachment.

### Journal settings

Stored with the existing per-owner settings, read and written through `GET, PUT /api/settings/journal`.

| Setting | Default | Feature |
| --- | --- | --- |
| `personal_checkin_enabled` | off | F8 |
| `quiz_enabled` | off | F8 |
| `graphs` (JSON: master switch plus one flag per graph id) | all on | F12 |
| `trackers_read_from_entries` | on | F13 |
| `trackers_in_ai_reports` | on | F13 |
| `keep_dropped_audio` | on | F4 |

### Reuse of existing tables

- Review answers link to their summary through `note_links` with `link_type = 'review_of'`.
- Project suggestions reuse `ai_suggestions` with `suggestion_type = 'project'`.
- `note_versions` gains the same `space` and `project_id` columns so a restore brings them back.

### Indexes

`(owner_id, kind, entry_date)`, `(owner_id, project_id, entry_date)`, and `(owner_id, kind, period_type, period_start)` with a unique rule so each period has one summary. No stats table is needed: every graph is one grouped SQL query using these indexes.

### Rules

- Existing notes keep `kind = 'note'` and NULL entry fields. All current data is test data, so nothing is backfilled and no existing note gets an entry date. The migration adds columns only and rewrites no content, so it does not trigger the real-note migration gate. A backup with `data:backup` still runs first.
- Client is reached through the project. An entry has no direct client column.
- Entry fields are also written to the markdown frontmatter on export, so `export_markdown.py` output stays readable in Obsidian.

## Feature requirements

Thirteen features, F1 to F13. Each lists what to build and how to tell it is done.

### F1. Journal surface and quick capture

A new Journal view in Mero beside the canvas: today's entries at the top, a capture box, and a date picker to move between days.

- The capture box takes text, a Record button (F3) and an Attach button (F4).
- Space, project and date sit under the box. They default to the last values used; date defaults to today.
- Saving creates a note with `kind = 'entry'`. The title is generated from the first line or by AI.
- Entries open in the existing editor drawer and can be dragged to the canvas as note cards.
- Commands in the existing palette: New entry, New voice entry, Go to today.

**Mixed entries**

- One entry is one note with any number of attachments. The capture box can hold typed text, one or more recordings and one or more images before saving.
- Typed text is the body. Each transcript and each image's extracted text is added under its own heading in the same note as its job finishes.
- `source` is `mixed` when more than one input type is present. The entry is re-embedded after each job completes and shows Ready when all jobs are done.

**Auto-assign**

- If space or project were not picked by hand, AI suggests them from the entry text, using the list of active project and client names. This runs in the same call as extraction (F5).
- A confident suggestion is applied and marked `suggested`. The entry shows the project as a chip; one tap confirms or changes it.
- A weak suggestion leaves the entry `unsorted`. Unsorted entries collect in an inbox at the top of the Journal view.
- When unsure between work and personal, choose personal. Personal is the safe side because it is excluded from every client output.
- Work summaries and project pages read `manual` and `suggested` entries. Client update drafts read only `manual` and confirmed entries.
- Until phase 5 ships, entries use the last values picked.

**Name-match hints**

- A plain text check, with no AI, runs on every save. If an entry names an active project or client but is not assigned to it, the entry shows a hint: "Mentions Client X. Assign?" One tap assigns, and the change can be undone.
- The same check runs on a project page as "Entries that mention this project but are not linked", each with a preview of the matching line.
- This ships in phase 1, so assignment help exists before AI auto-assign arrives in phase 5. Afterwards it stays as a backup for anything the AI left unsorted.

Done when: an entry typed on desktop is saved with all fields in under 15 seconds and appears on the correct day after a restart.

### F2. Filtered search and chat

Search and AI chat accept the same filter set: `from`, `to`, `space`, `project_id`, `client_id`, `kind`.

- Filters run in SQL first. Similarity scoring runs only on the rows that pass.
- Add keyword search with SQLite FTS5 over title and content. Final ranking blends keyword and similarity scores.
- Chat reads plain date phrases ("last week", "in August") and turns them into `from` and `to` before searching. The chat panel shows the filters it applied, and they can be changed by hand.
- For ranges longer than 31 days, chat reads summaries (F5) first and opens entries only for detail.
- `space` defaults to `work` in chat. Personal entries are included only when the personal filter is on.

**Search modes and results**

- A switch in the search bar: Text finds exact words, best for names and terms; AI finds by meaning, best when the wording is forgotten. The last mode used is remembered. An empty result offers a one-tap retry in the other mode.
- Each result shows where it matched (title, body, transcript, extracted image text, attachment) with a preview of the matching line. Clicking jumps to that spot.
- Filter options list only values present in the current results, each with a count, so no filter leads to an empty list.
- Results can be multi-selected for bulk actions: tag, assign to a project, add to a saved group, or ask about them (F9).

Done when: "What did I do for Client X last month?" cites only that client's entries from that month, and a query over 5,000 notes returns in under 1 second on the dev machine.

### F3. Voice entries

Two paths, one provider. On the Windows desktop, OrcaVoice already dictates into any focused text box, so the capture box works with it today and needs no code. On the phone and in other browsers, the Journal records audio and the backend sends it to the same Groq Whisper endpoint OrcaVoice uses. Audio is deleted once the transcript is saved.

- **Desktop:** focus the capture box, press the OrcaVoice hotkey, speak. Text lands in the box. Entries saved this way get `source = 'text'`, since the journal cannot tell them from typing. OrcaVoice itself is not changed.
- **Browser recording:** capture with MediaRecorder. Accept `audio/webm` and `audio/mp4`, since Safari records mp4. Groq accepts both.
- Upload through Express to a new FastAPI route. Raise the upload limit to 25 MB per recorded part, which matches Groq's documented upload limit.
- Hold the audio in the `attachments` table, linked to the entry, until transcription succeeds.
- Transcribe in a new module, `stt_provider.py`: one multipart POST to `https://api.groq.com/openai/v1/audio/transcriptions` with model `whisper-large-v3-turbo`, the same endpoint, model and language settings OrcaVoice uses in `src-tauri/src/stt.rs`. Endpoint and model sit in config.
- The key comes from the `GROQ_API_KEY` environment variable on the server. OrcaVoice keeps its own copy in the Windows keyring; the two do not share storage.
- Transcription runs as a background job. The entry shows "Transcribing" and fills in when ready. If it fails, the audio stays and a Retry button appears.
- When the transcript is saved, the audio file and its attachment row are deleted.
- The raw transcript is saved as version 1 of the note. An optional cleanup step, modelled on OrcaVoice's Grammar mode, saves as version 2, so the original wording is never lost.
- The existing Web Speech hooks stay for canvas commands only.

**Long recordings**

- The recorder closes the current file and starts a new one every 15 minutes without stopping the session. Each part is a complete file well under Groq's 25 MB limit, including Safari's larger mp4 files, so no audio tool is needed on the server.
- Parts upload as they finish, are transcribed in order, and are joined into one transcript in one entry. A word may be clipped at a join; the join is marked in the raw transcript so it is easy to spot.
- An attached audio file over 25 MB is split on the server with `ffmpeg` if it is installed. If it is not, the entry is saved with the audio and a message asks for a smaller file.

Done when: a 2-minute recording made on a phone becomes a searchable entry within 60 seconds, and the audio file is gone from disk once the transcript is saved.

### F4. Image and file text, and drag and drop

Text inside images and files becomes searchable, and audio files, PDFs and other files can be dragged into any note.

- On image upload, a Gemini vision model, called through the AI Studio API with the key held server-side and the model name in config, returns the visible text and a one-paragraph description. Both are appended to the entry under an "Extracted" heading, then embedded.
- Extend `file_processor.py` to accept `.docx`, `.heic` and audio types beside the current image, PDF, CSV and text types.
- Extraction is a background job with the same failed and retry states as F3.

**Drag and drop into any note**

- Any note accepts dropped files, not only journal entries: in the editor drawer, on a note card on the canvas, and in the Journal capture box. Several files can be dropped at once, and mixed types are fine. On the phone, the Attach button does the same job, since phones have no drag and drop.
- Accepted: audio (`mp3`, `m4a`, `wav`, `webm`, `ogg`, `flac`), PDF, images, `.docx`, `.txt`, `.md`, `.csv`. Anything else is refused with a message naming the accepted types.
- In the editor, the file lands where it was dropped, as a chip showing name, type, size and status. Dropped on a canvas card or the capture box, it is added at the end of the note.
- **Audio:** the chip has a player. The file is transcribed through Groq, and the transcript is inserted under the chip as a collapsible block. Files over 25 MB are split as described in F3.
- **PDF:** the chip opens the PDF in Mero's existing viewer. Its text is extracted with the existing PDF code and indexed for search and chat under this note, but not pasted into the body, because a PDF can run to hundreds of pages. "Insert text into note" and "Summarize into note" are one-click actions on the chip. A scanned PDF with no text layer goes to Gemini for reading, from phase 6.
- **Dropped files are kept.** The delete-after-transcription rule in F3 applies only to audio recorded inside the journal. A dropped file is your document, so it stays attached until you remove it. One setting, `keep_dropped_audio`, can switch dropped audio to the same delete-after-transcription rule.
- Search and scoped chat (F2, F9) read attachment text. A result shows where it matched, for example "in contract.pdf, page 4" or "in call.m4a, 12:30", and opens at that spot.
- The note is saved first and files process afterwards, each with its own status and Retry. A failed file never blocks the note or the other files.
- The same file dropped twice on one note is detected by its hash and attached once.
- Size limits, set in config: PDF 100 MB, audio 200 MB, images 10 MB, other files 25 MB.
- The old import flow, which turns a PDF into a new note, stays as it is. Dropping a PDF on the library background still uses it; dropping on a note attaches.

Done when: a photo of a whiteboard is found by searching a word written on it, and a PDF dropped on a plain note is found by a word on its fourth page.

### F5. Review cycle

Summaries (also called reports) build on a schedule and are saved as notes with `kind = 'summary'`.

- Scheduling runs in the Express job runner described under AI providers, not inside FastAPI, because only Express holds the sign-in credential. On startup, find every missing period since the last summary and build it, so a machine that was off catches up.
- Daily builds from that day's entries. Weekly builds from dailies, monthly from weeklies, annual from monthlies.
- Each level has its own prompt file in the repo so wording can change without code changes.
- Work and personal summaries are separate notes. A work summary never reads personal entries.
- Extraction on save fills the `extracted` column (tasks done, decisions, blockers, next steps, learnings). Summaries read this column first and entry text second.
- A daily check-in shows in the Journal view after a set time (default 17:00): what moved, what is blocked, what is next. Answers save as an entry. There are no phone reminders; the check-in shows only inside the app.
- Editing an old entry marks its daily summary as outdated. A Rebuild button refreshes it and the levels above.

| Level | Built | Contents |
| --- | --- | --- |
| Daily | 23:30, or next startup | Done, decisions, blockers, next steps per project |
| Weekly | Monday 06:00, covering the Monday to Sunday before | Progress per project and client, slipped items |
| Monthly | 1st of the month | Progress by client, repeated blockers, learnings |
| Annual | 1 January | Themes, finished projects, skills gained, open threads |

**Review questions**

At every level above daily, the AI asks as well as summarizes.

- After a weekly, monthly or annual summary is built, the AI writes 3 to 5 questions drawn from that summary's content, not from a fixed list. Example: "Project X had the same blocker three weeks running. What would remove it?"
- The Journal view shows a Review card with the summary and its questions. Answers can be typed or spoken, and any question can be skipped.
- Answers save as one entry with `source = 'review'`, linked to the summary with `review_of`. The next level up reads these answers along with the summaries.
- Work and personal reviews are separate cards with separate questions. Personal review prompts come from F8.
- A review left unanswered for one full period closes without a reminder.

| Level | Question focus |
| --- | --- |
| Daily check-in | What moved, what is blocked, what is next |
| Weekly | Slipped items, repeated blockers, what to stop or start next week |
| Monthly | Where effort went by client against where it should go, lessons worth keeping |
| Annual | Themes, what to continue, what to drop, skills to build next year |

**Editing extracted items**

- Tasks done, decisions, blockers, next steps and learnings shown on an entry can be edited, added or removed directly, without touching the entry text.
- A hand-edited item is marked as edited. Re-running extraction on that entry keeps edited items and only refreshes the ones the AI wrote.
- A blocker or next step can be marked resolved. Resolved items drop out of project pages and later summaries.

Done when: after 8 days of entries, 8 daily summaries and 1 weekly summary exist, each citing its sources, with no manual step.

### F6. Project and client pages

One page per project and per client, built from entries.

- Simple create, rename and archive for clients and projects. No other admin screens.
- The project page shows: AI-written status, open blockers, next steps, last entry date, and a timeline of entries.
- The status block rebuilds when a new entry for the project is saved, at most once per hour.
- A project with no entries for `stale_after_days` gets a Stale badge in the Journal view.
- A "Draft client update" button writes a plain update for a chosen date range. It reads work entries only and is saved as a draft note, never sent anywhere.

Done when: opening a project page answers "where is this project?" without opening any entry.

### F7. Phone access

The phone reaches the PC over a private network. Nothing is opened to the internet.

- Install Tailscale on the PC and phone. Run `tailscale serve` to give Express an HTTPS address inside the tailnet. HTTPS is required because browsers block the microphone on plain HTTP.
- FastAPI stays on loopback. Express keeps its login.
- Add a web app manifest and icons so the Journal installs to the phone home screen.
- Add a `/capture` route: a single screen with the capture box, Record, Attach and the tracker strip (F13). It loads fast and hides the canvas.
- If the PC is unreachable, the capture screen says so and keeps the unsent text or audio in the browser until the next try. This is a holding queue only, not sync.

**Sessions**

- Signing in on the phone offers "Trust this device". A trusted device keeps a 30-day session that renews each time it is used, so daily use never asks for a password again. Without trust, the session lasts 12 hours.
- The desktop settings list every active session with device name and last use. Each can be revoked, and one button signs out everything.
- If the phone is lost: revoke its session from the desktop and remove the device from Tailscale. Either one alone cuts access.
- The ChatGPT sign-in is not part of the phone session. It stays on the PC.

Done when: a voice entry recorded on the phone away from home Wi-Fi appears in the desktop Journal view.

### F8. Personal space and learning log

The personal side gets its own view, its own prompts and a way to bring lessons back.

- A Work and Personal switch at the top of the Journal view. Each side shows only its own entries, summaries and review cards.
- **Learning log.** Every item in `extracted.learnings`, from work or personal entries, becomes a row in `learnings`, linked to its source entry. A Learning page lists them, newest first, searchable.
- **Revisit.** Each learning comes back in the Journal view after 7, 30 and 90 days. Three actions: Still true (moves to the next step), Update (opens the text for editing and restarts at 7 days), Drop. After the 90-day step it is marked kept and stops returning. At most 3 appear per day.
- **Personal prompts.** Separate prompt files for the personal check-in and personal review questions, focused on what was learned, what was on your mind, and what to try next. The personal check-in is off by default and turned on in settings.
- **Trackers.** Mood, energy, health, sleep, light and activity are logged through personal trackers (F13), not as a field on the entry.
- Work learnings appear in the Learning page but keep `space = 'work'`, so they still never enter a personal-only or client-facing output by accident.

**Quiz mode for Revisit (optional, off by default)**

- With quiz mode on, the AI writes one short question and its answer when a learning is saved.
- Revisit then shows the question first. You answer in your head or out loud, reveal the lesson, then mark Got it or Missed it. Got it moves to the next step (7, 30, 90 days). Missed it restarts at 7 days.
- One setting, `quiz_enabled`, controls it. With it off, Revisit shows the lesson text with the Still true, Update and Drop actions described above, no questions are generated, and no quiz jobs run.
- A single learning can also be set to "never quiz" for lessons that do not suit a question.
- The setting sits in the Learning page header, and it can be changed at any time without losing review progress. Default: off.

**Learnings from imports**

- Imported articles, videos, PDFs and vault notes never create learnings on their own. Only entries you write or speak do.
- When you ask about an import in chat, each answer has a "Save as learning" action. It stores the point in your words or the AI's, linked to the source note, and it then follows the normal Revisit cycle.
- Any passage selected in any note offers the same action.

Done when: a lesson spoken in an entry today appears on the Learning page without any manual step and comes back for review 7 days later.

### F9. Questions about chosen notes

Chat can be pointed at one note, a hand-picked set, or a saved group, and answers only from those.

- **Ways to pick a scope:** the open note; several notes ticked in the Notes finder; cards selected on the canvas ("Ask about selection"); a folder with its subfolders; one or more tags; a project or client; a saved group.
- The chat panel shows the scope as a chip with a note count, for example "6 notes" or "Folder: Research". One tap clears it back to the whole vault.
- **Small scopes are read whole.** If the chosen notes fit the model's input budget (default 60,000 tokens, in config), their full text is sent, so questions like "compare these three" or "what do these notes disagree on" see everything. Larger scopes fall back to search inside the scope only.
- Citations can only point to notes inside the scope. If the answer is not in those notes, the AI says so and does not reach outside.
- **Saved groups.** Any scope can be saved with a name and reused. A group is either fixed (a list of note ids) or live (a folder, tags or filters that pick up new notes). Groups appear in the command palette.
- Scope and the F2 filters combine: "these tags, last quarter only".
- A hand-picked scope may include personal notes, since the choice was explicit. The chip shows a Personal mark when it does.

**Suggested questions**

- Chat offers 3 to 5 questions so it never starts blank. They are built from the notes in scope and lean on four angles: themes, connections, contradictions and gaps.
- On one note, the questions are about that note. On a hand-picked set or group, they compare the notes, for example "Where do these disagree?" On the whole vault, they draw on recent entries and show which notes each question relates to.
- A used question rotates out for a new one. A dismissed question stays gone. The panel can be hidden.
- Questions are built by the job runner in the background, so opening chat never waits on them.

**Personas**

- A persona is a saved set of instructions for chat: role, goal, tone and rules, up to 10,000 characters. Examples: Client update (plain, no internal detail, work entries only), Personal reflection, Research (cites every source).
- A picker in the chat panel switches persona per conversation. One can be set as default, and a plain built-in persona is always available.
- A persona may carry a default scope or space, so choosing Client update also sets the work-only filter. A persona can narrow what chat reads but can never widen it past the privacy rules.

Done when: three cards selected on the canvas can be compared in one question, and every citation in the answer points to one of those three.

### F10. Goals and accomplishments

Goals are set for each week, month and year. Accomplishments are collected from entries and matched to them, so each period ends with a clear record of what was aimed for and what was achieved.

**Goals**

- A goal has a period (week, month or year), a space, an optional project, and an optional parent goal, so a weekly goal can serve a monthly one and a monthly goal an annual one.
- Goals are set in the review card at the start of each period (F5). The AI proposes up to 5, drawn from unfinished goals, open next steps and the parent goals above. Each can be accepted, edited, spoken or deleted. None are added without approval.
- The daily check-in shows this week's goals above its questions.
- Work and personal goals are separate lists.

**Accomplishments**

- Extraction (F5) turns each finished task or decision worth keeping into an accomplishment row, linked to its source entry, date and project.
- The AI links an accomplishment to a goal when the match is clear. Anything unlinked is kept and shown as unplanned work, so effort outside the goals still counts.
- An accomplishment can be added by hand, edited, starred or removed. Starred items are the ones carried into monthly and annual records.

**Closing a period**

- The weekly, monthly and annual summaries gain a "Goals and accomplishments" section: each goal with a proposed status (done, partly done, not done), the evidence entries cited, and the unplanned list.
- The review card asks for confirmation of each status. Unfinished goals get one of three choices: carry forward, drop, or rewrite.
- Progress is shown as counts, for example "4 of 5 done". No scores or percentages.

**Views**

- A Goals page: this week, this month and this year side by side, each goal with its linked accomplishments.
- An Accomplishments page: filter by period, project, client or starred, and export the list as markdown. This doubles as source material for client updates (F6) and a year-end record.

Done when: a goal set on Monday shows as done in Sunday's weekly summary with the entries that prove it, and the annual view lists every starred accomplishment by month.

### F11. Your notes on reports

Weekly, monthly and annual reports (the summaries from F5) accept your own notes, kept apart from the AI text so a rebuild never erases them.

- Every report has a "My notes" area under the AI summary. Notes can be typed or spoken, and there can be any number per report.
- A note can also be pinned to one part of the report: a goal, an accomplishment, a project section or a graph. It then shows beside that part.
- Notes are stored in their own table, keyed to the period, not to the summary text. Rebuilding a report leaves them untouched and in place.
- Notes flow upward. The monthly report reads the notes on its weekly reports, and the annual report reads the monthly ones, the same way review answers do. Your own words outrank the AI's when the two disagree, and the prompt says so.
- Notes are searchable, can be cited by chat, follow the report's space (work or personal), and are included in markdown export under their own heading.
- Daily summaries accept notes too, but the feature is aimed at the three higher levels.

Done when: a note added to a weekly report survives a rebuild of that report and is quoted in the monthly report that covers it.

### F12. Graphs and stats

Reports and a Stats page show graphs built from plain counts. Each graph can be turned on or off, and a graph with too little data hides itself.

**Rules for every graph**

- Built with SQL counts and drawn with d3, which Mero already ships. No AI is involved, so graphs work before the live-AI gate passes and cost nothing to run.
- Each graph has its own on and off switch in Journal settings, plus one master switch. A graph that is off is not computed.
- A graph appears only when it has something to show: at least 3 data points and at least 2 different values. Otherwise it is skipped without leaving a gap.
- Each report level has a default set, listed below. Work graphs appear in work reports and personal graphs in personal reports.
- Graphs are drawn live from data, never stored as images, so they stay correct after edits. Markdown export includes each graph's numbers as a small table.
- Hovering a bar or point shows the number and opens the matching entries on click.

**Graph list**

| Graph | Type | Default in | Needs |
| --- | --- | --- | --- |
| Words written per day or week | Bars | Weekly, monthly, annual | `word_count` |
| Entries created, split by typed, voice and image | Stacked bars | Weekly, monthly | None |
| Activity calendar, one square per day | Heatmap | Annual, Stats page | None |
| Days journaled and longest streak | Number with sparkline | Weekly, monthly | None |
| Entries by project and by client | Horizontal bars | Weekly, monthly, annual | F1 |
| Work and personal split over time | Stacked area | Monthly, annual | None |
| Goals set against goals done, per period | Grouped bars | Monthly, annual | F10 |
| Accomplishments per week, starred marked | Bars | Monthly, annual | F10 |
| Time of day entries are made | Histogram | Stats page only | None |
| Most used tags | Horizontal bars | Stats page only | None |
| Learnings added against learnings reviewed | Two lines | Monthly, annual (personal) | F8 |
| Quiz results, Got it against Missed it | Stacked bars | Stats page only; hidden when quiz mode is off | F8 |
| One graph per active tracker, plus the Compare view | Line with range band, bars or calendar, by tracker type | Monthly (personal) | F13 |
| Vault growth: total notes and total words | Line | Annual, Stats page | `word_count` |

**Stats page**

- All graphs that are switched on, with a date range picker, a Work and Personal switch, and the project and client filters from F2.
- Four headline numbers at the top: entries, words, days journaled, accomplishments, each compared with the previous period of the same length.

**Left out on purpose:** hours and time tracking (a non-goal), scores, and any graph that ranks days as good or bad.

Done when: a weekly report shows its default graphs, switching one off removes it from every report and the Stats page, and a first-week report with two entries shows no empty charts.

### F13. Personal trackers

Mood, health, energy, light, activity and anything else you choose are logged as trackers: small daily measures you define, separate from written entries.

**Trackers**

- A tracker has a name, a type and an on or off switch. Types: scale 1 to 5, number with a unit, yes or no, one choice from a list, and duration.
- Starter set, all optional and all editable:

| Tracker | Type | Logged |
| --- | --- | --- |
| Mood | Scale 1 to 5 | Any number of times a day; the day shows the average and the range |
| Energy | Scale 1 to 5 | Any number of times a day |
| Health | Scale 1 to 5, with an optional short note for symptoms | Once a day |
| Sleep | Duration, hours | Once a day |
| Light | Duration, minutes outdoors in daylight | Once a day, or added up |
| Activity | Duration, minutes, plus a choice: walk, gym, run, sport, other | Added up over the day |

- Add your own with the same types, for example caffeine (number), meditation (yes or no), screen-free evening (yes or no). Archive a tracker to stop logging it without losing its history.

**Logging**

- Logging is manual only. Nothing is imported from Apple Health, Google Fit or any watch.
- A tracker strip sits at the top of the Personal side and on the phone capture screen: one tap per scale, a number pad for durations. Logging a full day takes under 20 seconds.
- By voice or text: "slept six hours, mood about a four, walked forty minutes" inside any personal entry. Extraction (F5) proposes the values, marks them `suggested`, and one tap confirms. Nothing is logged from work entries.
- Each log can carry a short note and can link to the entry it came from.
- Past days can be filled in or corrected. No tracker is ever required, and a missed day stays blank, not zero.

**Graphs and patterns**

- Every active tracker gets its own graph under the F12 rules: own on and off switch, hidden when there is too little data. Scales draw as a line with a daily range band, durations as bars, yes or no as a calendar of filled squares.
- A Compare view overlays any two trackers on one time axis, for example mood with sleep, energy with activity, or mood with light.
- The monthly and annual personal reports may describe patterns in plain numbers, for example "On the 12 days with 30 minutes or more outdoors, mood averaged 3.9; on the other 9 days, 3.1." A pattern is only stated with at least 14 logged days and at least 5 days on each side, always with the day counts, and always worded as a pattern, not a cause.
- The journal describes your own data. It does not diagnose, and it gives no medical advice.

**Privacy**

- Trackers exist only in the personal space. Tracker data never appears in work reports, project pages, client drafts or work graphs.
- Logging, storage and graphs are fully local and use no AI.
- Two switches in Journal settings, both on by default: "Read tracker values from my personal entries" and "Include tracker data in personal AI reports". With both off, no tracker value ever leaves the PC.

Done when: mood, sleep and light logged from the phone for two weeks show as three graphs and one Compare view on the Personal side, and none of it appears anywhere on the Work side.

## API changes

All routes are FastAPI routes reached through the existing Express proxy in `Mero/server/routes/myob.js`, except where marked Express. Every new route filters by `owner_id` the same way existing routes do, and each gets a case in `test_tenant_isolation.py` and `test_route_order.py`.

### Entries, capture and assignment (F1, F3)

| Method and path | Change |
| --- | --- |
| `POST /api/notes`, `PUT /api/notes/{id}` | Accept `kind`, `entry_date`, `space`, `project_id`, `source` |
| `GET /api/entries` | New. List entries by `from`, `to`, `space`, `project_id`, `client_id`, `assignment` |
| `POST /api/entries` | New. Multipart: text, entry fields, any number of audio and image files; returns entry id and one job id per file |
| `PUT /api/entries/{id}/assignment` | New. Confirm or change suggested space and project |
| `GET /api/entries/{id}/hints`, `GET /api/projects/{id}/unlinked` | New. Name-match hints for one entry; unlinked mentions for a project |
| `POST /api/entries/{id}/audio-parts` | New. Upload one 15-minute part with its `part_index`; the transcript joins when the last part is marked final |

### Search and chat (F2, F9)

| Method and path | Change |
| --- | --- |
| `GET /api/semantic-search` | Add the filter set, FTS5 blending, `mode` (`text` or `ai`) and `scope`. Each result returns match locations with a preview line. Response includes filter options with counts for the current results |
| `POST /api/ai/chat` | Add optional `filters`, `scope` and `persona_id` to `AIChatRequest`. `scope` holds `note_ids` (up to 200), `folder_id`, `tags`, `project_id`, `client_id` or `group_id`. Response states the filters and scope used and whether notes were read whole or searched |
| `POST /api/notes/bulk` | New. Tag, assign to a project, or add to a group for a list of note ids |
| `GET, POST, PUT, DELETE /api/note-groups` | New. Save, rename, list and remove groups |
| `GET /api/ai/suggested-questions` | New. By scope; `PUT` marks one used or dismissed |
| `GET, POST, PUT, DELETE /api/personas` | New. Manage personas and the default |

### Attachments and files (F4)

| Method and path | Change |
| --- | --- |
| `POST /api/notes/{id}/attachments` | New. Multipart, one or many files, with an optional `position` in the note body; returns one attachment id and job id per file |
| `GET /api/notes/{id}/attachments` | Existing. Now returns `kind`, `origin`, `status` and size |
| `GET /api/attachments/{id}/content` | New. Streams any attachment, with range requests so audio and large PDFs stream |
| `POST /api/attachments/{id}/insert-text`, `POST /api/attachments/{id}/summarize` | New. The two chip actions; both create a new note version |
| `DELETE /api/attachments/{id}` | New. Removes the file, its chunks and its chip |
| `POST /api/upload` | Accept `.docx`, `.heic`, audio; queue extraction |
| Express `routes/upload.js` | Per-type size limits replace the single 10 MB image limit; uploads stream to disk so a 200 MB file does not sit in memory |

### Jobs (all features)

| Method and path | Change |
| --- | --- |
| `GET /api/jobs/{id}`, `POST /api/jobs/{id}/retry` | New. Status and retry for any job |
| `GET /api/jobs?status=pending`, `POST /api/jobs/{id}/run` | New. Called by the Express job runner with the sign-in credential |

### Review cycle (F5, F11)

| Method and path | Change |
| --- | --- |
| `GET /api/summaries` | New. List by `period_type`, `from`, `to`, `space`. Each summary returns its report notes beside the AI text |
| `POST /api/summaries/rebuild` | New. Rebuild one period and the levels above it |
| `GET /api/checkin/today` | New. Whether today's check-in is due or done |
| `GET /api/reviews/open`, `POST /api/reviews/{summary_id}/answers` | New. Open review cards with their questions; save answers as a linked entry |
| `PUT /api/entries/{id}/extracted` | New. Add, edit, remove or resolve one extracted item; sets `edited` |
| `POST /api/entries/{id}/extract` | New. Re-run extraction, keeping edited items |
| `GET, POST /api/reports/{period_type}/{period_start}/notes` | New. List and add notes for a report, with `space` and an optional anchor |
| `PUT, DELETE /api/report-notes/{id}` | New. Edit or remove one note |

### Projects and clients (F6)

| Method and path | Change |
| --- | --- |
| `GET, POST, PUT /api/clients`, `/api/projects` | New. Create, rename, archive |
| `GET /api/projects/{id}/status` | New. Status block, blockers, next steps, last entry date |
| `POST /api/projects/{id}/client-update` | New. Draft update for a date range; saves a draft note |

### Learning (F8)

| Method and path | Change |
| --- | --- |
| `GET /api/learnings` | New. List and search |
| `GET /api/learnings/due` | New. Today's revisit items. Returns the question first when quiz mode is on, the lesson text when off |
| `PUT /api/learnings/{id}` | New. Still true, Update, Drop, `got_it`, `missed_it`, and the per-learning `quiz` flag |
| `POST /api/learnings` | New. Create a learning by hand from a chat answer or selected text, with its source note |

### Goals and accomplishments (F10)

| Method and path | Change |
| --- | --- |
| `GET, POST, PUT, DELETE /api/goals` | New. List by `period_type`, `period_start`, `space`; create, edit, set status, carry forward |
| `POST /api/goals/propose` | New. AI-proposed goals for a period; nothing is saved until accepted |
| `GET, POST, PUT, DELETE /api/accomplishments` | New. List by `from`, `to`, `project_id`, `client_id`, `goal_id`, `starred`; add, edit, star, link to a goal |
| `GET /api/accomplishments/export` | New. Markdown export for a date range |

### Stats and trackers (F12, F13)

| Method and path | Change |
| --- | --- |
| `GET /api/stats/{graph_id}` | New. Data for one graph by `from`, `to`, `bucket` (`day`, `week`, `month`), `space`, `project_id`, `client_id`. Returns `enough_data: false` when the graph should hide |
| `GET /api/stats/headline` | New. The four headline numbers with the previous-period comparison |
| `GET, POST, PUT /api/trackers` | New. List, create, edit, reorder, archive. First call seeds the starter set |
| `GET, POST /api/tracker-logs` | New. List by `tracker_id`, `from`, `to`; add one or several logs in one call, so the strip saves a whole day at once |
| `PUT, DELETE /api/tracker-logs/{id}` | New. Correct, confirm a suggested value, or remove |
| `GET /api/stats/tracker/{tracker_id}` | New. Daily value, range and count by `from`, `to`, `bucket`; same `enough_data` rule |
| `GET /api/stats/compare` | New. Two tracker ids on one time axis, plus the split averages and day counts used for pattern statements |

### Settings, usage, export and sessions

| Method and path | Change |
| --- | --- |
| `GET, PUT /api/settings/journal` | New. Holds every setting in the Journal settings table |
| `GET /api/usage` | New. This month's Groq and Gemini units, estimated cost, cap status, and text job counts |
| `POST /api/usage/override` | New. One-off "Run anyway" for a job held by the cap |
| `POST /api/export`, `GET /api/export/{job_id}` | New. Start a full export; progress and the local path of the finished zip |
| Express `GET /auth/sessions`, `DELETE /auth/sessions/{id}`, `POST /auth/sessions/revoke-all` | New. Express only, not proxied |
| Express `POST /auth/login` | Accepts `trust_device` and `device_name` |

## AI providers

Five jobs, four providers. Each model name lives in config so it can change without code edits.

| Job | Provider | Notes |
| --- | --- | --- |
| Embeddings | Local `BAAI/bge-small-en-v1.5` | Already in place |
| Transcription | Groq `whisper-large-v3-turbo` | New key: `GROQ_API_KEY`, held by FastAPI |
| Image reading | Gemini vision through the AI Studio API | New key, held by FastAPI; billing on |
| Deep text: chat, weekly to annual summaries, review questions, project status, client drafts | ChatGPT sign-in (OAuth) through the existing `codex_provider.py` | Model from the existing `OPENAI_CHAT_MODEL` setting. Uses the ChatGPT plan, no per-call charge |
| Fast text: titles, extraction, auto-assign, daily summaries | Same sign-in and provider | New setting `OPENAI_FAST_MODEL`, suggested value `gpt-5.6-luna`. If empty, the chat model runs with low reasoning effort |

New keys follow the existing fail-closed pattern: each is verified with one real call, and its feature shows an unavailable state until that passes. Keys never reach the browser.

**Text AI uses the OAuth system already in the repo.** `Mero/server/services/openaiOAuth.js` is the ggcoder flow from [gg-framework](https://github.com/KenKaiii/gg-framework) (MIT): PKCE login on `localhost:1455`, encrypted storage in Express, and leased refresh. Express adds the token to each proxied request as `X-Mero-AI-Credential` with type `oauth_codex`, and FastAPI never stores it. The journal adds no new login code.

- Sign-in happens once on the PC, because the callback is a localhost address. The phone never signs in to OpenAI; it uses the PC's stored credential through Express.
- Keep the MIT copyright notice for the ported code in a third-party notices file.
- ggcoder's model registry lists `gpt-5.6-luna` as low cost, `gpt-5.6-terra` as medium and `gpt-5.6-sol` as high on this route, and uses the low tier for its own summarizing.
- Two fixes in `codex_provider.py` before phase 5: its default model is still `gpt-5.4`, and it sends no Codex client version, which ggcoder sends because the backend rejects newer models from older clients.

**Background jobs need a credential carrier.** FastAPI only sees the token while a browser request is in flight, so a scheduler inside FastAPI could not call the text model at 23:30. The job runner therefore lives in Express, which owns the credential.

- FastAPI keeps the `jobs` table. Saving an entry or reaching a summary time adds a row. No AI call happens inside the save request.
- A timer in Express runs every minute and on startup. It refreshes the token if needed, asks FastAPI for pending text jobs, and calls `POST /api/jobs/{id}/run` for each with the credential headers and a 120-second timeout instead of the proxy's default 15.
- Transcription and image jobs use server-held keys, so FastAPI runs those itself without waiting for Express.
- If the sign-in has expired, text jobs stay pending and the Journal view shows "Sign in to ChatGPT to resume". Nothing is lost.

**Spend limit.** Groq and Gemini together are capped at 10 US dollars a month, set in config.

- Every Groq and Gemini call records its units (audio seconds, images) and an estimated cost from per-unit prices in config.
- At 80 percent of the cap, the Journal view shows a notice. At 100 percent, new transcription and image jobs wait as pending, their audio and images are kept, and a "Run anyway" button allows a one-off override. The count resets on the first of the month.
- At Groq's listed 0.04 dollars per audio hour, 10 dollars covers about 250 hours of speech, so the cap is a guard against a runaway loop, not a working limit.
- Text AI on the ChatGPT plan has no cost to cap. Its job counts are shown on the same usage panel.

## Privacy and data safety

Personal entries and client data never mix by accident, and no entry is lost to a failed job.

- **Space filter in the query, not in the prompt.** Work summaries, project pages and client updates select `space = 'work'` in SQL. The AI never sees personal rows for these tasks.
- **Chat defaults to work.** Personal entries join a chat only when the personal filter is switched on, and the panel shows that it is on.
- **Unsure means personal.** Auto-assign never guesses an entry into work. Client update drafts read only entries whose project was picked or confirmed by hand.
- **Local where possible.** Embeddings, graphs and tracker logging run on the PC. Transcription is hosted: audio goes to Groq, the provider OrcaVoice already uses, and this is accepted for recordings that mention client work. Text sent to a hosted AI provider is limited to the rows a task selected.
- **Gemini on paid terms.** Image reading uses Gemini through the AI Studio API. Turn on billing for the API project before sending client images. On the unpaid tier Google may use submitted content to improve its products and human reviewers may read it; with billing on, it does not ([Gemini API terms](https://ai.google.dev/gemini-api/terms), [billing](https://ai.google.dev/gemini-api/docs/billing)).
- **Text AI runs under your ChatGPT account.** Entry text sent for extraction, summaries and chat is handled under that account's data settings. Check the data controls in ChatGPT settings before real client notes go in.
- **The sign-in token stays in Express.** It is encrypted at rest, sent to FastAPI per request, and never written to the FastAPI database, logs or the `jobs` table.
- **Provider choice is visible.** The existing AI settings screen shows which provider handles chat, vision and transcription.
- **Write first, process second.** Text, audio and images are saved before any AI step starts. A failed AI step leaves the entry intact with a retry state, as `PRODUCT.md` already requires for embeddings.
- **Recorded audio is short-lived.** Audio recorded in the journal is deleted once its transcript is saved. Only audio from pending or failed jobs stays on disk. Dropped audio files are kept unless `keep_dropped_audio` is off.
- **Backups cover new data.** `data:backup` and restore checks include every new table, attachments, and any audio still waiting for transcription. Run a backup before applying migration 006.
- **AI output is marked.** Summaries, status blocks and client drafts carry `kind = 'summary'` or a draft tag and cite their source entries, so they are never confused with what was actually written.
- **Export everything.** One button builds a zip as a background job, with a progress bar: every note, entry, report and report note as markdown with frontmatter, in folders by kind and year; goals, accomplishments, learnings, clients, projects, trackers and tracker logs as CSV; attachments in their own folder. Work and personal go into separate top-level folders so either can be handed over alone. The zip is written to a local folder and never uploaded. The export grows with each phase, starting with notes and entries in phase 1.

## Build phases

Six phases, in dependency order. Each ends with something usable, so the build can pause after any phase. Effort is a rough guess for one developer working part-time.

| Phase | Contents | Depends on | Needs live-AI gate | Effort | Usable result |
| --- | --- | --- | --- | --- | --- |
| 1 | Migration 006, clients and projects, entry fields on note routes, Journal view with text capture, Work and Personal switch, name-match hints, word counts on save, first version of Export everything (F1, part of F8 and F12) | Backup | No | 1 to 2 weeks | Daily text journal with projects |
| 2 | Filters on search and chat, FTS5, date phrases, search modes, match previews and bulk actions (F2); scopes, saved groups and personas (F9) | 1 | Chat and date phrases only | 2 to 3 weeks | Questions by date, project, client, or chosen notes |
| 3 | Mixed-entry capture, browser recording, Groq transcription client, job status, audio cleanup (F1, F3); drag and drop of audio, PDF and other files into any note (F4) | 1 | No; needs Groq key | 2 weeks | Voice entries on desktop; files in any note |
| 4 | Tailscale HTTPS, manifest, `/capture` screen, holding queue, trusted-device sessions (F7); tracker tables, tracker strip and manual logging (F13) | 3 | No | 1 week | Voice, text and tracker logging from phone |
| 5 | Express job runner, extraction and auto-assign on save, four summary levels, check-in, review questions, editable extracted items (F1, F5); goals, accomplishments and period close (F10); suggested questions (F9); notes on reports (F11) | 2 | Yes | 3 to 4 weeks | Automatic reviews with goals and accomplishments |
| 6 | Project and client pages, stale badge, client update drafts (F6); Goals and Accomplishments pages with export (F10); graphs in reports, Stats page and graph switches (F12); learning log, revisit with optional quiz mode (F8); tracker graphs, Compare view and patterns in personal reports (F13); image and scanned-PDF text through Gemini (F4) | 5 | Yes; F4 needs Gemini key | 3 to 4 weeks | Status pages, goal views, graphs, learning log, searchable images |

Phone access moves ahead of summaries on purpose. Summaries are only as good as the entries behind them, and entries come more often once the phone works.

Gemini image reading sits last because typed and spoken entries carry most of the value. Move it earlier if photos of notes are a main input.

**Gate dependency.** `PRODUCT.md` keeps live AI off until a credential passes against `POST /v1/embeddings`. That wording is out of date: embeddings are local now, and a ChatGPT sign-in token is not an API key for that endpoint. Restate the gate as one successful call through `codex_provider.py` with the stored OAuth credential, and update `PRODUCT.md` to match. Phases 1, 3 and 4 do not touch the gate, and filtered search in phase 2 runs on local embeddings. Chat, phase 5 and phase 6 cannot ship until it passes. The Express job runner is built at the start of phase 5; the `jobs` table arrives in phase 3 for transcription.

**Suggested checkpoint.** Build phases 1 to 4, use the journal for two weeks, then re-read phases 5 and 6 before starting them.

## Testing

Each phase adds backend tests to the list in `AGENTS.md` so CI runs them. Manual check per phase: the "Done when" line of each feature, on desktop Chrome and on the phone.

| Test file | Covers |
| --- | --- |
| `test_journal_migration.py` | 006 applies to a copy of a populated database; existing notes are unchanged by hash |
| `test_entry_filters.py` | Date, space, project and client filters on entries, search and chat |
| `test_space_isolation.py` | No work summary, project status or client update can select a personal row. The most important new test |
| `test_name_hints.py` | A project or client name in an unassigned entry raises a hint; archived names do not; assigning and undoing both work |
| `test_search_modes.py` | Text mode finds exact phrases only; match locations and previews are correct; filter counts match the result set; bulk actions touch only the listed notes |
| `test_chat_scope.py` | Citations never leave the scope; small scopes are sent whole and large ones are searched; live groups pick up new notes; scope and date filters combine |
| `test_personas.py` | Instructions reach the prompt; a persona's default scope narrows what is read; no persona can include personal notes in a work-only output |
| `test_voice_entries.py` | Upload, job states, failure keeps audio, retry works, success deletes audio. Transcription is mocked |
| `test_audio_parts.py` | Parts join in `part_index` order even when uploaded out of order; a failed part retries alone; audio for all parts is deleted only after the joined transcript is saved |
| `test_mixed_entries.py` | One entry with text, audio and an image ends as one note with all three parts, and each job can fail and retry alone |
| `test_note_attachments.py` | Audio and PDF attach to a plain note as well as an entry; several files in one call each get their own job; the note saves even when every file fails; a repeated file attaches once; a refused type names the accepted types; dropped audio is kept while recorded audio is deleted; `keep_dropped_audio` off deletes both; search finds a word on page 4 of a PDF and returns that page; space rules apply to attachment text |
| `test_trackers.py` | Starter set is seeded once; each type validates its values; `many`, `once` and `sum` daily modes aggregate correctly; a missed day is blank, not zero; archiving keeps history |
| `test_tracker_privacy.py` | No work report, project page, client draft, work graph or work-scoped chat can read a tracker row; work entries never produce suggested logs; with both AI switches off, no job payload contains a tracker value |
| `test_auto_assign.py` | A weak suggestion leaves the entry unsorted; unsure between spaces resolves to personal; client drafts skip unconfirmed entries |
| `test_summaries.py` | Catch-up after missed days, one summary per period, outdated flag, rebuild chain |
| `test_reviews.py` | Questions are built per summary, answers link with `review_of`, work and personal stay separate |
| `test_extracted_edits.py` | Edited items survive re-extraction; resolved blockers leave project status and later summaries |
| `test_goals.py` | Parent links across week, month and year; proposed goals are not saved until accepted; carry forward keeps a link to the original; work and personal stay separate |
| `test_accomplishments.py` | Rows created from extraction with source entry; unlinked items kept as unplanned; starred items appear in monthly and annual sections; export matches the filter |
| `test_suggested_questions.py` | Questions cite notes inside the scope only; used ones rotate out; dismissed ones never return |
| `test_report_notes.py` | Notes survive a report rebuild; an anchored note stays with its goal or section; monthly builds read weekly notes; work and personal notes stay apart; notes appear in search and export |
| `test_learnings.py` | Rows created from extraction, 7, 30 and 90 day steps, daily cap of 3, Drop stops returns |
| `test_import_learnings.py` | Importing any number of notes creates zero learnings; "Save as learning" creates one with its source link |
| `test_quiz_mode.py` | With `quiz_enabled` off, no quiz jobs are created and Revisit returns lesson text; turning it on or off keeps each learning's step and next review date; "never quiz" is respected |
| `test_stats.py` | Each graph's numbers match hand-counted fixtures; week buckets start on Monday; `enough_data` is false under 3 points or with one repeated value; a graph switched off returns nothing and runs no query; the quiz graph hides when quiz mode is off; personal data never appears in a work graph |
| `test_tracker_patterns.py` | A pattern is stated only with 14 or more logged days and 5 or more on each side; the statement carries both day counts |
| `test_spend_cap.py` | Usage sums per month; 80 percent raises the notice; 100 percent holds new Groq and Gemini jobs and keeps their files; override runs exactly one job; the count resets on the first |
| `test_export.py` | The zip holds every note and table row by count; work and personal land in separate folders; frontmatter parses; special characters in titles do not break file names |
| Mero server tests | A trusted session renews on use and expires 30 days after last use; a revoked session is refused at once; revoke-all leaves no valid token |
| Existing files | New routes added to `test_tenant_isolation.py` and `test_route_order.py` |

## Risks

| Risk | Effect | Response |
| --- | --- | --- |
| The ChatGPT sign-in route is unofficial: it uses the Codex client ID and the `chatgpt.com/backend-api/codex` endpoint, which OpenAI can change or restrict without notice | All text AI stops | `openai_provider.py` stays as an API-key fallback behind one config switch; entries, search and transcription keep working without text AI |
| Extraction on every save draws on ChatGPT plan limits | Text jobs get rate-limited late in the day | Jobs retry with backoff; extraction, auto-assign and title share one call per entry |
| The refresh token is revoked or expires | Summaries and extraction queue up silently | Pending state plus the sign-in banner in the Journal view |
| Groq is unreachable or rate-limited | Voice entries wait untranscribed | Audio stays and the job retries; typed and OrcaVoice entries still work |
| Recorded audio is deleted after transcription | A wrong transcript cannot be checked against the recording | Raw transcript kept as version 1; fix by editing or re-recording |
| iOS Safari records mp4 and limits background recording | Phone recordings fail or cut off | Accept both formats; keep the screen awake while recording; test on the real phone in phase 4 |
| PC is off or asleep | Phone capture fails | Holding queue in F7; set the PC to wake on network or stay awake during work hours |
| Summary errors build up across levels | Annual review repeats a daily mistake | Every summary cites sources; your report notes outrank AI text; monthly and annual prompts may open entries for anything marked uncertain |
| Scope is large for one developer: thirteen features | Build stalls | Stop after any phase; nothing in a later phase is needed for an earlier one to work; checkpoint after phase 4 |
| Similarity scan slows as notes and attachment chunks grow | Search passes 1 second | SQL filters cut the set first; move to `sqlite-vec` only if the 5,000-note target fails |

## Decisions log (21 Sep 2026)

All open questions are closed.

- Existing data is test data. No backfill; old notes stay outside the journal.
- No hours or time tracking anywhere: not extracted, not shown, not summarized.
- Image reading uses a Gemini vision model through the AI Studio API, with billing on.
- Transcription uses Groq Whisper, the provider behind OrcaVoice. OrcaVoice covers desktop dictation as it is; the backend calls Groq directly for phone recordings. No local Whisper install. Groq is accepted for recordings that mention client work.
- Text AI uses the ggcoder OAuth flow already in the repo, with `gpt-5.6-luna` suggested for fast jobs.
- Text to speech waits for OrcaVoice.
- Weeks run Monday to Sunday.
- Recorded audio is deleted once its transcript is saved. Dropped audio files are kept by default.
- Long recordings are split into 15-minute parts.
- No late-night date rule. Entry date is the calendar date at save.
- Imports create learnings only when asked.
- Extracted items are editable, and edits survive re-extraction.
- Phone sessions: 30 days sliding on trusted devices, with revoke. No phone reminders.
- Export everything is in this build.
- Groq and Gemini share a 10 US dollar monthly cap.
- Light means minutes outdoors in daylight. Tracker logging is manual only, with no health app import.
- Personal check-in and quiz mode both start off.

## Separate documents, not in this PRD

- Prompt files: extraction and auto-assign, four summary levels, review questions, goal proposals, project status, client update, personal check-in, quiz items, suggested questions.
- Screen layouts: Journal view, phone capture screen with tracker strip, project page, Goals page, Stats page, Learning page.
