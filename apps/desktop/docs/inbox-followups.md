# Inbox follow-ups

Tracking unresolved questions and deferred work from the inbox redesign on `chore/inbox-redesign-v2`.

## Auto-expand-on-click — needs clarification

> User instruction (paraphrased): "add a ux feature for the settings to auto expand when i click it."

The phrasing is ambiguous. Four plausible interpretations:

1. **Channel-filter Popover auto-expand on click** — already implemented. Clicking the funnel icon opens the Popover. If this is what was meant, no work needed.

2. **Sort Select dropdown auto-expand on click** — already implemented. Clicking the "Sort by" trigger opens the Select. If this is what was meant, no work needed.

3. **ContextPanel Accordion auto-expand** (forward-looking) — the right-hand `ContextPanel` (`src/components/crm/inbox/ContextPanel.tsx`) is planned to host a collapsible Accordion of contact-context sections (recent activity, policies, appointments, notes, etc.). Two sub-interpretations:
   - (a) auto-expand certain Accordion sections on mount when the panel receives a `threadId`, OR
   - (b) auto-expand a section's content when the user clicks the section header (default Accordion behavior).

   ContextPanel implementation is part of cluster 2; this may have been a forward-looking design preference.

4. **Settings page sections auto-expand** — the sidebar "Settings" item routes to `/settings`. If the user was referring to a sidebar item under that page, that's a different area of the app entirely. Less likely given the inbox-focused conversation context, but possible.

### Action

Ask the user in chat which interpretation matches their intent. If (3a), capture as a design constraint for the upcoming ContextPanel implementation. If (4), open a separate ticket scoped to `/settings`.
