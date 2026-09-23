import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FUNCTIONALITY_KEY, GENERATION_KEY } from './state';

type OnInstalledListener = (details: { reason: string }) => void | Promise<void>;
type OnCommandListener = (command: string) => void | Promise<void>;
type OnActivatedListener = (activeInfo: { tabId: number }) => void;
type OnCompletedListener = (details: { tabId: number }) => void;

function mockChrome(tabUrlsById: Record<number, string> = {}) {
    const listeners: {
        onInstalled?: OnInstalledListener;
        onCommand?: OnCommandListener;
        onActivated?: OnActivatedListener;
        onCompleted?: OnCompletedListener;
    } = {};
    const store: Record<string, unknown> = {};
    const openTabs = Object.entries(tabUrlsById).map(([id, url]) => ({ id: Number(id), url }));

    const chromeMock = {
        runtime: {
            onInstalled: {
                addListener: vi.fn((cb: OnInstalledListener) => { listeners.onInstalled = cb; }),
            },
            onMessage: { addListener: vi.fn() },
            getURL: vi.fn((path: string) => `chrome-extension://test/${path}`),
        },
        tabs: {
            create: vi.fn(),
            onActivated: {
                addListener: vi.fn((cb: OnActivatedListener) => { listeners.onActivated = cb; }),
            },
            get: vi.fn((tabId: number, cb: (tab: { id: number; url?: string }) => void) => {
                cb({ id: tabId, url: tabUrlsById[tabId] });
            }),
            query: vi.fn((_filter: unknown, cb: (tabs: { id: number; url?: string }[]) => void) => cb(openTabs)),
            sendMessage: vi.fn(),
        },
        webNavigation: {
            onCompleted: {
                addListener: vi.fn((cb: OnCompletedListener) => { listeners.onCompleted = cb; }),
            },
        },
        scripting: { executeScript: vi.fn(() => Promise.resolve()) },
        commands: {
            onCommand: {
                addListener: vi.fn((cb: OnCommandListener) => { listeners.onCommand = cb; }),
            },
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
    };

    return { chromeMock, listeners, store };
}

afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
});

describe('shouldShowOnboarding', () => {
    beforeEach(() => {
        vi.stubGlobal('chrome', mockChrome().chromeMock);
    });

    it('returns true on a fresh install', async () => {
        const { shouldShowOnboarding } = await import('./background');
        expect(shouldShowOnboarding('install')).toBe(true);
    });

    it('returns false when the extension is updated', async () => {
        const { shouldShowOnboarding } = await import('./background');
        expect(shouldShowOnboarding('update')).toBe(false);
    });

    it('returns false when Chrome itself is updated', async () => {
        const { shouldShowOnboarding } = await import('./background');
        expect(shouldShowOnboarding('chrome_update')).toBe(false);
    });

    it('returns false for a shared module update', async () => {
        const { shouldShowOnboarding } = await import('./background');
        expect(shouldShowOnboarding('shared_module_update')).toBe(false);
    });

    it('returns false for an unrecognized reason', async () => {
        const { shouldShowOnboarding } = await import('./background');
        expect(shouldShowOnboarding('')).toBe(false);
    });
});

describe('onInstalled wiring', () => {
    it('opens the onboarding tab only on first install, never on update/chrome_update/reload', async () => {
        const { chromeMock, listeners } = mockChrome();
        vi.stubGlobal('chrome', chromeMock);
        await import('./background');

        await listeners.onInstalled!({ reason: 'update' });
        await listeners.onInstalled!({ reason: 'chrome_update' });
        await listeners.onInstalled!({ reason: 'shared_module_update' });
        expect(chromeMock.tabs.create).not.toHaveBeenCalled();

        await listeners.onInstalled!({ reason: 'install' });
        expect(chromeMock.tabs.create).toHaveBeenCalledTimes(1);
        expect(chromeMock.tabs.create).toHaveBeenCalledWith({
            url: 'chrome-extension://test/onboarding.html',
        });
    });
});

describe('toggle command', () => {
    it('flips the shared functionality flag in storage, defaulting to enabled', async () => {
        const { chromeMock, listeners, store } = mockChrome();
        vi.stubGlobal('chrome', chromeMock);
        await import('./background');

        // Nothing stored yet — getStoredFunctionalityEnabled() defaults to
        // true, so the first toggle should persist false for every tab to
        // pick up. The UI toggle is untouched — the shortcut only affects
        // whether copy.ts converts, not whether the pill is visible.
        await listeners.onCommand!('toggle-math-paste');
        expect(store[FUNCTIONALITY_KEY]).toBe(false);

        // Toggling again flips it back.
        await listeners.onCommand!('toggle-math-paste');
        expect(store[FUNCTIONALITY_KEY]).toBe(true);
    });

    it('ignores commands other than toggle-math-paste', async () => {
        const { chromeMock, listeners } = mockChrome();
        vi.stubGlobal('chrome', chromeMock);
        await import('./background');

        await listeners.onCommand!('some-other-command');
        expect(chromeMock.storage.local.set).not.toHaveBeenCalled();
    });
});

