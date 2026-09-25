// ─── KaTeX rendered HTML → LaTeX ─────────────────────────────────────────────
// Reconstructs an approximate LaTeX source by walking KaTeX's own *visual*
// HTML output (the `.katex-html` tree) — used as a last-resort fallback in
// copy.ts when no `<annotation encoding="application/x-tex">` exists
// anywhere in the DOM at all. That happens when KaTeX is configured with
// `output: 'html'` (visual only, no MathML companion) — confirmed live: some
// renderers (e.g. ChatGPT, at least in some configurations) emit
// `.katex > .katex-html` with no `.katex-mathml` sibling whatsoever, so
// there is no machine-readable LaTeX anywhere in the page to read back,
// regardless of how the clipboard/selection is inspected.
//
// This is inherently lossy — KaTeX's rendered HTML doesn't preserve
// everything a LaTeX source can express (custom spacing, macros, colors all
// disappear once rendered) — but KaTeX's own HTML builder uses a stable,
// well-documented set of CSS classes for each construct, so the common
// cases (fractions, exponents/subscripts, roots, basic operators/relations,
// parens, digits, letters, greek letters) can be recovered reliably.
// Anything unrecognized degrades to its plain text content rather than
// being dropped or throwing.

const SYMBOL_MAP: Record<string, string> = {
    // Common binary operators / relations KaTeX renders with a Unicode glyph
    // rather than the ASCII source character.
    "−": "-",       // minus sign
    "×": "\\times ",
    "÷": "\\div ",
    "⋅": "\\cdot ",
    "≤": "\\le ",
    "≥": "\\ge ",
    "≠": "\\neq ",
    "±": "\\pm ",
    "∓": "\\mp ",
    "≈": "\\approx ",
    "≡": "\\equiv ",
    "∞": "\\infty ",
    "∂": "\\partial ",
    "∇": "\\nabla ",
    "∫": "\\int ",
    "∑": "\\sum ",
    "∏": "\\prod ",
    "→": "\\to ",
    "⇒": "\\Rightarrow ",
    "⇔": "\\Leftrightarrow ",
    "∈": "\\in ",
    "∉": "\\notin ",
    "⊂": "\\subset ",
    "⊆": "\\subseteq ",
    "∪": "\\cup ",
    "∩": "\\cap ",
    "∅": "\\emptyset ",
    "¬": "\\neg ",
    "∧": "\\land ",
    "∨": "\\lor ",
    "…": "\\ldots ",
    "⋯": "\\cdots ",
    // Braces need escaping when they appear as literal delimiter glyphs.
    "{": "\\{",
    "}": "\\}",
};

const GREEK_MAP: Record<string, string> = {
    "α": "\\alpha", "β": "\\beta", "γ": "\\gamma", "δ": "\\delta",
    "ε": "\\epsilon", "ζ": "\\zeta", "η": "\\eta", "θ": "\\theta",
    "ι": "\\iota", "κ": "\\kappa", "λ": "\\lambda", "μ": "\\mu",
    "ν": "\\nu", "ξ": "\\xi", "π": "\\pi", "ρ": "\\rho",
    "σ": "\\sigma", "τ": "\\tau", "υ": "\\upsilon", "φ": "\\phi",
    "χ": "\\chi", "ψ": "\\psi", "ω": "\\omega",
    "Α": "\\Alpha", "Β": "\\Beta", "Γ": "\\Gamma", "Δ": "\\Delta",
    "Ε": "\\Epsilon", "Ζ": "\\Zeta", "Η": "\\Eta", "Θ": "\\Theta",
    "Ι": "\\Iota", "Κ": "\\Kappa", "Λ": "\\Lambda", "Μ": "\\Mu",
    "Ν": "\\Nu", "Ξ": "\\Xi", "Π": "\\Pi", "Ρ": "\\Rho",
    "Σ": "\\Sigma", "Τ": "\\Tau", "Υ": "\\Upsilon", "Φ": "\\Phi",
    "Χ": "\\Chi", "Ψ": "\\Psi", "Ω": "\\Omega",
};

/** Reads a KaTeX vlist entry's `top` inline-style value in em, e.g. "-2.314em" → -2.314. */
function topEm(el: Element): number {
    const style = (el as HTMLElement).style?.top ?? '';
    const m = /-?[\d.]+/.exec(style);
    return m ? parseFloat(m[0]) : 0;
}

/** A vlist's direct positioned entries — each `<span style="top:...">`, skipping the `vlist-s` strut column. */
function vlistEntries(vlist: Element): Element[] {
    return Array.from(vlist.children).filter(c => (c as HTMLElement).style?.top !== undefined || c.hasAttribute('style'));
}

