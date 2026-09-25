import { describe, it, expect } from 'vitest';
import { katexHtmlToLatex } from './katexHtmlToLatex';

function parse(html: string): HTMLElement {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.firstElementChild as HTMLElement;
}

/** Wraps a `.base` children fragment in the standard `.katex > .katex-html > .base` shell. */
function katex(baseInner: string): HTMLElement {
    return parse(`<span class="katex"><span class="katex-html" aria-hidden="true"><span class="base">${baseInner}</span></span></span>`);
}

describe('katexHtmlToLatex', () => {
    it('reconstructs a single digit', () => {
        expect(katexHtmlToLatex(katex('<span class="mord">3</span>'))).toBe('3');
    });

    it('reconstructs a single-letter variable', () => {
        expect(katexHtmlToLatex(katex('<span class="mord mathnormal">x</span>'))).toBe('x');
    });

    it('maps the Unicode minus sign back to a plain hyphen', () => {
        expect(katexHtmlToLatex(katex(
            '<span class="mord">5</span><span class="mbin">\u2212</span><span class="mord">3</span>'
        ))).toBe('5-3');
    });

    it('maps common binary operators and relations', () => {
        expect(katexHtmlToLatex(katex(
            '<span class="mord">1</span><span class="mbin">\u00d7</span><span class="mord">2</span>' +
            '<span class="mrel">=</span><span class="mord">2</span>'
        ))).toBe('1\\times 2=2');
    });

    it('reconstructs an exponent via a nested .msupsub', () => {
        const html = katex(
            '<span class="mord"><span class="mord mathnormal">x</span>' +
            '<span class="msupsub"><span class="vlist-t"><span class="vlist-r"><span class="vlist" style="height:0.8641em;">' +
            '<span style="top:-3.113em;margin-right:0.05em;"><span class="pstrut" style="height:2.7em;"></span>' +
            '<span class="sizing reset-size6 size3 mtight"><span class="mord mtight">2</span></span></span>' +
            '</span></span></span></span></span>'
        );
        expect(katexHtmlToLatex(html)).toBe('x^{2}');
    });

    it('reconstructs a subscript (positive/near-zero top) via a nested .msupsub', () => {
        const html = katex(
            '<span class="mord"><span class="mord mathnormal">x</span>' +
            '<span class="msupsub"><span class="vlist-t vlist-t2"><span class="vlist-r"><span class="vlist" style="height:0.15em;">' +
            '<span style="top:-0.15em;"><span class="pstrut" style="height:2.7em;"></span>' +
            '<span class="sizing reset-size6 size3 mtight"><span class="mord mtight">1</span></span></span>' +
            '</span></span></span></span></span>'
        );
        expect(katexHtmlToLatex(html)).toBe('x_{1}');
    });

    it('reconstructs a fraction from the real ChatGPT-rendered HTML shape (\\frac{d}{dx})', () => {
        // Captured live from a real "output: html"-only KaTeX render (no
        // annotation anywhere in the DOM) — the exact bug this module exists
        // to work around. Numerator "d" sits at a more negative `top`
        // (higher on screen) than denominator "dx".
        const html = katex(
            '<span class="mfrac"><span class="vlist-t vlist-t2"><span class="vlist-r"><span class="vlist" style="height:1.3714em;">' +
            '<span style="top:-3.23em;"><span class="pstrut" style="height:3em;"></span>' +
            '<span class="mord"><span class="mord mathnormal">d</span></span></span>' +
            '<span style="top:-2.314em;"><span class="pstrut" style="height:3em;"></span>' +
            '<span class="mord"><span class="mord mathnormal">d</span><span class="mord mathnormal">x</span></span></span>' +
            '</span></span></span></span>'
        );
        expect(katexHtmlToLatex(html)).toBe('\\frac{d}{dx}');
    });

    it('reconstructs parens around content', () => {
        const html = katex(
            '<span class="mopen">(</span><span class="mord mathnormal">x</span><span class="mclose">)</span>'
        );
        expect(katexHtmlToLatex(html)).toBe('(x)');
    });

    it('skips null delimiters (invisible open/close from \\left./implicit grouping)', () => {
        const html = katex(
            '<span class="mopen nulldelimiter"></span><span class="mord mathnormal">x</span><span class="mclose nulldelimiter"></span>'
        );
        expect(katexHtmlToLatex(html)).toBe('x');
    });

    it('reconstructs a square root', () => {
        const html = katex(
            '<span class="sqrt"><span class="vlist-t vlist-t2"><span class="vlist-r"><span class="vlist" style="height:0.8em;">' +
            '<span style="top:-3em;"><span class="pstrut" style="height:3em;"></span>' +
            '<span class="hide-tail" style="height:0.8em;">radical-glyph</span></span>' +
            '<span style="top:-3.8em;"><span class="pstrut" style="height:3em;"></span>' +
            '<span class="mord mathnormal">x</span></span>' +
            '</span></span></span></span>'
        );
        expect(katexHtmlToLatex(html)).toBe('\\sqrt{x}');
    });

    it('maps a lowercase greek letter to its LaTeX command', () => {
        expect(katexHtmlToLatex(katex('<span class="mord mathnormal">\u03c0</span>'))).toBe('\\pi');
    });

    it('keeps the space after a greek command when more content follows', () => {
        expect(katexHtmlToLatex(katex(
            '<span class="mord mathnormal">\u03c0</span><span class="mord mathnormal">r</span>'
        ))).toBe('\\pi r');
    });

    it('ignores layout-only strut spans', () => {
        const html = katex('<span class="strut" style="height:1em;"></span><span class="mord">7</span>');
        expect(katexHtmlToLatex(html)).toBe('7');
    });

    it('reconstructs the full real-world equation: d/dx(x^3+2x^2-5x)=3x^2+4x-5', () => {
        const exp = (base: string, sup: string) =>
            `<span class="mord"><span class="mord mathnormal">${base}</span>` +
            `<span class="msupsub"><span class="vlist-t"><span class="vlist-r"><span class="vlist" style="height:0.8em;">` +
            `<span style="top:-3.1em;"><span class="pstrut" style="height:2.7em;"></span>` +
            `<span class="sizing reset-size6 size3 mtight"><span class="mord mtight">${sup}</span></span></span>` +
            `</span></span></span></span></span>`;
        const frac = (num: string, den: string) =>
            `<span class="mfrac"><span class="vlist-t vlist-t2"><span class="vlist-r"><span class="vlist" style="height:1.3714em;">` +
            `<span style="top:-3.23em;"><span class="pstrut" style="height:3em;"></span><span class="mord">${num}</span></span>` +
            `<span style="top:-2.314em;"><span class="pstrut" style="height:3em;"></span><span class="mord">${den}</span></span>` +
            `</span></span></span></span>`;
        const html = katex(
            frac('<span class="mord mathnormal">d</span>', '<span class="mord mathnormal">d</span><span class="mord mathnormal">x</span>') +
            '<span class="mopen">(</span>' +
            exp('x', '3') +
            '<span class="mbin">+</span><span class="mord">2</span>' + exp('x', '2') +
            `<span class="mbin">−</span><span class="mord">5</span><span class="mord mathnormal">x</span>` +
            '<span class="mclose">)</span>' +
            '<span class="mrel">=</span>' +
            '<span class="mord">3</span>' + exp('x', '2') +
            '<span class="mbin">+</span><span class="mord">4</span><span class="mord mathnormal">x</span>' +
            `<span class="mbin">−</span><span class="mord">5</span>`
        );
        expect(katexHtmlToLatex(html)).toBe('\\frac{d}{dx}(x^{3}+2x^{2}-5x)=3x^{2}+4x-5');
    });

    it('concatenates multiple sibling .base groups directly, with no inserted line break', () => {
        // Regression: confirmed live against real ChatGPT-rendered KaTeX —
        // a single inline equation with \left...\right delimiters splits
        // into several *sibling* .base groups under one .katex-html purely
        // for internal auto-sizing, not because of any actual line break.
        // Was incorrectly joined with " \\\\ " (a LaTeX line-break command),
        // corrupting the reconstructed equation with spurious \\ tokens
        // between nearly every term.
        const html = parse(
            '<span class="katex"><span class="katex-html" aria-hidden="true">' +
            '<span class="base"><span class="mord">1</span></span>' +
            '<span class="base"><span class="mbin">+</span></span>' +
            '<span class="base"><span class="mord">2</span></span>' +
            '</span></span>'
        );
        expect(katexHtmlToLatex(html)).toBe('1+2');
    });

    it('reconstructs a bracketed matrix from the real ChatGPT-rendered .mtable/.col-align-c shape', () => {
        // Captured live from a real "output: html"-only KaTeX render of
        // \begin{bmatrix}2&1\\3&4\end{bmatrix} — same missing-annotation
        // bug as the fraction case, just a completely different HTML shape
        // (.mtable / one .col-align-c per column) that the reconstructor
        // had no support for at all, degrading to a flat "2314".
        const column = (top1: string, cell1: string, top2: string, cell2: string) =>
            `<span class="col-align-c"><span class="vlist-t vlist-t2"><span class="vlist-r"><span class="vlist" style="height:1.45em;">` +
            `<span style="top:${top1};"><span class="pstrut" style="height:3em;"></span><span class="mord">${cell1}</span></span>` +
            `<span style="top:${top2};"><span class="pstrut" style="height:3em;"></span><span class="mord">${cell2}</span></span>` +
            `</span></span></span></span>`;
        const html = katex(
            '<span class="minner">' +
            '<span class="mopen delimcenter" style="top:0em;"><span class="delimsizing size3">[</span></span>' +
            '<span class="mord"><span class="mtable">' +
            column('-3.61em', '2', '-2.41em', '3') +
            '<span class="arraycolsep" style="width:0.5em;"></span>' +
            column('-3.61em', '1', '-2.41em', '4') +
            '</span></span>' +
            '<span class="mclose delimcenter" style="top:0em;"><span class="delimsizing size3">]</span></span>' +
            '</span>'
        );
        expect(katexHtmlToLatex(html)).toBe('\\begin{bmatrix} 2 & 1 \\\\ 3 & 4 \\end{bmatrix}');
    });

    it('reconstructs a column vector (single .col-align-c, no separator needed)', () => {
        const html = katex(
            '<span class="minner">' +
            '<span class="mopen delimcenter" style="top:0em;"><span class="delimsizing size2">[</span></span>' +
            '<span class="mord"><span class="mtable"><span class="col-align-c">' +
            '<span class="vlist-t vlist-t2"><span class="vlist-r"><span class="vlist" style="height:1em;">' +
            '<span style="top:-3.4em;"><span class="pstrut" style="height:3em;"></span><span class="mord mathnormal">x</span></span>' +
            '<span style="top:-2.4em;"><span class="pstrut" style="height:3em;"></span><span class="mord mathnormal">y</span></span>' +
            '</span></span></span></span></span></span>' +
            '<span class="mclose delimcenter" style="top:0em;"><span class="delimsizing size2">]</span></span>' +
            '</span>'
        );
        expect(katexHtmlToLatex(html)).toBe('\\begin{bmatrix} x \\\\ y \\end{bmatrix}');
    });

    it('picks the pmatrix environment for round-bracket delimiters', () => {
        const html = katex(
            '<span class="minner">' +
            '<span class="mopen delimcenter" style="top:0em;"><span class="delimsizing size2">(</span></span>' +
            '<span class="mord"><span class="mtable"><span class="col-align-c">' +
            '<span class="vlist-t vlist-t2"><span class="vlist-r"><span class="vlist" style="height:1em;">' +
            '<span style="top:-3em;"><span class="pstrut" style="height:3em;"></span><span class="mord">1</span></span>' +
            '</span></span></span></span></span></span>' +
            '<span class="mclose delimcenter" style="top:0em;"><span class="delimsizing size2">)</span></span>' +
            '</span>'
        );
        expect(katexHtmlToLatex(html)).toBe('\\begin{pmatrix} 1 \\end{pmatrix}');
    });

    it('falls back to the .katex root itself when no .katex-html/.base is present', () => {
        const div = document.createElement('div');
        div.innerHTML = '<span class="mord">9</span>';
        expect(katexHtmlToLatex(div)).toBe('9');
    });
});
