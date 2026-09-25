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

// Regression coverage for a real bug found via live browser testing: the
// Markdown format silently dropped all math (annotation missing from the
// clipboard's serialized HTML — same root cause as the Word bug above) with
// no live-DOM fallback to recover it, unlike every other format's pipeline.
describe('patchMissingAnnotations', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    /** Simulates a clipboard-parsed clone where the browser stripped the annotation's content. */
    function makeClonedKatexWithEmptyAnnotation(): HTMLElement {
        const wrapper = document.createElement('div');
        wrapper.innerHTML =
            '<span class="katex-display"><span class="katex"><span class="katex-mathml">' +
            '<math><semantics><mrow><mi>x</mi></mrow>' +
            '<annotation encoding="application/x-tex"></annotation>' +
            '</semantics></math></span></span></span>';
        return wrapper;
    }

    it('patches an empty annotation using the live element intersecting the selection', async () => {
        const { patchMissingAnnotations } = await loadCopy();

        document.body.appendChild(makeKatexDisplayWithMathML('x^2 + 1', 'LIVE_MARKER'));
        const range = document.createRange();
        range.selectNodeContents(document.body);

        const clonedBody = makeClonedKatexWithEmptyAnnotation();
        patchMissingAnnotations(clonedBody, [range]);

        const ann = clonedBody.querySelector('annotation[encoding="application/x-tex"]');
        expect(ann?.textContent).toBe('x^2 + 1');
    });

    it('leaves an already-present annotation untouched', async () => {
        const { patchMissingAnnotations } = await loadCopy();

        document.body.appendChild(makeKatexDisplayWithMathML('should-not-be-used', 'LIVE'));
        const range = document.createRange();
        range.selectNodeContents(document.body);

        const wrapper = document.createElement('div');
        wrapper.appendChild(makeKatexDisplayWithMathML('already-here', 'CLONE_MARKER'));
        patchMissingAnnotations(wrapper, [range]);

        const ann = wrapper.querySelector('annotation[encoding="application/x-tex"]');
        expect(ann?.textContent).toBe('already-here');
    });

    it('does nothing when there are no ranges', async () => {
        const { patchMissingAnnotations } = await loadCopy();

        const clonedBody = makeClonedKatexWithEmptyAnnotation();
        patchMissingAnnotations(clonedBody, []);

        const ann = clonedBody.querySelector('annotation[encoding="application/x-tex"]');
        expect(ann?.textContent).toBe('');
    });

    it('pairs multiple math elements positionally', async () => {
        const { patchMissingAnnotations } = await loadCopy();

        document.body.appendChild(makeKatexDisplayWithMathML('a', 'A'));
        document.body.appendChild(makeKatexDisplayWithMathML('b', 'B'));
        const range = document.createRange();
        range.selectNodeContents(document.body);

        const wrapper = document.createElement('div');
        wrapper.appendChild(makeClonedKatexWithEmptyAnnotation());
        wrapper.appendChild(makeClonedKatexWithEmptyAnnotation());
        patchMissingAnnotations(wrapper, [range]);

        const anns = wrapper.querySelectorAll('annotation[encoding="application/x-tex"]');
        expect(anns[0].textContent).toBe('a');
        expect(anns[1].textContent).toBe('b');
    });
});

