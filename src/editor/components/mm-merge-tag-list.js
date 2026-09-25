// 差し込み変数の候補の一覧（グループごと）。絞り込みの文字列は外から渡し、
// 上下キー・Enter の操作は親が moveActive() / pickActive() で行う（フォーカスは親の入力欄に置いたまま）
import { LitElement, css, html, nothing } from 'lit';
import { filterMergeTags, mergeTagText } from '../merge-tag-search.js';
import { define } from '../context.js';

/** @import { MergeTag } from '../fields/fields.js' */
/** @import { MergeTagDelimiters } from '../../core/merge-tags.js' */
/** @import { Translate } from '../i18n.js' */

let nextId = 0;

export class MmMergeTagList extends LitElement {
  static properties = {
    tags: { attribute: false },
    query: { attribute: false },
    delimiters: { attribute: false },
    t: { attribute: false },
    _active: { state: true },
  };

  static styles = css`
    :host {
      display: block;
      max-height: 260px;
      overflow-y: auto;
      font-family: var(--mm-font-family);
      font-size: var(--mm-font-size, 13px);
      color: var(--mm-color-text);
    }
    [role='listbox'] {
      margin: 0;
      padding: 2px 0;
    }
    .group {
      padding: 6px 10px 2px;
      font-size: 11px;
      font-weight: bold;
      color: var(--mm-color-muted);
    }
    [role='option'] {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      padding: 5px 10px;
      cursor: pointer;
      white-space: nowrap;
    }
    [role='option'][aria-selected='true'] {
      background: var(--mm-color-accent-soft);
    }
    .key {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      color: var(--mm-color-muted);
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .empty {
      padding: 8px 10px;
      color: var(--mm-color-muted);
    }
  `;

  constructor() {
    super();
    /** @type {readonly MergeTag[]} */
    this.tags = [];
    this.query = '';
    /** @type {MergeTagDelimiters} */
    this.delimiters = { open: '{{', close: '}}' };
    /** @type {Translate} */
    this.t = (key) => key;
    this._active = 0;
    this._id = `mm-merge-tags-${++nextId}`;
  }

  /** 絞り込んだ候補（グループの順に平らにしたもの） */
  get items() {
    return filterMergeTags(this.tags, this.query).flatMap((group) => group.tags);
  }

  /** @param {Map<string, unknown>} changed */
  willUpdate(changed) {
    if (changed.has('query') || changed.has('tags')) this._active = 0;
  }

  updated() {
    const active = this.renderRoot.querySelector('[aria-selected="true"]');
    active?.scrollIntoView?.({ block: 'nearest' });
  }

  /**
   * 選択中の候補を動かす（端では反対側に回る）
   * @param {number} delta
   */
  moveActive(delta) {
    const count = this.items.length;
    if (count === 0) return;
    this._active = (this._active + delta + count) % count;
  }

  /**
   * 選択中の候補を選ぶ
   * @returns {boolean} 候補があったか
   */
  pickActive() {
    const tag = this.items[this._active];
    if (!tag) return false;
    this._pick(tag);
    return true;
  }

  /** @param {MergeTag} tag */
  _pick(tag) {
    this.dispatchEvent(
      new CustomEvent('mm-merge-tag-pick', {
        detail: { key: tag.key },
        bubbles: true,
        composed: true,
      }),
    );
  }

  render() {
    const groups = filterMergeTags(this.tags, this.query);
    if (groups.length === 0) {
      return html`<div class="empty" role="status">${this.t('mergeTag.empty')}</div>`;
    }
    const showHeaders = groups.some((group) => group.name !== null);
    let index = 0;
    return html`<div role="listbox" id=${this._id} aria-label=${this.t('mergeTag.insert')}>
      ${groups.map(
        (group) =>
          html`<div role="group" aria-label=${group.name ?? this.t('mergeTag.other')}>
            ${
              showHeaders
                ? html`<div class="group" aria-hidden="true">
                    ${group.name ?? this.t('mergeTag.other')}
                  </div>`
                : nothing
            }
            ${group.tags.map((tag) => {
              const i = index++;
              return html`<div
                role="option"
                id=${`${this._id}-${i}`}
                data-key=${tag.key}
                aria-selected=${i === this._active ? 'true' : 'false'}
                @pointerdown=${(/** @type {Event} */ e) => e.preventDefault()}
                @pointermove=${() => {
                  if (this._active !== i) this._active = i;
                }}
                @click=${() => this._pick(tag)}
              >
                <span class="label">${tag.label}</span>
                <span class="key">${mergeTagText(tag.key, this.delimiters)}</span>
              </div>`;
            })}
          </div>`,
      )}
    </div>`;
  }
}

define('mm-merge-tag-list', MmMergeTagList);
