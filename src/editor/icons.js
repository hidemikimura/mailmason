// パレットやツールバーで使う小さなアイコン（SVG）
import { svg } from 'lit';

const frame = (/** @type {import('lit').SVGTemplateResult} */ body) =>
  svg`<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

/** @type {Record<string, import('lit').TemplateResult | import('lit').SVGTemplateResult>} */
export const icons = {
  text: frame(svg`<path d="M5 6h14M12 6v12M9 18h6"/>`),
  image: frame(
    svg`<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-5 4 4 3-3 4 4"/>`,
  ),
  button: frame(svg`<rect x="3.5" y="8" width="17" height="8" rx="3"/><path d="M9 12h6"/>`),
  divider: frame(svg`<path d="M4 12h16"/><path d="M7 7h10M7 17h10" opacity=".35"/>`),
  spacer: frame(svg`<path d="M12 4v16M8 8l4-4 4 4M8 16l4 4 4-4"/>`),
  imageText: frame(
    svg`<rect x="3.5" y="6" width="8" height="12" rx="1.5"/><path d="M14.5 8h6M14.5 12h6M14.5 16h4"/>`,
  ),
  social: frame(
    svg`<circle cx="6" cy="12" r="2.2"/><circle cx="18" cy="6" r="2.2"/><circle cx="18" cy="18" r="2.2"/><path d="m8 11 8-4M8 13l8 4"/>`,
  ),
  html: frame(svg`<path d="m9 8-4 4 4 4M15 8l4 4-4 4"/>`),
  edit: frame(svg`<path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="m13.5 6.5 4 4"/>`),
  preview: frame(
    svg`<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>`,
  ),
  desktop: frame(
    svg`<rect x="3" y="4.5" width="18" height="12" rx="1.5"/><path d="M9 20h6M12 16.5V20"/>`,
  ),
  mobile: frame(svg`<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>`),
  palette: frame(
    svg`<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M12 8.5v7M8.5 12h7"/>`,
  ),
  settings: frame(
    svg`<path d="M5 7h9M18 7h1M5 17h3M12 17h7"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>`,
  ),
  undo: frame(svg`<path d="M9 7 5 11l4 4"/><path d="M5 11h9a5 5 0 0 1 0 10h-2"/>`),
  redo: frame(svg`<path d="m15 7 4 4-4 4"/><path d="M19 11h-9a5 5 0 0 0 0 10h2"/>`),
  up: frame(svg`<path d="m6 14 6-6 6 6"/>`),
  down: frame(svg`<path d="m6 10 6 6 6-6"/>`),
  duplicate: frame(
    svg`<rect x="8" y="8" width="11" height="11" rx="2"/><path d="M5 15V6a1 1 0 0 1 1-1h9"/>`,
  ),
  delete: frame(svg`<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>`),
  close: frame(svg`<path d="m7 7 10 10M17 7 7 17"/>`),
  grip: frame(
    svg`<circle cx="9" cy="6" r="1.2"/><circle cx="15" cy="6" r="1.2"/><circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/><circle cx="9" cy="18" r="1.2"/><circle cx="15" cy="18" r="1.2"/>`,
  ),
};
