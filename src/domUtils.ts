/** Matches KaTeX (inline/block) and MathJax v3 rendered-math containers. */
export const MATH_CONTAINER_SELECTOR = '.katex-display, .katex, mjx-container';

/** Drops any element that's a descendant of another element already in the list (e.g. `.katex` inside `.katex-display`). */
export function dedupeNestedContainers(elements: Element[]): Element[] {
    return elements.filter(el => !elements.some(other => other !== el && other.contains(el)));
}

/**
 * Whether a math container renders as block/display math. `.katex-display`
 * and a `display`-attributed `mjx-container` are the standard signals;
 * some renderers (e.g. ChatGPT) skip the `.katex-display` wrapper and put
 * `<math display="block">` directly inside `.katex` instead.
 */
export function computeIsBlock(container: Element): boolean {
    const tag = container.tagName.toLowerCase();
    return container.classList.contains('katex-display')
        || (tag === 'mjx-container' && container.hasAttribute('display'))
        || container.querySelector('math[display="block"]') !== null;
}

/**
 * Queries the live DOM for KaTeX / MathJax math containers that intersect
 * any of the given selection ranges, deduplicates nested containers, and
 * returns formatted LaTeX strings joined by newline. Returns null if no
 * math is found.
 *
 * `htmlFallback`, when given, is used for a container that has no
 * `<annotation encoding="application/x-tex">` at all — some renderers (e.g.
 * ChatGPT, at least in some configurations) emit KaTeX with `output: 'html'`,
 * meaning there is no LaTeX source anywhere in the DOM for that equation,
 * full stop. In that case `htmlFallback` gets the container element itself
 * and should return a best-effort reconstructed LaTeX string (see
 * katexHtmlToLatex.ts) rather than the container being skipped entirely.
 */
export function processFromLiveDOM(
    ranges: Range[],
    formatFn: (latex: string, isBlock: boolean) => string,
    htmlFallback?: (container: Element) => string
): string | null {
    if (ranges.length === 0) return null;

    const candidates = Array.from(document.querySelectorAll(MATH_CONTAINER_SELECTOR));

    // Keep only containers that intersect at least one range
    const matched: Element[] = [];
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

    const results: string[] = [];
    for (const container of dedupeNestedContainers(matched)) {
        const annotation = container.querySelector(
            'annotation[encoding="application/x-tex"]'
        );
        let latex = (annotation?.textContent ?? '').trim();
        if (!latex && htmlFallback) latex = htmlFallback(container).trim();
        if (!latex) continue;
        results.push(formatFn(latex, computeIsBlock(container)));
    }

    return results.length > 0 ? results.join('\n') : null;
}
