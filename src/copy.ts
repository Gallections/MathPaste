import { processFromLiveDOM, MATH_CONTAINER_SELECTOR, dedupeNestedContainers, computeIsBlock } from './domUtils';
import { htmlToMarkdown } from './markdownUtils';
import { latexToMathML } from './latexToMathML';
import { katexHtmlToLatex } from './katexHtmlToLatex';
import { getStoredFormat, getStoredFunctionalityEnabled, getStoredGeneration, onFormatChange, onFunctionalityEnabledChange } from './state';

// Use window to persist state across repeated content-script injections.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = window as any;

// Registering the "copy" listener in the CAPTURE phase (top-down, document
// first) instead of the default bubble phase means it always runs before
// any listener the host page itself registered on a descendant element —
// e.g. ChatGPT very likely has its own "copy" listener powering its "Ask
// ChatGPT / Share highlighted" selection toolbar. A bubble-phase listener
// on an inner element fires *before* one on document, and if that
// listener also calls clipboardData.setData() (common — sites append a
// "Read more at ..." attribution on copy this way), it can silently
// clobber whatever we already wrote. Capture phase avoids the ordering
// question entirely: we see the event first.
const CAPTURE_OPTS = { capture: true };

// Re-initializes whenever the extension's generation changes (see state.ts:
// a fresh install, update, chrome update, or dev reload) — not merely on
// this script's first-ever injection into the page. A plain one-time flag
// can't tell those apart, since `window` survives an update even though the
// old script's extension context doesn't; without this, a tab that already
// had MathPaste running before an update would keep listening via a stale
// reference and never pick up anything again until manually refreshed.
initForCurrentGeneration();

async function initForCurrentGeneration() {
    const generation = await getStoredGeneration();
    if (win.__mathpasteGeneration === generation) return;
    win.__mathpasteGeneration = generation;

    // Format functions are forward-declared — safe because content scripts compile as IIFE (hoisted).
    win.__mathpasteOptionToFunction = {
        "math_paste_Obsidian":  wrappedFormat,
        "math_paste_LaTex":     latexFormat,
        "math_paste_MathJax":   mathjaxFormat,
        "math_paste_Typst":     typstFormat,
        "math_paste_MediaWiki": mediawikiFormat,
        "math_paste_AsciiMath": asciimathFormat,
        "math_paste_None":      null,
    };

    // Drop whatever listener the previous generation registered, if any —
    // that reference is still valid to remove even though the extension
    // context it closed over is now invalidated. Try both capture and
    // bubble phase since an older script version may have registered
    // without CAPTURE_OPTS (removeEventListener silently no-ops on a
    // capture-flag mismatch, so this covers either case).
    if (typeof win.__mathpasteListener === "function") {
        document.removeEventListener("copy", win.__mathpasteListener, CAPTURE_OPTS);
        document.removeEventListener("copy", win.__mathpasteListener);
    }

    win.__mathpasteCurrentFormat = await getStoredFormat();
    win.__mathpasteIsActive = await getStoredFunctionalityEnabled();
    // A single stable listener that always reads the current format from
    // win.__mathpasteCurrentFormat — no need to recreate it on every change.
    win.__mathpasteListener = (event: ClipboardEvent) => setUpMathPaste(event, win.__mathpasteCurrentFormat);
    if (win.__mathpasteIsActive) {
        document.addEventListener("copy", win.__mathpasteListener, CAPTURE_OPTS);
    }

    // Cross-tab state (see state.ts) — the selected format and the
    // functionality toggle are shared via chrome.storage.local, so every tab
    // converges on the same behaviour instead of only the tab that was
    // active when changed.
    onFormatChange((formatId) => { win.__mathpasteCurrentFormat = formatId; });
    onFunctionalityEnabledChange((enabled) => {
        win.__mathpasteIsActive = enabled;
        document.removeEventListener("copy", win.__mathpasteListener, CAPTURE_OPTS);
        if (enabled) document.addEventListener("copy", win.__mathpasteListener, CAPTURE_OPTS);
    });
}

// ─── Format functions ───────────────────────────────────────────────────────

