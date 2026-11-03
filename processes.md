# Processes

Recurring workflow patterns for working on airbudget, distilled from past
sessions. Each entry here has shown up more than once — not a one-off
incident.

## Testing and verification

- After a change with zero runtime effect (comments, text-only wording),
  verify with a syntax check only, or nothing for HTML-only text tweaks —
  don't re-run the full browser test suite. Reserve that for actual
  behavioral/functional changes.
- Test-run anomalies (wrong counts, "function not defined" failures,
  stuck "running…") are almost always a stale-cache artifact — the
  service worker or Chrome's disk cache — not real flakiness. Root-cause
  by unregistering the service worker, clearing Cache Storage, and
  hard-reloading `index.html` first, then `tests.html`, before concluding
  it's a true regression or writing it off as noise.
- Don't rely on the automated test suite alone for UI-visibility-sensitive
  changes. Do a manual pass too — screenshot and interact — since weak
  assertions can pass while the UI is actually broken.

## Bug fixes

- When a real bug is found, by any means, fix it and add a dedicated
  regression test for it in the same change.

## Collaboration

- A question is not an implicit request to act. Diagnose and answer
  first, then ask before changing anything, even when the fix seems
  obvious.
- Ask for clarification when the next implementation choice isn't
  obvious, not only when the request itself is ambiguous.

## Code philosophy

- Prefer less code, or no code, when a change can be made that way.
  Look for ways to minimize code before adding to it.
