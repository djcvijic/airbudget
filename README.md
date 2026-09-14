# airbudget

A single-page, no-build-step web app. Pure HTML/CSS/JS — no framework, no
bundler, no package manager.

- `index.html` — page structure for every screen.
- `theme.css` / `theme.js` — generic, reusable chrome and behavior (fonts,
  colors, buttons, modals, back-to-top, toast).
- `currencies-data.js` — pure data: the curated currency list.
- `state.js` — persistence and derived calculations shared by every screen.
- One `.css`/`.js` pair per screen/feature: `settings`, `onboarding`,
  `categories`, `main-view`, `transaction`, `detail`, `debug`.
- `main.js` — boot sequence and all event wiring, loads last.

## Running it

```bash
python3 -m http.server 8934
# then open http://localhost:8934/index.html
```
