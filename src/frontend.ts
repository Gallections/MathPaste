import {
    getStoredFormat, setStoredFormat,
    getStoredUiEnabled, onUiEnabledChange,
    getStoredGeneration,
    getStoredTheme, resolveTheme, onThemeChange,
    onFormatChange,
} from "./state";
import { ICON_X, createIconElement } from "./icons";

// ─── Format registry ─────────────────────────────────────────────────────────

interface FormatDef {
    label: string;
    abbr:  string;
    hint:  string;
    color: string;
}

const FORMATS: Record<string, FormatDef> = {
    "math_paste_Obsidian":  { label: "Obsidian",  abbr: "OBS", hint: "$…$",      color: "#7C3AED" },
    "math_paste_LaTex":     { label: "LaTeX",     abbr: "TEX", hint: "raw",      color: "#EF4444" },
    "math_paste_MathJax":   { label: "MathJax",   abbr: "MJX", hint: "\\(…\\)", color: "#22C55E" },
    "math_paste_Typst":     { label: "Typst",     abbr: "TYP", hint: "$ … $",   color: "#06B6D4" },
    "math_paste_MediaWiki": { label: "MediaWiki", abbr: "MW",  hint: "<math>",   color: "#3B82F6" },
    "math_paste_AsciiMath": { label: "AsciiMath", abbr: "ASC", hint: "ascii",    color: "#F59E0B" },
    "math_paste_Markdown":  { label: "Markdown",  abbr: "MD",  hint: "**…**",   color: "#0EA5E9" },
    "math_paste_None":      { label: "None",      abbr: "OFF", hint: "–",        color: "#6B7280" },
};

// ─── Shadow CSS (fully isolated — no !important needed) ──────────────────────
// Theme tokens on :host, overridden by :host([data-theme="dark"]) — set from
// JS (see applyTheme below) after resolving the stored preference, "system"
// included. Custom properties are the only clean way to theme shadow-DOM
// content from outside without breaking the isolation the shadow root exists
// to provide.

