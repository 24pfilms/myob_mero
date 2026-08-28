# Operate Mode Surface Brief

## Operating intent

Operate mode is the normal authenticated Mero workspace after launch. It keeps the infinite canvas primary while making MyOb notes available as native, durable workflows. It is not an administrative console and does not expose service topology, credentials, migration switches, or raw embedding data.

## First glance

- Current board content and spatial context.
- Existing top and bottom toolbars in their saved positions.
- A **Notes** tool in the bottom toolbar.
- Existing AI access without a second assistant entry point.

## Second glance

- Note finder drawer with search, folder and tag filters, results, and status.
- Selected note context with related notes and embedding availability.
- Optional relationship mode, threshold, and legend.

## Primary path

1. Activate **Notes** by pointer or keyboard.
2. Search or filter, then inspect announced result status.
3. Drag a result onto the canvas or use its keyboard-accessible placement action.
4. Move, resize, select, duplicate, export, undo, or redo the card like any other board item.
5. Double-click or invoke Edit to open the note editor drawer; save once and refresh every visible reference.

## Supporting paths

- Create a note from the finder or canvas tool flow.
- Open a related note or place it beside the selected card.
- Toggle connectors or heatmap without intercepting canvas input.
- Ask the assistant in Canvas or Notes scope and follow note citations.
- View and restore a previous note version with the current body snapshotted first.

## Surface anatomy

### Notes trigger

Uses the incumbent icon family and toolbar control anatomy. It exposes expanded state and returns focus after its drawer closes.

### Finder drawer

Contains a labeled heading, close control, search input, folder/tag filters, result status, result list, placement alternatives, pagination or virtualization boundary, and a non-obscuring status area.

### Editor drawer

Contains title and tags fields, body editor, sanitized preview, versions access, conflict details, save/retry status, and close behavior that protects dirty work. Resizing remains bounded and keyboard-independent.

### Canvas note card

Contains title, excerpt, tags, updated time, and embedding state while remaining readable at useful zoom levels. Missing notes render a tombstone. A canvas delete removes the reference only.

### Relationship controls

Offer Disabled, Connectors, and Heatmap modes, a bounded threshold, a legend, and text context. Their rendering layer cannot receive pointer events.

### AI assistant

Adds a visible Canvas/Notes scope toggle to the incumbent assistant. Notes responses expose operable citations and explicit credential, rate-limit, partial, interrupted, and failure states.

## State inventory

| State | Required behavior |
| --- | --- |
| Loading | Preserve drawer/card geometry and announce meaningful progress without focus movement |
| First-use empty | Explain how to create or import a note |
| No results | Preserve filters and offer one clear reset action |
| Offline/service unavailable | Keep canvas usable, preserve edits, and expose retry |
| Credential unavailable | Disable only AI-dependent actions and explain the remedy without exposing secrets |
| Rate limited | Preserve request context and provide retry timing when known |
| Stale card | Keep last safe summary, label it stale, and allow refresh |
| Save pending | Prevent duplicate submission and retain editor content |
| Save failed | Preserve edits, identify failure, and provide retry |
| Version conflict | Show local and current-version choices without silent overwrite |
| Deleted note | Render a tombstone; do not break or delete the board item automatically |
| Invalid embedding | Keep note CRUD available; exclude it from relationship rendering and expose retry state |
| Partial import/job | Record checkpoint and per-item failures; resume without duplicating successes |

## Keyboard and focus contract

- Every pointer action has a keyboard path; note placement never requires dragging.
- Drawer opening moves focus to its heading or first task control as appropriate.
- Tab order follows visible task order and never enters hidden content.
- Escape closes only when doing so cannot silently discard dirty work.
- Closing a drawer or assistant returns focus to its trigger.
- Focus remains visible for keyboard input and distinct from selected or active canvas state.
- Tooltips do not contain essential instructions and satisfy dismissible, hoverable, and persistent behavior when shown.

## Narrow and constrained windows

Finder filters wrap or stack without horizontal loss. Editor actions stay visible or one obvious action away. The canvas can remain spatially scrollable, but drawer content reflows at 320 CSS pixels where applicable and at 200% text zoom. On-screen keyboard, safe-area, no-hover, coarse-pointer, reduced-motion, and forced-color modes keep the primary path operable.

## Trust boundaries visible to the user

- The browser talks only to authenticated Mero routes.
- Account-specific notes never appear under another Mero account.
- Removing a card is labeled as removing it from the canvas; deleting a note names the durable consequence and requires a proportionate safeguard.
- AI scope and note citations are visible before results are acted upon.
- No screen displays plaintext OpenAI credentials, internal service tokens, filesystem roots, or upstream response bodies.

## Operate-mode acceptance evidence

- Desktop and narrow renders for authentication, canvas, finder, editor, relationship modes, and representative failure states.
- Complete keyboard path for find, place, open, edit, save, close, and focus return.
- Automated accessibility defects plus manual semantics, names, order, contrast, zoom/reflow, reduced-motion, forced-color, and representative screen-reader checks.
- Fifty visible note cards with measured interaction sampling and bounded semantic requests.
- End-to-end launch, authentication, note placement/save/restart, duplicate-card refresh, reference-only undo/redo, relationship view, scoped AI success/failure, and exact-process shutdown.
