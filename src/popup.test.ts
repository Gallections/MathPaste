import { describe, it, expect, vi, afterEach } from 'vitest';
import { openDocs, buildPopup } from './popup';
import { FUNCTIONALITY_KEY, UI_KEY } from './state';

function mockChrome(store: Record<string, unknown> = {}) {
    return {
        tabs: { create: vi.fn() },
        runtime: {
            getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
        },
        storage: {
            local: {
                get: vi.fn((key: string) => Promise.resolve({ [key]: store[key] })),
                set: vi.fn((obj: Record<string, unknown>) => {
                    Object.assign(store, obj);
                    return Promise.resolve();
                }),
            },
        },
    } as unknown as Pick<typeof chrome, "tabs" | "runtime" | "storage">;
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('openDocs', () => {
    it('opens onboarding.html in a new tab', () => {
        const chromeMock = mockChrome();
        openDocs(chromeMock);
        expect(chromeMock.runtime.getURL).toHaveBeenCalledWith('onboarding.html');
        expect(chromeMock.tabs.create).toHaveBeenCalledWith({
            url: 'chrome-extension://test/onboarding.html',
        });
    });

    it('defaults to the global chrome API when none is provided', () => {
        const chromeMock = mockChrome();
        vi.stubGlobal('chrome', chromeMock);
        openDocs();
        expect(chromeMock.tabs.create).toHaveBeenCalledWith({
            url: 'chrome-extension://test/onboarding.html',
        });
    });
});

describe('buildPopup', () => {
    it('renders a docs button with an icon, wired to openDocs', () => {
        const chromeMock = mockChrome();
        vi.stubGlobal('chrome', chromeMock);
        // The click handler calls window.close() after opening the docs tab;
        // stub it so jsdom doesn't tear down the window for later tests.
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

    it('renders the extension title and a GitHub link with an icon, no bare emoji or arrow glyphs', () => {
        vi.stubGlobal('chrome', mockChrome());
        const popup = buildPopup();

        expect(popup.querySelector('.pop-title')?.textContent).toBe('Math Paste');

        const repoLink = popup.querySelector<HTMLAnchorElement>('.pop-footer a');
        expect(repoLink?.href).toBe('https://github.com/Gallections/MathPaste');
        expect(repoLink?.textContent).toContain('GitHub');
        expect(repoLink?.querySelector('svg.pop-footer-icon')).not.toBeNull();

        // No leftover emoji/arrow glyphs anywhere in the popup.
        expect(popup.textContent).not.toMatch(/[\u{1F300}-\u{1FAFF}↖-⇿]/u);
    });

    it('renders a functionality toggle and a UI toggle, each with an icon', () => {
        vi.stubGlobal('chrome', mockChrome());
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
        vi.stubGlobal('chrome', mockChrome({
            [FUNCTIONALITY_KEY]: false,
            [UI_KEY]: true,
        }));
        const popup = buildPopup();

        // getValue() resolves asynchronously — flush microtasks.
        await Promise.resolve();
        await Promise.resolve();

        const functionalityInput = popup.querySelector<HTMLInputElement>('#mp-toggle-functionality');
        const uiInput = popup.querySelector<HTMLInputElement>('#mp-toggle-ui');

        expect(functionalityInput!.checked).toBe(false);
        expect(uiInput!.checked).toBe(true);
    });

    it('persists a toggle change to its own storage key, leaving the other untouched', () => {
        const chromeMock = mockChrome();
        vi.stubGlobal('chrome', chromeMock);
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
