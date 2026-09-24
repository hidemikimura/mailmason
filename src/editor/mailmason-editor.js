import { LitElement, css, html } from 'lit';
import { createBlock, createRow, createTemplate } from '../core/model/factory.js';
import { findRowIndex, locateBlock, locateColumn } from '../core/model/tree.js';
import { migrate } from '../core/migrate/index.js';
import { createStore } from '../core/store/store.js';
import { DEFAULT_DELIMITERS, findMergeTags } from '../core/merge-tags.js';
import {
  HTML_SIZE_WARNING_BYTES,
  renderHtml,
  resolveHtmlOptions,
} from '../core/render-html/index.js';
import { resolveTextPart } from '../core/text-part.js';
import { createTranslator } from './i18n.js';
import { controls, tokens } from './styles.js';
import { DndController } from './dnd/controller.js';
import './components/mm-toolbar.js';
import './components/mm-palette.js';
import './components/mm-canvas.js';
import './components/mm-settings-panel.js';
import './components/mm-preview.js';
import { mergeTagValues } from './util.js';
import { insertBlock, placeBlock, placeRow } from './components/mm-palette.js';
import { DEFAULT_MAX_IMAGE_SIZE, ImageUploader, imageFiles, uploadTargetOf } from './upload.js';
import { getEditorBlockDef } from './blocks/index.js';
import { extractComponent, instantiateComponent } from '../core/components.js';
import { qrSignature, qrStatus } from '../core/blocks/qr.js';
import { QrTooLongError, createQrFile } from './qr.js';

/** @import { Template, BodySettings } from '../core/model/types.js' */
/** @import { Store, StoreState, StoreAction } from '../core/store/store.js' */
/** @import { Warning } from '../core/model/schema.js' */
/** @import { MergeTagDelimiters } from '../core/merge-tags.js' */
/** @import { RenderHtmlOptions } from '../core/render-html/index.js' */
/** @import { RenderTextOptions } from '../core/render-text/index.js' */
/** @import { MergeTag, ImageSelectHook } from './fields/fields.js' */
/** @import { ImageUploadHook, UploadState } from './upload.js' */
/** @import { FileDropTarget } from './dnd/controller.js' */
/** @import { EditorContext } from './context.js' */
/** @import { QrValues } from '../core/blocks/qr.js' */
/** @import { CustomBlock } from '../core/blocks/custom.js' */
/** @import { Component } from '../core/components.js' */

/**
 * コンポーネントを保存するフック。保存したもの（id 付き）を返すと一覧に加える
 * @typedef {(component: Component) => Promise<Component | null | undefined | void>} SaveComponentHook
 */

/**
 * コンポーネントを削除するフック。false を返すと削除を取り消す
 * @typedef {(component: Component) => Promise<boolean | void> | boolean | void} DeleteComponentHook
 */

/**
 * @typedef {Warning & Record<string, unknown>} EditorWarning
 */

const FORM_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** この幅（px）未満では、パレットと設定パネルをキャンバスに重ねて表示する */
export const NARROW_WIDTH = 1024;

/**
 * ノーコードメールエディタ本体 `<mailmason-editor>`。
 *
 * @fires mm-ready 初期化完了時
 * @fires mm-change 編集内容が変わったとき（1 フレームに 1 回まで）。detail: `{ template, actions }`
 * @fires mm-select 選択が変わったとき。detail: `{ id, kind }`（kind は 'row' | 'column' | 'block' | null）
 * @fires mm-warning 読込時の補正・未定義のマージタグ・HTML の大きさなどの警告。detail: 警告
 * @fires mm-view ツールバーで表示（編集 ⇄ プレビュー、PC ⇄ スマホ）を切り替えたとき。detail: `{ view, device }`
 * @csspart toolbar / palette / canvas / settings / preview
 * @slot toolbar ツールバーの右端に置く要素（保存ボタンなど）
 */
export class MailmasonEditor extends LitElement {
  static properties = {
    theme: { attribute: false },
    locale: { type: String },
    messages: { attribute: false },
    mergeTags: { attribute: false },
    mergeTagDelimiters: { attribute: false },
    onImageSelect: { attribute: false },
    onImageUpload: { attribute: false },
    blocks: { attribute: false },
    components: { attribute: false },
    onSaveComponent: { attribute: false },
    onDeleteComponent: { attribute: false },
    maxImageSize: { type: Number, attribute: 'max-image-size' },
    socialIconBaseUrl: { type: String, attribute: 'social-icon-base-url' },
    outlookFontFamily: { type: String, attribute: 'outlook-font-family' },
    historyLimit: { type: Number, attribute: 'history-limit' },
    colorMode: { type: String, attribute: 'color-mode', reflect: true },
    view: { type: String, reflect: true },
    previewDevice: { type: String, attribute: 'preview-device', reflect: true },
    _state: { state: true },
    _editing: { state: true },
    _narrow: { state: true },
    _uploads: { state: true },
    _drawer: { state: true },
  };

