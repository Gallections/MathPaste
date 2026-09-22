import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type OnInstalledListener = (details: { reason: string }) => void;

function mockChrome() {
    const listeners: { onInstalled?: OnInstalledListener } = {};

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
            onActivated: { addListener: vi.fn() },
            query: vi.fn(),
            sendMessage: vi.fn(),
        },
        webNavigation: { onCompleted: { addListener: vi.fn() } },
        scripting: { executeScript: vi.fn(() => Promise.resolve()) },
        commands: { onCommand: { addListener: vi.fn() } },
    };

    return { chromeMock, listeners };
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

        listeners.onInstalled!({ reason: 'update' });
        listeners.onInstalled!({ reason: 'chrome_update' });
        listeners.onInstalled!({ reason: 'shared_module_update' });
        expect(chromeMock.tabs.create).not.toHaveBeenCalled();

        listeners.onInstalled!({ reason: 'install' });
        expect(chromeMock.tabs.create).toHaveBeenCalledTimes(1);
        expect(chromeMock.tabs.create).toHaveBeenCalledWith({
            url: 'chrome-extension://test/onboarding.html',
        });
    });
});
