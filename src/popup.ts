// ─── Toolbar popup ───────────────────────────────────────────────────────────
// Small UI opened by clicking the extension's toolbar icon. The Home view is
// a way back into the docs (the onboarding page only auto-opens once, on
// first install) plus a GitHub link; the gear icon opens a Settings view
// holding every configurable preference — theme and the two on/off toggles.

import {
    getStoredFunctionalityEnabled,
    setStoredFunctionalityEnabled,
    getStoredUiEnabled,
    setStoredUiEnabled,
    getStoredTheme,
    setStoredTheme,
    resolveTheme,
    onThemeChange,
    Theme,
} from "./state";
import {
    ICON_BOOK_OPEN,
    ICON_EXTERNAL_LINK,
    ICON_POWER,
    ICON_EYE,
    ICON_SETTINGS,
    ICON_ARROW_LEFT,
    ICON_SUN,
    ICON_MOON,
    ICON_MONITOR,
    createIconElement,
} from "./icons";

type DocsChrome = Pick<typeof chrome, "tabs" | "runtime">;

export function openDocs(chromeApi: DocsChrome = chrome): void {
    chromeApi.tabs.create({ url: chromeApi.runtime.getURL("onboarding.html") });
}

// ─── Theme ───────────────────────────────────────────────────────────────────
// Applied to <html> so popup.css's [data-theme="dark"] overrides can target
// it. Re-resolved on every stored-theme change and every OS-level
// prefers-color-scheme flip (the latter only visibly matters while "system"
// is selected, but it's cheap to just always re-resolve).

async function applyPopupTheme() {
    const theme = await getStoredTheme();
    document.documentElement.dataset.theme = resolveTheme(theme);
}

applyPopupTheme();
onThemeChange(() => applyPopupTheme());
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => applyPopupTheme());

// ─── Toggle rows (Settings view) ──────────────────────────────────────────────

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

// ─── Theme selector (Settings view) ───────────────────────────────────────────

function buildThemeSelector(): HTMLElement {
    const group = document.createElement("div");
    group.className = "pop-theme-group";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", "Theme");

    const options: { value: Theme; icon: string; label: string }[] = [
        { value: "light", icon: ICON_SUN, label: "Light" },
        { value: "dark", icon: ICON_MOON, label: "Dark" },
        { value: "system", icon: ICON_MONITOR, label: "System" },
    ];

    const buttons: HTMLButtonElement[] = [];

    function setActive(value: Theme) {
        for (const btn of buttons) {
            const active = btn.dataset.value === value;
            btn.classList.toggle("pop-theme-active", active);
            btn.setAttribute("aria-checked", String(active));
        }
    }

    for (const opt of options) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "pop-theme-option";
        btn.dataset.value = opt.value;
        btn.setAttribute("role", "radio");
        btn.appendChild(createIconElement(opt.icon, "pop-theme-icon"));
        const label = document.createElement("span");
        label.textContent = opt.label;
        btn.appendChild(label);
        btn.addEventListener("click", () => {
            setActive(opt.value);
            setStoredTheme(opt.value);
        });
        buttons.push(btn);
        group.appendChild(btn);
    }

    getStoredTheme().then(setActive);

    return group;
}

// ─── Views ────────────────────────────────────────────────────────────────────

function buildHomeView(): HTMLElement {
    const view = document.createElement("div");
    view.className = "pop-view";

    const subtitle = document.createElement("p");
    subtitle.className = "pop-subtitle";
    subtitle.textContent = "Copy math from AI chatbots. Paste it perfectly into your notebook.";

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

    view.appendChild(subtitle);
    view.appendChild(docsBtn);
    view.appendChild(footer);
    return view;
}

function buildSettingsView(): HTMLElement {
    const view = document.createElement("div");
    view.className = "pop-view";

    const themeLabel = document.createElement("div");
    themeLabel.className = "pop-settings-label";
    themeLabel.textContent = "Appearance";

    const toggleLabel = document.createElement("div");
    toggleLabel.className = "pop-settings-label";
    toggleLabel.textContent = "Behavior";

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

    view.appendChild(themeLabel);
    view.appendChild(buildThemeSelector());
    view.appendChild(toggleLabel);
    view.appendChild(toggles);
    return view;
}

// ─── Root + header (view switching) ──────────────────────────────────────────

export function buildPopup(): HTMLElement {
    const root = document.createElement("div");

    let onHome = true;

    const header = document.createElement("div");
    header.className = "pop-header";

    const headerLeft = document.createElement("div");
    headerLeft.className = "pop-header-left";

    const logo = document.createElement("img");
    logo.className = "pop-logo";
    logo.src = chrome.runtime.getURL("icons/mathPaste-no-background.png");
    logo.alt = "";

    const title = document.createElement("span");
    title.className = "pop-title";
    title.textContent = "Math Paste";

    headerLeft.appendChild(logo);
    headerLeft.appendChild(title);

    const viewToggleBtn = document.createElement("button");
    viewToggleBtn.type = "button";
    viewToggleBtn.id = "mp-view-toggle";
    viewToggleBtn.className = "pop-icon-btn";
    viewToggleBtn.setAttribute("aria-label", "Open settings");
    viewToggleBtn.appendChild(createIconElement(ICON_SETTINGS, "pop-header-icon"));

    header.appendChild(headerLeft);
    header.appendChild(viewToggleBtn);

    const homeView = buildHomeView();
    const settingsView = buildSettingsView();
    settingsView.classList.add("pop-view-hidden");

    viewToggleBtn.addEventListener("click", () => {
        onHome = !onHome;
        homeView.classList.toggle("pop-view-hidden", !onHome);
        settingsView.classList.toggle("pop-view-hidden", onHome);
        title.textContent = onHome ? "Math Paste" : "Settings";
        viewToggleBtn.replaceChildren(
            createIconElement(onHome ? ICON_SETTINGS : ICON_ARROW_LEFT, "pop-header-icon")
        );
        viewToggleBtn.setAttribute("aria-label", onHome ? "Open settings" : "Back");
    });

    root.appendChild(header);
    root.appendChild(homeView);
    root.appendChild(settingsView);
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
