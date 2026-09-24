// DOM・Lit に依存しない公開 API（@hidemikimura/mailmason/core）
export {
  TEMPLATE_VERSION,
  createId,
  createTemplate,
  createRow,
  createColumn,
  createBlock,
  cloneRow,
  cloneBlock,
} from './model/factory.js';
export { defaultBodySettings } from './model/settings.js';
export { ROW_LAYOUTS, ROW_LAYOUT_NAMES, getLayoutSpans } from './model/layout.js';
export { BLOCK_TYPES } from './blocks/registry.js';
export { SOCIAL_SERVICES } from './blocks/social.js';
export { qrSignature, qrStatus } from './blocks/qr.js';
export { defineBlock } from './blocks/custom.js';
export { componentKindOf, extractComponent, instantiateComponent } from './components.js';
export { locateBlock, locateColumn, findRowIndex } from './model/tree.js';
export { migrate, validate } from './migrate/index.js';
export { applyCommand } from './store/commands.js';
export { createStore } from './store/store.js';
export { MailmasonError } from './errors.js';
export { computeLayout } from './model/layout.js';
export { renderHtml, HTML_SIZE_WARNING_BYTES } from './render-html/index.js';
export { renderText } from './render-text/index.js';
export { resolveTextPart, textSourceHash, fnv1a } from './text-part.js';
export {
  DEFAULT_DELIMITERS,
  extractMergeTags,
  findMergeTags,
  mergeTagPattern,
  replaceMergeTags,
} from './merge-tags.js';
export { sanitizeHtml } from './richtext/sanitize.js';
export { stringWidth } from './text/width.js';

// 型（JSDoc / TypeScript 向け）
/** @typedef {import('./model/types.js').Template} Template */
/** @typedef {import('./model/types.js').Body} Body */
/** @typedef {import('./model/types.js').BodySettings} BodySettings */
/** @typedef {import('./model/types.js').Row} Row */
/** @typedef {import('./model/types.js').RowSettings} RowSettings */
/** @typedef {import('./model/types.js').RowLayout} RowLayout */
/** @typedef {import('./model/types.js').Column} Column */
/** @typedef {import('./model/types.js').Block} Block */
/** @typedef {import('./model/types.js').Spacing} Spacing */
/** @typedef {import('./model/types.js').TextPart} TextPart */
/** @typedef {import('./model/schema.js').Warning} Warning */
/** @typedef {import('./merge-tags.js').MergeTagDelimiters} MergeTagDelimiters */
/** @typedef {import('./merge-tags.js').MergeTagUsage} MergeTagUsage */
/** @typedef {import('./render-html/index.js').RenderHtmlOptions} RenderHtmlOptions */
/** @typedef {import('./render-text/index.js').RenderTextOptions} RenderTextOptions */
/** @typedef {import('./text-part.js').ResolvedTextPart} ResolvedTextPart */
/** @typedef {import('./store/commands.js').Command} Command */
/** @typedef {import('./store/store.js').Store} Store */
/** @typedef {import('./store/store.js').StoreState} StoreState */
/** @typedef {import('./components.js').Component} Component */
/** @typedef {import('./blocks/custom.js').CustomBlock} CustomBlock */
/** @typedef {import('./blocks/custom.js').CustomBlockInput} CustomBlockInput */
/** @typedef {import('./blocks/custom.js').CustomField} CustomField */
/** @typedef {import('./blocks/custom.js').CustomHtmlContext} CustomHtmlContext */
