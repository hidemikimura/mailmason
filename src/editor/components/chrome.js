// 選択中の要素に付けるラベルと操作ボタン（行・ブロック共通）
import { css, html, nothing } from 'lit';
import { icons } from '../icons.js';

/** @import { Translate } from '../i18n.js' */

/**
 * @typedef {Object} ChromeActions
 * @property {(() => void) | null} moveUp 使えないときは null
 * @property {(() => void) | null} moveDown
 * @property {() => void} duplicate
 * @property {() => void} remove
 */

/**
 * @param {string} label
 * @param {ChromeActions} actions
 * @param {Translate} t
 * @param {(event: PointerEvent) => void} [onDragStart] ラベルをドラッグ用のつまみにする
 */
export function renderChrome(label, actions, t, onDragStart) {
  /** @param {() => void} fn */
  const run = (fn) => (/** @type {Event} */ e) => {
    e.stopPropagation();
    fn();
  };
  const button = (
    /** @type {string} */ key,
    /** @type {unknown} */ icon,
    /** @type {(() => void) | null} */ fn,
    danger = false,
  ) =>
    html`<button
      type="button"
      class=${danger ? 'danger' : ''}
      title=${t(key)}
      aria-label=${t(key)}
      ?disabled=${!fn}
      @click=${fn ? run(fn) : nothing}
    >
      ${icon}
    </button>`;
  return html`<div class="chrome" @pointerdown=${(/** @type {Event} */ e) => e.stopPropagation()}>
    <span
      class="chrome-label ${onDragStart ? 'handle' : ''}"
      title=${onDragStart ? t('action.drag') : ''}
      @pointerdown=${onDragStart ?? nothing}
      >${onDragStart ? icons.grip : nothing}${label}</span
    >
    <span class="chrome-actions">
      ${button('action.moveUp', icons.up, actions.moveUp)}
      ${button('action.moveDown', icons.down, actions.moveDown)}
      ${button('action.duplicate', icons.duplicate, actions.duplicate)}
      ${button('action.delete', icons.delete, actions.remove, true)}
    </span>
  </div>`;
}

export const chromeStyles = css`
  .chrome {
    position: absolute;
    left: -2px;
    right: -2px;
    bottom: 100%;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    pointer-events: none;
    z-index: 3;
    font-family: var(--mm-font-family);
    font-size: 11px;
  }
  .chrome-label {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: var(--mm-color-accent);
    color: var(--mm-color-accent-text);
    padding: 1px 6px;
    border-radius: var(--mm-radius) var(--mm-radius) 0 0;
    line-height: 18px;
  }
  .chrome-label.handle {
    pointer-events: auto;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .chrome-label svg {
    width: 14px;
    height: 14px;
  }
  .chrome-actions {
    display: flex;
    gap: 2px;
    pointer-events: auto;
    background: var(--mm-color-accent);
    border-radius: var(--mm-radius) var(--mm-radius) 0 0;
    padding: 2px;
  }
  .chrome-actions button {
    display: grid;
    place-items: center;
    width: 24px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--mm-color-accent-text);
    cursor: pointer;
  }
  .chrome-actions button:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
  }
  .chrome-actions button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .chrome-actions svg {
    width: 16px;
    height: 16px;
  }
`;
