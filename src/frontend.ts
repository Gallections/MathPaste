// ─── Format registry ─────────────────────────────────────────────────────────

interface FormatDef {
    label: string;
    abbr:  string;
    hint:  string;
    color: string;
}

const FORMATS: Record<string, FormatDef> = {
    "math_paste_Obsidian":  { label: "Obsidian",  abbr: "OBS", hint: "$…$",      color: "#7C3AED" },
    "math_paste_Notion":    { label: "Notion",    abbr: "NOT", hint: "$…$",      color: "#94A3B8" },
    "math_paste_LaTex":     { label: "LaTeX",     abbr: "TEX", hint: "raw",      color: "#EF4444" },
    "math_paste_MathJax":   { label: "MathJax",   abbr: "MJX", hint: "\\(…\\)", color: "#22C55E" },
    "math_paste_Typst":     { label: "Typst",     abbr: "TYP", hint: "$ … $",   color: "#06B6D4" },
    "math_paste_MediaWiki": { label: "MediaWiki", abbr: "MW",  hint: "<math>",   color: "#3B82F6" },
    "math_paste_AsciiMath": { label: "AsciiMath", abbr: "ASC", hint: "ascii",    color: "#F59E0B" },
    "math_paste_None":      { label: "None",      abbr: "OFF", hint: "–",        color: "#6B7280" },
};

// ─── Shadow CSS (fully isolated — no !important needed) ──────────────────────

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
}

#toggle-math-paste {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 7px 13px;
    border-radius: 999px;
    background: rgba(9,9,18,0.9);
    border: 1px solid rgba(255,255,255,0.11);
    box-shadow: 0 2px 16px rgba(0,0,0,0.45);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    cursor: grab;
    color: rgba(255,255,255,0.82);
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    white-space: nowrap;
    transition: border-color 0.15s, box-shadow 0.15s;
}

#toggle-math-paste:hover {
    border-color: rgba(255,255,255,0.2);
    box-shadow: 0 4px 24px rgba(0,0,0,0.55);
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
    background: rgba(9,9,18,0.96);
    border: 1px solid rgba(255,255,255,0.09);
    border-radius: 14px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.65), inset 0 0 0 1px rgba(255,255,255,0.04);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    overflow: hidden;
    opacity: 0;
    pointer-events: none;
    transform: translateX(6px);
    transition: opacity 0.18s ease, transform 0.18s ease;
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
    border-bottom: 1px solid rgba(255,255,255,0.06);
    cursor: grab;
}

#mp-header:active { cursor: grabbing; }

#mp-title {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.22em;
    color: rgba(255,255,255,0.28);
    font-family: inherit;
}

#mp-close {
    all: unset;
    font-size: 11px;
    color: rgba(255,255,255,0.22);
    cursor: pointer;
    line-height: 1;
    padding: 2px 3px;
    border-radius: 4px;
    transition: color 0.15s, background 0.15s;
}

#mp-close:hover {
    color: rgba(255,255,255,0.72);
    background: rgba(255,255,255,0.07);
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
    background: rgba(255,255,255,0.05);
}

.option-math-paste.mp-active {
    background: rgba(255,255,255,0.038);
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
    color: rgba(255,255,255,0.75);
    transition: color 0.1s;
}

.option-math-paste.mp-active .mp-name {
    color: rgba(255,255,255,0.95);
}

.mp-hint {
    flex-shrink: 0;
    white-space: nowrap;
    font-size: 10px;
    font-family: inherit;
    color: rgba(255,255,255,0.2);
    letter-spacing: 0.02em;
}
`;

// ─── State ───────────────────────────────────────────────────────────────────

let isActiveContent = false;
let observer: MutationObserver | null = null;
let hideTimer: ReturnType<typeof setTimeout> | null = null;
let shadowRoot: ShadowRoot | null = null;

// ─── Auto-start ──────────────────────────────────────────────────────────────

function autoStart() {
    isActiveContent = true;
    observer = new MutationObserver(() => inject());
    observer.observe(document.body, { childList: true, subtree: true });
    inject();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoStart);
} else {
    autoStart();
}

// ─── Message handler ─────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message) => {
    if (message.toggle === undefined) return;
    isActiveContent = message.toggle;

    if (isActiveContent) {
        observer = new MutationObserver(() => inject());
        observer.observe(document.body, { childList: true, subtree: true });
        inject();
    } else {
        document.getElementById("toggle-options-container")?.remove();
        shadowRoot = null;
        observer?.disconnect();
        observer = null;
    }
});

// ─── Injection ───────────────────────────────────────────────────────────────

function inject() {
    if (document.getElementById("toggle-options-container")) return;

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
}

// ─── Toggle pill ─────────────────────────────────────────────────────────────

function buildToggle(): HTMLElement {
    const pill = document.createElement("div");
    pill.id = "toggle-math-paste";

    const dot = document.createElement("span");
    dot.id = "mp-dot";
    dot.className = "mp-dot";

    const label = document.createElement("span");
    label.id = "mp-label";
    label.textContent = "–";

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
    close.textContent = "✕";
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
        row.addEventListener("click", () => selectFormat(id));
        list.appendChild(row);
    }

    return list;
}

// ─── Format selection ────────────────────────────────────────────────────────

function selectFormat(formatId: string) {
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

    chrome.runtime.sendMessage({ action: "functionChange", imgId: formatId });
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
