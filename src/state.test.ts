import { describe, it, expect, vi, afterEach } from 'vitest';
import {
    FORMAT_KEY,
    FUNCTIONALITY_KEY,
    getStoredFormat,
    setStoredFormat,
    getStoredFunctionalityEnabled,
    setStoredFunctionalityEnabled,
    getStoredUiEnabled,
    setStoredUiEnabled,
    getStoredGeneration,
    setStoredGeneration,
    onFormatChange,
    onFunctionalityEnabledChange,
    onUiEnabledChange,
} from './state';

type ChangeListener = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>, area: string) => void;

function mockChrome(initial: Record<string, unknown> = {}) {
    const store: Record<string, unknown> = { ...initial };
    const changeListeners: ChangeListener[] = [];

    const chromeMock = {
        storage: {
            local: {
                get: vi.fn((key: string) => Promise.resolve({ [key]: store[key] })),
                set: vi.fn((obj: Record<string, unknown>) => {
                    for (const [key, newValue] of Object.entries(obj)) {
                        const oldValue = store[key];
                        store[key] = newValue;
                        for (const listener of changeListeners) {
                            listener({ [key]: { oldValue, newValue } }, 'local');
                        }
                    }
                    return Promise.resolve();
                }),
            },
            onChanged: {
                addListener: vi.fn((cb: ChangeListener) => changeListeners.push(cb)),
            },
        },
    };

    return { chromeMock, store, changeListeners };
}

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('format storage', () => {
    it('returns null when nothing is stored', async () => {
        vi.stubGlobal('chrome', mockChrome().chromeMock);
        expect(await getStoredFormat()).toBeNull();
    });

    it('round-trips a stored format', async () => {
        vi.stubGlobal('chrome', mockChrome().chromeMock);
        await setStoredFormat('math_paste_LaTex');
        expect(await getStoredFormat()).toBe('math_paste_LaTex');
    });
});

describe('functionality-enabled storage', () => {
    it('defaults to true when nothing is stored', async () => {
        vi.stubGlobal('chrome', mockChrome().chromeMock);
        expect(await getStoredFunctionalityEnabled()).toBe(true);
    });

    it('round-trips a stored value', async () => {
        vi.stubGlobal('chrome', mockChrome().chromeMock);
        await setStoredFunctionalityEnabled(false);
        expect(await getStoredFunctionalityEnabled()).toBe(false);
    });
});

describe('ui-enabled storage', () => {
    it('defaults to true when nothing is stored', async () => {
        vi.stubGlobal('chrome', mockChrome().chromeMock);
        expect(await getStoredUiEnabled()).toBe(true);
    });

    it('round-trips a stored value', async () => {
        vi.stubGlobal('chrome', mockChrome().chromeMock);
        await setStoredUiEnabled(false);
        expect(await getStoredUiEnabled()).toBe(false);
    });

    it('is independent of the functionality flag', async () => {
        vi.stubGlobal('chrome', mockChrome().chromeMock);
        await setStoredFunctionalityEnabled(false);
        expect(await getStoredUiEnabled()).toBe(true);

        await setStoredUiEnabled(false);
        expect(await getStoredFunctionalityEnabled()).toBe(false);
    });
});

describe('generation storage', () => {
    it('returns null when nothing is stored', async () => {
        vi.stubGlobal('chrome', mockChrome().chromeMock);
        expect(await getStoredGeneration()).toBeNull();
    });

    it('round-trips a stored generation token', async () => {
        vi.stubGlobal('chrome', mockChrome().chromeMock);
        await setStoredGeneration('some-uuid');
        expect(await getStoredGeneration()).toBe('some-uuid');
    });
});

describe('onFormatChange', () => {
    it('notifies listeners when the format changes', async () => {
        const { chromeMock } = mockChrome();
        vi.stubGlobal('chrome', chromeMock);
        const cb = vi.fn();
        onFormatChange(cb);

        await setStoredFormat('math_paste_Typst');

        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith('math_paste_Typst');
    });

    it('ignores changes to unrelated keys', () => {
        const { chromeMock, changeListeners } = mockChrome();
        vi.stubGlobal('chrome', chromeMock);
        const cb = vi.fn();
        onFormatChange(cb);

        changeListeners[0]({ [FUNCTIONALITY_KEY]: { newValue: false } }, 'local');

        expect(cb).not.toHaveBeenCalled();
    });

    it('ignores changes outside the local storage area', () => {
        const { chromeMock, changeListeners } = mockChrome();
        vi.stubGlobal('chrome', chromeMock);
        const cb = vi.fn();
        onFormatChange(cb);

        changeListeners[0]({ [FORMAT_KEY]: { newValue: 'math_paste_Obsidian' } }, 'sync');

        expect(cb).not.toHaveBeenCalled();
    });
});

describe('onFunctionalityEnabledChange', () => {
    it('notifies listeners when the functionality flag changes', async () => {
        const { chromeMock } = mockChrome();
        vi.stubGlobal('chrome', chromeMock);
        const cb = vi.fn();
        onFunctionalityEnabledChange(cb);

        await setStoredFunctionalityEnabled(false);

        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith(false);
    });

    it('does not fire on a UI flag change', async () => {
        const { chromeMock } = mockChrome();
        vi.stubGlobal('chrome', chromeMock);
        const cb = vi.fn();
        onFunctionalityEnabledChange(cb);

        await setStoredUiEnabled(false);

        expect(cb).not.toHaveBeenCalled();
    });
});

describe('onUiEnabledChange', () => {
    it('notifies listeners when the UI flag changes', async () => {
        const { chromeMock } = mockChrome();
        vi.stubGlobal('chrome', chromeMock);
        const cb = vi.fn();
        onUiEnabledChange(cb);

        await setStoredUiEnabled(false);

        expect(cb).toHaveBeenCalledTimes(1);
        expect(cb).toHaveBeenCalledWith(false);
    });

    it('does not fire on a functionality flag change', async () => {
        const { chromeMock } = mockChrome();
        vi.stubGlobal('chrome', chromeMock);
        const cb = vi.fn();
        onUiEnabledChange(cb);

        await setStoredFunctionalityEnabled(false);

        expect(cb).not.toHaveBeenCalled();
    });

    it('ignores changes to unrelated keys', () => {
        const { chromeMock, changeListeners } = mockChrome();
        vi.stubGlobal('chrome', chromeMock);
        const cb = vi.fn();
        onUiEnabledChange(cb);

        changeListeners[0]({ [FORMAT_KEY]: { newValue: 'math_paste_Obsidian' } }, 'local');

        expect(cb).not.toHaveBeenCalled();
    });
});