/** The actual content of one vlist entry, with its layout-only `.pstrut` stripped. */
function entryContent(entry: Element): Element[] {
    return Array.from(entry.children).filter(c => !c.classList.contains('pstrut'));
}

function fracToLatex(mfrac: Element): string {
    const vlist = mfrac.querySelector(':scope > .vlist-t > .vlist-r > .vlist, :scope > .vlist-t2 > .vlist-r > .vlist');
    if (!vlist) return mfrac.textContent ?? '';

    const entries = vlistEntries(vlist)
        .map(e => ({ el: e, top: topEm(e) }))
        .sort((a, b) => a.top - b.top); // most negative (highest on screen) first

    if (entries.length < 2) return mfrac.textContent ?? '';

    const numerator = entries[0].el;
    const denominator = entries[entries.length - 1].el;
    const num = entryContent(numerator).map(nodeToLatex).join('').trim();
    const den = entryContent(denominator).map(nodeToLatex).join('').trim();
    return `\\frac{${num}}{${den}}`;
}

function sqrtToLatex(sqrt: Element): string {
    const rootIndex = sqrt.querySelector(':scope > .root');
    const vlist = sqrt.querySelector('.vlist-r > .vlist');
    if (!vlist) return sqrt.textContent ?? '';

    // The radicand is the vlist entry that isn't the radical glyph itself
    // (`.hide-tail`, an svg/glyph span with no useful text) or the overline.
    const entries = vlistEntries(vlist);
    const radicandEntry = entries.find(e =>
        !entryContent(e).some(c => c.classList.contains('hide-tail') || c.classList.contains('sqrt-line'))
    ) ?? entries[entries.length - 1];
    const radicand = radicandEntry ? entryContent(radicandEntry).map(nodeToLatex).join('').trim() : '';

    const index = rootIndex ? nodeToLatex(rootIndex).trim() : '';
    return index ? `\\sqrt[${index}]{${radicand}}` : `\\sqrt{${radicand}}`;
}

const MATRIX_ENV_FOR_OPEN_GLYPH: Record<string, string> = {
    "[": "bmatrix",
    "(": "pmatrix",
    "{": "Bmatrix",
    "|": "vmatrix",
    "‖": "Vmatrix",
};

/**
 * KaTeX renders `\begin{matrix}`/`bmatrix`/`pmatrix`/etc. as `.mtable`, one
 * `.col-align-*` span per COLUMN (already in correct left-to-right DOM
 * order), each a `.vlist` stack of that column's row entries — the same
 * vertical-stacking mechanism `.mfrac` uses, just one stack per column
 * instead of one for numerator/denominator. `.arraycolsep` spacer spans
 * between columns are skipped since they aren't real columns.
 */
function mtableToRows(mtable: Element): string {
    const columns = Array.from(mtable.children).filter(
        c => Array.from(c.classList).some(cls => cls.startsWith('col-align'))
    );
    const grid: string[][] = columns.map(col => {
        const vlist = col.querySelector('.vlist-r > .vlist, .vlist-t2 > .vlist-r > .vlist');
        if (!vlist) return [];
        return vlistEntries(vlist)
            .map(e => ({ el: e, top: topEm(e) }))
            .sort((a, b) => a.top - b.top) // top row (most negative top) first
            .map(e => entryContent(e.el).map(nodeToLatex).join('').trim());
    });
    const numRows = grid.reduce((max, col) => Math.max(max, col.length), 0);
    const rows: string[] = [];
    for (let r = 0; r < numRows; r++) {
        rows.push(grid.map(col => col[r] ?? '').join(' & '));
    }
    return rows.join(' \\\\ ');
}

/**
 * Reconstructs a bracketed matrix/array from its `.minner` wrapper — the
 * auto-sized open/close delimiter glyphs (`.mopen`/`.mclose`) plus the
 * `.mtable` they surround. Picks the matching LaTeX environment from the
 * open glyph (`[` → bmatrix, `(` → pmatrix, etc.) instead of emitting the
 * bracket characters literally, since `\begin{bmatrix}...\end{bmatrix}`
 * already draws its own brackets — emitting both would double them up.
 */
function minnerMatrixToLatex(minner: Element, mtable: Element): string {
    const openEl = minner.querySelector(':scope > .mopen');
    const openGlyph = (openEl?.textContent ?? '').trim();
    const env = MATRIX_ENV_FOR_OPEN_GLYPH[openGlyph] ?? 'matrix';
    return `\\begin{${env}} ${mtableToRows(mtable)} \\end{${env}}`;
}

