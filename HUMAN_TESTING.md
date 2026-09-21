# Journal — human testing guide

Phases 1 and 2 of the journal are built, committed and passing their automated tests.
This guide is for the part a machine cannot do: judging whether it actually feels right,
and confirming the privacy rules hold on your real data.

Work through **Part A**. It should take about 30 minutes. Write down anything that
surprises you, however small.

---

## Before you start

**Back up first.** The journal added two database migrations. They only add columns and
tables and rewrite no existing note, but take the backup anyway:

```
cd MyOb/backend
uv run python data_safety.py backup
```

It prints where the backup went and how many notes it saved. Keep that number.

**Use Node 22.** Node 24 breaks the Mero server (`better-sqlite3` cannot build against it).
`.nvmrc` pins this, so `nvm use` or `fnm use` in the project root picks the right one.

**Start everything with one command**, from the project root in PowerShell:

```
powershell -ExecutionPolicy Bypass -File Mero/scripts/start-all.ps1
```

That starts all three pieces, generates the internal service token they share, waits for
each to answer, and opens the browser. Ctrl+C stops all three together.

It needs `JWT_SIGNING_KEY` and `API_KEY_ENCRYPTION_KEY` already set (in `Mero/server/.env`
or your environment) and will refuse to start without them. To check your setup without
launching anything, add `-PreflightOnly`.

I created `Mero/server/.env` with two freshly generated random keys, because it did not
exist and nothing would start without it. It is gitignored and was never committed. Your
Mero database had no users and no stored credentials at the time, so nothing was locked
out by the new keys. **If you would rather use your own keys, replace that file** — but
note that changing `API_KEY_ENCRYPTION_KEY` later makes any credential saved under the old
key unreadable.

The browser opens straight onto the board at `http://127.0.0.1:3001`, signed in as a local
`dev` account — no login screen while you are developing.

That convenience is server-side and local-only: the backend refuses it unless it is
explicitly running in development, so a built bundle cannot reach past the login. Nothing
about ownership changes — it is a real sign-in with a real token, so the work/personal
isolation in A6 is tested under the same rules it will ship with. To get the login screen
back, drop `MERO_ALLOW_DEV_LOGIN` from `Mero/scripts/start-all.ps1`, or put
`VITE_DEV_AUTO_LOGIN=false` in `Mero/.env.local`.

**Before this becomes a commercial product, delete the `/auth/dev-login` route.**

Do **not** start the backend by itself with `uv run python runner.py` — it fails closed
with `MERO_SERVICE_TOKEN must be set to at least 32 characters`, because that token is
what proves a request came from the proxy rather than from the open internet.

---

## Part A: what to test now

### A1. Write your first entries

Click the **Journal** button in the toolbar (the notebook icon, ninth from the left).
The magnifying glass next to it is **Search**.

1. Type what you did today. Pick **Work**. Save.
2. Write another, pick **Personal**. Save.
3. Change the date to yesterday, write a third as **Work**. Save.

**Expect:** each entry appears in the list under its date. The date you picked is the date
it files under — not the time you typed it. If you write at 1am and it files under the
wrong day, that is a bug worth reporting.

### A2. Clients and projects

Create a client and a project under it, then write an entry that mentions the project
**by name** but leave the project box empty.

**Expect:** a suggestion chip appears on that entry offering the project. Click **Assign**.
Then click **Undo**.

**Expect:** it goes back to unassigned. The suggestion is plain text matching — no AI, no
cost, no network call. It only matches whole words, so a project called "Harbour" is not
suggested by the word "Harbourside".

### A3. Search — the two modes

Click the **Search** button (magnifying glass).

1. Search a distinctive word you know is in one entry, in **Text** mode.
2. Search the same idea in different words, in **AI** mode.

**Expect:** Text mode finds exact words and shows you *the matching line*, not just the
title. AI mode finds notes that mean the same thing even when the wording differs. If a
search finds nothing, you are offered a one-tap retry in the other mode. The mode you used
last is remembered.

**Judgement call for you:** are AI-mode results actually relevant, or is it returning
loosely-related noise? That threshold is a taste decision and I want your read on it.

### A4. Filters and counts

With results on screen, use the filter chips and the Space dropdown.