const SHADOW_CSS = `
* { box-sizing: border-box; }

:host {
    display: block;
    position: fixed;
    top: 100px;
    right: 20px;
    width: max-content;
    z-index: 2147483647;
    user-select: none;
    -webkit-user-select: none;
    font-family: 'Courier New', Consolas, 'Lucida Console', monospace;

    --mp-pill-bg: rgba(255,252,245,0.95);
    --mp-pill-border: rgba(210,200,185,0.60);
    --mp-pill-border-hover: rgba(180,165,145,0.80);
    --mp-pill-shadow: 0 2px 16px rgba(140,110,60,0.12);
    --mp-pill-shadow-hover: 0 4px 24px rgba(140,110,60,0.18);
    --mp-text: #504030;
    --mp-text-strong: #504030;
    --mp-text-muted: #b0a090;
    --mp-panel-bg: rgba(255,252,246,0.97);
    --mp-panel-border: rgba(210,200,185,0.50);
    --mp-panel-shadow: 0 8px 40px rgba(140,110,60,0.12), inset 0 0 0 1px rgba(255,248,235,0.60);
    --mp-header-border: rgba(210,200,185,0.30);
    --mp-close-hover-bg: rgba(80,64,48,0.08);
    --mp-option-hover-bg: rgba(80,64,48,0.06);
    --mp-option-active-bg: rgba(80,64,48,0.05);
    --mp-name-color: rgba(80,64,48,0.85);
}

:host([data-theme="dark"]) {
    --mp-pill-bg: rgba(32,27,22,0.92);
    --mp-pill-border: rgba(122,106,88,0.45);
    --mp-pill-border-hover: rgba(150,130,108,0.65);
    --mp-pill-shadow: 0 2px 16px rgba(0,0,0,0.30);
    --mp-pill-shadow-hover: 0 4px 24px rgba(0,0,0,0.38);
    --mp-text: #d8cfc2;
    --mp-text-strong: #f0e6d8;
    --mp-text-muted: #8a7a68;
    --mp-panel-bg: rgba(32,27,22,0.95);
    --mp-panel-border: rgba(122,106,88,0.40);
    --mp-panel-shadow: 0 8px 40px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.04);
    --mp-header-border: rgba(122,106,88,0.30);
    --mp-close-hover-bg: rgba(255,245,230,0.08);
    --mp-option-hover-bg: rgba(255,245,230,0.06);
    --mp-option-active-bg: rgba(255,245,230,0.05);
    --mp-name-color: rgba(216,207,194,0.85);
}

#toggle-math-paste {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 13px;
    border-radius: 999px;
    background: var(--mp-pill-bg);
    border: 1px solid var(--mp-pill-border);
    box-shadow: var(--mp-pill-shadow);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    cursor: grab;
    color: var(--mp-text);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    white-space: nowrap;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s, color 0.15s;
}

#toggle-math-paste:hover {
    border-color: var(--mp-pill-border-hover);
    box-shadow: var(--mp-pill-shadow-hover);
}

#mp-logo {
    height: 13px;
    width: auto;
    display: block;
    flex-shrink: 0;
}

.mp-dot {
    display: inline-block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--mp-dot-color, #6B7280);
    flex-shrink: 0;
    box-shadow: var(--mp-dot-shadow, none);
    transition: background 0.2s, box-shadow 0.2s;
}

#mathpaste-panel {
    position: absolute;
    top: 0;
    right: calc(100% + 10px);
    left: auto;
    width: 230px;
    background: var(--mp-panel-bg);
    border: 1px solid var(--mp-panel-border);
    border-radius: 14px;
    box-shadow: var(--mp-panel-shadow);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
    transform: translateX(6px);
    transition: opacity 0.18s ease, transform 0.18s ease, background 0.15s, border-color 0.15s;
}

#mathpaste-panel.mp-visible {
    opacity: 1;
    pointer-events: all;
    transform: translateX(0);
}

#mathpaste-panel.mp-flip {
    right: auto;
    left: calc(100% + 10px);
    transform: translateX(-6px);
}

#mathpaste-panel.mp-flip.mp-visible {
    transform: translateX(0);
}

#mp-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 11px 14px 9px;
    border-bottom: 1px solid var(--mp-header-border);
    cursor: grab;
}

#mp-header:active { cursor: grabbing; }

#mp-title {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.22em;
    color: var(--mp-text-muted);
    font-family: inherit;
}

#mp-close {
    all: unset;
    display: flex;
    color: var(--mp-text-muted);
    cursor: pointer;
    padding: 3px;
    border-radius: 4px;
    transition: color 0.15s, background 0.15s;
}

#mp-close svg {
    width: 11px;
    height: 11px;
    display: block;
}

#mp-close:hover {
    color: var(--mp-text-strong);
    background: var(--mp-close-hover-bg);
}

#mp-options {
    padding: 6px 0 8px;
}

.option-math-paste {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 7px 14px;
    cursor: pointer;
    border-left: 2px solid transparent;
    transition: background 0.1s, border-color 0.15s;
    width: 100%;
}

.option-math-paste:hover {
    background: var(--mp-option-hover-bg);
}

.option-math-paste.mp-active {
    background: var(--mp-option-active-bg);
    border-left-color: var(--accent);
}

.mp-name {
    flex: 1 1 0;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    font-family: inherit;
    color: var(--mp-name-color);
    transition: color 0.1s;
}

.option-math-paste.mp-active .mp-name {
    color: var(--mp-text-strong);
}

.mp-hint {
    flex-shrink: 0;
    white-space: nowrap;
    font-size: 10px;
    font-family: inherit;
    color: var(--mp-text-muted);
    letter-spacing: 0.02em;
}
`;

// ─── State ───────────────────────────────────────────────────────────────────

let isActiveContent = false;
let observer: MutationObserver | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let shadowRoot: ShadowRoot | null = null;

// ─── Auto-start ──────────────────────────────────────────────────────────────
// The UI toggle and format selection are shared across every tab via
// chrome.storage.local (see state.ts), so a fresh tab starts in whatever
// state the extension was last left in — not always-on with no format.

async function autoStart() {
    isActiveContent = await getStoredUiEnabled();
    if (isActiveContent) {
        startObserving();
        inject();
    }
}

function startObserving() {
    observer = new MutationObserver(() => inject());
    observer.observe(document.body, { childList: true, subtree: true });
}

// ─── Theme ───────────────────────────────────────────────────────────────────
// Set on the shadow host as data-theme so SHADOW_CSS's
// :host([data-theme="dark"]) block can pick it up — custom properties are
// the cleanest way to theme shadow-DOM content from outside without
// breaking the isolation it exists to provide.

async function applyPillTheme() {
    const host = document.getElementById("toggle-options-container");
    if (!host) return;
    const theme = await getStoredTheme();
    host.dataset.theme = resolveTheme(theme);
}

