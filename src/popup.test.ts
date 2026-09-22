import { describe, it, expect, vi, afterEach } from 'vitest';
import { openDocs, buildPopup } from './popup';

function mockChrome() {
    return {
        tabs: { create: vi.fn() },
        runtime: {
            getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
        },
    } as unknown as Pick<typeof chrome, "tabs" | "runtime">;
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
    it('renders a docs button wired to openDocs', () => {
        const chromeMock = mockChrome();
        vi.stubGlobal('chrome', chromeMock);
        // The click handler calls window.close() after opening the docs tab;
        // stub it so jsdom doesn't tear down the window for later tests.
        const closeSpy = vi.spyOn(window, 'close').mockImplementation(() => {});

        const popup = buildPopup();
        const docsBtn = popup.querySelector<HTMLButtonElement>('#mp-open-docs');

        expect(docsBtn).not.toBeNull();
        expect(docsBtn!.textContent).toContain('Open Docs');

        docsBtn!.click();
        expect(chromeMock.tabs.create).toHaveBeenCalledWith({
            url: 'chrome-extension://test/onboarding.html',
        });
        expect(closeSpy).toHaveBeenCalled();

        closeSpy.mockRestore();
    });

    it('renders the extension title and a GitHub link', () => {
        vi.stubGlobal('chrome', mockChrome());
        const popup = buildPopup();

        expect(popup.querySelector('.pop-title')?.textContent).toBe('Math Paste');
        const repoLink = popup.querySelector<HTMLAnchorElement>('.pop-footer a');
        expect(repoLink?.href).toBe('https://github.com/Gallections/MathPaste');
    });
});
