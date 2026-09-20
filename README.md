# airbudget

A single-page, no-build-step web app. Pure HTML/CSS/JS — no framework, no
bundler, no package manager.

- `index.html` — page structure for every screen.
- `css/` — all stylesheets; `js/` — all scripts. Both are flat, one file
  per screen/feature, loaded in the fixed order `index.html` declares.
- `theme.css` / `theme.js` — generic, reusable chrome and behavior (fonts,
  colors, buttons, modals, banners, back-to-top, toast).
- `currencies-data.js` — pure data: the curated currency list.
- `state.js` — persistence and derived calculations shared by every screen.
- One `.css`/`.js` pair per screen/feature: `settings`, `onboarding`,
  `categories`, `goals`, `main-view`, `report`, `install-prompt`,
  `transaction`, `detail`, `debug`.
- `main.js` — boot sequence and all event wiring, loads last.

## Running it

```bash
python3 -m http.server 8934
# then open http://localhost:8934/index.html
```
