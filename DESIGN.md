# Mero × MyOb Design Context

## Design read

### Surface

A dark, desktop-first infinite-canvas application with data-dense finder, editor, relationship, and AI surfaces layered around a spatial workspace. The canvas remains the leading surface; note management is supporting application UI, not a second app shell.

### Audience and environment

The primary user works on Windows with keyboard and pointer, often in long sessions and with many spatial objects visible. Resizable windows and narrow views remain supported even though mobile is not a product target. Keyboard-only, screen-reader, zoom, reduced-motion, forced-color, and no-hover operation remain acceptance requirements.

### Single job and risk

The interface must make finding a durable note and placing it in spatial context easiest. Moving a card is low-risk and undoable. Saving, restoring, importing, deleting a note, and applying AI output are high-risk and need explicit scope, durable feedback, conflict handling, and recovery.

### Local visual evidence

Mero already uses an Inter-led type stack, charcoal and slate canvas surfaces, gray text, blue and cyan interaction accents, occasional purple accents, rounded geometry, thin translucent borders, custom line icons, and compact floating toolbars. Existing top and bottom controls, canvas mechanics, and icon family are retained. MyOb's standalone visual shell is not imported.

## Design thesis

**A quiet spatial desk with precise semantic instruments.** The canvas and its content dominate first glance. Search, editing, AI, and relationship controls appear as attached instruments with restrained slate surfaces and blue focus accents. Semantic meaning becomes visible through line weight, labels, and legends rather than decorative cards or continuous motion.

The memorable device is a temporary semantic field: connectors or a coarse heatmap reveal relationships behind ordinary cards, then disappear without changing or competing with the workspace.

## Reuse map

- Keep Mero's existing top and bottom toolbar positions and custom icon set.
- Add **Notes** to the bottom tool surface rather than creating navigation.
- Extend the existing AI assistant with a visible **Canvas / Notes** scope control.
- Reuse incumbent slate surfaces, gray text hierarchy, blue/cyan focus accents, rounded corners, and compact control density.
- Reuse board selection, item sizing, history, clipboard, export, and drag behavior for `NOTE_CARD`.
- Preserve readable legacy `OBSIDIAN_NOTE` cards without visually promoting them as the new source of truth.

## Semantic roles

These roles guide reuse; they do not create a competing token system before local Tailwind configuration exists.

| Role | Incumbent direction | Use |
| --- | --- | --- |
| Canvas | charcoal to slate | uninterrupted spatial work area |
| Raised surface | opaque dark slate | drawers, editor, assistant, menus |
| Boundary | subtle gray or blue-gray | separation without visual noise |
| Primary text | near-white | titles and active content |
| Secondary text | readable cool gray | excerpts, timestamps, metadata |
| Action | blue | primary controls, focus, selected state |
| Semantic relation | blue to purple scale | connectors, heatmap, score context |
| Warning and error | high-contrast amber or red plus text/icon | conflicts, failed saves, invalid embeddings |
| Success | high-contrast text and icon | confirmed save or completed job |

Status must never rely on color alone. Contrast must be measured in rendered states before release.

## Geometry and composition

- Preserve the infinite canvas as the full-window base layer.
- Keep toolbar anatomy and placement stable; Notes joins the bottom tool group.
- The note finder is a bottom drawer with a stable header, search/filter row, result area, status region, and placement actions.
- Double-click opens a resizable editor drawer. The editor keeps title, tags, body, preview, save state, conflict recovery, and versions within one focus-managed surface.
- Related notes appear in a compact panel tied to current note context and support both drag and keyboard placement.
- Connectors and heatmaps render behind normal items with `pointer-events: none`.
- Drawers recompose rather than overlap essential controls at narrow widths and 200% zoom.

## Component and state contracts

### Note card

Shows title, scale-aware plain excerpt, tags, updated time, and embedding state. It supports selected, loading, stale, missing/tombstone, offline, and error states. Its accessible name includes the note title and state. Deleting it removes only the canvas reference.

### Note finder drawer

Provides labeled search, folder and tag filters, result count/status, bounded pagination or virtualization, empty, no-results, offline, loading, and retry states. Dragging has a single-pointer and keyboard/button placement alternative. Closing returns focus to the Notes trigger.

### Note editor drawer

Uses labeled title and tags controls plus a markdown editor and sanitized preview that does not enable raw HTML. It protects dirty work on close, identifies conflicts in text, preserves input after errors, prevents duplicate save submissions, and exposes save, retry, versions, and restore outcomes through an appropriate status region. Focus enters predictably, Escape does not discard dirty work, and close returns focus.

### Related notes

Shows score context as text, not color alone. Results can be opened or placed without dragging. Empty, invalid-embedding, loading, offline, and retry states remain distinguishable.

### AI assistant

Canvas and Notes scope is explicit before submission. Notes responses contain operable citations. Pending, stopped, partial, unavailable-credential, rate-limit, and error output remain distinguishable. Credentials never appear in copy, URLs, logs, or browser state.

### Relationship layer

Connector mode draws each symmetric pair once with bounded thresholds and a legend. Heatmap mode uses a coarse settled grid. Both ignore invalid or zero embeddings, preserve reduced-motion operation, provide text context or an accessible summary, and have a disabled fallback.

## Interaction and motion

- Use named property transitions only; no `transition: all` in new work.
- Do not use generic hover lift or scale as the default response.
- Keyboard focus is visible and distinct from selected, expanded, stale, and error states.
- Pointer activation must not leave a false focus or selected treatment.
- Auto-arrangement is one undoable action and never becomes a persistent mode.
- Relationship redraw waits for settled viewport changes, not every pointer move.
- Reduced motion removes animated arrangement and decorative movement while preserving final state and meaning.

## Responsive behavior

- Desktop keeps finder and editor aligned to the viewport's bottom edge while preserving core toolbar access.
- Narrow and high-zoom layouts stack finder controls and keep the primary action one obvious step away.
- Content regions avoid fixed content heights; drawers remain resizable within safe viewport bounds.
- Long titles, tags, unbroken identifiers, localized expansion, and right-to-left flow must not overlap controls.
- Touch targets meet at least 24 by 24 CSS pixels, with 44 by 44 preferred where density permits.

## Accessibility scope

The changed scope includes authenticated canvas operation, Notes trigger, finder, card placement alternatives, note cards, editor and version flows, related notes, AI scope and citations, relationship controls/summary, loading and failure states, and desktop/narrow compositions.

The implementation target is WCAG 2.2 Level AA. Release evidence must include keyboard completion and focus return, automated defect scanning, manual semantics and accessible-name review, representative screen-reader output, 200% text and 320 CSS-pixel reflow where applicable, reduced motion, forced colors, loading/empty/error/offline/conflict states, and desktop/narrow renders. Missing evidence remains unverified; no ADA or WCAG conformance claim is made from automated checks alone.

## Performance constraints

- Request semantic matrices only for visible deduplicated note IDs under the backend hard limit.
- Lazy-load editor and AI surfaces.
- Use pagination or virtualization for large result sets.
- Avoid storing note bodies in card records or duplicating them across cards.
- Target smooth interaction with 50 visible note cards and record measured results rather than inferred performance.

## Anti-default decisions

No new app shell, bento grid, floating screenshot, decorative metric blocks, emoji icons, mixed icon families, or ambient motion is introduced. Existing glass-like toolbar styling is retained only because it is part of Mero's incumbent interaction model; new note surfaces use more opaque slate panels for readability and focus. Semantic status treatments include text or icons and do not default to low-contrast tint-on-tint badges.
