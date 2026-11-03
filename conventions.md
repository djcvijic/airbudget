# Conventions

Coding and repository-structure conventions for airbudget, used when
building new features. Front-end-only, single-page, vanilla web app: no
framework, no bundler, no build step, no package manager, no transpile
step — not even a small one. Design mobile-first.

## File layout

- `index.html` — all screens' DOM structure, at the repo root.
- `css/` — every stylesheet. `js/` — every script. Both flat, no further
  nesting; `index.html`'s `<link>`/`<script>` tags reference them as
  `css/name.css` / `js/name.js` and encode the real load order for `js/`.
- `css/theme.css` — reusable, app-agnostic chrome only. Zero app-specific
  selectors.
- One `.css` file per screen/feature under `css/`, named after it.
- `js/theme.js` — generic, reusable behavior with no dependency on app
  state. Same app-agnostic bar as `theme.css`: zero app-specific
  behavior.
- `theme.css` and `theme.js` are shared byte-for-byte across every
  project built from this template.
- One `.js` file per screen/feature under `js/`.
- `js/main.js` — boot sequence and event wiring, loads last.
- Vendored third-party assets (fonts, icon libraries) keep their own
  top-level directory instead of being folded into `css/`/`js/` — e.g.
  `fontawesome/` — so their license file and internal structure stay
  intact.
- A stylesheet moved into `css/` that references another file by a
  relative URL (`url(...)` in a `@font-face`, etc.) must update that path
  to account for `css/` as the new base — relative URLs resolve against
  the stylesheet's own location, not `index.html`'s.

## Screen structure

Every full-screen (non-modal) feature screen is a `<div id="x-screen"
class="screen">` with the same internal skeleton: `.screen-header` (back
button + `.screen-title`), an optional `.screen-description`, body
content, then `.screen-actions`. These wrapper classes live in
`theme.css`; a new screen reuses them instead of writing its own
header/footer CSS.

## Screen navigation

`theme.js` provides generic screen-transition mechanics
(`setActiveScreen`, `wireNavButton`); `state.js` wraps them once in
`showScreen(screen)`, which also maintains the nav-button highlight and
bottom-nav visibility. Every screen's `open*Screen()` calls
`showScreen()`, never `setActiveScreen` directly — calling it directly
bypasses that bookkeeping.

## Unsaved-edit guard

A screen that lets the user edit state before applying it wires
`createUnsavedGuard(hasUnsaved*Changes, *UnsavedModal)` and
`wireSoftDisableClick(*DoneButton, "No changes to apply", apply*)` (both
from `theme.js`), plus a matching `*-unsaved-modal` with back/discard
buttons in `index.html`. A new editable screen should reuse this pair
instead of hand-rolling dirty-checking.

## State mutations

Screens mutate `state.<field>` directly, then call the matching
`save*()` from `state.js` (`saveMeta`/`saveCategories`/
`saveTransactions`) for whichever storage key that field belongs to.
There is no reactive store — a new state field must be assigned to one
of these three buckets, and the mutation site is responsible for calling
the right `save*()` itself.

## State reset paths

Any code path that replaces the whole in-memory `state` object (deleting
all data, importing a file, generating debug data) must build from
`defaultState()` and overlay only the fields it means to change, never
hand-roll the object's shape. A hand-rolled replacement silently drops any
field added to `defaultState()` after that code was written — this is
exactly how `importData()` lost `goalAmount`/`goalSetDate`/`lastSeenReport`
on every import until `stateFromImport()` fixed it by deriving the
importable field set from `defaultState()` itself.

## CSS breakpoints

`theme.css` is the only stylesheet that defines `@media` breakpoints.
Screen-specific stylesheets never add their own; responsive behavior for
a new screen should come from the existing global breakpoint and shared
layout primitives in `theme.css`.

## Tests

Each `*.test.js` file defines its own `seededFor<Screen>(overrides)`
builder that shallow-merges `overrides` over defaults, then drives the
app via `await freshApp(seededForX(...))`. Suites are named `"<screen>
screen[: <variant>]"` for screen tests, or `"<file>.js: <functionName>"`
for pure-logic tests in `logic.test.js`. A new screen's tests should add
their own seed builder rather than reusing another screen's.

## Common pitfalls

- Toggling an element's visibility via `el.style.display` only shows it if
  you set an explicit non-`none` value for the visible state (`"flex"`,
  `"block"`, etc.). Setting `el.style.display = ""` does not show an
  element whose CSS rule is `display: none` — it just falls back to that
  same stylesheet default, so the element stays hidden with no error.

## Comment policy

- Use only simple language, be clear, be precise, and avoid phrases and
  run-on sentences.
- Default to no comments. Well-named functions/variables and descriptive
  test names carry the meaning; comments are the exception, not the
  baseline.
- A comment earns its place only by explaining a non-obvious WHY: a
  hidden constraint, a load-order dependency, a subtle invariant, or a
  decision that would surprise a reader.
- Never comments that restate what the code does. No narrating a loop or
  a line-by-line description of logic.
- Never comments referencing the current task, fix, or ticket. That
  belongs in commit messages, and rots as the code evolves.
- No comments in tests. Tests should be self-explanatory through their
  names and structure.

## Code philosophy

- Prefer less code, or no code, when a change can be made that way.
  Look for ways to minimize code before adding to it.

## Avoid speculative abstraction

Given the template's small, static-file scope, prefer duplicating a few
lines over introducing a helper, config layer, or indirection for a
single current use.