  static styles = [
    tokens,
    controls,
    css`
      :host {
        display: block;
        height: 100%;
        min-height: 480px;
        background: var(--mm-color-bg);
        overflow: hidden;
      }
      .layout {
        display: grid;
        grid-template-rows: auto 1fr;
        height: 100%;
      }
      .main[hidden] {
        display: none;
      }
      /* 狭い画面: キャンバスだけを並べ、パレットと設定パネルは開いたときだけ重ねて出す */
      :host([narrow]) .main {
        grid-template-columns: minmax(0, 1fr);
        position: relative;
      }
      :host([narrow]) mm-palette,
      :host([narrow]) mm-settings-panel {
        display: none;
        position: absolute;
        top: 0;
        bottom: 0;
        z-index: 20;
        box-shadow: 0 0 16px rgba(0, 0, 0, 0.2);
      }
      :host([narrow]) mm-palette {
        left: 0;
        width: var(--mm-palette-width);
      }
      :host([narrow]) mm-settings-panel {
        right: 0;
        width: min(var(--mm-panel-width), 100%);
      }
      :host([narrow]) mm-palette[open],
      :host([narrow]) mm-settings-panel[open] {
        display: block;
      }
      mm-preview {
        min-height: 0;
      }
      .main {
        display: grid;
        grid-template-columns: var(--mm-palette-width) minmax(0, 1fr) var(--mm-panel-width);
        min-height: 0;
      }
      mm-palette,
      mm-canvas,
      mm-settings-panel {
        min-height: 0;
      }
      :host([dragging]) {
        cursor: grabbing;
        user-select: none;
        -webkit-user-select: none;
      }
      .mm-drop-indicator {
        position: fixed;
        z-index: 1000;
        pointer-events: none;
        background: var(--mm-color-accent);
        border-radius: 2px;
        box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.8);
      }
      .mm-drop-indicator.box {
        background: var(--mm-color-accent-soft);
        border: 2px dashed var(--mm-color-accent);
        box-sizing: border-box;
        box-shadow: none;
      }
      .mm-drag-ghost {
        position: fixed;
        left: 0;
        top: 0;
        z-index: 1001;
        pointer-events: none;
        padding: 4px 10px;
        border-radius: var(--mm-radius);
        background: var(--mm-color-accent);
        color: var(--mm-color-accent-text);
        font: 12px/1.5 var(--mm-font-family);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
        white-space: nowrap;
      }
    `,
  ];

