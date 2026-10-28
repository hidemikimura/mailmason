// 差し込み変数の候補の一覧（グループごと）。絞り込みの文字列は外から渡し、
// 上下キー・Enter の操作は親が moveActive() / pickActive() で行う（フォーカスは親の入力欄に置いたまま）。
// light 属性を付けると Shadow DOM を使わずに描く（親の入力欄から aria-activedescendant で候補を指せるように）
import { LitElement, css, html, nothing, unsafeCSS } from 'lit';
import { filterMergeTags, mergeTagText } from '../merge-tag-search.js';
import { adoptStyles } from '../styles.js';
import { define } from '../context.js';

/** @import { MergeTag } from '../fields/fields.js' */
/** @import { MergeTagDelimiters } from '../../core/merge-tags.js' */
/** @import { Translate } from '../i18n.js' */

let nextId = 0;

/**
 * 一覧のスタイル。Shadow DOM（:host）と、light 属性で置いたとき（要素名で範囲を限る）の両方に使う
 * @param {string} hostSelector
 * @param {(selector: string) => string} scope
 */
function listStyles(hostSelector, scope) {
  const host = unsafeCSS(hostSelector);
  const s = (/** @type {string} */ selector) => unsafeCSS(scope(selector));
  return css`
    ${host} {
      display: block;
      max-height: 260px;
      overflow-y: auto;
      font-family: var(--mm-font-family);
      font-size: var(--mm-font-size, 13px);
      color: var(--mm-color-text);
    }
    ${s("[role='listbox']")} {
      margin: 0;
      padding: 2px 0;
    }
    ${s('.group')} {
      padding: 6px 10px 2px;
      font-size: 11px;
      font-weight: bold;
      color: var(--mm-color-muted);
    }
    ${s("[role='option']")} {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      padding: 5px 10px;
      cursor: pointer;
      white-space: nowrap;
    }
    ${s("[role='option'][aria-selected='true']")} {
      background: var(--mm-color-accent-soft);
    }
    ${s('.key')} {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 11px;
      color: var(--mm-color-muted);
      overflow: hidden;
      text-overflow: ellipsis;
    }
    ${s('.empty')} {
      padding: 8px 10px;
      color: var(--mm-color-muted);
    }
    ${s('.group-description')} {
      padding: 0 10px 4px;
      font-size: 11px;
      color: var(--mm-color-muted);
      white-space: normal;
    }
  `;
}

/** light 属性で置いたときのスタイル。:where() で詳細度を 0 にする */
const lightStyles = listStyles(
  ':where(mm-merge-tag-list[light])',
  (selector) => `:where(mm-merge-tag-list[light] ${selector})`,
);

export class MmMergeTagList extends LitElement {
  static properties = {
    tags: { attribute: false },
    query: { attribute: false },
    delimiters: { attribute: false },
    t: { attribute: false },
    _active: { state: true },
  };

  static styles = listStyles(':host', (selector) => selector);

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

  createRenderRoot() {
    return this.hasAttribute('light') ? this : super.createRenderRoot();
  }

  connectedCallback() {
    super.connectedCallback();
    if (this.hasAttribute('light')) adoptStyles(this.getRootNode(), lightStyles);
  }

  /** 一覧（listbox）の id。候補が無いときは null */
  get listboxId() {
    return this.items.length > 0 ? this._id : null;
  }

  /** 選択中の候補（option）の id。候補が無いときは null */
  get activeId() {
    return this.items.length > 0 ? `${this._id}-${this._active}` : null;
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
    // 親の入力欄が aria-controls・aria-activedescendant を合わせる（Shadow DOM の外には出さない）
    this.dispatchEvent(
      new CustomEvent('mm-merge-tag-active', {
        detail: { listboxId: this.listboxId, activeId: this.activeId },
        bubbles: true,
      }),
    );
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
      ${groups.map((group, groupIndex) => {
        const descriptionId = `${this._id}-g${groupIndex}`;
        return html`<div
          role="group"
          aria-label=${group.name ?? this.t('mergeTag.other')}
          aria-describedby=${showHeaders && group.description ? descriptionId : nothing}
        >
          ${
            showHeaders
              ? html`<div class="group" aria-hidden="true">
                  ${group.name ?? this.t('mergeTag.other')}
                </div>`
              : nothing
          }
          ${
            showHeaders && group.description
              ? html`<div class="group-description" id=${descriptionId}>${group.description}</div>`
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
        </div>`;
      })}
    </div>`;
  }
}

define('mm-merge-tag-list', MmMergeTagList);