function wrappedFormat(latex: string, isBlock: boolean): string {
    return isBlock ? `$$${latex}$$` : `$${latex}$`;
}

function latexFormat(latex: string, _isBlock: boolean): string {
    return latex;
}

function mathjaxFormat(latex: string, isBlock: boolean): string {
    return isBlock ? `\\[${latex}\\]` : `\\(${latex}\\)`;
}

function typstFormat(latex: string, isBlock: boolean): string {
    // Typst display math requires surrounding spaces: $ expr $
    return isBlock ? `$ ${latex} $` : `$${latex}$`;
}

function mediawikiFormat(latex: string, isBlock: boolean): string {
    return isBlock
        ? `<math display="block">${latex}</math>`
        : `<math>${latex}</math>`;
}

function asciimathFormat(latex: string, _isBlock: boolean): string {
    return latexToAsciiMath(latex);
}

/**
 * Best-effort LaTeX → AsciiMath converter.
 * Handles the most common academic math constructs via ordered regex passes.
 * Deeply nested braces degrade gracefully (converted to parentheses).
 */
function latexToAsciiMath(latex: string): string {
    let s = latex.trim();

    // 1. Strip display-math environments (not representable in AsciiMath)
    s = s.replace(/\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\}/g, '...');

    // 2. Multi-argument commands (handle up to 3 iterative passes for nesting)
    for (let i = 0; i < 3; i++) {
        s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)');
        s = s.replace(/\\sqrt\[([^\]]*)\]\{([^{}]*)\}/g, 'root($1)($2)');
        s = s.replace(/\\sqrt\{([^{}]*)\}/g, 'sqrt($1)');
        s = s.replace(/\\mathbf\{([^{}]*)\}/g, 'bb($1)');
        s = s.replace(/\\mathbb\{([^{}]*)\}/g, 'bbb($1)');
        s = s.replace(/\\mathcal\{([^{}]*)\}/g, 'cc($1)');
        s = s.replace(/\\mathrm\{([^{}]*)\}/g, '$1');
        s = s.replace(/\\text\{([^{}]*)\}/g, '"$1"');
        s = s.replace(/\\hat\{([^{}]*)\}/g, 'hat($1)');
        s = s.replace(/\\bar\{([^{}]*)\}/g, 'bar($1)');
        s = s.replace(/\\vec\{([^{}]*)\}/g, 'vec($1)');
        s = s.replace(/\\tilde\{([^{}]*)\}/g, 'tilde($1)');
        s = s.replace(/\\dot\{([^{}]*)\}/g, 'dot($1)');
        s = s.replace(/\\ddot\{([^{}]*)\}/g, 'ddot($1)');
        s = s.replace(/\\overline\{([^{}]*)\}/g, 'overline($1)');
        s = s.replace(/\\underbrace\{([^{}]*)\}(?:_\{[^{}]*\})?/g, '$1');
        s = s.replace(/\\overbrace\{([^{}]*)\}(?:\^\{[^{}]*\})?/g, '$1');
    }

    // 3. Greek letters (must come before generic \cmd strip)
    const greek: Record<string, string> = {
        alpha: 'alpha', beta: 'beta', gamma: 'gamma', delta: 'delta',
        epsilon: 'epsilon', varepsilon: 'epsilon', zeta: 'zeta', eta: 'eta',
        theta: 'theta', vartheta: 'theta', iota: 'iota', kappa: 'kappa',
        lambda: 'lambda', mu: 'mu', nu: 'nu', xi: 'xi', pi: 'pi',
        varpi: 'pi', rho: 'rho', varrho: 'rho', sigma: 'sigma',
        varsigma: 'sigma', tau: 'tau', upsilon: 'upsilon', phi: 'phi',
        varphi: 'phi', chi: 'chi', psi: 'psi', omega: 'omega',
        Gamma: 'Gamma', Delta: 'Delta', Theta: 'Theta', Lambda: 'Lambda',
        Xi: 'Xi', Pi: 'Pi', Sigma: 'Sigma', Upsilon: 'Upsilon',
        Phi: 'Phi', Psi: 'Psi', Omega: 'Omega',
    };
    for (const [cmd, ascii] of Object.entries(greek)) {
        s = s.replace(new RegExp(`\\\\${cmd}(?![a-zA-Z])`, 'g'), ascii);
    }

    // 4. Operators and symbols
    s = s.replace(/\\infty/g, 'oo');
    s = s.replace(/\\partial/g, 'del');
    s = s.replace(/\\nabla/g, 'grad');
    s = s.replace(/\\pm/g, '+-');
    s = s.replace(/\\mp/g, '-+');
    s = s.replace(/\\times/g, 'xx');
    s = s.replace(/\\div/g, '-:');
    s = s.replace(/\\cdot/g, '*');
    s = s.replace(/\\cdots/g, '...');
    s = s.replace(/\\ldots/g, '...');
    s = s.replace(/\\leq|\\le(?![a-z])/g, '<=');
    s = s.replace(/\\geq|\\ge(?![a-z])/g, '>=');
    s = s.replace(/\\neq|\\ne(?![a-z])/g, '!=');
    s = s.replace(/\\approx/g, '~~');
    s = s.replace(/\\sim(?![a-z])/g, '~');
    s = s.replace(/\\equiv/g, '-=');
    s = s.replace(/\\propto/g, 'prop');
    s = s.replace(/\\in(?![a-z])/g, 'in');
    s = s.replace(/\\notin/g, '!in');
    s = s.replace(/\\subset/g, 'sub');
    s = s.replace(/\\supset/g, 'sup');
    s = s.replace(/\\subseteq/g, 'sube');
    s = s.replace(/\\supseteq/g, 'supe');
    s = s.replace(/\\cup/g, 'uu');
    s = s.replace(/\\cap/g, 'nn');
    s = s.replace(/\\setminus/g, '\\');
    s = s.replace(/\\emptyset/g, 'O/');
    s = s.replace(/\\wedge|\\land/g, '^^');
    s = s.replace(/\\vee|\\lor/g, 'vv');
    s = s.replace(/\\neg|\\lnot/g, 'not ');
    s = s.replace(/\\forall/g, 'AA');
    s = s.replace(/\\exists/g, 'EE');
    s = s.replace(/\\to|\\rightarrow/g, '->');
    s = s.replace(/\\leftarrow/g, '<-');
    s = s.replace(/\\Rightarrow|\\implies/g, '=>');
    s = s.replace(/\\Leftarrow/g, '<=');
    s = s.replace(/\\Leftrightarrow|\\iff/g, '<=>');
    s = s.replace(/\\sum/g, 'sum');
    s = s.replace(/\\prod/g, 'prod');
    s = s.replace(/\\int/g, 'int');
    s = s.replace(/\\oint/g, 'oint');
    s = s.replace(/\\lim/g, 'lim');
    s = s.replace(/\\max/g, 'max');
    s = s.replace(/\\min/g, 'min');
    s = s.replace(/\\sup/g, 'sup');
    s = s.replace(/\\inf/g, 'inf');
    s = s.replace(/\\det/g, 'det');
    s = s.replace(/\\log/g, 'log');
    s = s.replace(/\\ln/g, 'ln');
    s = s.replace(/\\sin/g, 'sin');
    s = s.replace(/\\cos/g, 'cos');
    s = s.replace(/\\tan/g, 'tan');
    s = s.replace(/\\cot/g, 'cot');
    s = s.replace(/\\sec/g, 'sec');
    s = s.replace(/\\csc/g, 'csc');

    // 5. Braced super/subscripts: x^{abc} → x^(abc)
    s = s.replace(/\^\{([^{}]*)\}/g, '^($1)');
    s = s.replace(/_\{([^{}]*)\}/g, '_($1)');

    // 6. Delimiters
    s = s.replace(/\\left\\\|/g, '||');
    s = s.replace(/\\right\\\|/g, '||');
    s = s.replace(/\\left\|/g, '|');
    s = s.replace(/\\right\|/g, '|');
    s = s.replace(/\\left\(/g, '(');
    s = s.replace(/\\right\)/g, ')');
    s = s.replace(/\\left\[/g, '[');
    s = s.replace(/\\right\]/g, ']');
    s = s.replace(/\\left\\{/g, '{');
    s = s.replace(/\\right\\}/g, '}');
    s = s.replace(/\\left\./g, '');
    s = s.replace(/\\right\./g, '');
    s = s.replace(/\\langle/g, '<<');
    s = s.replace(/\\rangle/g, '>>');
    s = s.replace(/\\lfloor/g, 'lfloor');
    s = s.replace(/\\rfloor/g, 'rfloor');
    s = s.replace(/\\lceil/g, 'lceil');
    s = s.replace(/\\rceil/g, 'rceil');
    s = s.replace(/\\{/g, '{');
    s = s.replace(/\\}/g, '}');

    // 7. Spacing commands — collapse to single space or remove
    s = s.replace(/\\(?:quad|qquad|,|;|:|!)/g, ' ');
    s = s.replace(/\\hspace\{[^}]*\}/g, ' ');

    // 8. Strip remaining unrecognised \commands
    s = s.replace(/\\[a-zA-Z]+\*?/g, '');

    // 9. Bare braces → parentheses
    s = s.replace(/\{/g, '(').replace(/\}/g, ')');

    // 10. Collapse multiple spaces
    s = s.replace(/ {2,}/g, ' ').trim();

    return s;
}

