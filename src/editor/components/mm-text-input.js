// 差し込み変数を入れられる入力欄（設定パネル用）。
// - 横の「差し込み…」ボタンで、候補を絞り込んで選べる（カーソル位置に入れる）
// - trigger が有効なら、区切り開始文字（`{{` など）を入力すると候補を出し、続けて入力した文字で絞り込む
// Shadow DOM を使わない（設定パネルのスタイルとテストの querySelector('input') をそのまま使うため）。
// 値の変更は中の input / textarea の input・change イベント（バブリング）で伝える
import { LitElement, html, nothing } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';
import { findMergeTagTrigger, mergeTagText } from '../merge-tag-search.js';
import { isComposing } from '../util.js';
import { define } from '../context.js';
import './mm-merge-tag-list.js';
import './mm-merge-tag-picker.js';

/** @import { MergeTag } from '../fields/fields.js' */
/** @import { MergeTagDelimiters } from '../../core/merge-tags.js' */
/** @import { Translate } from '../i18n.js' */
/** @import { MmMergeTagList } from './mm-merge-tag-list.js' */

export class MmTextInput extends LitElement {
  static properties = {
    value: { attribute: false },
    inputId: { attribute: false },
    placeholder: { attribute: false },
    inputmode: { attribute: false },
    multiline: { type: Boolean },
    rows: { type: Number },
    disabled: { type: Boolean },
    tags: { attribute: false },
    delimiters: { attribute: false },
    trigger: { type: Boolean },
    t: { attribute: false },
    _suggest: { state: true },
  };

  constructor() {
    super();
    this.value = '';
    this.inputId = '';
    this.placeholder = '';
    this.inputmode = 'text';
    this.multiline = false;
    this.rows = 4;
    this.disabled = false;
    /** @type {readonly MergeTag[]} */
    this.tags = [];
    /** @type {MergeTagDelimiters} */
    this.delimiters = { open: '{{', close: '}}' };
    this.trigger = true;
    /** @type {Translate} */
    this.t = (key) => key;
    /** @type {{ start: number, end: number, query: string } | null} 入力中の差し込み変数 */
    this._suggest = null;
    /** _replace で input を発火している間 */
    this._replacing = false;
  }

  createRenderRoot() {
    return this;
  }

  /** @returns {HTMLInputElement | HTMLTextAreaElement} */
  get field() {
    return /** @type {HTMLInputElement | HTMLTextAreaElement} */ (
      this.querySelector('.mm-text-input-field')
    );
  }

  /** @returns {MmMergeTagList | null} */
  get suggestList() {
    return this.querySelector('.mm-merge-tag-suggest mm-merge-tag-list');
  }

  /**
   * 文字列を入れ替えて、input と change を発火する（設定パネルが値を受け取る）
   * @param {number} start
   * @param {number} end
   * @param {string} text
   */
  _replace(start, end, text) {
    const field = this.field;
    const next = field.value.slice(0, start) + text + field.value.slice(end);
    field.value = next;
    field.focus();
    field.setSelectionRange(start + text.length, start + text.length);
    this._replacing = true;
    try {
      field.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      field.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    } finally {
      this._replacing = false;
    }
  }

  /** キャレットの前を見て、入力中の差し込み変数の候補を出す・閉じる */
  _detect() {
    const field = this.field;
    if (!this.trigger || this.tags.length === 0 || field.selectionStart !== field.selectionEnd) {
      this._suggest = null;
      return;
    }
    const caret = field.selectionStart ?? field.value.length;
    const found = findMergeTagTrigger(field.value.slice(0, caret), this.delimiters);
    this._suggest = found ? { start: found.start, end: caret, query: found.query } : null;
  }

  _onInput() {
    // 候補を選んで入れたとき（_replace が発火する input）は開き直さない
    if (this._replacing) {
      this._suggest = null;
      return;
    }
    this._detect();
  }

  /** @param {KeyboardEvent} event */
  _onKeydown(event) {
    if (!this._suggest || isComposing(event)) return;
    const list = this.suggestList;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      list?.moveActive(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter' || event.key === 'Tab') {
      if (list?.pickActive()) event.preventDefault();
      else this._suggest = null;
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation(); // 選択の解除など、エディタの Esc の動作をしない
      this._suggest = null;
    }
  }

  /** @param {KeyboardEvent} event */
  _onKeyup(event) {
    // 左右キーなどでキャレットが動いたら、入力中の範囲から出たか確かめる
    if (this._suggest && /^(Arrow(Left|Right)|Home|End)$/.test(event.key)) this._detect();
  }

  /** @param {CustomEvent<{ key: string }>} event */
  _onSuggestPick(event) {
    event.stopPropagation();
    const suggest = this._suggest;
    if (!suggest) return;
    this._suggest = null;
    this._replace(suggest.start, suggest.end, mergeTagText(event.detail.key, this.delimiters));
  }

  /** @param {CustomEvent<{ key: string }>} event */
  _onPickerPick(event) {
    event.stopPropagation();
    const field = this.field;
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? start;
    this._replace(start, end, mergeTagText(event.detail.key, this.delimiters));
  }

  render() {
    const hasTags = this.tags.length > 0;
    const common = {
      id: this.inputId,
      class: 'mm-text-input-field',
    };
    const field = this.multiline
      ? html`<textarea
          id=${common.id}
          class=${common.class}
          rows=${this.rows}
          .value=${this.value}
          placeholder=${this.placeholder}
          ?disabled=${this.disabled}
          @input=${this._onInput}
          @keydown=${this._onKeydown}
          @keyup=${this._onKeyup}
          @blur=${() => (this._suggest = null)}
        ></textarea>`
      : html`<input
          id=${common.id}
          class=${common.class}
          type="text"
          inputmode=${this.inputmode}
          .value=${this.value}
          placeholder=${this.placeholder}
          ?disabled=${this.disabled}
          @input=${this._onInput}
          @keydown=${this._onKeydown}
          @keyup=${this._onKeyup}
          @blur=${() => (this._suggest = null)}
        />`;
    return html`<div
      class="with-menu"
      style=${styleMap({ position: 'relative', 'align-items': this.multiline ? 'flex-start' : '' })}
    >
      ${field}
      ${
        hasTags
          ? html`<mm-merge-tag-picker
              align="right"
              .tags=${this.tags}
              .delimiters=${this.delimiters}
              .t=${this.t}
              ?disabled=${this.disabled}
              @mm-merge-tag-pick=${this._onPickerPick}
            ></mm-merge-tag-picker>`
          : nothing
      }
      ${
        this._suggest
          ? html`<div
              class="mm-merge-tag-suggest"
              style=${styleMap({
                position: 'absolute',
                top: 'calc(100% + 4px)',
                left: '0',
                'z-index': '20',
                width: '260px',
                'max-width': '100%',
                background: 'var(--mm-color-surface)',
                border: '1px solid var(--mm-color-border)',
                'border-radius': 'var(--mm-radius)',
                'box-shadow': '0 4px 12px rgba(0, 0, 0, 0.15)',
              })}
              @mm-merge-tag-pick=${this._onSuggestPick}
            >
              <mm-merge-tag-list
                .tags=${this.tags}
                .query=${this._suggest.query}
                .delimiters=${this.delimiters}
                .t=${this.t}
              ></mm-merge-tag-list>
            </div>`
          : nothing
      }
    </div>`;
  }
}

define('mm-text-input', MmTextInput);
