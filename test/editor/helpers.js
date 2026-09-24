import '../../src/index.js';
import basicJson from '../fixtures/templates/basic.json';
import kitchenSinkJson from '../fixtures/templates/kitchen-sink.json';

/** @typedef {import('../../src/index.js').MailmasonEditor} MailmasonEditor */

/**
 * 実寸どおりの画像（SVG の data URL）。
 * フィクスチャの画像 URL は読み込めず、壊れた画像の表示サイズがブラウザごとに違う
 * （WebKit は大きな枠を出す）ため、テストでは読み込める画像に差し替えて配置を揃える
 * @param {number} width
 * @param {number} height
 */
export function imageUrl(width, height) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#8a9fb4"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * テンプレート内の画像 URL を imageUrl に差し替えた複製を作る
 * @template T
 * @param {T} template
 * @returns {T}
 */
function withLocalImages(template) {
  /** @param {any} node */
  const walk = (node) => {
    if (Array.isArray(node)) {
      node.forEach(walk);
    } else if (node && typeof node === 'object') {
      if (typeof node.src === 'string' && node.src && 'naturalWidth' in node) {
        node.src = imageUrl(node.naturalWidth ?? 600, node.naturalHeight ?? 300);
      } else if (typeof node.src === 'string' && node.src && 'generated' in node) {
        node.src = imageUrl(node.size ?? 160, node.size ?? 160); // QR コード
      }
      Object.values(node).forEach(walk);
    }
  };
  const copy = structuredClone(template);
  walk(copy);
  return copy;
}

export const fixtures = {
  basic: withLocalImages(basicJson),
  kitchenSink: withLocalImages(kitchenSinkJson),
};

/** 次のフレームまで待つ（子コンポーネントの更新と mm-change の通知を待つため） */
export async function frame() {
  await new Promise((resolve) => requestAnimationFrame(() => resolve(undefined)));
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * @param {Record<string, unknown>} [props]
 * @returns {Promise<MailmasonEditor>}
 */
export async function mount(props = {}) {
  const el = /** @type {MailmasonEditor} */ (document.createElement('mailmason-editor'));
  Object.assign(el, props);
  el.style.height = '800px';
  document.body.append(el);
  await el.updateComplete;
  await frame();
  return el;
}

/**
 * Shadow DOM をたどって要素を探す: deep(el, 'mm-canvas', 'mm-row', 'mm-block')
 * @param {Element} root
 * @param {...string} selectors 最後以外は Shadow ホストのセレクタ
 * @returns {HTMLElement | null}
 */
export function deep(root, ...selectors) {
  /** @type {Element | null} */
  let current = root;
  for (const selector of selectors) {
    const scope = /** @type {ShadowRoot | null} */ (current?.shadowRoot ?? null);
    current = (scope ?? current)?.querySelector(selector) ?? null;
    if (!current) return null;
  }
  return /** @type {HTMLElement} */ (current);
}

/**
 * @param {Element} root
 * @param {string[]} path 最後の 1 つ手前までの Shadow ホスト
 * @param {string} selector
 * @returns {HTMLElement[]}
 */
export function deepAll(root, path, selector) {
  const host = path.length ? deep(root, ...path) : root;
  return /** @type {HTMLElement[]} */ ([...(host?.shadowRoot?.querySelectorAll(selector) ?? [])]);
}

/**
 * キャンバス上の全ブロック要素（文書順）
 * @param {MailmasonEditor} el
 * @returns {any[]}
 */
export function canvasBlocks(el) {
  const rows = deepAll(el, ['mm-canvas'], 'mm-row');
  return rows.flatMap((row) => [...(row.shadowRoot?.querySelectorAll('mm-block') ?? [])]);
}

/**
 * @param {EventTarget} target
 * @param {string} type
 * @returns {Promise<CustomEvent>}
 */
export function once(target, type) {
  return new Promise((resolve) =>
    target.addEventListener(type, (e) => resolve(/** @type {CustomEvent} */ (e)), { once: true }),
  );
}

/**
 * @param {Element} target
 * @param {string} key
 * @param {KeyboardEventInit} [init]
 */
export function press(target, key, init = {}) {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key, bubbles: true, composed: true, ...init }),
  );
}

/**
 * 入力欄に値を入れて input / change を発火する
 * @param {HTMLInputElement | HTMLTextAreaElement} input
 * @param {string} value
 */
export function typeInto(input, value) {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  input.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
}