  constructor() {
    super();
    /** @type {Partial<BodySettings>} 新規テンプレートの既定デザイン（読み込んだ JSON には適用しない） */
    this.theme = {};
    /** 表示言語（'ja' | 'en'） */
    this.locale = 'ja';
    /** @type {Record<string, string>} UI 文言の部分上書き */
    this.messages = {};
    /** @type {MergeTag[]} 差し込み変数の候補 */
    this.mergeTags = [];
    /** @type {MergeTagDelimiters} */
    this.mergeTagDelimiters = DEFAULT_DELIMITERS;
    /** @type {ImageSelectHook | null} 画像の「選択…」ボタンで呼ぶフック。URL を返す */
    this.onImageSelect = null;
    /** @type {ImageUploadHook | null} ローカルの画像ファイルを受け取ってアップロードし、URL を返すフック */
    this.onImageUpload = null;
    /** @type {readonly CustomBlock[]} カスタムブロックの定義（defineBlock() の戻り値の配列） */
    this.blocks = [];
    /** @type {readonly Component[]} 保存したコンポーネント（行・ブロック）の一覧。パレットの「保存済み」に出す */
    this.components = [];
    /** @type {SaveComponentHook | null} 「コンポーネントとして保存」で呼ぶ。アプリが保存し、id を付けたコンポーネントを返す */
    this.onSaveComponent = null;
    /** @type {DeleteComponentHook | null} パレットの「保存済み」で削除するときに呼ぶ。false を返すと取り消し */
    this.onDeleteComponent = null;
    /** アップロードできる画像の大きさの上限（バイト。0 で無制限） */
    this.maxImageSize = DEFAULT_MAX_IMAGE_SIZE;
    /** SNS アイコン PNG の置き場所（空ならテキストリンク） */
    this.socialIconBaseUrl = '';
    /** Outlook（Windows）用のフォント */
    this.outlookFontFamily = 'Arial, sans-serif';
    /** 保持する履歴の上限 */
    this.historyLimit = 100;
    /** エディタ UI の明暗（'light' | 'dark' | 'auto'） */
    this.colorMode = 'light';
    /** @type {'edit' | 'preview'} 表示中の画面 */
    this.view = 'edit';
    /** @type {'desktop' | 'mobile'} プレビューの表示幅 */
    this.previewDevice = 'desktop';

    /** @type {Store | null} */
    this._store = null;
    /** @type {StoreState | null} 接続時にストアを作ってから入れる（historyLimit などの設定を待つため） */
    this._state = null;
    /** @type {string | null} キャンバス上で直接編集中のブロック ID */
    this._editing = null;
    /** 狭い画面か（NARROW_WIDTH 未満） */
    this._narrow = false;
    /** @type {'palette' | 'settings' | null} 狭い画面で開いているパネル */
    this._drawer = null;
    /** @type {ResizeObserver | null} */
    this._resizeObserver = null;
    this._uploader = new ImageUploader({
      store: () => this.store,
      hook: () => this.onImageUpload,
      maxSize: () => this.maxImageSize,
      t: () => this._context().t,
      warn: (warning) => this._warn(warning),
      onChange: (uploads) => {
        this._uploads = uploads;
      },
    });
    /** @type {ReadonlyMap<string, UploadState>} アップロードの状態（ブロック ID ごと） */
    this._uploads = this._uploader.uploads;
    /** テンプレートが明示的に読み込まれたか（theme を新規テンプレートにだけ適用するため） */
    this._loaded = false;
    /** @type {string[]} まだ通知していない変更のアクション */
    this._pendingActions = [];
    this._changeScheduled = false;
    /** @type {{ key: string, value: EditorContext } | null} */
    this._ctxCache = null;
    const host = this;
    this._dnd = new DndController({
      context: () => this._context(),
      canvas: () => /** @type {any} */ (this.renderRoot?.querySelector('mm-canvas') ?? null),
      get overlayRoot() {
        return /** @type {ShadowRoot} */ (host.renderRoot);
      },
      element: this,
      // 狭い画面では、ドロップ先が隠れないようにパレットを閉じる
      onBegin: () => {
        if (this._drawer === 'palette') this._drawer = null;
      },
    });

    this.addEventListener('keydown', (event) => this._onKeydown(event));
    this.addEventListener('paste', (event) => this._onPaste(event));
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this._state) this._state = this.store.getState();
    if (typeof ResizeObserver === 'function') {
      this._resizeObserver = new ResizeObserver((entries) => {
        const width = entries[entries.length - 1].contentRect.width;
        if (width > 0) this._setNarrow(width < NARROW_WIDTH);
      });
      this._resizeObserver.observe(this);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
  }

  /** @param {boolean} narrow */
  _setNarrow(narrow) {
    if (narrow === this._narrow) return;
    this._narrow = narrow;
    this.toggleAttribute('narrow', narrow);
    if (!narrow) this._drawer = null;
  }

  /** 内部のストア（初回アクセス時に作る） */
  get store() {
    if (!this._store) {
      this._store = createStore(createTemplate(this.theme), {
        historyLimit: this.historyLimit,
        blocks: () => this.blocks,
      });
      this._store.subscribe((state, prev, action, warnings) =>
        this._onStoreChange(state, prev, action, warnings),
      );
    }
    return this._store;
  }

  /** 現在のテンプレート（コピー）。代入すると読み込む */
  get template() {
    return this.getJson();
  }

  set template(value) {
    this.loadJson(value);
  }

  /**
   * @param {StoreState} state
   * @param {StoreState} prev
   * @param {StoreAction} action
   * @param {Warning[]} warnings
   */
  _onStoreChange(state, prev, action, warnings) {
    this._state = state;
    // 選択が変わったとき・編集中のブロックが消えたときは直接編集を終える
    if (
      this._editing &&
      (state.selection !== this._editing || !locateBlock(state.template, this._editing))
    ) {
      this._editing = null;
    }
    for (const warning of warnings) this._warn(warning);
    // 狭い画面でパレットから追加したら、結果が見えるようにパレットを閉じる
    if (
      this._drawer === 'palette' &&
      (action.type === 'addBlock' || action.type === 'addRow') &&
      state.template !== prev.template
    ) {
      this._drawer = null;
    }
    if (state.template !== prev.template && action.type !== 'loadTemplate') {
      this._pendingActions.push(action.type);
      this._scheduleChange();
    }
    if (state.selection !== prev.selection) {
      this._uploader.clearErrors();
      this.dispatchEvent(
        new CustomEvent('mm-select', {
          detail: { id: state.selection, kind: this._kindOf(state.selection) },
          bubbles: true,
          composed: true,
        }),
      );
    }
  }

