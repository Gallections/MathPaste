import { describe, it, expect, vi, afterEach } from 'vitest';
import { FUNCTIONALITY_KEY, UI_KEY, THEME_KEY } from './state';

type ChangeListener = (changes: Record<string, { newValue?: unknown }>, area: string) => void;

function mockChrome(store: Record<string, unknown> = {}) {
    const changeListeners: ChangeListener[] = [];
    const chromeMock = {
        tabs: { create: vi.fn() },
        runtime: {
            getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
        },
        storage: {
            local: {
                get: vi.fn((key: string) => Promise.resolve({ [key]: store[key] })),
                set: vi.fn((obj: Record<string, unknown>) => {
                    for (const [key, newValue] of Object.entries(obj)) {
                        store[key] = newValue;
                        for (const listener of changeListeners) {
                            listener({ [key]: { newValue } }, 'local');
                        }
                    }
                    return Promise.resolve();
                }),
            },
            onChanged: {
                addListener: vi.fn((cb: ChangeListener) => changeListeners.push(cb)),
            },
        },
    } as unknown as Pick<typeof chrome, "tabs" | "runtime" | "storage">;

    return { chromeMock, store, changeListeners };
}

function mockMatchMedia(matchesDark = false) {
    return vi.fn((query: string) => ({
        matches: query.includes('dark') && matchesDark,
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
    }));
}

/**
 * popup.ts runs side effects at module load (applies the stored theme,
 * registers onThemeChange, reads window.matchMedia) — so chrome and
 * matchMedia must be stubbed BEFORE it's imported, and each test needs a
 * fresh module instance (reset) to re-run that top-level setup.
 */
async function loadPopup(chromeMock: unknown, matchesDark = false) {
    vi.resetModules();
    vi.stubGlobal('chrome', chromeMock);
    vi.stubGlobal('matchMedia', mockMatchMedia(matchesDark));
    return import('./popup');
}

afterEach(() => {
    vi.unstubAllGlobals();
    document.documentElement.removeAttribute('data-theme');
});

describe('openDocs', () => {
    it('opens onboarding.html in a new tab', async () => {
        const { chromeMock } = mockChrome();
        const { openDocs } = await loadPopup(chromeMock);
        openDocs(chromeMock as never);
        expect(chromeMock.runtime.getURL).toHaveBeenCalledWith('onboarding.html');
        expect(chromeMock.tabs.create).toHaveBeenCalledWith({
            url: 'chrome-extension://test/onboarding.html',
        });
    });

    it('defaults to the global chrome API when none is provided', async () => {
        const { chromeMock } = mockChrome();
        const { openDocs } = await loadPopup(chromeMock);
        openDocs();
        expect(chromeMock.tabs.create).toHaveBeenCalledWith({
            url: 'chrome-extension://test/onboarding.html',
        });
    });
});

describe('buildPopup — home view', () => {
    it('renders a docs button with an icon, wired to openDocs', async () => {
        const { chromeMock } = mockChrome();
        const { buildPopup } = await loadPopup(chromeMock);
        const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});

        const popup = buildPopup();
        const docsBtn = popup.querySelector<HTMLButtonElement>('#mp-open-docs');

        expect(docsBtn).not.toBeNull();
        expect(docsBtn!.textContent).toContain('Open Docs');
        expect(docsBtn!.querySelector('svg.pop-btn-icon')).not.toBeNull();

        docsBtn!.click();
        expect(chromeMock.tabs.create).toHaveBeenCalledWith({
            url: 'chrome-extension://test/onboarding.html',
        });
        expect(closeSpy).toHaveBeenCalled();

        closeSpy.mockRestore();
    });

    it('renders the extension title and a GitHub link with an icon, no bare emoji or arrow glyphs', async () => {
        const { chromeMock } = mockChrome();
        const { buildPopup } = await loadPopup(chromeMock);
        const popup = buildPopup();

        expect(popup.querySelector('.pop-title')?.textContent).toBe('Math Paste');

        const repoLink = popup.querySelector<HTMLAnchorElement>('.pop-footer a');
        expect(repoLink?.href).toBe('https://github.com/Gallections/MathPaste');
        expect(repoLink?.textContent).toContain('GitHub');
        expect(repoLink?.querySelector('svg.pop-footer-icon')).not.toBeNull();

        expect(popup.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}↖-⇿]/u);
    });

    it('home view is visible and settings view is hidden by default', async () => {
        const { chromeMock } = mockChrome();
        const { buildPopup } = await loadPopup(chromeMock);
        const popup = buildPopup();

        const views = popup.querySelectorAll('.pop-view');
        expect(views.length).toBe(2);
        expect(views[0].classList.contains('pop-view-hidden')).toBe(false);
        expect(views[1].classList.contains('pop-view-hidden')).toBe(true);
    });
});

describe('buildPopup — settings view toggle (gear button)', () => {
    it('switches views, title, and icon when the gear/back button is clicked', async () => {
        const { chromeMock } = mockChrome();
        const { buildPopup } = await loadPopup(chromeMock);
        const popup = buildPopup();

        const [homeView, settingsView] = popup.querySelectorAll('.pop-view');
        const viewToggleBtn = popup.querySelector<HTMLButtonElement>('#mp-view-toggle')!;
        const title = popup.querySelector('.pop-title')!;

        expect(viewToggleBtn.querySelector('svg')).not.toBeNull();
        expect(viewToggleBtn.getAttribute('aria-label')).toBe('Open settings');

        viewToggleBtn.click();
        expect(homeView.classList.contains('pop-view-hidden')).toBe(true);
        expect(settingsView.classList.contains('pop-view-hidden')).toBe(false);
        expect(title.textContent).toBe('Settings');
        expect(viewToggleBtn.getAttribute('aria-label')).toBe('Back');

        viewToggleBtn.click();
        expect(homeView.classList.contains('pop-view-hidden')).toBe(false);
        expect(settingsView.classList.contains('pop-view-hidden')).toBe(true);
        expect(title.textContent).toBe('Math Paste');
        expect(viewToggleBtn.getAttribute('aria-label')).toBe('Open settings');
    });
});

