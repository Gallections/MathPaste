/**
 * Converts an HTML node tree to Markdown, with special handling for KaTeX /
 * MathJax math elements (converted to $…$ / $$…$$).
 *
 * Top-level entry point: htmlToMarkdown(document.body)
 * Returned string may have leading/trailing whitespace — callers should .trim()
 * and collapse runs of 3+ newlines to 2.
 */
export function htmlToMarkdown(node: Node): string {
    if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent ?? '';
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (tag === 'style' || tag === 'script' || tag === 'head') return '';

    // ── Math elements — intercept before recursing into children ──────────────
    // KaTeX block: .katex-display wraps .katex, so check display first.
    if (el.classList.contains('katex-display')) {
        const ann = el.querySelector('annotation[encoding="application/x-tex"]');
        const latex = ann?.textContent?.trim() ?? '';
        return latex ? `\n\n$$${latex}$$\n\n` : '';
    }
    if (el.classList.contains('katex')) {
        const ann = el.querySelector('annotation[encoding="application/x-tex"]');
        const latex = ann?.textContent?.trim() ?? '';
        return latex ? `$${latex}$` : '';
    }
    if (tag === 'mjx-container') {
        const ann = el.querySelector('annotation[encoding="application/x-tex"]');
        const latex = ann?.textContent?.trim() ?? '';
        if (latex) return el.hasAttribute('display') ? `\n\n$$${latex}$$\n\n` : `$${latex}$`;
        return '';
    }
    // Suppress raw annotation text (already captured by the math handlers above)
    if (tag === 'annotation') return '';

    const children = () => Array.from(el.childNodes).map(htmlToMarkdown).join('');

    switch (tag) {
        case 'h1': return `\n# ${children().trim()}\n\n`;
        case 'h2': return `\n## ${children().trim()}\n\n`;
        case 'h3': return `\n### ${children().trim()}\n\n`;
        case 'h4': return `\n#### ${children().trim()}\n\n`;
        case 'h5': return `\n##### ${children().trim()}\n\n`;
        case 'h6': return `\n###### ${children().trim()}\n\n`;
        case 'p':  return `${children().trim()}\n\n`;
        case 'br': return '\n';
        case 'hr': return '\n---\n\n';

        case 'strong':
        case 'b':  return `**${children()}**`;
        case 'em':
        case 'i':  return `*${children()}*`;
        case 'del':
        case 's':  return `~~${children()}~~`;

        case 'code':
            if (el.parentElement?.tagName.toLowerCase() === 'pre') return children();
            return `\`${children()}\``;
        case 'pre': {
            const codeEl = el.querySelector('code');
            const lang = codeEl?.className?.match(/language-(\w+)/)?.[1] ?? '';
            const content = (codeEl?.textContent ?? children()).trim();
            return `\n\`\`\`${lang}\n${content}\n\`\`\`\n\n`;
        }

        case 'a': {
            const href = el.getAttribute('href') ?? '';
            const text = children().trim();
            if (!href || href.startsWith('#')) return text;
            return `[${text}](${href})`;
        }

        case 'ul': return convertList(el, false) + '\n';
        case 'ol': return convertList(el, true) + '\n';
        case 'li': return children(); // handled by ul/ol

        case 'blockquote':
            return children().trim().split('\n').map(l => `> ${l}`).join('\n') + '\n\n';

        case 'table': return convertMarkdownTable(el) + '\n\n';
        // thead/tbody/tr/th/td are walked by convertMarkdownTable directly
        case 'thead': case 'tbody': case 'tfoot':
        case 'tr': case 'th': case 'td': return children();

        default: return children();
    }
}

function convertList(el: Element, ordered: boolean): string {
    const items = Array.from(el.children).filter(
        c => c.tagName.toLowerCase() === 'li'
    );
    return items.map((li, i) => {
        const prefix = ordered ? `${i + 1}. ` : '- ';
        const content = Array.from(li.childNodes).map(htmlToMarkdown).join('').trim();
        return prefix + content.replace(/\n(?=[^\n])/g, '\n  ');
    }).join('\n');
}

function convertMarkdownTable(table: Element): string {
    const rows = Array.from(table.querySelectorAll('tr'));
    if (!rows.length) return '';

    const cellText = (cell: Element) =>
        Array.from(cell.childNodes).map(htmlToMarkdown).join('').trim().replace(/\|/g, '\\|');

    const toRow = (tr: Element) =>
        '| ' + Array.from(tr.querySelectorAll('th, td')).map(cellText).join(' | ') + ' |';

    const firstRow = rows[0];
    const colCount = firstRow.querySelectorAll('th, td').length;
    const separator = '| ' + Array(colCount).fill('---').join(' | ') + ' |';
    const isHeaderRow = firstRow.querySelector('th') !== null;

    if (isHeaderRow) {
        return [toRow(firstRow), separator, ...rows.slice(1).map(toRow)].join('\n');
    }
    return [toRow(firstRow), separator, ...rows.slice(1).map(toRow)].join('\n');
}