  _scheduleChange() {
    if (this._changeScheduled) return;
    this._changeScheduled = true;
    requestAnimationFrame(() => {
      this._changeScheduled = false;
      const actions = this._pendingActions;
      this._pendingActions = [];
      this.dispatchEvent(
        new CustomEvent('mm-change', {
          // テンプレートはイミュータブルなので、そのまま渡す（変更しないこと）
          detail: { template: this.store.getState().template, actions },
          bubbles: true,
          composed: true,
        }),
      );
    });
  }

  /** @param {EditorWarning} warning */
  _warn(warning) {
    this.dispatchEvent(
      new CustomEvent('mm-warning', { detail: warning, bubbles: true, composed: true }),
    );
  }

  /**
   * @param {string | null} id
   * @returns {'row' | 'column' | 'block' | null}
   */
  _kindOf(id) {
    if (!id) return null;
    const { template } = this.store.getState();
    if (locateBlock(template, id)) return 'block';
    if (locateColumn(template, id)) return 'column';
    if (findRowIndex(template, id) !== -1) return 'row';
    return null;
  }

  /** @param {Map<string, unknown>} changed */
  willUpdate(changed) {
    // プレビューに切り替えたら直接編集を終える
    if (changed.has('view') && this.view === 'preview') this._editing = null;
    // 何も読み込んでいなければ、theme を新規テンプレートに反映する
    if (changed.has('theme') && !this._loaded && !this.store.canUndo()) {
      this.store.dispatch({ type: 'loadTemplate', template: createTemplate(this.theme) });
    }
    // 読み込んだ後にカスタムブロックの定義が渡されたら、そのブロックの値を定義に沿って整え直す
    if (changed.has('blocks') && changed.get('blocks') !== undefined) this._renormalize();
  }

  firstUpdated() {
    this.dispatchEvent(new CustomEvent('mm-ready', { bubbles: true, composed: true }));
  }

  // ---- 公開 API -------------------------------------------------------------

  /**
   * テンプレートを読み込む（JSON 文字列も可）。直した箇所は mm-warning で通知し、戻り値でも返す。
   * 履歴はクリアされる
   * @param {unknown} json
   * @returns {Warning[]}
   * @throws {import('../core/errors.js').MailmasonError} テンプレートとして解釈できないとき
   */
  loadJson(json) {
    const { template, warnings } = migrate(json, {
      mergeTagDelimiters: this.mergeTagDelimiters,
      blocks: this.blocks,
    });
    this.store.dispatch({ type: 'loadTemplate', template });
    this._loaded = true;
    for (const warning of warnings) this._warn(warning);
    return warnings;
  }

  /**
   * 現在のテンプレート（呼び出し側で変更しても内部に影響しない）
   * @returns {Template}
   */
  getJson() {
    return structuredClone(this.store.getState().template);
  }

  /**
   * 配信用 HTML。未定義のマージタグや大きさの警告は mm-warning で通知する
   * @param {RenderHtmlOptions} [options]
   * @returns {string}
   */
  exportHtml(options = {}) {
    const { template } = this.store.getState();
    this._checkMergeTags(template);
    this._checkQrCodes(template);
    const html = renderHtml(template, {
      ...this._htmlDefaults(),
      ...options,
      mergeValues: this._withFallbacks(options.mergeValues),
    });
    const bytes = new TextEncoder().encode(html).length;
    if (bytes > HTML_SIZE_WARNING_BYTES) {
      this._warn({
        code: 'html-size',
        path: '',
        message: `HTML is ${Math.round(bytes / 1024)}KB; Gmail clips messages over about 102KB. Consider minify: true.`,
        bytes,
      });
    }
    return html;
  }

  /**
   * テキストパート（手編集があればそれ、無ければ自動生成）
   * @param {RenderTextOptions} [options]
   * @returns {string}
   */
  exportText(options = {}) {
    const { template } = this.store.getState();
    this._checkMergeTags(template);
    const part = resolveTextPart(template, {
      locale: this.locale,
      mergeTagDelimiters: this.mergeTagDelimiters,
      blocks: this.blocks,
      ...options,
      mergeValues: this._withFallbacks(options.mergeValues),
    });
    if (part.stale) {
      this._warn({
        code: 'stale-text',
        path: 'text',
        message: 'The manual text part was edited before the latest HTML changes.',
      });
    }
    return part.text;
  }