**Expect:** every chip shows a count, and clicking one never gives you an empty list —
the counts describe what actually matched. Filtering by a client shows only entries whose
project belongs to that client.

### A5. Bulk actions

Tick several results, then assign them all to a project in one go.

**Expect:** only the ticked ones change.

### A6. The privacy check — please do this one properly

This is the rule the whole design rests on: **work-scoped output must never contain a
personal entry.**

1. Write a personal entry containing a distinctive word you would not want in a client
   document. Use something memorable and harmless, like `pineapple`.
2. Search that word with Space set to **Work**.
3. Filter entries by your client, and by each project.

**Expect:** `pineapple` appears nowhere. Not in results, not in a preview line, not in a count.

There are automated tests for exactly this (`test_space_isolation.py`, 8 of them), but
please confirm it on your own data too. **If personal text ever shows up in a work view,
stop testing and tell me — that is the most serious bug this project can have.**

### A7. Export

Click **Export** in the Journal panel. Wait for it to finish.

**Expect:** a progress count, then a path to a `.zip`. Open it. Inside:

- `work/` and `personal/` folders, kept separate
- entries as markdown with their details at the top, readable in Obsidian
- `tables/clients.csv` and `tables/projects.csv`

The zip is written to disk only — it is never served over the web, by design. If you want
a download button in the browser instead, say so and I will add one.

### A8. Restart test

Stop all three processes. Start them again. Open the Journal.

**Expect:** everything is still there, with the same dates and spaces.

---

## Part B: blocked until you provide something

I could not build or verify these, because each needs a credential or a device that only
you can supply. None of them are started, so nothing is half-finished in the repo.

| What | What it needs from you | Why I stopped |
| --- | --- | --- |
| **AI chat over the journal** | A ChatGPT sign-in that passes one real call through `codex_provider.py` | The PRD's own rule: chat and phases 5–6 cannot ship until this gate passes |
| **Voice entries (F3)** | A `GROQ_API_KEY` on the server | Transcription goes to Groq. I can build it against a mock, but I could not prove it works on real audio |
| **Reading text in images (F4)** | A Gemini API key **with billing enabled** | On the unpaid tier Google may use submitted content for product improvement and human reviewers may read it. That is not acceptable for client images, so this needs your explicit decision |
| **Phone access (F7)** | Tailscale set up, and a real phone | Cannot be tested from here at all |
| **Summaries, goals, learnings (F5, F8, F10)** | The chat gate above, first | Same gate |

The plumbing that does not need a key is already in place: chat accepts filters, scopes
and personas today, and the scope boundary that stops citations escaping is tested. When
the gate passes, chat gets its answers from that existing path.

---

## Already verified end to end

So you know what is proven and what still needs your eyes, I ran the whole of Part A
against the running stack (backend + proxy + app) before writing this:

- an entry saved under the date and space I picked, and survived a full restart
- the project suggestion fired on a name in the text, assign returned the previous values, and undo restored them
- **the privacy check passed on live data**: a personal entry containing `pineapple` was invisible to a work-scoped search, while an unfiltered search still found it
- the export zip contained separated `work/` and `personal/` folders, readable frontmatter, and both CSVs — with no personal text in the work file
- both panels render and the empty-state "Try Text mode instead" fallback works

What I could **not** judge for you is whether the results *feel* right — that is A3 and the
tuning question below.

## What I would flag if I were reviewing this

Three honest caveats, none blocking:

1. **AI-mode search scores are untuned.** The blend is 40% keyword, 60% meaning, with a
   0.3 relevance floor. Those are reasonable starting numbers, not measured ones. A2/A3
   feedback is how they get tuned.
2. **Search speed is unproven at scale.** The PRD target is under 1 second over 5,000
   notes. Your vault currently has 3 notes, so that number is untested. If you want, I can
   generate 5,000 realistic notes and measure it properly.
3. **The `.zip` export has no download button**, as above.

---

## How to report back

For anything that looks wrong, the most useful thing is: what you clicked, what you
expected, what happened. Screenshots help for anything visual.

If something breaks hard, the backend terminal usually explains it — copy the last 20 lines.

To undo everything and go back to before the journal existed:

```
cd MyOb/backend
uv run python data_safety.py restore --backup <the backup directory printed earlier>
```
