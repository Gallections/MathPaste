import { describe, it, expect, beforeEach } from 'vitest';
import { processFromLiveDOM } from './domUtils';

// Build a .katex-display > .katex > .katex-mathml > math > annotation structure
function makeKatexDisplay(latex: string): HTMLElement {
    const display = document.createElement('span');
    display.className = 'katex-display';
    const katex = document.createElement('span');
    katex.className = 'katex';
    const mathml = document.createElement('span');
    mathml.className = 'katex-mathml';
    const math = document.createElement('math');
    const annotation = document.createElement('annotation');
    annotation.setAttribute('encoding', 'application/x-tex');
    annotation.textContent = latex;
    math.appendChild(annotation);
    mathml.appendChild(math);
    katex.appendChild(mathml);
    display.appendChild(katex);
    return display;
}

// Build a .katex > .katex-mathml > math > annotation structure (inline)
function makeKatexInline(latex: string): HTMLElement {
    const katex = document.createElement('span');
    katex.className = 'katex';
    const mathml = document.createElement('span');
    mathml.className = 'katex-mathml';
    const math = document.createElement('math');
    const annotation = document.createElement('annotation');
    annotation.setAttribute('encoding', 'application/x-tex');
    annotation.textContent = latex;
    math.appendChild(annotation);
    mathml.appendChild(math);
    katex.appendChild(mathml);
    return katex;
}

const fmt = (latex: string, isBlock: boolean) => isBlock ? `$$${latex}$$` : `$${latex}$`;

describe('processFromLiveDOM', () => {
    beforeEach(() => {
        document.body.innerHTML = '';
    });

    it('returns null when no ranges provided', () => {
        document.body.appendChild(makeKatexDisplay('x^2'));
        expect(processFromLiveDOM([], fmt)).toBeNull();
    });

    it('returns null when selection does not intersect any math container', () => {
        const para = document.createElement('p');
        para.textContent = 'hello world';
        document.body.appendChild(para);
        const range = document.createRange();
        range.selectNodeContents(para);
        expect(processFromLiveDOM([range], fmt)).toBeNull();
    });

    it('returns formatted block LaTeX for .katex-display', () => {
        const el = makeKatexDisplay('x^2');
        document.body.appendChild(el);
        const range = document.createRange();
        range.selectNodeContents(el);
        expect(processFromLiveDOM([range], fmt)).toBe('$$x^2$$');
    });

    it('returns formatted inline LaTeX for .katex', () => {
        const el = makeKatexInline('x^2');
        document.body.appendChild(el);
        const range = document.createRange();
        range.selectNodeContents(el);
        expect(processFromLiveDOM([range], fmt)).toBe('$x^2$');
    });

    it('deduplicates: .katex nested inside .katex-display yields one result', () => {
        const el = makeKatexDisplay('x^2');
        document.body.appendChild(el);
        // Select the whole body — both .katex-display and its child .katex will intersect
        const range = document.createRange();
        range.selectNodeContents(document.body);
        expect(processFromLiveDOM([range], fmt)).toBe('$$x^2$$');
    });

    it('partial selection within .katex-display still returns full equation', () => {
        const el = makeKatexDisplay('\\frac{a}{b}');
        document.body.appendChild(el);
        // Select only the inner .katex (simulates left-to-right partial copy)
        const innerKatex = el.querySelector('.katex') as Element;
        const range = document.createRange();
        range.selectNodeContents(innerKatex);
        expect(processFromLiveDOM([range], fmt)).toBe('$$\\frac{a}{b}$$');
    });

    it('joins multiple math containers with newline', () => {
        const a = makeKatexDisplay('x^2');
        const b = makeKatexDisplay('y^3');
        document.body.appendChild(a);
        document.body.appendChild(b);
        const range = document.createRange();
        range.selectNodeContents(document.body);
        expect(processFromLiveDOM([range], fmt)).toBe('$$x^2$$\n$$y^3$$');
    });

    it('skips math container with no annotation', () => {
        const el = document.createElement('span');
        el.className = 'katex-display';
        document.body.appendChild(el);
        const range = document.createRange();
        range.selectNodeContents(el);
        expect(processFromLiveDOM([range], fmt)).toBeNull();
    });

    it('skips math container with empty annotation', () => {
        const el = makeKatexDisplay('');
        document.body.appendChild(el);
        const range = document.createRange();
        range.selectNodeContents(el);
        expect(processFromLiveDOM([range], fmt)).toBeNull();
    });

    it('trims whitespace from annotation text', () => {
        const el = makeKatexDisplay('  x^2  ');
        document.body.appendChild(el);
        const range = document.createRange();
        range.selectNodeContents(el);
        expect(processFromLiveDOM([range], fmt)).toBe('$$x^2$$');
    });
});