  /**
   * HTML とテキストをまとめて出力する
   * @param {{ html?: RenderHtmlOptions, text?: RenderTextOptions }} [options]
   * @returns {{ html: string, text: string }}
   */
  export(options = {}) {
    return { html: this.exportHtml(options.html), text: this.exportText(options.text) };
  }

  /**
   * コンポーネント（保存した行・ブロック）を複製して入れる。
   * 選択中の要素の後ろ（行は選択中の要素を含む行の直後）に入れ、入れた要素を選択する
   * @param {Component} component
   * @returns {string | null} 入れた行・ブロックの ID（入れられなければ null。理由は mm-warning）
   */
  insertComponent(component) {
    const result = this._instantiate(component);
    if (!result) return null;
    const ctx = this._context();
    return result.kind === 'row' ? placeRow(ctx, result.row) : placeBlock(ctx, result.block);
  }

  /** @returns {boolean} */
  undo() {
    return this.store.undo();
  }

  /** @returns {boolean} */
  redo() {
    return this.store.redo();
  }

  /** @returns {boolean} */
  canUndo() {
    return this.store.canUndo();
  }

  /** @returns {boolean} */
  canRedo() {
    return this.store.canRedo();
  }

  /**
   * 要素を選択する（null で選択解除）
   * @param {string | null} id
   */
  select(id) {
    this.store.select(id);
  }

  // ---- 内部 -----------------------------------------------------------------

  /**
   * 差し込みの値に、候補の既定値（fallback）を補う。値を渡されなければ置換しない（null）
   * @param {Record<string, string> | null | undefined} values
   * @returns {Record<string, string> | null}
   */
  _withFallbacks(values) {
    if (!values) return null;
    return { ...mergeTagValues(this.mergeTags, 'fallback'), ...values };
  }

  /**
   * 画像ファイルを新しい画像ブロックにする（アップロードは呼び出し側）
   * @returns {import('../core/model/types.js').Block}
   */
  _newImageBlock() {
    const def = getEditorBlockDef('image');
    return createBlock('image', def?.initialValues?.(this._context().t) ?? {});
  }

  /**
   * QR ブロックの PNG を作って onImageUpload でアップロードし、URL を src に設定する
   * @param {string} blockId
   * @returns {Promise<boolean>} 設定できたか
   */
  async _generateQr(blockId) {
    if (!this.onImageUpload) return false;
    const { template } = this.store.getState();
    const loc = locateBlock(template, blockId);
    if (!loc) return false;
    const block = template.body.rows[loc.rowIndex].columns[loc.columnIndex].blocks[loc.blockIndex];
    if (block.type !== 'qr') return false;
    const values = /** @type {QrValues} */ (/** @type {unknown} */ (block.values));
    if (!values.content) return false;
    /** @type {File} */
    let file;
    try {
      file = await createQrFile(values);
    } catch (error) {
      const tooLong = error instanceof QrTooLongError;
      const t = this._context().t;
      this._uploader.fail(blockId, 'src', t(tooLong ? 'qr.errorTooLong' : 'qr.errorFailed'));
      this._warn({
        code: tooLong ? 'qr-too-long' : 'qr-failed',
        path: `block(${blockId}).values.content`,
        message: tooLong ? 'The QR content is too long.' : 'Failed to create the QR code.',
        blockId,
        error,
      });
      return false;
    }
    return this._uploader.upload(
      file,
      { blockId, field: 'src' },
      { measure: false, patch: { generated: qrSignature(values) } },
    );
  }

  /**
   * キャンバスに落とした画像ファイルを、差し替えまたは新しい画像ブロックにしてアップロードする
   * @param {FileDropTarget} target
   * @param {File[]} files
   */
  _dropImageFiles(target, files) {
    const images = imageFiles(files);
    if (images.length === 0) {
      // 画像以外のファイル: 形式の案内を出す
      if (files[0]) this._reportInvalid(files[0]);
      return;
    }
    const { store } = this;
    if (target.kind === 'replace') {
      const upload = uploadTargetOf(store.getState().template, target.blockId);
      if (upload) {
        store.select(target.blockId);
        void this._uploader.upload(images[0], upload);
      }
      return;
    }
    const valid = images.filter((file) => {
      const problem = this._uploader.check(file);
      if (problem) this._reportInvalid(file);
      return !problem;
    });
    if (valid.length === 0) return;
    const blocks = valid.map(() => this._newImageBlock());
    if (target.kind === 'column') {
      blocks.forEach((block, i) =>
        store.dispatch({
          type: 'addBlock',
          columnId: target.columnId,
          index: target.index + i,
          block,
        }),
      );
    } else {
      store.dispatch({
        type: 'addRow',
        row: createRow('1', [blocks]),
        index: target.index,
      });
    }
    store.select(blocks[0].id);
    blocks.forEach(
      (block, i) => void this._uploader.upload(valid[i], { blockId: block.id, field: 'src' }),
    );
  }

