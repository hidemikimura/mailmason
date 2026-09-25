// 差し込み変数を選ぶコンボボックス。ボタンで開き、入力した文字でグループ名・表示名・キーを絞り込む。
// 選ぶと mm-merge-tag-pick（detail.key）を発火して閉じる
import { LitElement, css, html, nothing } from 'lit';
import { controls } from '../styles.js';
import { isComposing } from '../util.js';
import { define } from '../context.js';
import './mm-merge-tag-list.js';

/** @import { MergeTag } from '../fields/fields.js' */
/** @import { MergeTagDelimiters } from '../../core/merge-tags.js' */
/** @import { Translate } from '../i18n.js' */
/** @import { MmMergeTagList } from './mm-merge-tag-list.js' */

export class MmMergeTagPicker extends LitElement {
  static properties = {
    tags: { attribute: false },
    delimiters: { attribute: false },
    t: { attribute: false },
    /** 一覧を開く向き（ボタンの左端 / 右端にそろえる） */
    align: { type: String },
    open: { type: Boolean, reflect: true },
    disabled: { type: Boolean },
    _query: { state: true },
  };

  static styles = [
    controls,
    css`
      :host {
        position: relative;
        display: inline-block;
        flex: none;
      }
      .toggle {
        white-space: nowrap;
      }
      .popover {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        z-index: 20;
        width: 260px;
        background: var(--mm-color-surface);
        border: 1px solid var(--mm-color-border);
        border-radius: var(--mm-radius);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        overflow: hidden;
      }
      :host([align='right']) .popover {
        left: auto;
        right: 0;
      }
      .search {
        display: block;
        width: 100%;
        border: 0;
        border-bottom: 1px solid var(--mm-color-border);
        border-radius: 0;
        padding: 6px 10px;
      }
      .search:focus-visible {
        outline: none;
      }
    `,
  ];

  constructor() {
    super();
    /** @type {readonly MergeTag[]} */
    this.tags = [];
    /** @type {MergeTagDelimiters} */
    this.delimiters = { open: '{{', close: '}}' };
    /** @type {Translate} */
    this.t = (key) => key;
    this.align = 'left';
    this.open = false;
    this.disabled = false;
    this._query = '';
    /** @param {Event} event */
    this._onOutside = (event) => {
      if (!event.composedPath().includes(this)) this.close();
    };
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('pointerdown', this._onOutside, true);
  }

  /** @returns {MmMergeTagList | null} */
  get list() {
    return this.renderRoot.querySelector('mm-merge-tag-list');
  }

  /** 一覧を開いて検索欄にフォーカスする */
  async show() {
    if (this.open) return;
    this._query = '';
    this.open = true;
    document.addEventListener('pointerdown', this._onOutside, true);
    await this.updateComplete;
    /** @type {HTMLInputElement | null} */ (this.renderRoot.querySelector('.search'))?.focus();
    this.dispatchEvent(new CustomEvent('mm-merge-tag-open', { bubbles: true, composed: true }));
  }

  close() {
    if (!this.open) return;
    this.open = false;
    document.removeEventListener('pointerdown', this._onOutside, true);
    this.dispatchEvent(new CustomEvent('mm-merge-tag-close', { bubbles: true, composed: true }));
  }

  /** @param {KeyboardEvent} event */
  _onKeydown(event) {
    // 日本語入力の変換中（確定の Enter を含む）は、候補を選ばずに入力欄に任せる
    if (isComposing(event)) {
      event.stopPropagation();
      return;
    }
    const list = this.list;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      list?.moveActive(event.key === 'ArrowDown' ? 1 : -1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      list?.pickActive();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      /** @type {HTMLButtonElement | null} */ (this.renderRoot.querySelector('.toggle'))?.focus();
    }
    // エディタのショートカット（Delete で要素を消すなど）に渡さない
    event.stopPropagation();
  }

  /** @param {CustomEvent<{ key: string }>} event */
  _onPick(event) {
    // 自分の一覧で選んだものだけを外に伝える（そのまま上に伝わる）
    if (event.target !== this.list) return;
    this.open = false;
    document.removeEventListener('pointerdown', this._onOutside, true);
  }

  render() {
    const { t } = this;
    return html`<button
        type="button"
        class="toggle"
        aria-haspopup="listbox"
        aria-expanded=${this.open ? 'true' : 'false'}
        ?disabled=${this.disabled}
        @pointerdown=${(/** @type {Event} */ e) => e.preventDefault()}
        @click=${() => (this.open ? this.close() : this.show())}
      >
        ${t('mergeTag.insert')}
      </button>
      ${
        this.open
          ? html`<div class="popover" @mm-merge-tag-pick=${this._onPick}>
              <input
                class="search"
                type="text"
                role="combobox"
                aria-expanded="true"
                aria-autocomplete="list"
                aria-label=${t('mergeTag.search')}
                placeholder=${t('mergeTag.search')}
                .value=${this._query}
                @input=${(/** @type {Event} */ e) =>
                  (this._query = /** @type {HTMLInputElement} */ (e.target).value)}
                @keydown=${this._onKeydown}
              />
              <mm-merge-tag-list
                .tags=${this.tags}
                .query=${this._query}
                .delimiters=${this.delimiters}
                .t=${t}
              ></mm-merge-tag-list>
            </div>`
          : nothing
      }`;
  }
}

define('mm-merge-tag-picker', MmMergeTagPicker);
