// 上部のツールバー（Undo / Redo、編集 ⇄ プレビュー、PC / スマホ、利用者が差し込むボタン用のスロット）
import { LitElement, css, html, nothing } from 'lit';
import { icons } from '../icons.js';
import { controls } from '../styles.js';
import { define } from '../context.js';

/** @import { EditorContext } from '../context.js' */

export class MmToolbar extends LitElement {
  static properties = {
    ctx: { attribute: false },
    canUndo: { type: Boolean },
    canRedo: { type: Boolean },
    view: { type: String },
    device: { type: String },
    narrow: { type: Boolean },
    drawer: { type: String },
  };

  static styles = [
    controls,
    css`
      :host {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 6px 10px;
        background: var(--mm-color-surface);
        border-bottom: 1px solid var(--mm-color-border);
      }
      button {
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      svg {
        width: 18px;
        height: 18px;
      }
      .spacer {
        flex: 1;
      }
      .sep {
        width: 1px;
        height: 20px;
        background: var(--mm-color-border);
        margin: 0 4px;
      }
      .segmented {
        display: inline-flex;
      }
      .segmented button {
        border-radius: 0;
        margin-left: -1px;
      }
      .segmented button:first-child {
        border-radius: var(--mm-radius) 0 0 var(--mm-radius);
        margin-left: 0;
      }
      .segmented button:last-child {
        border-radius: 0 var(--mm-radius) var(--mm-radius) 0;
      }
      .segmented button[aria-pressed='true'] {
        position: relative;
      }
    `,
  ];

  constructor() {
    super();
    /** @type {EditorContext} */
    this.ctx = /** @type {any} */ (null);
    this.canUndo = false;
    this.canRedo = false;
    /** @type {'edit' | 'preview'} */
    this.view = 'edit';
    /** @type {'desktop' | 'mobile'} */
    this.device = 'desktop';
    /** 狭い画面（パレットと設定パネルを重ねて表示する） */
    this.narrow = false;
    /** @type {'palette' | 'settings' | null} 狭い画面で開いているパネル */
    this.drawer = null;
  }

  /** 狭い画面で、パレット・設定パネルを開閉するボタン */
  _drawerButtons() {
    const { ctx } = this;
    const button = (/** @type {'palette' | 'settings'} */ name) =>
      html`<button
        type="button"
        data-drawer=${name}
        aria-pressed=${this.drawer === name ? 'true' : 'false'}
        @click=${() => ctx.toggleDrawer(name)}
      >
        ${icons[name]}<span>${ctx.t(`toolbar.${name}`)}</span>
      </button>`;
    return html`${button('palette')} ${button('settings')}<span class="sep"></span>`;
  }

  /**
   * 押された状態を持つボタンの組
   * @param {string} label グループの名前
   * @param {{ value: string, icon: unknown, text: string }[]} items
   * @param {string} current
   * @param {(value: string) => void} onSelect
   * @param {string} name
   */
  _segmented(label, items, current, onSelect, name) {
    return html`<div class="segmented" role="group" aria-label=${label} data-group=${name}>
      ${items.map(
        (item) =>
          html`<button
            type="button"
            data-value=${item.value}
            aria-pressed=${item.value === current ? 'true' : 'false'}
            @click=${() => onSelect(item.value)}
          >
            ${item.icon}<span>${item.text}</span>
          </button>`,
      )}
    </div>`;
  }

  render() {
    const { ctx } = this;
    if (!ctx) return nothing;
    const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';
    return html`${this.narrow && this.view === 'edit' ? this._drawerButtons() : nothing}<button
        type="button"
        data-action="undo"
        title=${`${ctx.t('toolbar.undo')} (${mod}Z)`}
        ?disabled=${!this.canUndo}
        @click=${() => ctx.store.undo()}
      >
        ${icons.undo}<span class="sr-only">${ctx.t('toolbar.undo')}</span>
      </button>
      <button
        type="button"
        data-action="redo"
        title=${`${ctx.t('toolbar.redo')} (${mod}${mod === '⌘' ? '⇧Z' : 'Y'})`}
        ?disabled=${!this.canRedo}
        @click=${() => ctx.store.redo()}
      >
        ${icons.redo}<span class="sr-only">${ctx.t('toolbar.redo')}</span>
      </button>
      <span class="sep"></span>
      ${this._segmented(
        ctx.t('toolbar.view'),
        [
          { value: 'edit', icon: icons.edit, text: ctx.t('toolbar.edit') },
          { value: 'preview', icon: icons.preview, text: ctx.t('toolbar.preview') },
        ],
        this.view,
        (value) => ctx.setView({ view: /** @type {'edit' | 'preview'} */ (value) }),
        'view',
      )}
      ${
        this.view === 'preview'
          ? this._segmented(
              ctx.t('toolbar.device'),
              [
                { value: 'desktop', icon: icons.desktop, text: ctx.t('toolbar.desktop') },
                { value: 'mobile', icon: icons.mobile, text: ctx.t('toolbar.mobile') },
              ],
              this.device,
              (value) => ctx.setView({ device: /** @type {'desktop' | 'mobile'} */ (value) }),
              'device',
            )
          : nothing
      }
      <span class="spacer"></span>
      <slot></slot>`;
  }
}

define('mm-toolbar', MmToolbar);