// ─── Markdown pipeline ──────────────────────────────────────────────────────

function setUpMarkdownPaste(event: ClipboardEvent) {
    // Snapshot selection synchronously — see patchMissingAnnotations below.
    const sel = window.getSelection();
    const selRanges = sel
        ? Array.from({ length: sel.rangeCount }, (_, i) => sel.getRangeAt(i).cloneRange())
        : [];

    // See the comment in setUpMathPaste: ClipboardEvent.clipboardData starts
    // empty on a "copy" event, so the selection HTML has to be built
    // ourselves from the live Range(s) rather than read back from the event.
    const container = document.createElement('div');
    for (const range of selRanges) container.appendChild(range.cloneContents());

    // A tight (or even a full-looking) selection of rendered math commonly
    // clones NO math container at all — its class-bearing wrapper never
    // gets included, only the raw visible glyph text (see the comment in
    // setUpMathPaste on why). patchMissingAnnotations can only patch a
    // container that's actually present in the clone, so when there isn't
    // one, fall back to pure live-DOM equation extraction — surrounding
    // non-math text isn't preserved in this path, same tradeoff the other
    // formats already accept in their own live-DOM fallback.
    const hasClonedMathContainer = container.querySelector(MATH_CONTAINER_SELECTOR) !== null;
    if (!hasClonedMathContainer && selRanges.length > 0) {
        const mdFormat = (latex: string, isBlock: boolean) => isBlock ? `\n\n$$${latex}$$\n\n` : `$${latex}$`;
        const liveResult = processFromLiveDOM(selRanges, mdFormat, katexHtmlToLatex);
        if (liveResult !== null) {
            setClipboardText(event, liveResult.trim().replace(/\n{3,}/g, '\n\n'));
            return;
        }
    }

    if (!container.innerHTML) return;

    patchMissingAnnotations(container, selRanges);
    const markdown = htmlToMarkdown(container).trim().replace(/\n{3,}/g, '\n\n');
    setClipboardText(event, markdown);
}

