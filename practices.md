# Practices

Recurring workflow patterns for working on airbudget, distilled from past
sessions. Each entry here has shown up more than once — not a one-off
incident.

## Running the app

- Serve the project root over HTTP; never open `index.html` via
  `file://`.

  ```bash
  python3 ~/git/serve.py 8935
  # then open http://localhost:8935/index.html
  ```

- Once started, leave this server running — do not stop it (e.g.
  `pkill`) unless explicitly told to. It stays open across turns so the
  app can be viewed live; killing it between edits breaks that.
- Chrome caches `.js` files by URL. After editing any `.js` file,
  hard-reload (`cmd+shift+r`) before checking behavior — a plain reload
  can silently serve the old script with no error.
- When testing via browser automation, Chrome is normally in responsive
  device-emulation mode (mobile-first). Synthetic mouse clicks can time
  out or silently no-op there — if a click hangs or does nothing, try
  dispatching touch events (`touchstart`/`touchend`) instead, or fall
  back to calling the element's `.click()` directly via the JS execution
  tool.
- After verifying a change, stop. Don't click Back, Cancel, or any nav
  button "to leave things tidy" once the check is done — leave the
  browser on whatever screen/modal the last verification step landed on.
  This includes the final step of a testing sequence: the last action
  should be the check itself, not a cleanup navigation after it.

## Deploying

Live at https://djcvijic.github.io/airbudget/, served via GitHub Pages
from the `main` branch root — pushing to `main` deploys directly, no
build step, no Actions workflow.

Before pushing to `main`, if the push changes anything `sw.js`'s
`APP_SHELL` lists (any served `.css`/`.js`/`index.html`/font/icon),
commit a `CACHE_NAME` bump in `sw.js` first, as its own step before the
push. The service worker is cache-first; its own update check only
triggers when `sw.js`'s bytes change, so a deploy that edits a cached
file without bumping `CACHE_NAME` is invisible to already-installed
users indefinitely, not just delayed.

## Testing and verification

- Test UI changes at phone viewport sizes first, not desktop.
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
- Establish a stable repro before fixing — don't apply a fix based on a
  guess at the root cause.

## Code review

- Focus on simplicity and clarity. Focus on naming — names should be
  true, precise, and just descriptive enough. Remove dead code.
- Enforce the theme/app-specific boundary during review — see
  `conventions.md`'s File layout section for the rule.
- Protect the "no build step" promise during review — see
  `conventions.md` for what that means.
- Check load order stays correct and explicit during review — see
  `conventions.md`'s File layout section for why it matters.
- Enforce `conventions.md`'s Comment policy during review as a literal
  first step, not an optional afterthought — this specific check is the
  one that gets skipped most often in practice. Always run it when asked
  to review code, without being asked separately.
- Enforce `conventions.md`'s no-speculative-abstraction rule during
  review too, not just when writing new code.

## Collaboration

- When a request is ambiguous or underspecified, ask for clarification
  before proceeding. Do not default to an assumption.
- Never edit `theme.css` or `theme.js` without confirming with the user
  first — see `conventions.md`'s File layout section for why.
- "The project" / "the whole codebase" means everything in the repo,
  including `tests/` — not just the app files listed in `conventions.md`'s
  File layout section. A review or refactor scoped to less than that is a
  silent narrowing; say so explicitly if you're intentionally scoping
  down.
- A question is not an implicit request to act. Diagnose and answer
  first, then ask before changing anything, even when the fix seems
  obvious.
- Ask for clarification when the next implementation choice isn't
  obvious, not only when the request itself is ambiguous.
- When a pattern repeats 3+ times or a correction recurs during normal
  work, flag it as a candidate convention or process. Suggest it, don't
  add it — the user confirms before it goes into `conventions.md` or
  `practices.md`.

## Git operations

- Only run read-only git commands (`status`, `diff`, `log`, `show`,
  `branch` listing, etc.) without being asked. Any mutating command —
  `add`, `commit`, `push`, branch create/delete, `checkout`, `merge`,
  `rebase`, `reset`, `stash` — needs specific one-time permission from
  the user for that exact operation. An earlier go-ahead doesn't carry
  forward to the next one.