/** True for spans that exist purely for CSS layout/sizing and carry no math content of their own. */
function isLayoutOnly(el: Element): boolean {
    return el.classList.contains('strut')
        || el.classList.contains('pstrut')
        || el.classList.contains('vlist-s')
        || el.classList.contains('frac-line')
        || el.classList.contains('sqrt-line')
        || el.classList.contains('hide-tail');
}

function mapLeafText(text: string): string {
    if (!text) return '';
    let out = '';
    for (const ch of text) {
        out += GREEK_MAP[ch] ? GREEK_MAP[ch] + ' ' : SYMBOL_MAP[ch] ?? ch;
    }
    return out;
}

function supSubToLatex(supsub: Element): { sup: string; sub: string } {
    const vlist = supsub.querySelector('.vlist-r > .vlist, .vlist-t2 > .vlist-r > .vlist');
    if (!vlist) return { sup: '', sub: '' };

    const entries = vlistEntries(vlist)
        .map(e => ({ el: e, top: topEm(e) }))
        .filter(e => entryContent(e.el).length > 0)
        .sort((a, b) => a.top - b.top); // most negative (raised) first

    if (entries.length === 0) return { sup: '', sub: '' };
    if (entries.length === 1) {
        // A single entry could be either — negative-enough top means raised (sup);
        // near-zero/positive top means lowered (sub).
        const content = entryContent(entries[0].el).map(nodeToLatex).join('').trim();
        return entries[0].top < -0.5 ? { sup: content, sub: '' } : { sup: '', sub: content };
    }
    const sup = entryContent(entries[0].el).map(nodeToLatex).join('').trim();
    const sub = entryContent(entries[entries.length - 1].el).map(nodeToLatex).join('').trim();
    return { sup, sub };
}

function nodeToLatex(el: Element): string {
    if (isLayoutOnly(el)) return '';

    if (el.classList.contains('mfrac')) return fracToLatex(el);
    if (el.classList.contains('sqrt')) return sqrtToLatex(el);

    if (el.classList.contains('minner')) {
        const mtable = el.querySelector('.mtable');
        if (mtable) return minnerMatrixToLatex(el, mtable);
    }
    // A bare .mtable with no surrounding brackets at all (\begin{matrix}
    // with no auto-sized delimiters).
    if (el.classList.contains('mtable')) return `\\begin{matrix} ${mtableToRows(el)} \\end{matrix}`;

    // An atom with a nested .msupsub — combine its base content with the
    // reconstructed sup/sub. .msupsub is a *child* of the atom it attaches
    // to in KaTeX's HTML, not a following sibling.
    const supsub = Array.from(el.children).find(c => c.classList.contains('msupsub'));
    if (supsub) {
        const baseLatex = Array.from(el.children)
            .filter(c => c !== supsub)
            .map(nodeToLatex)
            .join('')
            .trim();
        const { sup, sub } = supSubToLatex(supsub);
        let result = baseLatex.length > 1 && !/^\\[a-zA-Z]+$/.test(baseLatex) ? `{${baseLatex}}` : baseLatex;
        if (!result) result = '{}';
        if (sub) result += `_{${sub}}`;
        if (sup) result += `^{${sup}}`;
        return result;
    }

    if (el.children.length === 0) {
        return mapLeafText(el.textContent ?? '');
    }

    return Array.from(el.children).map(nodeToLatex).join('');
}

/**
 * Reconstructs approximate LaTeX from a KaTeX HTML-only render (no
 * annotation anywhere to read back). `root` should be the `.katex` (or
 * `.katex-display`) element, or anything containing a `.katex-html` /
 * `.base` descendant.
 */
export function katexHtmlToLatex(root: Element): string {
    const katexHtml = root.querySelector('.katex-html') ?? root;
    // A single inline/display equation can have several *sibling* `.base`
    // groups directly under `.katex-html` — confirmed live: KaTeX's
    // auto-sizing for `\left...\right` delimiters splits the surrounding
    // content into separate strut/base groups purely for internal vertical
    // sizing, not because of any actual line break. Real multi-row content
    // (`\begin{aligned}`, arrays, cases) renders as a completely different
    // `.mtable`/`.array` structure, never as multiple `.base` siblings — so
    // it's always correct to just concatenate every `.base` group directly,
    // never join them with a line break.
    const bases = Array.from(katexHtml.querySelectorAll(':scope > .base'));
    const targets = bases.length > 0 ? bases : [katexHtml];
    return targets
        .map(b => Array.from(b.children).map(nodeToLatex).join(''))
        .join('')
        .trim();
}