/**
 * Browsers frequently omit a KaTeX annotation's content from the
 * clipboard's serialized HTML — it's position:absolute; clip:rect(...)
 * hidden, screen-reader-only — even though the surrounding math container
 * survives, which otherwise makes htmlToMarkdown silently drop the math
 * entirely (same root cause as the one setUpWordPaste's live-DOM fallback
 * works around). Patches any math container with a missing/empty
 * annotation using the LaTeX from the corresponding LIVE page element,
 * paired positionally — both lists reflect the same underlying selection,
 * so document order lines them up.
 */
export function patchMissingAnnotations(clonedBody: HTMLElement, ranges: Range[]) {
    if (ranges.length === 0) return;

    const clonedContainers = dedupeNestedContainers(
        Array.from(clonedBody.querySelectorAll(MATH_CONTAINER_SELECTOR))
    );

    const liveContainers = dedupeNestedContainers(
        Array.from(document.querySelectorAll(MATH_CONTAINER_SELECTOR)).filter(el => ranges.some(r => {
            try { return r.intersectsNode(el); } catch { return false; }
        }))
    );

    const count = Math.min(clonedContainers.length, liveContainers.length);
    for (let i = 0; i < count; i++) {
        const clonedEl = clonedContainers[i];
        const ann = clonedEl.querySelector('annotation[encoding="application/x-tex"]');
        if (ann?.textContent?.trim()) continue; // already present — nothing to patch

        const liveAnn = liveContainers[i].querySelector('annotation[encoding="application/x-tex"]');
        const latex = liveAnn?.textContent?.trim() || katexHtmlToLatex(liveContainers[i]).trim();
        if (!latex) continue;

        if (ann) {
            ann.textContent = latex;
        } else {
            const newAnn = clonedEl.ownerDocument.createElement('annotation');
            newAnn.setAttribute('encoding', 'application/x-tex');
            newAnn.textContent = latex;
            clonedEl.appendChild(newAnn);
        }
    }
}

