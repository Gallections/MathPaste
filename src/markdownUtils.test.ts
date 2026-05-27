import { describe, it, expect, beforeEach } from 'vitest';
import { htmlToMarkdown } from './markdownUtils';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parse(html: string): HTMLElement {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div;
}

function md(html: string): string {
    return htmlToMarkdown(parse(html)).trim().replace(/\n{3,}/g, '\n\n');
}

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

// ─── Text nodes ──────────────────────────────────────────────────────────────

describe('text nodes', () => {
    it('plain text is returned as-is', () => {
        const node = document.createTextNode('hello world');
        expect(htmlToMarkdown(node)).toBe('hello world');
    });
});

// ─── Block elements ───────────────────────────────────────────────────────────

describe('headings', () => {
    it('h1', () => expect(md('<h1>Title</h1>')).toBe('# Title'));
    it('h2', () => expect(md('<h2>Sub</h2>')).toBe('## Sub'));
    it('h3', () => expect(md('<h3>Sub</h3>')).toBe('### Sub'));
    it('h4', () => expect(md('<h4>Sub</h4>')).toBe('#### Sub'));
    it('h5', () => expect(md('<h5>Sub</h5>')).toBe('##### Sub'));
    it('h6', () => expect(md('<h6>Sub</h6>')).toBe('###### Sub'));
});

describe('paragraphs', () => {
    it('wraps content and adds blank line', () => {
        expect(md('<p>Hello</p>')).toBe('Hello');
    });

    it('two paragraphs separated by blank line', () => {
        expect(md('<p>First</p><p>Second</p>')).toBe('First\n\nSecond');
    });
});

describe('hr and br', () => {
    it('br becomes newline', () => {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode('a'));
        div.appendChild(document.createElement('br'));
        div.appendChild(document.createTextNode('b'));
        expect(htmlToMarkdown(div)).toBe('a\nb');
    });

    it('hr becomes ---', () => expect(md('<hr>')).toBe('---'));
});

// ─── Inline formatting ────────────────────────────────────────────────────────

describe('inline formatting', () => {
    it('strong', () => expect(md('<strong>bold</strong>')).toBe('**bold**'));
    it('b', ()      => expect(md('<b>bold</b>')).toBe('**bold**'));
    it('em', () =>    expect(md('<em>italic</em>')).toBe('*italic*'));
    it('i', () =>     expect(md('<i>italic</i>')).toBe('*italic*'));
    it('del', () =>   expect(md('<del>struck</del>')).toBe('~~struck~~'));
    it('s', () =>     expect(md('<s>struck</s>')).toBe('~~struck~~'));
    it('nested bold+italic', () =>
        expect(md('<strong><em>both</em></strong>')).toBe('***both***'));
});

// ─── Code ─────────────────────────────────────────────────────────────────────

describe('code', () => {
    it('inline code', () => expect(md('<code>x = 1</code>')).toBe('`x = 1`'));

    it('fenced code block without language', () => {
        expect(md('<pre><code>let x = 1;</code></pre>')).toBe('```\nlet x = 1;\n```');
    });

    it('fenced code block with language class', () => {
        expect(md('<pre><code class="language-python">x = 1</code></pre>'))
            .toBe('```python\nx = 1\n```');
    });
});

// ─── Links ────────────────────────────────────────────────────────────────────

describe('links', () => {
    it('external link', () =>
        expect(md('<a href="https://example.com">click</a>')).toBe('[click](https://example.com)'));

    it('anchor-only href becomes plain text', () =>
        expect(md('<a href="#section">jump</a>')).toBe('jump'));

    it('empty href becomes plain text', () =>
        expect(md('<a href="">label</a>')).toBe('label'));
});

// ─── Lists ────────────────────────────────────────────────────────────────────

describe('unordered list', () => {
    it('single item', () => expect(md('<ul><li>one</li></ul>')).toBe('- one'));

    it('multiple items', () =>
        expect(md('<ul><li>a</li><li>b</li><li>c</li></ul>')).toBe('- a\n- b\n- c'));
});

describe('ordered list', () => {
    it('single item', () => expect(md('<ol><li>first</li></ol>')).toBe('1. first'));

    it('multiple items numbered correctly', () =>
        expect(md('<ol><li>x</li><li>y</li></ol>')).toBe('1. x\n2. y'));
});

// ─── Blockquote ───────────────────────────────────────────────────────────────

