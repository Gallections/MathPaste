// ─── Icon sources ─────────────────────────────────────────────────────────
// Raw SVG markup from Lucide (https://lucide.dev, ISC license: lucide-static
// on npm), copied verbatim and inlined directly so the extension never
// fetches anything at runtime. Each is the untouched 0-0-24-24 viewBox —
// only display size is controlled via CSS, never the coordinates.

const svgOpen = (extra = "") =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"${extra}>`;

export const ICON_X =
    `${svgOpen()}<path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>`;

export const ICON_BOOK_OPEN =
    `${svgOpen()}<path d="M12 5v16"/><path d="M20.001 19A2 2 0 0 0 22 17V5a2 2 0 0 0-1.999-2L16 3.002A5 5 0 0 0 12 5a5 5 0 0 0-4-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 1.999 2H8a5 5 0 0 1 4 2 5 5 0 0 1 4-2z"/></svg>`;

export const ICON_EXTERNAL_LINK =
    `${svgOpen()}<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>`;

export const ICON_POWER =
    `${svgOpen()}<path d="M12 2v10"/><path d="M18.4 6.6a9 9 0 1 1-12.77.04"/></svg>`;

export const ICON_EYE =
    `${svgOpen()}<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/></svg>`;

export const ICON_PIN =
    `${svgOpen()}<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>`;

export const ICON_CIRCLE_PLAY =
    `${svgOpen()}<path d="M9 9.003a1 1 0 0 1 1.517-.859l4.997 2.997a1 1 0 0 1 0 1.718l-4.997 2.997A1 1 0 0 1 9 14.996z"/><circle cx="12" cy="12" r="10"/></svg>`;

export const ICON_INFO =
    `${svgOpen()}<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>`;

export const ICON_LIST_CHECKS =
    `${svgOpen()}<path d="M13 5h8"/><path d="M13 12h8"/><path d="M13 19h8"/><path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/></svg>`;

export const ICON_WRENCH =
    `${svgOpen()}<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/></svg>`;

// Play, filled — used as a small solid glyph inside a dark circular button,
// where a stroked outline reads too faint. Same path Lucide ships for
// "play", just rendered filled instead of stroked.
export const ICON_PLAY_FILLED =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/></svg>`;

/** Parses trusted, hardcoded SVG markup (never user input) into a real element. */
export function createIconElement(svgMarkup: string, className?: string): SVGElement {
    const doc = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
    const svg = doc.documentElement as unknown as SVGElement;
    if (className) svg.setAttribute("class", className);
    svg.setAttribute("aria-hidden", "true");
    return svg;
}
