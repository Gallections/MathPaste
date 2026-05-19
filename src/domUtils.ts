/**
 * Queries the live DOM for KaTeX / MathJax math containers that intersect
 * any of the given selection ranges, deduplicates nested containers, and
 * returns formatted LaTeX strings joined by newline. Returns null if no
 * math is found.
 */
export function processFromLiveDOM(
    ranges: Range[],
    formatFn: (latex: string, isBlock: boolean) => string
): string | null {
    if (ranges.length === 0) return null;

    const candidates = Array.from(
        document.querySelectorAll('.katex-display, .katex, mjx-container')
    );

    // Keep only containers that intersect at least one range
    let matched: Element[] = [];
    for (const container of candidates) {
        for (const range of ranges) {
            try {
                if (range.intersectsNode(container)) {
                    matched.push(container);
                    break;
                }
            } catch {
                // cross-origin frame or detached node — skip silently
            }
        }
    }

    // Remove containers that are descendants of other matched containers
    // (e.g. .katex inside .katex-display)
    matched = matched.filter(
        el => !matched.some(other => other !== el && other.contains(el))
    );

    const results: string[] = [];
    for (const container of matched) {
        const annotation = container.querySelector(
            'annotation[encoding="application/x-tex"]'
        );
        if (!annotation) continue;
        const latex = (annotation.textContent ?? '').trim();
        if (!latex) continue;
        const tag = container.tagName.toLowerCase();
        const isBlock =
            container.classList.contains('katex-display') ||
            (tag === 'mjx-container' && container.hasAttribute('display'));
        results.push(formatFn(latex, isBlock));
    }

    return results.length > 0 ? results.join('\n') : null;
}