describe('content script re-injection', () => {
    // Regression test: tabs that were already open before install/reload only
    // get scripts re-injected via these two hooks (the declarative
    // content_scripts entry never runs for them). Both the copy interceptor
    // AND the pill UI must be re-injected, or the pill never appears there
    // until the user manually refreshes.
    it('re-injects both copy.js and frontend.js on tab activation, for an injectable URL', async () => {
        const { chromeMock, listeners } = mockChrome({ 7: 'https://chatgpt.com/' });
        vi.stubGlobal('chrome', chromeMock);
        await import('./background');

        listeners.onActivated!({ tabId: 7 });

        expect(chromeMock.scripting.executeScript).toHaveBeenCalledWith({
            target: { tabId: 7 },
            files: ['src/copy.js', 'src/frontend.js'],
        });
    });

    it('re-injects both copy.js and frontend.js when a navigation completes', async () => {
        const { chromeMock, listeners } = mockChrome({ 9: 'http://example.com/' });
        vi.stubGlobal('chrome', chromeMock);
        await import('./background');

        listeners.onCompleted!({ tabId: 9 });

        expect(chromeMock.scripting.executeScript).toHaveBeenCalledWith({
            target: { tabId: 9 },
            files: ['src/copy.js', 'src/frontend.js'],
        });
    });

    it('skips non-injectable URLs (chrome://, about:blank, etc.)', async () => {
        const { chromeMock, listeners } = mockChrome({ 3: 'chrome://extensions/' });
        vi.stubGlobal('chrome', chromeMock);
        await import('./background');

        listeners.onActivated!({ tabId: 3 });

        expect(chromeMock.scripting.executeScript).not.toHaveBeenCalled();
    });
});

describe('inject into already-open tabs on install/update/reload', () => {
    // Regression test: tabs open at the moment this fires never get the
    // declarative content_scripts injection (it only fires on a NEW
    // navigation), so without this the pill wouldn't show up anywhere the
    // user already had open until they switched tabs, navigated, or refreshed.
    // This must cover every reason — install, update, chrome_update, and a
    // dev reload — because all of them restart the service worker and orphan
    // whatever content script is already running in an open tab, not just a
    // first install.
    it.each(['install', 'update', 'chrome_update', 'shared_module_update'])(
        'injects into every open, injectable tab when reason is %s',
        async (reason) => {
            const { chromeMock, listeners } = mockChrome({
                1: 'https://chatgpt.com/',
                2: 'https://claude.ai/chats',
                3: 'chrome://extensions/', // not injectable
            });
            vi.stubGlobal('chrome', chromeMock);
            await import('./background');

            await listeners.onInstalled!({ reason });

            expect(chromeMock.scripting.executeScript).toHaveBeenCalledTimes(2);
            expect(chromeMock.scripting.executeScript).toHaveBeenCalledWith({
                target: { tabId: 1 },
                files: ['src/copy.js', 'src/frontend.js'],
            });
            expect(chromeMock.scripting.executeScript).toHaveBeenCalledWith({
                target: { tabId: 2 },
                files: ['src/copy.js', 'src/frontend.js'],
            });
        }
    );
});

describe('generation bump on install/update/reload', () => {
    // Regression test: a plain re-injection isn't enough on its own — the
    // content scripts' re-init guards need a fresh generation token to tell
    // a genuinely new script generation apart from a redundant re-injection
    // of the one already running (see state.ts). Without a NEW token here,
    // they'd see their own stale flag and skip re-initializing.
    it.each(['install', 'update', 'chrome_update', 'shared_module_update'])(
        'stores a fresh generation token before injecting, for reason %s',
        async (reason) => {
            const { chromeMock, listeners, store } = mockChrome({ 1: 'https://chatgpt.com/' });
            vi.stubGlobal('chrome', chromeMock);
            await import('./background');

            await listeners.onInstalled!({ reason });

            expect(typeof store[GENERATION_KEY]).toBe('string');
            expect((store[GENERATION_KEY] as string).length).toBeGreaterThan(0);
        }
    );

    it('generates a different token on each install/update/reload', async () => {
        const { chromeMock, listeners, store } = mockChrome();
        vi.stubGlobal('chrome', chromeMock);
        await import('./background');

        await listeners.onInstalled!({ reason: 'install' });
        const first = store[GENERATION_KEY];

        await listeners.onInstalled!({ reason: 'update' });
        const second = store[GENERATION_KEY];

        expect(second).not.toBe(first);
    });
});
