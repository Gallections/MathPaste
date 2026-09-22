// ─── Toolbar popup ───────────────────────────────────────────────────────────
// Small UI opened by clicking the extension's toolbar icon. Its only job right
// now is giving users a way back into the docs (the onboarding page), since
// that page only auto-opens once, on first install.

type DocsChrome = Pick<typeof chrome, "tabs" | "runtime">;

export function openDocs(chromeApi: DocsChrome = chrome): void {
    chromeApi.tabs.create({ url: chromeApi.runtime.getURL("onboarding.html") });
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

    const docsBtn = document.createElement("button");
    docsBtn.className = "pop-docs-btn";
    docsBtn.id = "mp-open-docs";
    docsBtn.type = "button";
    docsBtn.textContent = "📖 Open Docs";
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
    repoLink.textContent = "GitHub ↗";
    footer.appendChild(repoLink);

    root.appendChild(header);
    root.appendChild(subtitle);
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
