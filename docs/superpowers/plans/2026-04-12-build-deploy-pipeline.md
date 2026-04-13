# Build & Deploy Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce Vite + TypeScript + ESLint to MathPaste, enabling auto-reload on save during development and a `npm run package` command for Chrome Web Store submission.

**Architecture:** Source files move to `src/` and are renamed to `.ts`. Vite bundles them into `dist/` using `vite-plugin-web-extension`, which reads `manifest.json`, compiles all entry points as separate IIFE scripts (required for MV3 content scripts), and hot-reloads the extension on each rebuild. `vite-plugin-static-copy` copies the `icons/` folder to `dist/` since it is not an explicit entry point.

**Tech Stack:** Vite 5, vite-plugin-web-extension 4, vite-plugin-static-copy, TypeScript 5, @types/chrome, ESLint 9, typescript-eslint 8, archiver 7

---

## File Map

| Action | Path |
|--------|------|
| Create | `package.json` |
| Create | `tsconfig.json` |
| Create | `vite.config.ts` |
| Create | `eslint.config.js` |
| Create | `scripts/package.js` |
| Create | `src/background.ts` |
| Create | `src/copy.ts` |
| Create | `src/frontend.ts` |
| Create | `src/style.css` |
| Create | `src/onboarding.html` |
| Create | `src/onboarding.css` |
| Modify | `manifest.json` |
| Modify | `.gitignore` |
| Modify | `CLAUDE.md` |
| Delete | `background.js` |
| Delete | `copy.js` |
| Delete | `frontend.js` |
| Delete | `style.css` (root) |
| Delete | `onboarding.html` (root) |
| Delete | `onboarding.css` (root) |

---

### Task 1: Create package.json and install dependencies

**Files:**
- Create: `package.json`

- [ ] **Step 1: Create package.json**

Create `package.json` at the project root with the following content:

```json
{
  "name": "mathpaste",
  "version": "1.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite build --watch",
    "build": "vite build",
    "package": "npm run build && node scripts/package.js",
    "lint": "eslint src/"
  },
  "devDependencies": {
    "@types/chrome": "^0.0.268",
    "archiver": "^7.0.1",
    "eslint": "^9.0.0",
    "typescript": "^5.4.0",
    "typescript-eslint": "^8.0.0",
    "vite": "^5.2.0",
    "vite-plugin-static-copy": "^1.0.0",
    "vite-plugin-web-extension": "^4.1.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

```bash
npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Verify key binaries are available**

```bash
npx vite --version && npx tsc --version && npx eslint --version
```

Expected output (versions may vary):
```
vite/5.x.x
Version 5.x.x
v9.x.x
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add package.json and install build dependencies"
```

---

### Task 2: Create tsconfig.json

**Files:**
- Create: `tsconfig.json`

- [ ] **Step 1: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": false,
    "noEmit": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*", "vite.config.ts", "scripts/**/*"]
}
```

`strict: false` is intentional for the initial migration — the existing JS code has patterns (e.g., string-array coercion in `traverseHTMLLatex`) that require annotation work before strict mode can be enabled. Enable incrementally after migration.

- [ ] **Step 2: Verify TypeScript accepts the config**

```bash
npx tsc --version
```

Expected: prints version with no errors (no files to check yet).

- [ ] **Step 3: Commit**

```bash
git add tsconfig.json
git commit -m "chore: add tsconfig.json targeting ES2020 with strict mode off"
```

---

### Task 3: Create vite.config.ts

**Files:**
- Create: `vite.config.ts`

- [ ] **Step 1: Create vite.config.ts**

```ts
import { defineConfig } from 'vite'
import webExtension from 'vite-plugin-web-extension'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  plugins: [
    webExtension(),
    viteStaticCopy({
      targets: [
        { src: 'icons', dest: '.' },
        { src: 'videos', dest: '.' },
      ],
    }),
  ],
})
```

`webExtension()` reads `manifest.json` from the project root, discovers all entry points (background, content scripts, HTML pages), bundles them, and rewrites paths in the output manifest. `viteStaticCopy` handles the `icons/` and `videos/` directories since they are not referenced as explicit module entry points.

- [ ] **Step 2: Verify Vite can parse the config**

```bash
npx vite build --config vite.config.ts 2>&1 | head -5
```

Expected: either a build error (because `src/` doesn't exist yet — that's fine) or a config parse success message. If you see `Cannot find module 'vite-plugin-web-extension'`, run `npm install` again.

- [ ] **Step 3: Commit**

```bash
git add vite.config.ts
git commit -m "chore: add vite config with web-extension and static-copy plugins"
```

---

### Task 4: Create eslint.config.js

**Files:**
- Create: `eslint.config.js`

- [ ] **Step 1: Create eslint.config.js**

```js
import tseslint from 'typescript-eslint'