describe('blockquote', () => {
    it('prefixes each line with >', () =>
        expect(md('<blockquote>quote text</blockquote>')).toBe('> quote text'));
});

// ─── Table ────────────────────────────────────────────────────────────────────

describe('table', () => {
    it('renders header + separator + rows', () => {
        const html = `
            <table>
              <tr><th>Name</th><th>Value</th></tr>
              <tr><td>foo</td><td>1</td></tr>
            </table>`;
        expect(md(html)).toBe('| Name | Value |\n| --- | --- |\n| foo | 1 |');
    });

    it('escapes pipe characters in cells', () => {
        const html = '<table><tr><th>a|b</th></tr></table>';
        expect(md(html)).toBe('| a\\|b |\n| --- |');
    });
});

// ─── Skipped elements ─────────────────────────────────────────────────────────

describe('skipped elements', () => {
    it('style tag produces no output', () =>
        expect(md('<style>body{color:red}</style>')).toBe(''));

    it('script tag produces no output', () =>
        expect(md('<script>alert(1)</script>')).toBe(''));
});

// ─── Math elements ────────────────────────────────────────────────────────────

describe('KaTeX inline math', () => {
    beforeEach(() => { document.body.innerHTML = ''; });

    it('converts to $…$', () => {
        const el = makeKatexInline('x^2');
        expect(htmlToMarkdown(el)).toBe('$x^2$');
    });

    it('empty annotation produces empty string', () => {
        const el = makeKatexInline('');
        expect(htmlToMarkdown(el)).toBe('');
    });

    it('trims whitespace in annotation', () => {
        const el = makeKatexInline('  E=mc^2  ');
        expect(htmlToMarkdown(el)).toBe('$E=mc^2$');
    });
});

describe('KaTeX block math', () => {
    it('converts to $$…$$', () => {
        const el = makeKatexDisplay('\\frac{a}{b}');
        expect(htmlToMarkdown(el).trim()).toBe('$$\\frac{a}{b}$$');
    });

    it('.katex-display takes priority over nested .katex', () => {
        // The display element contains a .katex child — should not produce
        // double output.
        const el = makeKatexDisplay('x+y');
        const result = htmlToMarkdown(el);
        expect((result.match(/\$\$/g) ?? []).length).toBe(2); // exactly one $$…$$ pair
        expect(result.trim()).toBe('$$x+y$$');
    });
});

describe('MathJax container', () => {
    it('inline mjx-container → $…$', () => {
        const el = document.createElement('mjx-container');
        const ann = document.createElement('annotation');
        ann.setAttribute('encoding', 'application/x-tex');
        ann.textContent = 'E=mc^2';
        el.appendChild(ann);
        expect(htmlToMarkdown(el)).toBe('$E=mc^2$');
    });

    it('display mjx-container → $$…$$', () => {
        const el = document.createElement('mjx-container');
        el.setAttribute('display', 'true');
        const ann = document.createElement('annotation');
        ann.setAttribute('encoding', 'application/x-tex');
        ann.textContent = 'E=mc^2';
        el.appendChild(ann);
        expect(htmlToMarkdown(el).trim()).toBe('$$E=mc^2$$');
    });
});

// ─── Mixed content ────────────────────────────────────────────────────────────

describe('mixed content', () => {
    it('paragraph with inline math', () => {
        const div = document.createElement('div');
        const p = document.createElement('p');
        p.appendChild(document.createTextNode('The equation '));
        p.appendChild(makeKatexInline('x^2'));
        p.appendChild(document.createTextNode(' is quadratic.'));
        div.appendChild(p);
        const result = htmlToMarkdown(div).trim();
        expect(result).toBe('The equation $x^2$ is quadratic.');
    });

    it('paragraph followed by block math', () => {
        const div = document.createElement('div');
        const p = document.createElement('p');
        p.textContent = 'Integrate:';
        div.appendChild(p);
        div.appendChild(makeKatexDisplay('\\int_0^1 x\\,dx'));
        const result = htmlToMarkdown(div).trim().replace(/\n{3,}/g, '\n\n');
        expect(result).toBe('Integrate:\n\n$$\\int_0^1 x\\,dx$$');
    });

    it('bold text inside a paragraph', () =>
        expect(md('<p>This is <strong>important</strong>.</p>'))
            .toBe('This is **important**.'));
});
