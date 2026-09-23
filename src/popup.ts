// ─── Toolbar popup ───────────────────────────────────────────────────────────
// Small UI opened by clicking the extension's toolbar icon: a way back into
// the docs (the onboarding page only auto-opens once, on first install), plus
// the two on/off toggles — whether Math Paste actually converts on copy, and
// whether the floating pill shows up on the page at all.

import {
    getStoredFunctionalityEnabled,
    setStoredFunctionalityEnabled,
    getStoredUiEnabled,
    setStoredUiEnabled,
} from "./state";
import { ICON_BOOK_OPEN, ICON_EXTERNAL_LINK, ICON_POWER, ICON_EYE, createIconElement } from "./icons";

type DocsChrome = Pick<typeof chrome, "tabs" | "runtime">;

export function openDocs(chromeApi: DocsChrome = chrome): void {
    chromeApi.tabs.create({ url: chromeApi.runtime.getURL("onboarding.html") });
}

interface ToggleRowConfig {
    id: string;
    icon: string;
    label: string;
    description: string;
    getValue: () => Promise<boolean>;
    setValue: (value: boolean) => Promise<void>;
}

function buildToggleRow(config: ToggleRowConfig): HTMLElement {
    const row = document.createElement("label");
    row.className = "pop-toggle-row";

    row.appendChild(createIconElement(config.icon, "pop-toggle-icon"));

    const text = document.createElement("span");
    text.className = "pop-toggle-text";

    const title = document.createElement("span");
    title.className = "pop-toggle-label";
    title.textContent = config.label;

    const desc = document.createElement("span");
    desc.className = "pop-toggle-desc";
    desc.textContent = config.description;

    text.appendChild(title);
    text.appendChild(desc);

    const switchEl = document.createElement("span");
    switchEl.className = "pop-switch";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.id = config.id;
    input.addEventListener("change", () => {
        config.setValue(input.checked);
    });

    const track = document.createElement("span");
    track.className = "pop-switch-track";

    switchEl.appendChild(input);
    switchEl.appendChild(track);

    row.appendChild(text);
    row.appendChild(switchEl);

    config.getValue().then((value) => { input.checked = value; });

    return row;
}

export function buildPopup(): HTMLElement {
    const root = document.createElement("div");

    const header = document.createElement("div");
    header.className = "pop-header";

    const logo = document.createElement("img");
    logo.className = "pop-logo";
    logo.src = chrome.runtime.getURL("icons/mathPaste-no-background.png");
    logo.alt = "";

    const title = document.createElement("span");
    title.className = "pop-title";
    title.textContent = "Math Paste";

    header.appendChild(logo);
    header.appendChild(title);

    const subtitle = document.createElement("p");
    subtitle.className = "pop-subtitle";
    subtitle.textContent = "Copy math from AI chatbots. Paste it perfectly into your notebook.";

    const toggles = document.createElement("div");
    toggles.className = "pop-toggles";
    toggles.appendChild(buildToggleRow({
        id: "mp-toggle-functionality",
        icon: ICON_POWER,
        label: "Math Paste",
        description: "Convert math when you copy",
        getValue: getStoredFunctionalityEnabled,
        setValue: setStoredFunctionalityEnabled,
    }));
    toggles.appendChild(buildToggleRow({
        id: "mp-toggle-ui",
        icon: ICON_EYE,
        label: "Floating pill",
        description: "Show the on-page format picker",
        getValue: getStoredUiEnabled,
        setValue: setStoredUiEnabled,
    }));

    const docsBtn = document.createElement("button");
    docsBtn.className = "pop-docs-btn";
    docsBtn.id = "mp-open-docs";
    docsBtn.type = "button";
    docsBtn.appendChild(createIconElement(ICON_BOOK_OPEN, "pop-btn-icon"));
    docsBtn.appendChild(document.createTextNode("Open Docs"));
    docsBtn.addEventListener("click", () => {
        openDocs();
        window.close();
    });

    const footer = document.createElement("div");
    footer.className = "pop-footer";

    const repoLink = document.createElement("a");
    repoLink.href = "https://github.com/Gallections/MathPaste";
    repoLink.target = "_blank";
    repoLink.rel = "noopener noreferrer";
    repoLink.appendChild(createIconElement(ICON_EXTERNAL_LINK, "pop-footer-icon"));
    repoLink.appendChild(document.createTextNode("GitHub"));
    footer.appendChild(repoLink);

    root.appendChild(header);
    root.appendChild(subtitle);
    root.appendChild(toggles);
    root.appendChild(docsBtn);
    root.appendChild(footer);
    return root;
}

function init() {
    const mount = document.getElementById("mp-popup");
    if (!mount) return;
    mount.appendChild(buildPopup());
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}