describe('buildPopup — settings toggles', () => {
    it('renders a functionality toggle and a UI toggle, each with an icon', async () => {
        const { chromeMock } = mockChrome();
        const { buildPopup } = await loadPopup(chromeMock);
        const popup = buildPopup();

        const functionalityInput = popup.querySelector<HTMLInputElement>('#mp-toggle-functionality');
        const uiInput = popup.querySelector<HTMLInputElement>('#mp-toggle-ui');

        expect(functionalityInput).not.toBeNull();
        expect(uiInput).not.toBeNull();
        expect(functionalityInput!.type).toBe('checkbox');
        expect(uiInput!.type).toBe('checkbox');

        const rows = popup.querySelectorAll('.pop-toggle-row');
        expect(rows.length).toBe(2);
        for (const row of rows) {
            expect(row.querySelector('svg.pop-toggle-icon')).not.toBeNull();
        }
    });

    it('initializes each toggle from stored state', async () => {
        const { chromeMock } = mockChrome({
            [FUNCTIONALITY_KEY]: false,
            [UI_KEY]: true,
        });
        const { buildPopup } = await loadPopup(chromeMock);
        const popup = buildPopup();

        await Promise.resolve();
        await Promise.resolve();

        const functionalityInput = popup.querySelector<HTMLInputElement>('#mp-toggle-functionality');
        const uiInput = popup.querySelector<HTMLInputElement>('#mp-toggle-ui');

        expect(functionalityInput!.checked).toBe(false);
        expect(uiInput!.checked).toBe(true);
    });

    it('persists a toggle change to its own storage key, leaving the other untouched', async () => {
        const { chromeMock } = mockChrome();
        const { buildPopup } = await loadPopup(chromeMock);
        const popup = buildPopup();

        const functionalityInput = popup.querySelector<HTMLInputElement>('#mp-toggle-functionality')!;
        functionalityInput.checked = false;
        functionalityInput.dispatchEvent(new Event('change'));

        expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ [FUNCTIONALITY_KEY]: false });
        expect(chromeMock.storage.local.set).not.toHaveBeenCalledWith(
            expect.objectContaining({ [UI_KEY]: expect.anything() })
        );
    });
});

describe('buildPopup — theme selector', () => {
    it('renders three theme options, each with an icon', async () => {
        const { chromeMock } = mockChrome();
        const { buildPopup } = await loadPopup(chromeMock);
        const popup = buildPopup();

        const options = popup.querySelectorAll<HTMLButtonElement>('.pop-theme-option');
        expect(options.length).toBe(3);
        expect([...options].map((o) => o.dataset.value)).toEqual(['light', 'dark', 'system']);
        for (const opt of options) {
            expect(opt.querySelector('svg.pop-theme-icon')).not.toBeNull();
        }
    });

    it('marks the stored theme as active on load', async () => {
        const { chromeMock } = mockChrome({ [THEME_KEY]: 'dark' });
        const { buildPopup } = await loadPopup(chromeMock);
        const popup = buildPopup();

        await Promise.resolve();
        await Promise.resolve();

        const active = popup.querySelector('.pop-theme-active') as HTMLButtonElement;
        expect(active.dataset.value).toBe('dark');
    });

    it('persists a theme choice and updates which option is marked active', async () => {
        const { chromeMock } = mockChrome();
        const { buildPopup } = await loadPopup(chromeMock);
        const popup = buildPopup();
        await Promise.resolve();
        await Promise.resolve();

        const darkOption = popup.querySelector<HTMLButtonElement>('[data-value="dark"]')!;
        darkOption.click();

        expect(chromeMock.storage.local.set).toHaveBeenCalledWith({ [THEME_KEY]: 'dark' });
        expect(darkOption.classList.contains('pop-theme-active')).toBe(true);
        expect(popup.querySelector('[data-value="light"]')!.classList.contains('pop-theme-active')).toBe(false);
    });
});

describe('theme application to the popup document', () => {
    it('applies the stored "dark" theme to <html> on load', async () => {
        const { chromeMock } = mockChrome({ [THEME_KEY]: 'dark' });
        await loadPopup(chromeMock);
        await Promise.resolve();
        await Promise.resolve();

        expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('applies "light" by default when nothing is stored', async () => {
        const { chromeMock } = mockChrome();
        await loadPopup(chromeMock);
        await Promise.resolve();
        await Promise.resolve();

        expect(document.documentElement.dataset.theme).toBe('light');
    });

    it('resolves "system" using matchMedia', async () => {
        const { chromeMock } = mockChrome({ [THEME_KEY]: 'system' });
        await loadPopup(chromeMock, /* matchesDark */ true);
        await Promise.resolve();
        await Promise.resolve();

        expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('re-applies the theme live when another tab changes it', async () => {
        const { chromeMock } = mockChrome({ [THEME_KEY]: 'light' });
        await loadPopup(chromeMock);
        await Promise.resolve();
        await Promise.resolve();
        expect(document.documentElement.dataset.theme).toBe('light');

        // A real write (as if it came from another tab) — the mock's set()
        // both updates the backing store and fires onChanged, same as
        // real chrome.storage always does.
        await chromeMock.storage.local.set({ [THEME_KEY]: 'dark' });
        await Promise.resolve();
        await Promise.resolve();

        expect(document.documentElement.dataset.theme).toBe('dark');
    });
});