// Regression coverage for a real bug found via live browser testing against
// actual chatgpt.com: real ChatGPT skips the .katex-display wrapper and puts
// <math display="block"> directly inside .katex instead. Walking up from the
// annotation, findMathContainer correctly detected isBlock=true from that
// <math> tag, but then kept walking, hit the outer .katex span, and
// unconditionally reset isBlock back to false — block equations were wrapped
// as inline ($...$) instead of block ($$...$$).
describe('processHTML — ChatGPT-style block detection', () => {
    const wrappedFormat = (latex: string, isBlock: boolean) =>
        isBlock ? `$$${latex}$$` : `$${latex}$`;

    it('wraps a ChatGPT-style .katex > math[display="block"] equation as block', async () => {
        const { processHTML } = await loadCopy();

        const body = document.createElement('body');
        const katex = document.createElement('span');
        katex.className = 'katex';
        const math = document.createElement('math');
        math.setAttribute('display', 'block');
        const ann = document.createElement('annotation');
        ann.setAttribute('encoding', 'application/x-tex');
        ann.textContent = 'x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}';
        math.appendChild(ann);
        katex.appendChild(math);
        body.appendChild(katex);

        const { text, replaced } = processHTML(body, wrappedFormat);

        expect(replaced).toBe(1);
        expect(text).toBe('$$x=\\frac{-b\\pm\\sqrt{b^2-4ac}}{2a}$$');
    });

    it('still wraps as inline when the ChatGPT-style <math> has no display attribute', async () => {
        const { processHTML } = await loadCopy();

        const body = document.createElement('body');
        const katex = document.createElement('span');
        katex.className = 'katex';
        const math = document.createElement('math');
        const ann = document.createElement('annotation');
        ann.setAttribute('encoding', 'application/x-tex');
        ann.textContent = 'x^2';
        math.appendChild(ann);
        katex.appendChild(math);
        body.appendChild(katex);

        const { text } = processHTML(body, wrappedFormat);

        expect(text).toBe('$x^2$');
    });
});

// Regression: copying a chunk of prose containing an equation was dropping
// everything except the equation — because Strategy 1 (processHTML, which
// replaces math *in place* within the cloned selection HTML, preserving
// surrounding text) only ever looked for <annotation> tags. Real
// annotation-less KaTeX (ChatGPT's HTML-only render — see
// katexHtmlToLatex.ts) always failed to find one, replaced=0 every time, so
// every mixed text+equation copy fell through to the live-DOM-only
// fallback, which by design recovers just the equations and discards
// everything else.
describe('processHTML — mixed prose + annotation-less equation', () => {
    const wrappedFormat = (latex: string, isBlock: boolean) =>
        isBlock ? `$$${latex}$$` : `$${latex}$`;

    it('preserves surrounding text and replaces only the equation, even with no annotation present', async () => {
        const { processHTML } = await loadCopy();

        const body = document.createElement('body');
        const p = document.createElement('p');
        p.appendChild(document.createTextNode('Before the equation, '));

        const katex = document.createElement('span');
        katex.className = 'katex';
        const katexHtml = document.createElement('span');
        katexHtml.className = 'katex-html';
        katexHtml.setAttribute('aria-hidden', 'true');
        const base = document.createElement('span');
        base.className = 'base';
        const mord = document.createElement('span');
        mord.className = 'mord mathnormal';
        mord.textContent = 'x';
        base.appendChild(mord);
        katexHtml.appendChild(base);
        katex.appendChild(katexHtml); // no .katex-mathml/<annotation> at all
        p.appendChild(katex);

        p.appendChild(document.createTextNode(' after the equation.'));
        body.appendChild(p);

        const { text, replaced } = processHTML(body, wrappedFormat);

        expect(replaced).toBe(1);
        expect(text).toBe('Before the equation, $x$ after the equation.');
    });
});