// ─── Word pipeline ──────────────────────────────────────────────────────────
// Unlike every other format, Word needs real MathML *elements* embedded in
// the HTML clipboard payload — not an escaped text string — since Word's
// paste handler recognizes embedded MathML and converts it into a native,
// editable equation object automatically. KaTeX already renders a full
// semantic MathML tree alongside its visual HTML (for accessibility), right
// next to the LaTeX annotation — reusing that directly is more reliable
// than re-deriving math structure from the LaTeX source ourselves, so it's
// the primary path; latexToMathML.ts is only the fallback for plain-text
// sources with no pre-rendered tree to reuse (e.g. Copilot).
//
// Strategy 1.5 (live DOM) turns out to matter *far* more here than for the
// other formats: browsers frequently drop a KaTeX annotation's content from
// the clipboard's serialized HTML — it's position:absolute; clip:rect(...)
// hidden, screen-reader-only — even though sibling MathML tags survive.
// Reading straight from the live DOM sidesteps that entirely, so it isn't
// an edge-case fallback here; verified live that it's the path that
// actually fires for real KaTeX output.

function setUpWordPaste(event: ClipboardEvent) {
    // Snapshot selection synchronously — before any DOM changes.
    const sel = window.getSelection();
    const selRanges = sel
        ? Array.from({ length: sel.rangeCount }, (_, i) => sel.getRangeAt(i).cloneRange())
        : [];

    // See the comment in setUpMathPaste: ClipboardEvent.clipboardData starts
    // empty on a "copy" event, so the selection HTML has to be built
    // ourselves from the live Range(s) rather than read back from the event.
    const container = document.createElement('div');
    for (const range of selRanges) container.appendChild(range.cloneContents());
    const htmlText = container.innerHTML;

    // ── Strategy 1: HTML clipboard with rendered math (KaTeX, MathJax, MathML) ──
    if (htmlText) {
        const { html, text, replaced } = processHTMLForWord(container);
        if (replaced > 0) {
            setClipboardData(event, html, text);
            return;
        }

        // ── Strategy 1.5: HTML present but no annotations — fall back to live DOM ──
        if (selRanges.length > 0) {
            const liveResult = processFromLiveDOMForWord(selRanges);
            if (liveResult) {
                setClipboardData(event, liveResult.html, liveResult.text);
                return;
            }
        }

        return; // HTML present but no math found — skip plain-text strategy, native copy stands
    }

    // ── Strategy 2: Plain text containing LaTeX delimiters ──
    const plain = sel?.toString() ?? "";
    if (plain && hasLatexDelimiters(plain)) {
        const { html, text } = processPlainTextForWord(plain);
        setClipboardData(event, html, text);
    }
}

/**
 * Word's counterpart to domUtils.ts's processFromLiveDOM: queries the live
 * page DOM (not the clipboard's serialized HTML) for KaTeX/MathJax
 * containers intersecting the given selection ranges, and builds an HTML
 * fragment of their MathML content back to back. Like the plain-text
 * fallback the other formats use in this same situation, surrounding
 * non-math text isn't preserved here — only the equations are recovered.
 */