export default tseslint.config(
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': 'warn',
    },
  },
)
```

- [ ] **Step 2: Commit**

```bash
git add eslint.config.js
git commit -m "chore: add ESLint flat config with typescript-eslint recommended rules"
```

---

### Task 5: Move source files into src/

**Files:**
- Create: `src/background.ts`, `src/copy.ts`, `src/frontend.ts`, `src/style.css`, `src/onboarding.html`, `src/onboarding.css`
- Delete: `background.js`, `copy.js`, `frontend.js`, `style.css`, `onboarding.html`, `onboarding.css`

- [ ] **Step 1: Create src/ and copy background.ts**

Copy the content of `background.js` into `src/background.ts`. No changes needed — it compiles as valid TypeScript with `strict: false` and `@types/chrome`.

```bash
cp background.js src/background.ts
```

- [ ] **Step 2: Create src/frontend.ts**

Copy the content of `frontend.js` into `src/frontend.ts`. No changes needed.

```bash
cp frontend.js src/frontend.ts
```

- [ ] **Step 3: Create src/copy.ts**

Copy `copy.js` to `src/copy.ts`. Do NOT copy verbatim — `traverseHTMLLatex` contains JavaScript type coercions that TypeScript rejects even with `strict: false`. Apply the following fixes:

Original lines 139–142 in `copy.js`:
```js
let textContent = [];