// Re-initializes whenever the extension's generation changes (see state.ts:
// a fresh install, update, chrome update, or dev reload) — not merely on
// this script's first-ever injection into the page. That also covers plain
// re-injection into a page already running the CURRENT generation (e.g.
// background.ts re-injects on tab-activate/navigation, and SPAs like
// ChatGPT/Claude fire navigation-completed events on client-side route
// changes without a real reload) — same generation means skip, so we don't
// stack another MutationObserver and another pair of storage listeners.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = window as any;

initForCurrentGeneration();

async function initForCurrentGeneration() {
    const generation = await getStoredGeneration();
    if (win.__mathpasteFrontendGeneration === generation) return;
    win.__mathpasteFrontendGeneration = generation;

    // Drop any pill left by a previous generation — its click handlers and
    // chrome.runtime.getURL() calls are tied to an extension context that's
    // now invalidated, so it would silently stop working if left in place.
    document.getElementById("toggle-options-container")?.remove();

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", autoStart);
    } else {
        autoStart();
    }

    // ─── Cross-tab state sync ──────────────────────────────────────────────

    onUiEnabledChange((enabled) => {
        isActiveContent = enabled;

        if (isActiveContent) {
            startObserving();
            inject();
        } else {
            document.getElementById("toggle-options-container")?.remove();
            shadowRoot = null;
            observer?.disconnect();
            observer = null;
        }
    });

    onFormatChange((formatId) => applyFormat(formatId, /* persist */ false));
    onThemeChange(() => applyPillTheme());
    // Only visibly matters while "system" is selected, but it's cheap to
    // just always re-resolve rather than track which preference is active.
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyPillTheme());
}

// ─── Injection ───────────────────────────────────────────────────────────────

function inject() {
    if (document.getElementById("toggle-options-container")) return;

    try {
        const host = document.createElement("div");
        host.id = "toggle-options-container";

        // Shadow root isolates our CSS from the host page entirely
        shadowRoot = host.attachShadow({ mode: "open" });

        const style = document.createElement("style");
        style.textContent = SHADOW_CSS;
        shadowRoot.appendChild(style);

        const panel  = buildPanel();
        const toggle = buildToggle();

        shadowRoot.appendChild(panel);
        shadowRoot.appendChild(toggle);
        document.body.appendChild(host);

        const header = shadowRoot.getElementById("mp-header") as HTMLElement;
        setupHover(host, panel);
        setupDrag(host, panel, toggle, header);

        applyPillTheme();

        // Reflect whatever format is currently selected elsewhere, if any.
        getStoredFormat().then((formatId) => {
            if (formatId) applyFormat(formatId, /* persist */ false);
        });
    } catch {
        // buildToggle() calls chrome.runtime.getURL(), which throws once
        // this generation's extension context is invalidated. That can only
        // happen here if this is an orphaned instance's MutationObserver
        // still firing after a newer generation already took over — stop
        // watching so it doesn't keep erroring on every DOM mutation.
        observer?.disconnect();
        observer = null;
    }
}

// ─── Toggle pill ─────────────────────────────────────────────────────────────

function buildToggle(): HTMLElement {
    const pill = document.createElement("div");
    pill.id = "toggle-math-paste";

    const logo = document.createElement("img");
    logo.id = "mp-logo";
    logo.src = chrome.runtime.getURL("icons/mathPaste-no-background.png");
    logo.alt = "";

    const dot = document.createElement("span");
    dot.id = "mp-dot";
    dot.className = "mp-dot";

    const label = document.createElement("span");
    label.id = "mp-label";
    label.textContent = "–";

    pill.appendChild(logo);
    pill.appendChild(dot);
    pill.appendChild(label);
    return pill;
}

// ─── Options panel ───────────────────────────────────────────────────────────

function buildPanel(): HTMLElement {
    const panel = document.createElement("div");
    panel.id = "mathpaste-panel";

    panel.appendChild(buildHeader());
    panel.appendChild(buildOptionsList());
    return panel;
}

function buildHeader(): HTMLElement {
    const header = document.createElement("div");
    header.id = "mp-header";

    const title = document.createElement("span");
    title.id = "mp-title";
    title.textContent = "MATHPASTE";

    const close = document.createElement("button");
    close.id = "mp-close";
    close.setAttribute("aria-label", "Close MathPaste");
    close.appendChild(createIconElement(ICON_X));
    close.addEventListener("click", (e) => {
        e.stopPropagation();
        const host = document.getElementById("toggle-options-container");
        if (host) host.style.display = "none";
    });

    header.appendChild(title);
    header.appendChild(close);
    return header;
}