export function processFromLiveDOMForWord(ranges: Range[]): { html: string; text: string } | null {
    if (ranges.length === 0) return null;

    const candidates = Array.from(document.querySelectorAll(MATH_CONTAINER_SELECTOR));

    const matched: Element[] = [];
    for (const el of candidates) {
        for (const range of ranges) {
            try {
                if (range.intersectsNode(el)) {
                    matched.push(el);
                    break;
                }
            } catch {
                // cross-origin frame or detached node — skip silently
            }
        }
    }

    const container = document.createElement("div");
    let found = false;

    for (const el of dedupeNestedContainers(matched)) {
        const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
        const latex = (annotation?.textContent ?? '').trim();
        const isBlock = computeIsBlock(el);

        if (annotation && latex) {
            if (found) container.appendChild(document.createTextNode(' '));
            container.appendChild(buildMathMLElement(annotation, latex, isBlock));
            found = true;
            continue;
        }

        // No annotation anywhere (KaTeX rendered HTML-only — see
        // katexHtmlToLatex.ts) — reconstruct approximate LaTeX from the
        // visual HTML structure instead of skipping this equation entirely.
        const reconstructed = katexHtmlToLatex(el).trim();
        if (!reconstructed) continue;
        if (found) container.appendChild(document.createTextNode(' '));
        container.appendChild(synthesizeMathMLElement(reconstructed, isBlock));
        found = true;
    }

    if (!found) return null;
    return { html: container.innerHTML, text: container.textContent ?? '' };
}

/**
 * Every `.katex-display`/`.katex`/`mjx-container` in `root` that isn't
 * nested inside another one already in the list — the outermost math
 * container for each equation, deduplicated.
 */
function findTopLevelMathContainers(root: Element): Element[] {
    return dedupeNestedContainers(Array.from(root.querySelectorAll(MATH_CONTAINER_SELECTOR)));
}

/**
 * Gets a math container's LaTeX (from its annotation if present, else
 * reconstructed from the visual HTML — see katexHtmlToLatex.ts for why
 * that fallback exists at all) and whether it's block/display math. Null
 * if there's nothing usable either way.
 */
function extractMathContent(container: Element): { latex: string; isBlock: boolean } | null {
    const annotation = container.querySelector('annotation[encoding="application/x-tex"]');
    const latex = annotation?.textContent?.trim() || katexHtmlToLatex(container).trim();
    if (!latex) return null;
    return { latex, isBlock: computeIsBlock(container) };
}

/**
 * Like processHTML, but splices in a real <math> MathML element in place of
 * each math container instead of a formatted text string — see the section
 * comment above for why that distinction matters for Word specifically.
 */
export function processHTMLForWord(htmlBody: HTMLElement): { html: string; text: string; replaced: number } {
    const clone = htmlBody.cloneNode(true) as HTMLElement;
    let replaced = 0;

    for (const container of findTopLevelMathContainers(clone)) {
        const extracted = extractMathContent(container);
        if (!extracted) continue;

        const annotation = container.querySelector('annotation[encoding="application/x-tex"]');
        const mathEl = annotation?.textContent?.trim()
            ? buildMathMLElement(annotation, extracted.latex, extracted.isBlock)
            : synthesizeMathMLElement(extracted.latex, extracted.isBlock);
        container.parentNode?.replaceChild(mathEl, container);
        replaced++;
    }

    return { html: clone.innerHTML, text: clone.textContent ?? '', replaced };
}

/**
 * Prefers KaTeX/MathJax's own pre-rendered MathML (the annotation's
 * ancestor <math> element) — it's the renderer's own, presumably-correct
 * conversion. Falls back to synthesizing one from the LaTeX source via
 * latexToMathML when no such tree is present.
 */
function buildMathMLElement(annotation: Element, latex: string, isBlock: boolean): Element {
    const existing = findMathMLAncestor(annotation);
    if (existing) {
        const el = existing.cloneNode(true) as Element;
        el.setAttribute("xmlns", "http://www.w3.org/1998/Math/MathML");
        if (isBlock) el.setAttribute("display", "block");
        return el;
    }

    return synthesizeMathMLElement(latex, isBlock);
}