  /**
   * 使えないファイルの警告（ブロックは作らない）
   * @param {File} file
   */
  _reportInvalid(file) {
    const problem = this._uploader.check(file) ?? {
      code: 'image-upload-type',
      message: this._context().t('image.errorType'),
    };
    this._warn({ ...problem, path: '', fileName: file.name });
  }

  /**
   * クリップボードの画像を貼り付ける。画像を持つブロックを選択中なら差し替え、それ以外は画像ブロックを追加する
   * @param {ClipboardEvent} event
   */
  _onPaste(event) {
    if (!this.onImageUpload || this.view !== 'edit' || this._editing) return;
    const origin = /** @type {HTMLElement | undefined} */ (event.composedPath()[0]);
    if (origin && (FORM_TAGS.has(origin.tagName) || origin.isContentEditable)) return;
    const files = imageFiles(event.clipboardData?.files);
    if (files.length === 0) return;
    event.preventDefault();
    const { template, selection } = this.store.getState();
    const target = uploadTargetOf(template, selection);
    if (target) {
      void this._uploader.upload(files[0], target);
      return;
    }
    const problem = this._uploader.check(files[0]);
    if (problem) {
      this._reportInvalid(files[0]);
      return;
    }
    const blockId = insertBlock(this._context(), 'image');
    void this._uploader.upload(files[0], { blockId, field: 'src' });
  }

  /**
   * 表示を切り替える（ツールバーから）。変わったら mm-view を発火する
   * @param {{ view?: 'edit' | 'preview', device?: 'desktop' | 'mobile' }} change
   */
  _setView(change) {
    const view = change.view ?? this.view;
    const device = change.device ?? this.previewDevice;
    if (view === this.view && device === this.previewDevice) return;
    this.view = view;
    this.previewDevice = device;
    this.dispatchEvent(
      new CustomEvent('mm-view', { detail: { view, device }, bubbles: true, composed: true }),
    );
  }

  /** @returns {RenderHtmlOptions} */
  _htmlDefaults() {
    return {
      locale: this.locale,
      mergeTagDelimiters: this.mergeTagDelimiters,
      socialIconBaseUrl: this.socialIconBaseUrl,
      outlookFontFamily: this.outlookFontFamily,
      blocks: this.blocks,
    };
  }

  /**
   * コンポーネントを行・ブロックにする。直した箇所は mm-warning で知らせ、入れられなければ null
   * @param {Component} component
   * @returns {ReturnType<typeof instantiateComponent> | null}
   */
  _instantiate(component) {
    try {
      const result = instantiateComponent(component, {
        blocks: this.blocks,
        mergeTagDelimiters: this.mergeTagDelimiters,
      });
      for (const warning of result.warnings) this._warn({ ...warning, componentId: component?.id });
      return result;
    } catch (error) {
      this._warn({
        code: 'invalid-component',
        path: '',
        message: `Cannot insert the component: ${error instanceof Error ? error.message : String(error)}`,
        componentId: component?.id,
        error,
      });
      return null;
    }
  }

  /**
   * 行・ブロックをコンポーネントとして保存する（保存はアプリのフックに任せる）
   * @param {string} id 行またはブロックの ID
   * @param {string} name
   * @returns {Promise<Component>} 保存したコンポーネント。失敗したら例外（mm-warning も発火）
   */
  async _saveComponent(id, name) {
    if (!this.onSaveComponent) throw new Error('onSaveComponent is not set.');
    const component = extractComponent(this.store.getState().template, id, { name });
    if (!component) throw new Error(`Row or block "${id}" was not found.`);
    try {
      const saved = await this.onSaveComponent(structuredClone(component));
      const result = saved && typeof saved === 'object' ? saved : component;
      if (result.id && !this.components.some((c) => c.id === result.id)) {
        this.components = [...this.components, result];
      }
      return result;
    } catch (error) {
      this._warn({
        code: 'component-save-failed',
        path: '',
        message: `Saving the component failed: ${error instanceof Error ? error.message : String(error)}`,
        error,
      });
      throw error;
    }
  }

