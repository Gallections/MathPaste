# Build & Deploy Pipeline Design

**Date:** 2026-04-12
**Status:** Approved

## Goal

Add a modern local development workflow to MathPaste using Vite + TypeScript, with auto-reload on save and a packaging script for eventual Chrome Web Store submission.

## Tooling

| Tool | Purpose |
|------|---------|
| Vite | Bundler and dev build runner |
| vite-plugin-web-ext | MV3-aware extension reloader, watches dist/ and reloads Chrome on rebuild |
| TypeScript | Type safety across all source files |
| @typescript-eslint | Linting with TS-aware rules |

## Project Structure

```
MathPaste/
├── src/
│   ├── background.ts       (renamed from background.js)
│   ├── copy.ts             (renamed from copy.js)
│   ├── frontend.ts         (renamed from frontend.js)
│   ├── onboarding.html
│   ├── onboarding.css
│   └── style.css
├── icons/                  (stays at root, copied to dist/ by Vite)
├── manifest.json           (stays at root, read by vite-plugin-web-ext)
├── dist/                   (gitignored — load this folder in Chrome)
├── vite.config.ts
├── tsconfig.json
├── package.json
└── .eslintrc.json
```

`videos/` is not bundled (too large, dev-only reference assets).

## Build Pipeline

Vite is configured in **library mode** with Rollup's multi-entry `input` map so that `background.ts`, `copy.ts`, and `frontend.ts` each compile to their own independent output file. They must not be merged — Chrome MV3 requires separate files for service workers and content scripts.

`vite-plugin-web-ext` reads `manifest.json` from the root, copies it to `dist/` with rewritten asset paths, and signals Chrome to reload the extension after each rebuild.

## npm Scripts

```
npm run dev      → vite build --watch   (rebuilds on save, auto-reloads extension in Chrome)
npm run build    → vite build           (one-shot production build)
npm run package  → npm run build && node scripts/package.js   (zips dist/ → mathpaste.zip)
npm run lint     → eslint src/
```

## TypeScript Config

- Target: `ES2020` (Chrome 90+ compatible)
- Libs: `DOM`, `DOM.Iterable` (for Clipboard API, MutationObserver, etc.)
- Strict mode: enabled

## Dev Workflow After Setup

1. Run `npm run dev`
2. Edit any `.ts` file in `src/`
3. Vite rebuilds in ~100ms
4. `vite-plugin-web-ext` reloads the extension and active tab automatically

**Initial one-time setup:** Load unpacked pointing to `dist/` in `chrome://extensions/`. Only needs to be done once.

## Known Constraints

- The MV3 service worker (`background.ts`) always does a full extension reload on change — Chrome does not support partial HMR for service workers. This is a Chrome platform limitation.
- Content scripts (`copy.ts`, `frontend.ts`) reload cleanly without a full browser restart.

## Future: Chrome Web Store

`npm run package` produces `mathpaste.zip` ready for manual upload to the Chrome Web Store dashboard. Automated submission via the Web Store Publish API is out of scope for this phase.
