# Math Paste (2.0.0)

[![Available on the Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-Install%20Math%20Paste-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/math-paste/klkkpojhdgbmkelmimcceifbpknnimoi)

Copy math equations from AI conversations and paste them perfectly formatted into Obsidian, LaTeX, Word, and more!

Math Paste intercepts copy events on AI chatbot pages (ChatGPT, Claude, Copilot, etc.) and automatically converts KaTeX-rendered math equations into the format your notebook app expects — no manual reformatting needed.

**How it works:**
1. Open any supported AI chatbot in Chrome
2. Hover over the floating pill to pick your target format
3. Copy math from the chatbot as usual
4. Paste — it's already formatted correctly

Lightweight, zero external dependencies, and fully isolated so it never interferes with the page.

## Demo
Video Demo: [🎥 Watch on YouTube](https://www.youtube.com/watch?v=m4J2uIUJ6IE)

## Screenshots

<p align="center">
  <img src="https://lh3.googleusercontent.com/yRVwO0ezrzKCvJh5UPN-xrdLuzK3x_RcDXxtudHM4CwY3chG_XRjZnhkTDo0yZNkV_fZ5-r05BbC0bK2vzdpDcVYpMQ=s1280-w1280-h800" alt="Math Paste format selector panel open next to the floating pill on a ChatGPT conversation" width="720">
</p>
<p align="center"><em>Hover the pill to pick one of nine target formats.</em></p>

<p align="center">
  <img src="https://lh3.googleusercontent.com/ngXnuotPwxzaAlQxyro7UxRNrSvq2eRohBzoR9rs2lgSq5GINB6DZOaFGrJxzVzDlbEoTuzju8gAr7QzKHqxLzX60Qs=s1280-w1280-h800" alt="Selecting a Fourier series answer on ChatGPT with the Math Paste pill set to MathJax" width="720">
</p>
<p align="center"><em>Select and copy as usual — the pill shows the active format (here, MathJax).</em></p>

## Table of Contents
- [Demo](#demo)
- [Screenshots](#screenshots)
- [Getting Started](#getting-started)
  - [Chrome Extension](#chrome-extension)
  - [Install from Source](#install-from-source)
- [Usage](#usage)
- [Supported Formats](#supported-formats)
- [Development](#development)
- [Tech Stack](#tech-stack)

## Getting Started
Math Paste v2.0.0 is available on the Chrome Web Store, or you can install it manually from source.

### Chrome Extension
**[Install Math Paste from the Chrome Web Store](https://chromewebstore.google.com/detail/math-paste/klkkpojhdgbmkelmimcceifbpknnimoi)** — one click, and it updates automatically.

### Install from Source

1. Clone the repository

```bash
git clone https://github.com/Gallections/MathPaste.git
cd MathPaste
```

2. Install dependencies and build

```bash
npm install
npm run build
```

3. Open `chrome://extensions/` in Chrome and enable **Developer Mode**

4. Click **Load unpacked** and select the `dist/` folder (NOT the project root)

5. The extension icon will appear in your toolbar — you're ready to go!

> **Tip:** Run `npm run dev` during development for automatic rebuilds on save.

## Usage

### User Guide
1. Open ChatGPT, Claude, Copilot, or another supported AI chatbot in Chrome.
2. The Math Paste floating pill appears automatically near the top-right corner. Drag it anywhere on the page if it's in the way.
3. Hover over the pill to open the format selector panel.
4. Select your target format (Obsidian, LaTeX, Word, etc.). Your choice is remembered across tabs and sessions.
5. Copy rendered math from the chatbot — Math Paste intercepts the copy and reformats it automatically. Partial selections that cut through an equation are reconstructed so the math still comes through intact.
6. Paste into your notebook app. The math will be formatted correctly.
7. Press **`Alt+Shift+M`** to turn math conversion on/off.

### Settings
Click the Math Paste icon in the Chrome toolbar to open the popup. From there you can open the docs, and under **Settings**:
- **Appearance** — Light, Dark, or System theme.
- **Math Paste** — turn math conversion on/off (same as `Alt+Shift+M`).
- **Floating pill** — show or hide the on-page format picker.

### Switching Tabs
Math Paste auto-injects when you switch to a new tab — no refresh needed.

### Common Issues
- If the extension stops responding, reload it from `chrome://extensions/`.
- Refresh the current page after reloading the extension.
- If the pill is gone, check that **Floating pill** is enabled in the popup's Settings (the pill's ✕ only hides it on the current page).
- If copies come through unconverted, make sure **Math Paste** is enabled in Settings — `Alt+Shift+M` may have turned it off.

## Supported Formats

| Format | Syntax | Target app |
|---|---|---|
| **Obsidian** | `$…$` / `$$…$$` | Obsidian |
| **LaTeX** | raw LaTeX | LaTeX editors |
| **MathJax** | `\(…\)` / `\[…\]` | Web / MathJax |
| **Typst** | `$ … $` | Typst |
| **MediaWiki** | `<math>…</math>` | Wikipedia / MediaWiki |
| **AsciiMath** | ASCII notation | AsciiMath renderers |
| **Markdown** | `$…$` + `**bold**` etc. | Any Markdown editor |
| **Word** | MathML (native equation) | Microsoft Word |
| **None** | — | Passthrough (no conversion) |

## Development

```bash
npm run dev       # rebuild dist/ on save
npm test          # run the Vitest suite
npm run lint      # ESLint
npm run package   # build and zip for the Chrome Web Store
```

## Tech Stack
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)
![Chrome Extension](https://img.shields.io/badge/Chrome%20Extension-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white)
![Manifest v3](https://img.shields.io/badge/Manifest%20v3-000000?style=for-the-badge&logo=json&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)
![Clipboard API](https://img.shields.io/badge/Clipboard%20API-5C2D91?style=for-the-badge&logo=googlechrome&logoColor=white)