function dfs (root) {
    if (Date.now() - startTime > 3000) {
        throw new Error("The nested HTML strucutre is infinite!");
    }
    if (!root) {
        return;
    }

    const nodes = root.childNodes;
    if (nodes.length === 0) {
        textContent = textContent + [root.textContent];
        return;
    }
    // ...
    textContent = textContent + [latexMathContent];
```

Replace with:
```ts
let textContent: string = '';

function dfs (root: any): string | undefined {
    if (Date.now() - startTime > 3000) {
        throw new Error("The nested HTML structure is infinite!");
    }
    if (!root) {
        return;
    }

    const nodes = root.childNodes;
    if (nodes.length === 0) {
        textContent += root.textContent ?? '';
        return;
    }
    // ...
    textContent += latexMathContent ?? '';
```

The original code used `textContent = textContent + [value]` which relies on JavaScript's implicit array-to-string coercion (`"" + ["foo"]` → `"foo"`). TypeScript rejects assigning `string | string[]` back to a `never[]` typed variable. The fix converts to a string accumulator with `+=`.

Create the file with these changes applied:

```bash
# Copy then edit — do NOT use the raw cp command for this file
cp copy.js src/copy.ts
# Then open src/copy.ts and apply the changes in Step 3 above
```

- [ ] **Step 4: Copy CSS and HTML files**

```bash
cp style.css src/style.css
cp onboarding.html src/onboarding.html
cp onboarding.css src/onboarding.css
```

- [ ] **Step 5: Verify TypeScript compiles src/**

```bash
npx tsc --noEmit
```

Expected: no errors. If you see errors in `copy.ts`, they will be in `traverseHTMLLatex` — apply the fix from Step 3.

- [ ] **Step 6: Delete old root-level source files**

```bash
git rm background.js copy.js frontend.js style.css onboarding.html onboarding.css
```

- [ ] **Step 7: Commit**

```bash
git add src/
git commit -m "feat: move source files to src/ and rename to TypeScript"
```

---

### Task 6: Update manifest.json

**Files:**
- Modify: `manifest.json`

`vite-plugin-web-extension` reads `manifest.json` and uses the file paths to discover entry points. Update all paths to point to `src/`.

- [ ] **Step 1: Update manifest.json**

Replace the current content of `manifest.json` with:

```json
{
    "manifest_version": 3,
    "name": "Math Paste",
    "version": "1.1.0",
    "description": "An light weight application that aims to ease the transfer of rendered math equations from GPT to Notion",
    "permissions": [
        "activeTab",
        "scripting",
        "clipboardRead",
        "clipboardWrite",
        "storage",
        "tabs",
        "webNavigation"
    ],
    "host_permissions": ["<all_urls>"],
    "icons": {
        "16": "icons/favicons/mathPaste-16x16.png",
        "48": "icons/favicons/mathPaste-48x48.png",
        "128": "icons/favicons/mathPaste-128x128.png"
    },
    "web_accessible_resources": [
        {
            "resources": ["icons/*", "src/onboarding.html"],
            "matches": ["<all_urls>"]
        }
    ],
    "background": {
        "service_worker": "src/background.ts"
    },
    "content_scripts": [
        {
            "matches": ["<all_urls>"],
            "js": ["src/copy.ts", "src/frontend.ts"],
            "css": ["src/style.css"],
            "run_at": "document_start"
        }
    ],
    "action": {
        "default_title": "Math Paste",
        "default_icon": {
            "16": "icons/favicons/mathPaste-16x16.png",
            "48": "icons/favicons/mathPaste-48x48.png",
            "128": "icons/favicons/mathPaste-128x128.png"
        }
    },
    "commands": {
        "toggle-math-paste": {
            "suggested_key": {
                "default": "Ctrl+M",
                "mac": "Command+M"
            },
            "description": "Toggle math-paste on/off"
        }
    }
}
```

Changes from the original:
- Removed duplicate `"activeTab"` permission
- Updated `"version"` to `"1.1.0"` (matches git history)
- `"service_worker"` changed from `background.js` → `src/background.ts`
- `"js"` changed from `["copy.js", "frontend.js"]` → `["src/copy.ts", "src/frontend.ts"]`
- `"css"` changed from `["style.css"]` → `["src/style.css"]`
- `"resources"` updated to `"src/onboarding.html"` in web_accessible_resources
- Icon paths remain unchanged (icons stay at project root, copied to dist/ by viteStaticCopy)

- [ ] **Step 2: Commit**

```bash
git add manifest.json
git commit -m "chore: update manifest.json to reference src/ TypeScript entry points"
```

---

### Task 7: Update .gitignore

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Update .gitignore**

Replace the current content of `.gitignore` with:

```
.claude/
CLAUDE.md
dist/
node_modules/
mathpaste.zip
```

- [ ] **Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add dist/, node_modules/, and mathpaste.zip to .gitignore"
```

---

### Task 8: Create packaging script

**Files:**
- Create: `scripts/package.js`

- [ ] **Step 1: Create scripts/package.js**

```js
import archiver from 'archiver'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const distPath = path.join(root, 'dist')
const outputPath = path.join(root, 'mathpaste.zip')

if (!fs.existsSync(distPath)) {
  console.error('dist/ not found. Run npm run build first.')
  process.exit(1)
}

if (fs.existsSync(outputPath)) {
  fs.unlinkSync(outputPath)
}

const output = fs.createWriteStream(outputPath)
const archive = archiver('zip', { zlib: { level: 9 } })

output.on('close', () => {
  console.log(`mathpaste.zip created (${(archive.pointer() / 1024).toFixed(1)} KB)`)
})

archive.on('error', (err) => {
  throw err
})

archive.pipe(output)
archive.directory(distPath, false)
archive.finalize()
```

- [ ] **Step 2: Commit**

```bash
git add scripts/package.js
git commit -m "chore: add packaging script to zip dist/ for Chrome Web Store"
```

---

### Task 9: Verify the full build pipeline

- [ ] **Step 1: Run a production build**

```bash
npm run build
```

Expected:
- No errors
- `dist/` directory created containing:
  - `background.js`
  - `copy.js`
  - `frontend.js`
  - `style.css`
  - `manifest.json` (with paths rewritten to output filenames, no `src/` prefix)
  - `onboarding.html`
  - `icons/` directory with all icon files

If icons are missing from dist/, open `vite.config.ts` and verify `viteStaticCopy` targets are correct. If `onboarding.html` is missing, verify it is listed in `web_accessible_resources` in `manifest.json`.

- [ ] **Step 2: Load in Chrome and verify the extension works**

1. Open `chrome://extensions/`
2. Enable Developer Mode
3. Click **Load unpacked** → select the `dist/` folder
4. Navigate to `https://chatgpt.com` or `https://claude.ai`
5. Press `Ctrl+M` — the floating UI should appear in the top-right corner
6. Select a format (e.g., Obsidian)
7. Copy a math equation from the AI response
8. Paste into a text editor — verify it has `$...$` or `$$...$$` wrapping

- [ ] **Step 3: Test auto-reload with npm run dev**

1. Run `npm run dev` in a terminal
2. Make a visible change in `src/frontend.ts` (e.g., change the `OPTIONS` map to add a `console.log`)
3. Save the file
4. Verify Vite rebuilds in the terminal output (should take under 1 second)
5. Verify the extension reloads in Chrome automatically (the floating UI will briefly disappear)
6. Revert the change

- [ ] **Step 4: Verify linting passes**

```bash
npm run lint
```

Expected: no errors. Warnings about `@typescript-eslint/no-explicit-any` or `no-unused-vars` are acceptable at this stage.

- [ ] **Step 5: Verify packaging works**

```bash
npm run package
```

Expected:
```
mathpaste.zip created (X.X KB)
```

Verify `mathpaste.zip` exists at the project root.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: complete Vite + TypeScript build pipeline with auto-reload and packaging"
```

---

### Task 10: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Replace the Development Workflow section in CLAUDE.md**

Find and replace the "Development Workflow" section with:

```markdown
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
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with new npm-based dev workflow"
```
