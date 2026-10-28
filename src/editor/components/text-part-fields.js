// 設定パネルの「テキストパート」（部品・行ごとの扱い）。テキストパートは HTML を表示しないメールソフト向けの文字だけの版
import { html } from 'lit';
import { renderBlockText } from '../../core/render-text/index.js';

/** @import { FieldSpec } from '../fields/fields.js' */
/** @import { Block } from '../../core/model/types.js' */
/** @import { EditorContext } from '../context.js' */

/** @type {FieldSpec} */
export const BLOCK_TEXT_FIELD = {
  key: 'mode',
  kind: 'align',
  labelKey: 'field.textPart',
  helpKey: 'field.textPartHelp',
  options: {
    choices: [
      { value: 'auto', labelKey: 'textPart.auto' },
      { value: 'hidden', labelKey: 'textPart.hidden' },
      { value: 'only', labelKey: 'textPart.only' },
    ],
  },
};

/** @type {FieldSpec} */
export const ROW_TEXT_FIELD = {
  key: 'mode',
  kind: 'align',
  labelKey: 'field.textPart',
  helpKey: 'field.rowTextPartHelp',
  options: {
    choices: [
      { value: 'auto', labelKey: 'textPart.auto' },
      { value: 'hidden', labelKey: 'textPart.hiddenRow' },
    ],
  },
};

/**
 * 部品・行の text を、設定欄の値にする
 * @param {{ text?: { mode: string } }} element
 */
export const textModeValues = (element) => ({ mode: element.text?.mode ?? 'auto' });

/**
 * 「自動」のとき、この部品から作られるテキストを小さく見せる
 * @param {Block} block
 * @param {EditorContext} ctx
 */
export function autoTextPreview(block, ctx) {
  if (block.text?.mode === 'hidden') return html``;
  const text = renderBlockText(block, ctx.textOptions);
  return html`<div class="text-preview">
    <span class="hint">${ctx.t('textPart.preview')}</span>
    <pre>${text || ctx.t('textPart.empty')}</pre>
  </div>`;
}
