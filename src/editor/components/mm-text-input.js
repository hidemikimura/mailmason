// 差し込み変数を入れられる入力欄。エディタの設定欄で使い、`<mm-text-input>` として公開もする
// （件名など、エディタの外の欄に置ける）。
// - 横の「差し込み…」ボタンで、候補を絞り込んで選べる（カーソル位置に入れる）
// - mergeTagTrigger が有効なら、区切り開始文字（`{{` など）を入力すると候補を出し、続けて入力した文字で絞り込む
// - displayLabels なら、欄の中は候補の表示名（`{{氏名}}`）で見せ、value とイベントはキー（`{{name}}`）で返す
// Shadow DOM を使わない（外の <label for> が中の欄を指せるように。設定パネルのスタイルもそのまま効く）。
// 値は入力のたびに value に入れ、`mm-value-input`（入力のたび）・`mm-value-change`（確定したとき）で伝える
import { LitElement, css, html, nothing } from 'lit';
import { live } from 'lit/directives/live.js';
import { findMergeTagTrigger, mergeTagText } from '../merge-tag-search.js';
import { getMergeTagDisplay } from '../merge-tag-display.js';
import { createTranslator, loadMessages, needsMessages } from '../i18n.js';
import { registerTokenDefaults } from '../styles.js';
import { isComposing } from '../util.js';
import { define } from '../context.js';
import './mm-merge-tag-list.js';
import './mm-merge-tag-picker.js';

/** @import { MergeTag } from '../fields/fields.js' */
/** @import { MergeTagDelimiters } from '../../core/merge-tags.js' */
/** @import { MergeTagDisplay } from '../merge-tag-display.js' */
/** @import { Translate } from '../i18n.js' */
/** @import { MmMergeTagList } from './mm-merge-tag-list.js' */

/**
 * 中の欄の見た目。Shadow DOM が無いので、置かれた場所（document か、親の Shadow Root）に足す。
 * :where() で詳細度を 0 にし、利用者や設定パネルのスタイルが常に勝つようにする
 */
const lightStyles = css`
  :where(mm-text-input) {
    display: block;
    font-family: var(--mm-font-family);
    font-size: var(--mm-font-size);
    color: var(--mm-color-text);
  }
  :where(mm-text-input .mm-text-input-row) {
    position: relative;
    display: flex;
    gap: 4px;
  }
  :where(mm-text-input .mm-text-input-row.multiline) {
    align-items: flex-start;
  }
  :where(mm-text-input .mm-text-input-field) {
    flex: 1;
    min-width: 0;
    box-sizing: border-box;
    font: inherit;
    color: inherit;
    background: var(--mm-color-surface);
    border: 1px solid var(--mm-color-border);
    border-radius: var(--mm-radius);
    padding: 4px 6px;
  }
  :where(mm-text-input textarea.mm-text-input-field) {
    resize: vertical;
  }
  :where(mm-text-input .mm-text-input-field:focus-visible) {
    outline: 2px solid var(--mm-color-accent);
    outline-offset: 1px;
  }
  :where(mm-text-input .mm-text-input-suggest) {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    z-index: 20;
    box-sizing: border-box;
    width: var(--mm-suggest-width, 260px);
    max-width: 100%;
    background: var(--mm-color-surface);
    border: 1px solid var(--mm-color-border);
    border-radius: var(--mm-radius);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
`;

/** @type {WeakSet<Document | ShadowRoot>} スタイルを足し終えた場所 */
const styledRoots = new WeakSet();

/** @param {Node} root */
function adoptLightStyles(root) {
  if (!(root instanceof Document || root instanceof ShadowRoot) || styledRoots.has(root)) return;
  const sheet = lightStyles.styleSheet;
  if (!sheet) return;
  styledRoots.add(root);
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
}

export class MmTextInput extends LitElement {
  static properties = {
    value: { type: String },
    inputId: { type: String, attribute: 'input-id' },
    placeholder: { type: String },
    inputmode: { type: String },
    multiline: { type: Boolean },
    rows: { type: Number },
    disabled: { type: Boolean, reflect: true },
    tags: { attribute: false },
    delimiters: { attribute: false },
    mergeTagTrigger: {
      type: Boolean,
      attribute: 'merge-tag-trigger',
      // 既定が true なので、属性は "false" のときだけオフにする（<mailmason-editor> と同じ）
      converter: { fromAttribute: (/** @type {string | null} */ value) => value !== 'false' },
    },
    displayLabels: { type: Boolean, attribute: 'display-labels' },
    locale: { type: String },
    messages: { attribute: false },
    t: { attribute: false },
    _suggest: { state: true },
  };

