import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// copy.ts runs module-level side effects on import (reads storage, may
// register a "copy" listener) — same as background.ts/frontend.ts — so
// chrome must be stubbed before import, and each test needs a fresh module
// instance via vi.resetModules().
function mockChrome() {
    return {
        storage: {
            local: {
                get: vi.fn(() => Promise.resolve({})),
                set: vi.fn(() => Promise.resolve()),
            },
            onChanged: { addListener: vi.fn() },
        },
    };
}

async function loadCopy() {
    vi.resetModules();
    vi.stubGlobal('chrome', mockChrome());
    return import('./copy');
}

afterEach(() => {
    vi.unstubAllGlobals();
});

// ─── Fixtures ─────────────────────────────────────────────────────────────
// Mirrors domUtils.test.ts's KaTeX fixture shape: .katex-display > .katex >
// .katex-mathml > math > annotation[encoding="application/x-tex"].

/** A realistic KaTeX block with a pre-rendered MathML tree containing a distinctive marker. */
function makeKatexDisplayWithMathML(latex: string, markerText: string): HTMLElement {
    const display = document.createElement('span');
    display.className = 'katex-display';
    const katex = document.createElement('span');
    katex.className = 'katex';
    const mathmlSpan = document.createElement('span');
    mathmlSpan.className = 'katex-mathml';
    const math = document.createElement('math');
    math.innerHTML =
        `<semantics><mrow><mi>${markerText}</mi></mrow>` +
        `<annotation encoding="application/x-tex">${latex}</annotation></semantics>`;
    mathmlSpan.appendChild(math);
    katex.appendChild(mathmlSpan);
    display.appendChild(katex);
    return display;
}

/** A contrived KaTeX-shaped block with NO <math> wrapper — exercises the synthesis fallback. */
function makeKatexDisplayNoMathTag(latex: string): HTMLElement {
    const display = document.createElement('span');
    display.className = 'katex-display';
    const katex = document.createElement('span');
    katex.className = 'katex';
    const mathmlSpan = document.createElement('span');
    mathmlSpan.className = 'katex-mathml';
    const annotation = document.createElement('annotation');
    annotation.setAttribute('encoding', 'application/x-tex');
    annotation.textContent = latex;
    mathmlSpan.appendChild(annotation);
    katex.appendChild(mathmlSpan);
    display.appendChild(katex);
    return display;
}

describe('processHTMLForWord', () => {
    it('reuses the pre-rendered MathML tree when one is present, not the synthesized fallback', async () => {
        const { processHTMLForWord } = await loadCopy();
        const body = document.createElement('body');
        body.appendChild(document.createTextNode('Before '));
        body.appendChild(makeKatexDisplayWithMathML('x', 'REUSED_MARKER'));
        body.appendChild(document.createTextNode(' after'));

        const { html, replaced } = processHTMLForWord(body);

        expect(replaced).toBe(1);
        expect(html).toContain('REUSED_MARKER');
        expect(html).toContain('<math');
        expect(html).toContain('xmlns="http://www.w3.org/1998/Math/MathML"');
        expect(html).toContain('display="block"');
        expect(html).not.toContain('katex-display'); // the visual container was replaced, not kept
    });

    it('synthesizes MathML from the LaTeX source when no pre-rendered tree is present', async () => {
        const { processHTMLForWord } = await loadCopy();
        const body = document.createElement('body');
        body.appendChild(makeKatexDisplayNoMathTag('x'));

        const { html, replaced } = processHTMLForWord(body);

        expect(replaced).toBe(1);
        expect(html).not.toContain('REUSED_MARKER');
        expect(html).toContain('<mi>x</mi>');
    });

    it('sets isBlock correctly for inline KaTeX (no display attribute)', async () => {
        const { processHTMLForWord } = await loadCopy();
        const body = document.createElement('body');
        const katex = document.createElement('span');
        katex.className = 'katex';
        const mathmlSpan = document.createElement('span');
        mathmlSpan.className = 'katex-mathml';
        const math = document.createElement('math');
        math.innerHTML = '<annotation encoding="application/x-tex">x</annotation>';
        mathmlSpan.appendChild(math);
        katex.appendChild(mathmlSpan);
        body.appendChild(katex);

        const { html } = processHTMLForWord(body);
        expect(html).not.toContain('display="block"');
    });

    it('returns replaced: 0 and leaves the body untouched when there is no math', async () => {
        const { processHTMLForWord } = await loadCopy();
        const body = document.createElement('body');
        body.appendChild(document.createTextNode('just plain text'));

        const { html, text, replaced } = processHTMLForWord(body);
        expect(replaced).toBe(0);
        expect(text).toBe('just plain text');
        expect(html).toBe('just plain text');
    });
});

