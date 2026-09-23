// ─── Shared cross-tab state ──────────────────────────────────────────────────
// Backed by chrome.storage.local so the selected format and both toggles stay
// identical across every tab (open now, or opened later) instead of being
// scoped to whichever tab was active when the user changed them.
//
// Two independent toggles:
//  - "functionality" — whether copy.ts actually converts math on copy.
//  - "UI"             — whether frontend.ts shows the floating pill at all.
// They're deliberately separate: hiding the pill shouldn't silently turn off
// conversion, and pausing conversion shouldn't hide the format picker.

export const FORMAT_KEY = "mathpaste_format";
export const FUNCTIONALITY_KEY = "mathpaste_functionality_enabled";
export const UI_KEY = "mathpaste_ui_enabled";
export const THEME_KEY = "mathpaste_theme";
export const GENERATION_KEY = "mathpaste_generation";

export type Theme = "light" | "dark" | "system";

export async function getStoredFormat(): Promise<string | null> {
    const result = await chrome.storage.local.get(FORMAT_KEY);
    return result[FORMAT_KEY] ?? null;
}

export async function setStoredFormat(formatId: string): Promise<void> {
    await chrome.storage.local.set({ [FORMAT_KEY]: formatId });
}

export async function getStoredFunctionalityEnabled(): Promise<boolean> {
    const result = await chrome.storage.local.get(FUNCTIONALITY_KEY);
    return result[FUNCTIONALITY_KEY] ?? true;
}

export async function setStoredFunctionalityEnabled(enabled: boolean): Promise<void> {
    await chrome.storage.local.set({ [FUNCTIONALITY_KEY]: enabled });
}

export async function getStoredUiEnabled(): Promise<boolean> {
    const result = await chrome.storage.local.get(UI_KEY);
    return result[UI_KEY] ?? true;
}

export async function setStoredUiEnabled(enabled: boolean): Promise<void> {
    await chrome.storage.local.set({ [UI_KEY]: enabled });
}

// Light is the app's current default look, so it's also the default here.
export async function getStoredTheme(): Promise<Theme> {
    const result = await chrome.storage.local.get(THEME_KEY);
    return (result[THEME_KEY] as Theme | undefined) ?? "light";
}

export async function setStoredTheme(theme: Theme): Promise<void> {
    await chrome.storage.local.set({ [THEME_KEY]: theme });
}

/**
 * Resolves "system" against the OS/browser color-scheme preference; "light"
 * and "dark" pass through unchanged. `matchMedia` is injectable (defaults to
 * the real one) so this stays testable without a jsdom matchMedia shim.
 */
export function resolveTheme(
    theme: Theme,
    matchMedia: (query: string) => { matches: boolean } = (q) => window.matchMedia(q)
): "light" | "dark" {
    if (theme === "system") {
        return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return theme;
}

/**
 * A random token written once per install/update/reload (see background.ts).
 * Content scripts compare this against what they last saw to tell a genuinely
 * new script generation apart from a redundant re-injection into a page
 * that's already running the current one — window-scoped flags alone can't
 * make that distinction, since `window` survives an extension update even
 * though the old script's extension context doesn't.
 */
export async function getStoredGeneration(): Promise<string | null> {
    const result = await chrome.storage.local.get(GENERATION_KEY);
    return result[GENERATION_KEY] ?? null;
}

export async function setStoredGeneration(generation: string): Promise<void> {
    await chrome.storage.local.set({ [GENERATION_KEY]: generation });
}

/** Fires whenever any tab (including this one) persists a new format selection. */
export function onFormatChange(callback: (formatId: string) => void): void {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        const change = changes[FORMAT_KEY];
        if (change && typeof change.newValue === "string") {
            callback(change.newValue);
        }
    });
}

/** Fires whenever any tab (including this one) persists a new functionality toggle state. */
export function onFunctionalityEnabledChange(callback: (enabled: boolean) => void): void {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        const change = changes[FUNCTIONALITY_KEY];
        if (change && typeof change.newValue === "boolean") {
            callback(change.newValue);
        }
    });
}

/** Fires whenever any tab (including this one) persists a new UI toggle state. */
export function onUiEnabledChange(callback: (enabled: boolean) => void): void {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        const change = changes[UI_KEY];
        if (change && typeof change.newValue === "boolean") {
            callback(change.newValue);
        }
    });
}

/** Fires whenever any tab (including this one) persists a new theme preference. */
export function onThemeChange(callback: (theme: Theme) => void): void {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== "local") return;
        const change = changes[THEME_KEY];
        if (change && typeof change.newValue === "string") {
            callback(change.newValue as Theme);
        }
    });
}