  constructor() {
    super();
    /** 今の値（差し込み変数はキーで書く） */
    this.value = '';
    /** 中の欄の id（外の <label for> から指す） */
    this.inputId = '';
    this.placeholder = '';
    this.inputmode = 'text';
    this.multiline = false;
    this.rows = 4;
    this.disabled = false;
    /** @type {readonly MergeTag[]} 差し込み変数の候補 */
    this.tags = [];
    /** @type {MergeTagDelimiters} */
    this.delimiters = { open: '{{', close: '}}' };
    this.mergeTagTrigger = true;
    /** 欄の中を候補の表示名で見せる */
    this.displayLabels = false;
    this.locale = 'ja';
    /** @type {Record<string, string>} 文言の部分上書き（例: `{ 'mergeTag.insert': '変数' }`） */
    this.messages = {};
    /** @type {Translate | null} 文言（エディタの中で使うときに渡す。無ければ locale と messages から作る） */
    this.t = null;
    /** @type {{ start: number, end: number, query: string } | null} 入力中の差し込み変数 */
    this._suggest = null;
    /** _replace で input を発火している間 */
    this._replacing = false;
    /** @type {{ locale: string, messages: Record<string, string>, t: Translate } | null} */
    this._translator = null;
  }

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    registerTokenDefaults();
    adoptLightStyles(this.getRootNode());
  }

  /** @param {Map<string, unknown>} changed */
  willUpdate(changed) {
    if (changed.has('locale') && !this.t && needsMessages(this.locale)) {
      loadMessages(this.locale).then(
        () => this.requestUpdate(),
        (error) => console.error('[mailmason] 文言を読み込めませんでした', error),
      );
    }
  }

  /** @returns {HTMLInputElement | HTMLTextAreaElement} */
  get field() {
    return /** @type {HTMLInputElement | HTMLTextAreaElement} */ (
      this.querySelector('.mm-text-input-field')
    );
  }

  /** @returns {MmMergeTagList | null} */
  get suggestList() {
    return this.querySelector('.mm-text-input-suggest mm-merge-tag-list');
  }

  /** @returns {MergeTagDisplay | null} */
  get _display() {
    return this.displayLabels && this.tags.length > 0
      ? getMergeTagDisplay(this.tags, this.delimiters)
      : null;
  }

  /** @returns {Translate} */
  get _t() {
    if (this.t) return this.t;
    const cached = this._translator;
    if (cached?.locale === this.locale && cached.messages === this.messages) return cached.t;
    const t = createTranslator(this.locale, this.messages);
    this._translator = { locale: this.locale, messages: this.messages, t };
    return t;
  }

  /**
   * 欄の文字（表示名を含みうる）を value の形（キー）にする
   * @param {string} text
   */
  _toValue(text) {
    return this._display?.toKeys(text) ?? text;
  }

  /** 欄に出す文字。欄の今の文字が value と同じ意味なら、そのまま（キャレットや変換中の文字を動かさない） */
  _fieldText() {
    const current = this.field?.value;
    if (current !== undefined && this._toValue(current) === this.value) return current;
    return this._display?.toLabels(this.value) ?? this.value;
  }

  /** @param {string} key */
  _tagText(key) {
    return this._display?.text(key) ?? mergeTagText(key, this.delimiters);
  }

  /** @param {'mm-value-input' | 'mm-value-change'} type */
  _emit(type) {
    this.dispatchEvent(new CustomEvent(type, { detail: { value: this.value }, bubbles: true }));
  }

  /**
   * 文字列を入れ替えて、input と change を発火する
   * @param {number} start
   * @param {number} end
   * @param {string} text
   */
  _replace(start, end, text) {
    const field = this.field;
    field.value = field.value.slice(0, start) + text + field.value.slice(end);
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
    if (
      !this.mergeTagTrigger ||
      this.tags.length === 0 ||
      field.selectionStart !== field.selectionEnd
    ) {
      this._suggest = null;
      return;
    }
    const caret = field.selectionStart ?? field.value.length;
    const found = findMergeTagTrigger(field.value.slice(0, caret), this.delimiters);
    this._suggest = found ? { start: found.start, end: caret, query: found.query } : null;
  }

  _onInput() {
    this.value = this._toValue(this.field.value);
    this._emit('mm-value-input');
    // 候補を選んで入れたとき（_replace が発火する input）は開き直さない
    if (this._replacing) {
      this._suggest = null;
      return;
    }
    this._detect();
  }

  _onChange() {
    this._emit('mm-value-change');
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
    this._replace(suggest.start, suggest.end, this._tagText(event.detail.key));
  }

  /** @param {CustomEvent<{ key: string }>} event */
  _onPickerPick(event) {
    event.stopPropagation();
    const field = this.field;
    const start = field.selectionStart ?? field.value.length;
    const end = field.selectionEnd ?? start;
    this._replace(start, end, this._tagText(event.detail.key));
  }

  render() {
    const t = this._t;
    const text = this._fieldText();
    const field = this.multiline
      ? html`<textarea
          id=${this.inputId || nothing}
          class="mm-text-input-field"
          rows=${this.rows}
          .value=${live(text)}
          placeholder=${this.placeholder || nothing}
          ?disabled=${this.disabled}
          @input=${this._onInput}
          @change=${this._onChange}
          @keydown=${this._onKeydown}
          @keyup=${this._onKeyup}
          @blur=${() => (this._suggest = null)}
        ></textarea>`
      : html`<input
          id=${this.inputId || nothing}
          class="mm-text-input-field"
          type="text"
          inputmode=${this.inputmode}
          .value=${live(text)}
          placeholder=${this.placeholder || nothing}
          ?disabled=${this.disabled}
          @input=${this._onInput}
          @change=${this._onChange}
          @keydown=${this._onKeydown}
          @keyup=${this._onKeyup}
          @blur=${() => (this._suggest = null)}
        />`;
    return html`<div class="mm-text-input-row with-menu ${this.multiline ? 'multiline' : ''}">
      ${field}
      ${
        this.tags.length > 0
          ? html`<mm-merge-tag-picker
              align="right"
              .tags=${this.tags}
              .delimiters=${this.delimiters}
              .t=${t}
              ?disabled=${this.disabled}
              @mm-merge-tag-pick=${this._onPickerPick}
            ></mm-merge-tag-picker>`
          : nothing
      }
      ${
        this._suggest
          ? html`<div class="mm-text-input-suggest" @mm-merge-tag-pick=${this._onSuggestPick}>
              <mm-merge-tag-list
                .tags=${this.tags}
                .query=${this._suggest.query}
                .delimiters=${this.delimiters}
                .t=${t}
              ></mm-merge-tag-list>
            </div>`
          : nothing
      }
    </div>`;
  }
}

define('mm-text-input', MmTextInput);