  /**
   * コンポーネントを一覧から削除する（アプリのフックが false を返したら取り消し）
   * @param {Component} component
   */
  async _deleteComponent(component) {
    if (!this.onDeleteComponent) return;
    try {
      if ((await this.onDeleteComponent(component)) === false) return;
    } catch (error) {
      this._warn({
        code: 'component-delete-failed',
        path: '',
        message: `Deleting the component failed: ${error instanceof Error ? error.message : String(error)}`,
        componentId: component.id,
        error,
      });
      return;
    }
    this.components = this.components.filter(
      (c) => c !== component && (component.id === undefined || c.id !== component.id),
    );
  }

  /**
   * カスタムブロックの定義が変わったとき、テンプレートにあるそのブロックの値を整え直す
   * （定義より先に loadJson したテンプレートでも、既定値の補完や不正値の修正が効くように）。
   * 変化が無ければ何もしない。変化があれば履歴はクリアされる
   */
  _renormalize() {
    if (!this._store) return;
    const custom = new Set(this.blocks.map((def) => def.type));
    const { template } = this.store.getState();
    const uses = template.body.rows.some((row) =>
      row.columns.some((column) => column.blocks.some((block) => custom.has(block.type))),
    );
    if (!uses) return;
    const { template: next, warnings } = migrate(template, {
      mergeTagDelimiters: this.mergeTagDelimiters,
      blocks: this.blocks,
    });
    if (JSON.stringify(next) === JSON.stringify(template)) return;
    this.store.dispatch({ type: 'loadTemplate', template: next });
    for (const warning of warnings) this._warn(warning);
  }

  /**
   * 未作成・作成後に設定が変わった QR コードを警告する（書き出しの HTML には今ある画像が入る）
   * @param {Template} template
   */
  _checkQrCodes(template) {
    for (const row of template.body.rows) {
      for (const column of row.columns) {
        for (const block of column.blocks) {
          if (block.type !== 'qr') continue;
          const status = qrStatus(block);
          if (status === 'missing' || status === 'stale') {
            this._warn({
              code: status === 'missing' ? 'qr-missing' : 'qr-stale',
              path: `block(${block.id}).values.src`,
              message:
                status === 'missing'
                  ? 'The QR code image has not been created.'
                  : 'The QR code settings changed after the image was created.',
              blockId: block.id,
            });
          }
        }
      }
    }
  }

  /** @param {Template} template */
  _checkMergeTags(template) {
    if (this.mergeTags.length === 0) return;
    const known = new Set(this.mergeTags.map((tag) => tag.key));
    const reported = new Set();
    for (const usage of findMergeTags(template, {
      delimiters: this.mergeTagDelimiters,
      blocks: this.blocks,
    })) {
      if (known.has(usage.key) || reported.has(usage.key)) continue;
      reported.add(usage.key);
      this._warn({
        code: 'unknown-merge-tag',
        path: usage.blockId ? `block(${usage.blockId}).values.${usage.field}` : usage.field,
        message: `Merge tag "${usage.key}" is not in mergeTags.`,
        key: usage.key,
        blockId: usage.blockId,
      });
    }
  }

  /** @returns {EditorContext} */
  _context() {
    const key = JSON.stringify([
      this.locale,
      this.messages,
      this.mergeTags,
      this.mergeTagDelimiters,
      this.socialIconBaseUrl,
      this.outlookFontFamily,
    ]);
    if (
      this._ctxCache?.key === key &&
      this._ctxCache.value.onImageSelect === this.onImageSelect &&
      this._ctxCache.value.onImageUpload === this.onImageUpload &&
      this._ctxCache.value.blocks === this.blocks &&
      this._ctxCache.value.components === this.components &&
      this._ctxCache.value.canSaveComponents === Boolean(this.onSaveComponent) &&
      this._ctxCache.value.canDeleteComponents === Boolean(this.onDeleteComponent)
    ) {
      return this._ctxCache.value;
    }
    /** @type {EditorContext} */
    const value = {
      store: this.store,
      t: createTranslator(this.locale, this.messages),
      locale: this.locale,
      htmlOptions: resolveHtmlOptions(this._htmlDefaults()),
      blocks: this.blocks,
      components: this.components,
      canSaveComponents: Boolean(this.onSaveComponent),
      canDeleteComponents: Boolean(this.onDeleteComponent),
      saveComponent: (id, name) => this._saveComponent(id, name),
      deleteComponent: (component) => void this._deleteComponent(component),
      insertComponent: (component) => this.insertComponent(component),
      instantiateComponent: (component) => this._instantiate(component),
      mergeTags: this.mergeTags,
      delimiters: this.mergeTagDelimiters,
      onImageSelect: this.onImageSelect,
      onImageUpload: this.onImageUpload,
      upload: (file, target) => void this._uploader.upload(file, target),
      generateQr: (blockId) => void this._generateQr(blockId),
      dropImageFiles: (target, files) => this._dropImageFiles(target, files),
      dnd: this._dnd,
      edit: (id) => this._edit(id),
      setView: (change) => this._setView(change),
      toggleDrawer: (name) => {
        this._drawer = this._drawer === name ? null : name;
      },
    };
    this._ctxCache = { key, value };
    return value;
  }