function buildOptionsList(): HTMLElement {
    const list = document.createElement("div");
    list.id = "mp-options";

    for (const [id, fmt] of Object.entries(FORMATS)) {
        const row = document.createElement("div");
        row.className = "option-math-paste";
        row.dataset.formatId = id;

        const dot = document.createElement("span");
        dot.className = "mp-dot";
        dot.style.setProperty("--mp-dot-color", fmt.color);

        const name = document.createElement("span");
        name.className = "mp-name";
        name.textContent = fmt.label;

        const hint = document.createElement("span");
        hint.className = "mp-hint";
        hint.textContent = fmt.hint;

        row.appendChild(dot);
        row.appendChild(name);
        row.appendChild(hint);
        row.addEventListener("click", () => applyFormat(id));
        list.appendChild(row);
    }

    return list;
}

// ─── Format selection ────────────────────────────────────────────────────────

/**
 * Updates this tab's pill/panel to reflect `formatId`. By default also
 * persists it to chrome.storage.local so every other tab picks it up via
 * onFormatChange — pass persist: false when applying a change that just
 * arrived from another tab, to avoid an unnecessary redundant write.
 */
function applyFormat(formatId: string, persist = true) {
    const fmt = FORMATS[formatId];
    if (!fmt || !shadowRoot) return;

    const dot   = shadowRoot.getElementById("mp-dot")   as HTMLElement | null;
    const label = shadowRoot.getElementById("mp-label") as HTMLElement | null;
    if (dot) {
        dot.style.setProperty("--mp-dot-color", fmt.color);
        dot.style.setProperty("--mp-dot-shadow", `0 0 6px ${fmt.color}88`);
    }
    if (label) { label.textContent = fmt.abbr; }

    for (const row of shadowRoot.querySelectorAll<HTMLElement>(".option-math-paste")) {
        const active = row.dataset.formatId === formatId;
        row.classList.toggle("mp-active", active);
        if (active) row.style.setProperty("--accent", fmt.color);
    }

    if (persist) {
        setStoredFormat(formatId);
    }
}

// ─── Hover ───────────────────────────────────────────────────────────────────

function setupHover(host: HTMLElement, panel: HTMLElement) {
    const show = () => {
        if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
        panel.classList.add("mp-visible");
    };
    const hide = () => {
        hideTimer = setTimeout(() => panel.classList.remove("mp-visible"), 120);
    };

    host.addEventListener("mouseenter", show);
    host.addEventListener("mouseleave", hide);
    panel.addEventListener("mouseenter", show);
    panel.addEventListener("mouseleave", hide);
}

// ─── Drag ────────────────────────────────────────────────────────────────────

const PANEL_WIDTH = 230;

function setupDrag(
    host: HTMLElement,
    panel: HTMLElement,
    pill: HTMLElement,
    header: HTMLElement
) {
    let dragging = false;
    let ox = 0, oy = 0;
    let activeHandle: HTMLElement | null = null;

    function startDrag(e: MouseEvent, handle: HTMLElement) {
        // Snapshot position BEFORE removing right anchor (prevents jump to 0)
        const rect = host.getBoundingClientRect();
        host.style.left  = `${rect.left}px`;
        host.style.top   = `${rect.top}px`;
        host.style.right = "auto";

        dragging = true;
        activeHandle = handle;
        ox = e.clientX - rect.left;
        oy = e.clientY - rect.top;
        handle.style.cursor = "grabbing";
        e.preventDefault();
    }

    pill.addEventListener("mousedown",   (e) => startDrag(e, pill));
    header.addEventListener("mousedown", (e) => startDrag(e, header));

    document.addEventListener("mousemove", (e: MouseEvent) => {
        if (!dragging) return;
        const x = e.clientX - ox;
        const y = Math.max(0, e.clientY - oy);
        host.style.left = `${x}px`;
        host.style.top  = `${y}px`;

        panel.classList.toggle("mp-flip", x < PANEL_WIDTH + 20);
    });

    document.addEventListener("mouseup", () => {
        if (!dragging) return;
        dragging = false;
        if (activeHandle) { activeHandle.style.cursor = "grab"; activeHandle = null; }
    });
}
