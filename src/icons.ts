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

export const ICON_SETTINGS =
    `${svgOpen()}<path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915"/><circle cx="12" cy="12" r="3"/></svg>`;

export const ICON_ARROW_LEFT =
    `${svgOpen()}<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/></svg>`;

export const ICON_SUN =
    `${svgOpen()}<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`;

export const ICON_MOON =
    `${svgOpen()}<path d="M20.985 12.486a9 9 0 1 1-9.473-9.472c.405-.022.617.46.402.803a6 6 0 0 0 8.268 8.268c.344-.215.825-.004.803.401"/></svg>`;

export const ICON_MONITOR =
    `${svgOpen()}<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>`;

/** Parses trusted, hardcoded SVG markup (never user input) into a real element. */
export function createIconElement(svgMarkup: string, className?: string): SVGElement {
    const doc = new DOMParser().parseFromString(svgMarkup, "image/svg+xml");
    const svg = doc.documentElement as unknown as SVGElement;
    if (className) svg.setAttribute("class", className);
    svg.setAttribute("aria-hidden", "true");
    return svg;
}
