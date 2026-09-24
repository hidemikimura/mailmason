// Shadow DOM 内の選択範囲を扱う。
// - 取得: document.getSelection() は Shadow DOM の中を指さないため、getComposedRanges を使う
// - 設定: 仕様上 addRange は文書直下の範囲しか受け付けず、WebKit（Safari）は Shadow DOM 内の範囲を無視する。
//   setBaseAndExtent は Shadow DOM 内のノードも受け付けるため、こちらを使う

/**
 * root の中の選択範囲を Range として取り出す（無ければ null）
 * @param {ShadowRoot} root
 * @returns {Range | null}
 */
export function getRangeIn(root) {
  const selection = document.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  /** @type {StaticRange | undefined} */
  let composed;
  const sel = /** @type {any} */ (selection);
  if (typeof sel.getComposedRanges === 'function') {
    try {
      [composed] = sel.getComposedRanges({ shadowRoots: [root] });
    } catch {
      // 古い仕様（可変長引数）の実装
      [composed] = sel.getComposedRanges(root);
    }
  }
  if (composed) {
    const range = document.createRange();
    range.setStart(composed.startContainer, composed.startOffset);
    range.setEnd(composed.endContainer, composed.endOffset);
    return range;
  }
  // getComposedRanges の無い環境（Chromium の古い版）
  const legacy = /** @type {any} */ (root).getSelection?.();
  return legacy && legacy.rangeCount > 0 ? legacy.getRangeAt(0) : null;
}

/**
 * 選択範囲を復元する
 * @param {Range} range
 */
export function restoreRange(range) {
  const selection = document.getSelection();
  if (!selection) return;
  try {
    selection.setBaseAndExtent(
      range.startContainer,
      range.startOffset,
      range.endContainer,
      range.endOffset,
    );
    return;
  } catch {
    // setBaseAndExtent が使えない環境
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

/** 子を持たない（キャレットを中に置けない）要素 */
const VOID_ELEMENTS = new Set(['BR', 'IMG', 'HR', 'INPUT']);

/**
 * キャレットを要素の末尾に置く。
 * 要素そのものの末尾（最後の段落の外側）に置くと、Firefox は次の入力で新しい段落を作るため、
 * 最後のテキストの末尾まで降りる
 * @param {HTMLElement} element
 */
export function placeCaretAtEnd(element) {
  /** @type {Node} */
  let node = element;
  while (node.lastChild && !VOID_ELEMENTS.has(/** @type {Element} */ (node.lastChild).nodeName)) {
    node = node.lastChild;
  }
  const range = document.createRange();
  if (node.nodeType === Node.TEXT_NODE) {
    range.setStart(node, /** @type {Text} */ (node).length);
  } else if (node.lastChild?.nodeName === 'BR' && node !== element) {
    // 末尾の <br> の手前（<br> の後ろは見た目上の次の行になる）
    range.setStart(node, node.childNodes.length - 1);
  } else {
    range.setStart(node, node.childNodes.length);
  }
  range.collapse(true);
  restoreRange(range);
}