describe('processPlainTextForWord', () => {
    it('embeds synthesized MathML for an inline $...$ expression, preserving surrounding text', async () => {
        const { processPlainTextForWord } = await loadCopy();
        const { html, text } = processPlainTextForWord('The answer is $x^2$ today.');

        expect(html).toContain('The answer is ');
        expect(html).toContain(' today.');
        expect(html).toContain('<msup><mrow><mi>x</mi></mrow><mrow><mn>2</mn></mrow></msup>');
        expect(html).not.toContain('display="block"');
        expect(text).toContain('The answer is');
    });

    it('marks a $$...$$ block expression as display="block"', async () => {
        const { processPlainTextForWord } = await loadCopy();
        const { html } = processPlainTextForWord('$$x+1$$');
        expect(html).toContain('display="block"');
    });

    it('converts multiple expressions in the same string', async () => {
        const { processPlainTextForWord } = await loadCopy();
        const { html } = processPlainTextForWord('$a$ and $b$');
        expect(html).toContain('<mi>a</mi>');
        expect(html).toContain('<mi>b</mi>');
        expect(html).toContain(' and ');
    });
});

// Regression coverage for a real bug found via live browser testing:
// browsers frequently omit a KaTeX annotation's content from the
// clipboard's serialized HTML (it's position:absolute; clip:rect(...)
// hidden, screen-reader-only), even though sibling MathML tags survive —
// so processHTMLForWord alone finds nothing, and this live-DOM fallback,
// which reads directly from the actual page instead of the clipboard
// snapshot, is what makes the Word format work in practice.
describe('processFromLiveDOMForWord', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('returns null when there are no ranges', async () => {
        const { processFromLiveDOMForWord } = await loadCopy();
        expect(processFromLiveDOMForWord([])).toBeNull();
    });

    it('finds a KaTeX display block intersecting the selection and reuses its MathML', async () => {
        const { processFromLiveDOMForWord } = await loadCopy();

        const el = makeKatexDisplayWithMathML('x', 'LIVE_DOM_MARKER');
        document.body.appendChild(el);
        const range = document.createRange();
        range.selectNodeContents(document.body);

        const result = processFromLiveDOMForWord([range]);

        expect(result).not.toBeNull();
        expect(result!.html).toContain('LIVE_DOM_MARKER');
        expect(result!.html).toContain('display="block"');
    });

    it('returns null when the selection does not intersect any KaTeX container', async () => {
        const { processFromLiveDOMForWord } = await loadCopy();

        const el = makeKatexDisplayWithMathML('x', 'MARKER');
        document.body.appendChild(el);
        const other = document.createElement('p');
        other.textContent = 'unrelated paragraph';
        document.body.appendChild(other);

        const range = document.createRange();
        range.selectNodeContents(other);

        expect(processFromLiveDOMForWord([range])).toBeNull();
    });

    it('joins multiple matched equations with a separating space', async () => {
        const { processFromLiveDOMForWord } = await loadCopy();

        document.body.appendChild(makeKatexDisplayWithMathML('a', 'FIRST_MARKER'));
        document.body.appendChild(makeKatexDisplayWithMathML('b', 'SECOND_MARKER'));
        const range = document.createRange();
        range.selectNodeContents(document.body);

        const result = processFromLiveDOMForWord([range]);

        expect(result).not.toBeNull();
        expect(result!.html).toContain('FIRST_MARKER');
        expect(result!.html).toContain('SECOND_MARKER');
    });
});
