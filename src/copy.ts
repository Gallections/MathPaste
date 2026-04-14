// Use window to persist state across repeated content-script injections.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const win = window as any;

if (typeof win.__mathpasteInit === "undefined") {
    win.__mathpasteInit = true;
    // Format functions are forward-declared — safe because content scripts compile as IIFE (hoisted).
    win.__mathpasteOptionToFunction = {
        "math_paste_Obsidian":  wrappedFormat,
        "math_paste_Notion":    wrappedFormat,
        "math_paste_LaTex":     latexFormat,
        "math_paste_MathJax":   mathjaxFormat,
        "math_paste_Typst":     typstFormat,
        "math_paste_MediaWiki": mediawikiFormat,
        "math_paste_AsciiMath": asciimathFormat,
        "math_paste_None":      null,
    };
    win.__mathpasteIsActive = true;
    win.__mathpasteListener = () => setUpMathPaste(null);
    document.addEventListener("copy", win.__mathpasteListener);
}

chrome.runtime.onMessage.addListener((message, _sender, _sendResponse) => {
    if (message.imgId !== undefined) {
        if (win.__mathpasteIsActive) {
            document.removeEventListener("copy", win.__mathpasteListener);
            win.__mathpasteListener = () => setUpMathPaste(message.imgId);
            document.addEventListener("copy", win.__mathpasteListener);
        }
    }

    if (message.toggle !== undefined) {
        win.__mathpasteIsActive = message.toggle;
        win.__mathpasteListener = () => setUpMathPaste(null);
        if (win.__mathpasteIsActive) {
            document.addEventListener("copy", win.__mathpasteListener);
        } else {
            document.removeEventListener("copy", win.__mathpasteListener);
        }
    }
});

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

// ─── Core pipeline ──────────────────────────────────────────────────────────

async function setUpMathPaste(imgId: string | null) {
    const formatFn = win.__mathpasteOptionToFunction[imgId];
    if (!formatFn) return;

    const items = await navigator.clipboard.read();

    // ── Strategy 1: HTML clipboard with rendered math (KaTeX, MathJax, MathML) ──
    for (const item of items) {
        if (!item.types.includes("text/html")) continue;
        const blob = await item.getType("text/html");
        const htmlText = await blob.text();
        const doc = new DOMParser().parseFromString(htmlText, "text/html");
        const { html, text, replaced } = processHTML(doc.body, formatFn);
        if (replaced > 0) {
            await writeClipboard(html, text);
            return;
        }
        break; // HTML present but no math — fall through to plain-text strategy
    }

    // ── Strategy 2: Plain text containing LaTeX delimiters ──
    // Covers: platform copy buttons, Copilot (no rendering), markdown sources
    for (const item of items) {
        if (!item.types.includes("text/plain")) continue;
        const blob = await item.getType("text/plain");
        const plain = await blob.text();
        if (hasLatexDelimiters(plain)) {
            const converted = processPlainText(plain, formatFn);
            await navigator.clipboard.writeText(converted);
        }
        return;
    }
}

/**
 * Clones the HTML body, finds every rendered math element via its
 * `<annotation encoding="application/x-tex">` tag (present in KaTeX,
 * MathJax v3, and native MathML), replaces the outermost math container
 * in-place with formatted LaTeX text, and returns the result together with
 * a count of replacements made. All surrounding formatting is preserved.
 */
function processHTML(
    htmlBody: HTMLElement,
    formatFn: (latex: string, isBlock: boolean) => string
): { html: string; text: string; replaced: number } {
    const clone = htmlBody.cloneNode(true) as HTMLElement;
    const seen = new WeakSet<Element>();
    let replaced = 0;

    for (const annotation of Array.from(
        clone.querySelectorAll('annotation[encoding="application/x-tex"]')
    )) {
        const latex = (annotation.textContent ?? '').trim();
        if (!latex) continue;

        const { container, isBlock } = findMathContainer(annotation as Element);
        if (!container || seen.has(container)) continue;
        seen.add(container);

        container.parentNode?.replaceChild(
            document.createTextNode(formatFn(latex, isBlock)),
            container
        );
        replaced++;
    }

    return { html: clone.innerHTML, text: clone.textContent ?? '', replaced };
}

/**
 * Walks up the DOM from a LaTeX annotation to find the outermost math
 * container to replace. Handles:
 *   - KaTeX inline  → .katex
 *   - KaTeX block   → .katex-display
 *   - MathJax v3    → mjx-container
 *   - Native MathML → <math>
 */
function findMathContainer(start: Element): { container: Element | null; isBlock: boolean } {
    let el: Element | null = start.parentElement;
    let container: Element | null = null;
    let isBlock = false;

    while (el && el.tagName.toLowerCase() !== 'body') {
        const tag = el.tagName.toLowerCase();

        if (el.classList?.contains('katex-display')) {
            return { container: el, isBlock: true };          // KaTeX block — outermost
        }
        if (el.classList?.contains('katex')) {
            container = el; isBlock = false;                  // KaTeX inline — keep walking
        }
        if (tag === 'mjx-container') {
            return { container: el, isBlock: el.hasAttribute('display') }; // MathJax
        }
        if (tag === 'math' && !container) {
            container = el;                                   // bare MathML
            isBlock = el.getAttribute('display') === 'block';
        }

        el = el.parentElement;
    }

    return { container, isBlock };
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

async function writeClipboard(htmlContent: string, plainText: string) {
    try {
        await navigator.clipboard.write([
            new ClipboardItem({
                'text/html':  new Blob([`<html><body>${htmlContent}</body></html>`], { type: 'text/html' }),
                'text/plain': new Blob([plainText], { type: 'text/plain' }),
            })
        ]);
    } catch (err) {
        console.error("MathPaste: failed to write clipboard:", err);
    }
}