// ─── Live copy-event interception (regression) ───────────────────────────────
// Regression for the actual bug reported live: copying via ChatGPT's own
// selection worked in isolated unit tests of the pure formatting functions,
// but real-world copies (both Ctrl+C and right-click ▸ Copy) still pasted
// completely raw, unformatted text. Root cause: the "copy" listener never
// called event.preventDefault() and instead read back the clipboard
// asynchronously via navigator.clipboard.read() after the browser's own
// default copy had already run, then tried to overwrite it via
// navigator.clipboard.write() — a race against that default write (and,
// for a context-menu-triggered copy, against expiring user-activation)
// that the browser's own write could silently win, leaving the native,
// unformatted copy standing. These tests dispatch a real "copy" event
// through the actual document-level listener (not just the pure formatting
// helpers) and assert the interception is synchronous: defaultPrevented is
// true and the override lands on clipboardData before the handler returns,
// with no dependency on the async Clipboard API at all.
//
// jsdom doesn't implement DataTransfer/ClipboardEvent, so a minimal
// same-shape stand-in is used for clipboardData; the "copy" event itself is
// a plain, cancelable Event, which is all copy.ts's listener touches.
describe('copy event — live synchronous interception (regression)', () => {
    class FakeDataTransfer {
        private data = new Map<string, string>();
        setData(type: string, value: string) { this.data.set(type, value); }
        getData(type: string) { return this.data.get(type) ?? ''; }
    }

    function makeCopyEvent(dt: FakeDataTransfer) {
        const event = new Event('copy', { bubbles: true, cancelable: true });
        Object.defineProperty(event, 'clipboardData', { value: dt, configurable: true });
        return event as unknown as ClipboardEvent;
    }

    function mockChromeWithFormat(formatId: string) {
        return {
            storage: {
                local: {
                    get: vi.fn((key: string) => {
                        if (key === 'mathpaste_format') return Promise.resolve({ mathpaste_format: formatId });
                        if (key === 'mathpaste_functionality_enabled') return Promise.resolve({ mathpaste_functionality_enabled: true });
                        return Promise.resolve({});
                    }),
                    set: vi.fn(() => Promise.resolve()),
                },
                onChanged: { addListener: vi.fn() },
            },
        };
    }

    function resetMathpasteGlobals() {
        document.body.innerHTML = '';
        for (const key of ['__mathpasteGeneration', '__mathpasteListener', '__mathpasteCurrentFormat',
                            '__mathpasteIsActive', '__mathpasteOptionToFunction']) {
            delete (window as any)[key];
        }
    }

    // Prior tests in this file (and this file's own generic loadCopy()) leave
    // window.__mathpasteGeneration set — initForCurrentGeneration()'s
    // generation-equality guard would then skip re-registering the listener
    // entirely, silently leaving a stale listener (wrong mocked format) from
    // an earlier test attached instead.
    beforeEach(resetMathpasteGlobals);
    afterEach(resetMathpasteGlobals);

    async function loadCopyAndWaitForListener(formatId: string) {
        const addSpy = vi.spyOn(document, 'addEventListener');
        vi.resetModules();
        vi.stubGlobal('chrome', mockChromeWithFormat(formatId));
        const mod = await import('./copy');
        // initForCurrentGeneration() is fire-and-forget at module load —
        // wait for it to actually register the listener (a few
        // chrome.storage.local.get round-trips deep).
        for (let i = 0; i < 50 && !addSpy.mock.calls.some(c => c[0] === 'copy'); i++) {
            await new Promise(r => setTimeout(r, 0));
        }
        addSpy.mockRestore();
        return mod;
    }

    it('claims a real dispatched copy event synchronously via the live-DOM fallback for a realistic leaf-to-leaf selection', async () => {
        await loadCopyAndWaitForListener('math_paste_Obsidian');

        const el = makeKatexDisplayWithMathML('x^2', 'marker');
        document.body.appendChild(el);

        // A real mouse drag starts/ends inside rendered TEXT — here, the
        // visible "marker" glyph inside <mi> — never inside the sibling
        // <annotation>, which is always visually hidden (clip-rect'd for
        // screen readers) and so is never part of what a user drags over.
        // Range.cloneContents() on a range like this reliably does NOT
        // include that hidden sibling (verified directly: cloning it in
        // isolation yields no .katex/.katex-display wrapper and no
        // <annotation> at all) — this is what real partial (and even
        // full-looking) selections of rendered KaTeX produce, and is
        // exactly the shape of the live bug report this regression guards.
        const mi = el.querySelector('mi')!;
        const textNode = mi.firstChild as Text;
        const range = document.createRange();
        range.setStart(textNode, 0);
        range.setEnd(textNode, textNode.length);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);

        const dt = new FakeDataTransfer();
        const event = makeCopyEvent(dt);

        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(dt.getData('text/plain')).toBe('$$x^2$$');
    });

    it('wins over a bubble-phase host-page "copy" listener that also tries to overwrite clipboardData (e.g. a site-added attribution)', async () => {
        // Regression for a live report: our own debug trace confirmed a
        // correct write with event.defaultPrevented === true, yet the
        // actual paste was still raw/unformatted. ChatGPT (like many sites)
        // very plausibly has its own "copy" listener — e.g. powering its
        // "Ask ChatGPT / Share highlighted" toolbar, or appending a "Read
        // more at ..." attribution the way many sites do on copy. A
        // bubble-phase listener on a descendant element fires *before* one
        // on document, so if it also calls clipboardData.setData(), it can
        // silently clobber our write even though preventDefault() was
        // already called. Registering in the capture phase (see
        // CAPTURE_OPTS in copy.ts) means we always see the event first.
        await loadCopyAndWaitForListener('math_paste_Obsidian');

        const el = makeKatexDisplayWithMathML('x^2', 'marker');
        document.body.appendChild(el);
        const mi = el.querySelector('mi')!;
        const textNode = mi.firstChild as Text;
        const range = document.createRange();
        range.setStart(textNode, 0);
        range.setEnd(textNode, textNode.length);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);

        // A host-page listener registered on a descendant element, in the
        // default bubble phase — exactly the shape a real site's own copy
        // customization would take.
        el.addEventListener('copy', (e) => {
            (e as ClipboardEvent).clipboardData?.setData('text/plain', 'raw unformatted text + some site attribution');
        });

        const dt = new FakeDataTransfer();
        const event = makeCopyEvent(dt);
        el.dispatchEvent(event);

        expect(dt.getData('text/plain')).toBe('$$x^2$$');
    });

    it('recovers math via the katexHtmlToLatex last resort when the live DOM has no annotation at all', async () => {
        // Reproduces the actual live bug: KaTeX rendered with output:'html'
        // only (confirmed via a real captured DOM dump — .katex contains
        // only .katex-html, no .katex-mathml/<annotation> sibling at all).
        // Neither Strategy 1 nor the annotation-based half of Strategy 1.5
        // has anything to find; only reconstructing from the visual HTML
        // (katexHtmlToLatex) can recover it.
        await loadCopyAndWaitForListener('math_paste_Obsidian');

        const display = document.createElement('span');
        display.className = 'katex-display';
        const katexEl = document.createElement('span');
        katexEl.className = 'katex';
        const katexHtml = document.createElement('span');
        katexHtml.className = 'katex-html';
        katexHtml.setAttribute('aria-hidden', 'true');
        const base = document.createElement('span');
        base.className = 'base';
        const mord = document.createElement('span');
        mord.className = 'mord mathnormal';
        mord.textContent = 'x';
        base.appendChild(mord);
        katexHtml.appendChild(base);
        katexEl.appendChild(katexHtml); // no .katex-mathml sibling — the whole point
        display.appendChild(katexEl);
        document.body.appendChild(display);

        const range = document.createRange();
        range.setStart(mord.firstChild as Text, 0);
        range.setEnd(mord.firstChild as Text, 1);
        const sel = window.getSelection()!;
        sel.removeAllRanges();
        sel.addRange(range);

        const dt = new FakeDataTransfer();
        const event = makeCopyEvent(dt);
        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(true);
        expect(dt.getData('text/plain')).toBe('$$x$$');
    });

    it('leaves the copy event unmodified (defaultPrevented stays false) when nothing matches', async () => {
        await loadCopyAndWaitForListener('math_paste_Obsidian');

        document.body.appendChild(document.createElement('p'));

        const dt = new FakeDataTransfer();
        dt.setData('text/html', '<p>plain text, no math here</p>');
        const event = makeCopyEvent(dt);

        document.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
    });
});
