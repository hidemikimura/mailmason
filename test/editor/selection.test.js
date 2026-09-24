import { afterEach, describe, expect, it } from 'vitest';
import { getRangeIn, placeCaretAtEnd, restoreRange } from '../../src/editor/richtext/selection.js';

afterEach(() => {
  document.body.innerHTML = '';
});

/** Shadow DOM の中に contenteditable を作る */
function setup(/** @type {string} */ html) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<div contenteditable="true">${html}</div>`;
  const editable = /** @type {HTMLElement} */ (root.firstElementChild);
  editable.focus();
  return { root, editable };
}

describe('Shadow DOM 内の選択範囲', () => {
  it('placeCaretAtEnd は最後のテキストの末尾に置く（段落の外側に置かない）', () => {
    const { root, editable } = setup('<h1>見出し</h1><p>本文<strong>太字</strong></p>');
    placeCaretAtEnd(editable);
    const range = /** @type {Range} */ (getRangeIn(root));
    expect(range.collapsed).toBe(true);
    expect(range.startContainer.nodeValue).toBe('太字');
    expect(range.startOffset).toBe(2);
  });

  it('末尾が <br> ならその手前に置く', () => {
    const { root, editable } = setup('<p>一行目<br></p>');
    placeCaretAtEnd(editable);
    const range = /** @type {Range} */ (getRangeIn(root));
    expect(range.startContainer).toBe(editable.firstChild);
    expect(range.startOffset).toBe(1);
  });

  it('restoreRange で Shadow DOM 内の範囲を選択できる', () => {
    const { root, editable } = setup('<p>あいうえお</p>');
    const text = /** @type {Text} */ (editable.querySelector('p')?.firstChild);
    const range = document.createRange();
    range.setStart(text, 1);
    range.setEnd(text, 3);
    restoreRange(range);
    expect(getRangeIn(root)?.toString()).toBe('いう');
  });
});
