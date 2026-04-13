# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MathPaste is a Chrome Extension (Manifest V3) that intercepts copy events on AI chatbot pages (ChatGPT, Claude.AI, Copilot) and transforms KaTeX-rendered math equations into LaTeX/Markdown formats for Notion, Obsidian, or raw LaTeX output. It uses vanilla JavaScript with zero external dependencies.

## Development Workflow

**Install dependencies (once):**
```bash
npm install
```

**Commands:**
```bash
npm run dev      # Build + watch — auto-reloads extension on save
npm run build    # One-shot production build → dist/
npm run lint     # Run ESLint across src/
npm run package  # Build then zip dist/ → mathpaste.zip (for Web Store)
```

**Initial Chrome setup (once):**
1. Open `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **Load unpacked** → select the `dist/` folder (NOT the project root)
4. From this point, `npm run dev` handles all reloading automatically

**TypeScript:** `strict: false` is intentional — enable incrementally once type annotations are added to the existing code. Run `npx tsc --noEmit` to check types.

## Architecture

The extension has three main scripts that communicate via Chrome message passing:

### background.js (Service Worker)
Orchestrates the extension lifecycle. Injects content scripts into `http`/`https` tabs on activation and navigation completion. Relays messages between `frontend.js` and `copy.js`. Handles the `Ctrl+M` keyboard command.

### copy.js (Content Script — injected at `document_start`)
The core math conversion engine. Listens for `copy` events, reads HTML from the clipboard, traverses the DOM tree (DFS with 3s timeout guard), finds KaTeX `<annotation>` elements containing raw LaTeX, and writes the reformatted content back to the clipboard.

Two traversal modes based on user-selected format:
- `traverseHTMLWrapped()` — wraps equations in `$`/`$$` (Notion/Obsidian)
- `traverseHTMLLatex()` — extracts raw LaTeX (vanilla LaTeX output)

### frontend.js (Content Script — injected with copy.js)
Injects the draggable floating UI (top-right corner) into the active tab. Sends `functionChange` messages to background.js when the user selects a format (Obsidian/Notion/LaTeX/None). Uses a `MutationObserver` to re-inject UI after SPA navigation.

### Message Flow
```
User clicks format option
  → frontend.js sends "functionChange" to background.js
  → background.js relays to copy.js with imgId
  → copy.js registers the appropriate copy handler
```

## Key Technical Details

- KaTeX renders math using `<annotation encoding="application/x-tex">` tags — this is the source of raw LaTeX that `copy.js` extracts.
- The Clipboard API is used directly (no jQuery). HTML is read via `ClipboardItem` and written back after transformation.
- `manifest.json` declares permissions: `clipboardRead`, `clipboardWrite`, `activeTab`, `scripting`, `webNavigation`, `tabs`.
- Content scripts are injected programmatically (not via `content_scripts` manifest field) to allow dynamic control.