  /**
   * テキストの直接編集を開始・終了する
   * @param {string | null} id
   */
  _edit(id) {
    if (id) {
      const { template } = this.store.getState();
      const loc = locateBlock(template, id);
      if (!loc) return;
      this.store.select(id);
    }
    this._editing = id;
  }

  /** @param {KeyboardEvent} event */
  _onKeydown(event) {
    const origin = /** @type {HTMLElement | undefined} */ (event.composedPath()[0]);
    if (origin && (FORM_TAGS.has(origin.tagName) || origin.isContentEditable)) return;

    const { store } = this;
    const mod = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();
    const { template, selection } = store.getState();

    if (mod && key === 'z') {
      event.preventDefault();
      if (event.shiftKey) store.redo();
      else store.undo();
      return;
    }
    if (mod && key === 'y') {
      event.preventDefault();
      store.redo();
      return;
    }
    // プレビュー中は見えない要素を消したり動かしたりしないよう、Undo / Redo 以外は受け付けない
    if (this.view === 'preview') return;
    if (event.key === 'Escape') {
      if (this._drawer) this._drawer = null;
      else store.select(null);
      return;
    }
    if (!selection) return;

    const block = locateBlock(template, selection);
    const rowIndex = findRowIndex(template, selection);

    if (event.key === 'Enter' && block && !this._editing) {
      const { type } =
        template.body.rows[block.rowIndex].columns[block.columnIndex].blocks[block.blockIndex];
      if (type === 'text' || type === 'imageText') {
        event.preventDefault();
        this._edit(selection);
      }
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      if (block) store.dispatch({ type: 'removeBlock', blockId: selection });
      else if (rowIndex !== -1) store.dispatch({ type: 'removeRow', rowId: selection });
      return;
    }
    if (mod && key === 'd') {
      event.preventDefault();
      if (block) store.dispatch({ type: 'duplicateBlock', blockId: selection });
      else if (rowIndex !== -1) store.dispatch({ type: 'duplicateRow', rowId: selection });
      return;
    }
    if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      const delta = event.key === 'ArrowUp' ? -1 : 1;
      if (block) {
        const column = template.body.rows[block.rowIndex].columns[block.columnIndex];
        const to = block.blockIndex + delta;
        if (to >= 0 && to < column.blocks.length) {
          store.dispatch({ type: 'moveBlock', blockId: selection, columnId: column.id, index: to });
        }
      } else if (rowIndex !== -1) {
        const to = rowIndex + delta;
        if (to >= 0 && to < template.body.rows.length) {
          store.dispatch({ type: 'moveRow', rowId: selection, index: to });
        }
      }
    }
  }

  render() {
    const ctx = this._context();
    const { template, selection } = this._state ?? this.store.getState();
    return html`<div class="layout">
      <mm-toolbar
        part="toolbar"
        .ctx=${ctx}
        .canUndo=${this.store.canUndo()}
        .canRedo=${this.store.canRedo()}
        .view=${this.view}
        .device=${this.previewDevice}
        .narrow=${this._narrow}
        .drawer=${this._drawer}
      >
        <slot name="toolbar"></slot>
      </mm-toolbar>
      <div class="main" ?hidden=${this.view === 'preview'}>
        <mm-palette part="palette" ?open=${this._drawer === 'palette'} .ctx=${ctx}></mm-palette>
        <mm-canvas
          part="canvas"
          tabindex="0"
          .template=${template}
          .selection=${selection}
          .editing=${this._editing}
          .uploads=${this._uploads}
          .ctx=${ctx}
        ></mm-canvas>
        <mm-settings-panel
          part="settings"
          ?open=${this._drawer === 'settings'}
          .template=${template}
          .selection=${selection}
          .uploads=${this._uploads}
          .ctx=${ctx}
        ></mm-settings-panel>
      </div>
      <mm-preview
        part="preview"
        ?hidden=${this.view !== 'preview'}
        .active=${this.view === 'preview'}
        .device=${this.previewDevice}
        .template=${template}
        .ctx=${ctx}
      ></mm-preview>
    </div>`;
  }
}
