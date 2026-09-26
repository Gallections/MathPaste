import { getStoredFunctionalityEnabled, setStoredFunctionalityEnabled, setStoredGeneration } from "./state";

// Only the very first install should open onboarding — not every extension
// update, Chrome update, or reload of an unpacked build during development.
export function shouldShowOnboarding(reason: string): boolean {
    return reason === "install";
}

chrome.runtime.onInstalled.addListener(async (details) => {
    // A fresh generation token invalidates the re-init guard every content
    // script checks (see state.ts) — install, update, chrome_update, and a
    // dev reload all restart this service worker and orphan any content
    // script already running in an open tab, so all of them need this, not
    // just a first install. Must finish before we (re)inject below, so the
    // freshly-injected scripts see the new value instead of the old one.
    await setStoredGeneration(crypto.randomUUID());

    if (shouldShowOnboarding(details.reason)) {
        chrome.tabs.create({ url: chrome.runtime.getURL("onboarding.html") });
    }

    injectIntoOpenTabs();
});

// Tabs that were already open when this fired never receive the declarative
// content_scripts injection — that only fires on a NEW navigation. Without
// this, the pill wouldn't show up in any tab the user already had open until
// they switched tabs, navigated, or refreshed.
function injectIntoOpenTabs() {
    chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
            if (tab.id !== undefined && isInjectableUrl(tab.url)) {
                injectContentScript(tab.id);
            }
        }
    });
}

chrome.tabs.onActivated.addListener((activeTab) => {
    chrome.tabs.get(activeTab.tabId, tab => {
        if (isInjectableUrl(tab.url)) {
            injectContentScript(tab.id);
        }
    });
});

chrome.webNavigation.onCompleted.addListener(details => {
    chrome.tabs.get(details.tabId, tab => {
        if (isInjectableUrl(tab.url)) {
            injectContentScript(tab.id);
        }
    });
});

function isInjectableUrl(url) {
    if (!url) return false;
    return url.startsWith('http://') || url.startsWith('https://');
}

// Keep this file list in sync with manifest.json's content_scripts entry —
// both the copy interceptor AND the pill UI need re-injecting into tabs that
// were already open before install/reload; otherwise the pill never appears
// there until the user manually refreshes.
function injectContentScript(tabId) {
    chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/copy.js', 'src/frontend.js']
    }).catch(err => {
        console.error('Failed to inject content scripts:', err);
    });
}

// The toggles and the format selection all live in chrome.storage.local now
// (see state.ts) — every content script listens for storage changes directly,
// so no per-tab message relay is needed here to keep tabs in sync. The
// keyboard shortcut only flips the functionality toggle (whether copy.ts
// actually converts math) — the UI (pill) toggle is popup-only, since it's a
// more cosmetic preference that doesn't need a shortcut.
chrome.commands.onCommand.addListener(async (command) => {
    if (command === "toggle-math-paste") {
        const enabled = await getStoredFunctionalityEnabled();
        await setStoredFunctionalityEnabled(!enabled);
        console.log("Math paste is " + (!enabled ? "enabled" : "disabled"));
    }
});