/** Builds a fresh <math> element from a LaTeX string — no pre-rendered tree to reuse. */
function synthesizeMathMLElement(latex: string, isBlock: boolean): Element {
    const parsed = new DOMParser().parseFromString(latexToMathML(latex, isBlock), "application/xml");
    return document.importNode(parsed.documentElement, true);
}

/** Walks up from a LaTeX annotation to the nearest ancestor <math> element, if any. */
function findMathMLAncestor(start: Element): Element | null {
    let el: Element | null = start.parentElement;
    while (el) {
        if (el.tagName.toLowerCase() === "math") return el;
        el = el.parentElement;
    }
    return null;
}

/**
 * Plain-text counterpart of processHTMLForWord: builds an HTML fragment by
 * walking the LaTeX-delimited text and alternating plain text nodes with
 * synthesized <math> elements (via a detached container, so serialization
 * via innerHTML never escapes the embedded XML).
 */
export function processPlainTextForWord(text: string): { html: string; text: string } {
    const container = document.createElement("div");
    const pattern = /\$\$([\s\S]+?)\$\$|\\\[([\s\S]+?)\\\]|(?<!\$)\$([^$\n]+?)\$(?!\$)|\\\((.+?)\\\)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
        if (match.index > lastIndex) {
            container.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        const isBlock = match[1] !== undefined || match[2] !== undefined;
        const latex = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? '').trim();
        const parsed = new DOMParser().parseFromString(latexToMathML(latex, isBlock), "application/xml");
        container.appendChild(document.importNode(parsed.documentElement, true));
        lastIndex = pattern.lastIndex;
    }
    if (lastIndex < text.length) {
        container.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    return { html: container.innerHTML, text: container.textContent ?? text };
}

// ─── Core pipeline ──────────────────────────────────────────────────────────

function setUpMathPaste(event: ClipboardEvent, imgId: string | null) {
    if (imgId === 'math_paste_Markdown') {
        setUpMarkdownPaste(event);
        return;
    }
    if (imgId === 'math_paste_Word') {
        setUpWordPaste(event);
        return;
    }

    const formatFn = win.__mathpasteOptionToFunction[imgId];
    if (!formatFn) return;

    // Snapshot selection synchronously — before any DOM changes.
    const sel = window.getSelection();
    const selRanges = sel
        ? Array.from({ length: sel.rangeCount }, (_, i) => sel.getRangeAt(i).cloneRange())
        : [];

    // Build our own HTML serialization of the selected DOM instead of
    // reading it from the ClipboardEvent. ClipboardEvent.clipboardData on a
    // "copy" event starts as an EMPTY DataTransfer — it's an out-tray for a
    // page to write an override into via setData(), never pre-populated
    // with the browser's own default serialization of the selection, so
    // there is nothing to read back from it synchronously (confirmed live:
    // clipboardData.getData() returns "" for both text/html and text/plain
    // on entry, every time, by spec — not a bug). The old async code worked
    // around this by reading the OS clipboard back via
    // navigator.clipboard.read() *after* the browser's real default copy
    // had already written to it — which is why it was async, and also why
    // it raced that same default write. Cloning straight from the live
    // selection Range(s) gets us the same kind of HTML without waiting on
    // (or racing) anything the browser does.
    const container = document.createElement('div');
    for (const range of selRanges) container.appendChild(range.cloneContents());
    const htmlText = container.innerHTML;
    const plainText = sel?.toString() ?? "";

    // ── Strategy 1: HTML clipboard with rendered math (KaTeX, MathJax, MathML) ──
    if (htmlText) {
        const { html, text, replaced } = processHTML(container, formatFn);
        if (replaced > 0) {
            setClipboardData(event, html, text);
            return;
        }

        // ── Strategy 1.5: HTML present but no annotations — fall back to live DOM,
        // and if even the live DOM has no annotation at all (KaTeX rendered
        // HTML-only, no MathML companion — see katexHtmlToLatex.ts), reconstruct
        // approximate LaTeX from the visual HTML structure as a last resort. ──
        if (selRanges.length > 0) {
            const liveResult = processFromLiveDOM(selRanges, formatFn, katexHtmlToLatex);
            if (liveResult !== null) {
                setClipboardText(event, liveResult);
                return;
            }
        }

        return; // HTML present but no math found — skip plain-text strategy
    }

    // ── Strategy 2: Plain text containing LaTeX delimiters ──
    // Covers: platform copy buttons, Copilot (no rendering), markdown sources
    if (plainText && hasLatexDelimiters(plainText)) {
        setClipboardText(event, processPlainText(plainText, formatFn));
    }
}

/**
 * Clones the HTML body, finds every rendered math element via its
 * `<annotation encoding="application/x-tex">` tag (present in KaTeX,
 * MathJax v3, and native MathML), replaces the outermost math container
 * in-place with formatted LaTeX text, and returns the result together with
 * a count of replacements made. All surrounding formatting is preserved.
 */
export function processHTML(
    htmlBody: HTMLElement,
    formatFn: (latex: string, isBlock: boolean) => string
): { html: string; text: string; replaced: number } {
    const clone = htmlBody.cloneNode(true) as HTMLElement;
    let replaced = 0;

    for (const container of findTopLevelMathContainers(clone)) {
        const extracted = extractMathContent(container);
        if (!extracted) continue;

        container.parentNode?.replaceChild(
            document.createTextNode(formatFn(extracted.latex, extracted.isBlock)),
            container
        );
        replaced++;
    }

    return { html: clone.innerHTML, text: clone.textContent ?? '', replaced };
}

/** True if text contains any recognised LaTeX math delimiters. */
function hasLatexDelimiters(text: string): boolean {
    return /\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\(.+?\\\)/.test(text);
}

/**
 * Converts LaTeX delimiters in plain text to the target format.
 * Handles $$...$$ / \[...\] (block) and $...$ / \(...\) (inline).
 * Block patterns are matched first so $$ is not consumed by the $ rule.
 */
function processPlainText(
    text: string,
    formatFn: (latex: string, isBlock: boolean) => string
): string {
    let result = text;
    result = result.replace(/\$\$([\s\S]+?)\$\$/g,     (_, l) => formatFn(l.trim(), true));
    result = result.replace(/\\\[([\s\S]+?)\\\]/g,      (_, l) => formatFn(l.trim(), true));
    result = result.replace(/(?<!\$)\$([^$\n]+?)\$(?!\$)/g, (_, l) => formatFn(l.trim(), false));
    result = result.replace(/\\\((.+?)\\\)/g,           (_, l) => formatFn(l.trim(), false));
    return result;
}

// ─── Clipboard helpers ───────────────────────────────────────────────────────

// Claims the copy event synchronously via ClipboardEvent.clipboardData —
// see the comment in setUpMathPaste for why this replaces the old async
// navigator.clipboard.write() approach. Must be called synchronously within
// the "copy" event handler's call stack (no `await` beforehand): clipboardData
// stops accepting writes once the event handler returns to the event loop.
function setClipboardData(event: ClipboardEvent, htmlContent: string, plainText: string) {
    if (!event.clipboardData) {
        console.error("MathPaste: copy event has no clipboardData — cannot override clipboard");
        return;
    }
    event.preventDefault();
    event.clipboardData.setData('text/html', `<html><body>${htmlContent}</body></html>`);
    event.clipboardData.setData('text/plain', plainText);
    // Host pages commonly attach their own "copy" listener too (ChatGPT
    // clearly does — it powers the "Ask ChatGPT / Share highlighted"
    // selection toolbar). A later-running listener on the same target can
    // still call clipboardData.setData() itself and silently clobber ours —
    // event.preventDefault() only suppresses the browser's own default
    // copy, it does nothing to stop other listeners from running. Claim
    // the event outright once we've written to it, matching how rich-text
    // editors that customize copy (Google Docs, GitHub, etc.) do this.
    event.stopImmediatePropagation();
}

function setClipboardText(event: ClipboardEvent, plainText: string) {
    if (!event.clipboardData) {
        console.error("MathPaste: copy event has no clipboardData — cannot override clipboard");
        return;
    }
    event.preventDefault();
    event.clipboardData.setData('text/plain', plainText);
    event.stopImmediatePropagation(); // see setClipboardData
}
