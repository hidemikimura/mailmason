// ドラッグ&ドロップの制御（Pointer Events で自前実装）。
// - 4px 以上動いたらドラッグ開始（それ未満はクリックとして扱う）
// - 開始時に行・カラム・ブロックの矩形を測ってキャッシュし、スクロールしたときだけ測り直す
// - ドラッグ中はストアを変更せず、挿入線を 1 本だけ動かす。pointerup でコマンドを 1 回だけ発行する
// - キャンバスの上下端 48px に入ったら自動スクロール、Esc で中止
import { createBlock, createRow } from '../../core/model/factory.js';
import { locateBlock } from '../../core/model/tree.js';
import { getEditorBlockDef } from '../blocks/index.js';
import { findDropTarget } from './target.js';

/** @import { DragPayload, DropTarget, Geometry, Indicator } from './target.js' */
/** @import { EditorContext } from '../context.js' */

const THRESHOLD = 4;
const SCROLL_EDGE = 48;
const SCROLL_MAX_SPEED = 18;

/**
 * @typedef {Object} DndHost
 * @property {() => EditorContext} context
 * @property {() => (HTMLElement & { geometry(): Geometry, elementFor(id: string): HTMLElement | null }) | null} canvas
 * @property {ShadowRoot} overlayRoot 挿入線とゴーストを置く場所
 * @property {HTMLElement} element ドラッグ中に [dragging] 属性を付ける要素
 * @property {() => void} [onBegin] ドラッグを開始したとき（狭い画面で開いているパネルを閉じるため）
 */

export class DndController {
  /** @param {DndHost} host */
  constructor(host) {
    this.host = host;
    /** @type {{ payload: DragPayload, x: number, y: number, pointerId: number, source: Element | null } | null} */
    this.pending = null;
    /** @type {{ payload: DragPayload, x: number, y: number, target: DropTarget | null } | null} */
    this.drag = null;
    /** @type {Geometry | null} */
    this.geometry = null;
    /** @type {DOMRect | null} */
    this.canvasBox = null;
    /** @type {HTMLElement | null} */
    this.indicator = null;
    /** @type {HTMLElement | null} */
    this.ghost = null;
    /** @type {HTMLElement | null} */
    this.sourceElement = null;
    this.frame = 0;

    this._onMove = this._onMove.bind(this);
    this._onUp = this._onUp.bind(this);
    this._onCancel = this._onCancel.bind(this);
    this._onKey = this._onKey.bind(this);
    this._onScroll = this._onScroll.bind(this);
    this._tick = this._tick.bind(this);
  }

  /** ドラッグ中か */
  get active() {
    return this.drag !== null;
  }

  /**
   * pointerdown で呼ぶ。動かさずに離せば通常のクリックになる
   * @param {PointerEvent} event
   * @param {DragPayload} payload
   */
  start(event, payload) {
    if (event.button !== 0 || this.pending || this.drag) return;
    this.pending = {
      payload,
      x: event.clientX,
      y: event.clientY,
      pointerId: event.pointerId,
      source: /** @type {Element | null} */ (event.currentTarget),
    };
    window.addEventListener('pointermove', this._onMove);
    window.addEventListener('pointerup', this._onUp);
    window.addEventListener('pointercancel', this._onCancel);
    window.addEventListener('keydown', this._onKey, true);
  }

  /** @param {PointerEvent} event */
  _onMove(event) {
    if (this.pending && !this.drag) {
      const dx = event.clientX - this.pending.x;
      const dy = event.clientY - this.pending.y;
      if (Math.hypot(dx, dy) < THRESHOLD) return;
      this._begin();
    }
    if (!this.drag) return;
    event.preventDefault();
    this._update(event.clientX, event.clientY);
  }

  _begin() {
    const pending = /** @type {NonNullable<typeof this.pending>} */ (this.pending);
    try {
      pending.source?.setPointerCapture(pending.pointerId);
    } catch {
      // 合成イベントなどでポインタが有効でないときは捕捉しない
    }
    this.drag = { payload: pending.payload, x: pending.x, y: pending.y, target: null };
    this.host.element.toggleAttribute('dragging', true);
    this.host.onBegin?.();

    const root = this.host.overlayRoot;
    this.indicator = document.createElement('div');
    this.indicator.className = 'mm-drop-indicator';
    this.indicator.hidden = true;
    this.ghost = document.createElement('div');
    this.ghost.className = 'mm-drag-ghost';
    this.ghost.textContent = this._label(pending.payload);
    root.append(this.indicator, this.ghost);

    const canvas = this.host.canvas();
    const sourceId =
      pending.payload.kind === 'move-block'
        ? pending.payload.blockId
        : pending.payload.kind === 'move-row'
          ? pending.payload.rowId
          : null;
    this.sourceElement = sourceId && canvas ? canvas.elementFor(sourceId) : null;
    this.sourceElement?.toggleAttribute('dragging', true);

    canvas?.addEventListener('scroll', this._onScroll);
    this._measure();
    this.frame = requestAnimationFrame(this._tick);
  }

  _measure() {
    const canvas = this.host.canvas();
    this.geometry = canvas ? canvas.geometry() : null;
    this.canvasBox = canvas ? canvas.getBoundingClientRect() : null;
  }

  /**
   * @param {number} x
   * @param {number} y
   */
  _update(x, y) {
    const drag = /** @type {NonNullable<typeof this.drag>} */ (this.drag);
    drag.x = x;
    drag.y = y;
    if (this.ghost) this.ghost.style.transform = `translate(${x + 14}px, ${y + 14}px)`;

    const box = this.canvasBox;
    const inside = box && x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    if (!inside || !this.geometry) {
      drag.target = null;
      this._showIndicator(null);
      return;
    }
    const hit = findDropTarget(this.geometry, drag.payload, x, y);
    drag.target = hit.target;
    this._showIndicator(hit.indicator);
  }

  /** @param {Indicator | null} indicator */
  _showIndicator(indicator) {
    const el = this.indicator;
    if (!el) return;
    if (!indicator) {
      el.hidden = true;
      return;
    }
    el.hidden = false;
    el.classList.toggle('box', indicator.type === 'box');
    Object.assign(el.style, {
      left: `${indicator.left}px`,
      top: `${indicator.type === 'box' ? indicator.top : indicator.top - 2}px`,
      width: `${indicator.width}px`,
      height: indicator.type === 'box' ? `${indicator.height}px` : '4px',
    });
  }

  _onScroll() {
    if (!this.drag) return;
    this._measure();
    this._update(this.drag.x, this.drag.y);
  }

  /** 端に近ければ自動スクロールする */
  _tick() {
    if (!this.drag) return;
    const canvas = this.host.canvas();
    const box = this.canvasBox;
    if (canvas && box) {
      const { y } = this.drag;
      let speed = 0;
      if (y < box.top + SCROLL_EDGE && y >= box.top - SCROLL_EDGE) {
        speed = -Math.ceil(((box.top + SCROLL_EDGE - y) / SCROLL_EDGE) * SCROLL_MAX_SPEED);
      } else if (y > box.bottom - SCROLL_EDGE && y <= box.bottom + SCROLL_EDGE) {
        speed = Math.ceil(((y - (box.bottom - SCROLL_EDGE)) / SCROLL_EDGE) * SCROLL_MAX_SPEED);
      }
      if (speed !== 0) canvas.scrollTop += speed;
    }
    this.frame = requestAnimationFrame(this._tick);
  }

  /** @param {PointerEvent} _event */
  _onUp(_event) {
    if (this.drag) {
      const { target, payload } = this.drag;
      this._end();
      if (target) this._drop(payload, target);
      this._suppressNextClick();
    } else {
      this._end();
    }
  }

  _onCancel() {
    this._end();
  }

  /** @param {KeyboardEvent} event */
  _onKey(event) {
    if (event.key !== 'Escape' || !this.drag) return;
    event.preventDefault();
    event.stopPropagation();
    this._end();
    this._suppressNextClick();
  }

  /** ドラッグの直後に起きるクリック（パレットの「クリックで追加」など）を 1 回だけ無効にする */
  _suppressNextClick() {
    /** @param {MouseEvent} event */
    const swallow = (event) => {
      event.stopPropagation();
      event.preventDefault();
    };
    window.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
  }

  _end() {
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerup', this._onUp);
    window.removeEventListener('pointercancel', this._onCancel);
    window.removeEventListener('keydown', this._onKey, true);
    this.host.canvas()?.removeEventListener('scroll', this._onScroll);
    cancelAnimationFrame(this.frame);
    this.indicator?.remove();
    this.ghost?.remove();
    this.sourceElement?.toggleAttribute('dragging', false);
    this.host.element.toggleAttribute('dragging', false);
    this.indicator = null;
    this.ghost = null;
    this.sourceElement = null;
    this.pending = null;
    this.drag = null;
    this.geometry = null;
  }

  /** @param {DragPayload} payload */
  _label(payload) {
    const { t, store } = this.host.context();
    switch (payload.kind) {
      case 'new-block': {
        const def = getEditorBlockDef(payload.type);
        return def ? t(def.labelKey) : payload.type;
      }
      case 'new-row':
        return t(`layout.${payload.layout}`);
      case 'move-row':
        return t('crumb.row');
      case 'move-block': {
        const { template } = store.getState();
        const loc = locateBlock(template, payload.blockId);
        const type = loc
          ? template.body.rows[loc.rowIndex].columns[loc.columnIndex].blocks[loc.blockIndex].type
          : '';
        const def = getEditorBlockDef(type);
        return def ? t(def.labelKey) : type;
      }
    }
  }

  /**
   * ドロップを 1 つのコマンドにする
   * @param {DragPayload} payload
   * @param {DropTarget} target
   */
  _drop(payload, target) {
    const { store, t } = this.host.context();
    switch (payload.kind) {
      case 'new-block': {
        const def = getEditorBlockDef(payload.type);
        const block = createBlock(payload.type, def?.initialValues?.(t) ?? {});
        if (target.kind === 'column') {
          store.dispatch({
            type: 'addBlock',
            columnId: target.columnId,
            index: target.index,
            block,
          });
        } else {
          store.dispatch({ type: 'addRow', row: createRow('1', [[block]]), index: target.index });
        }
        store.select(block.id);
        break;
      }
      case 'new-row': {
        if (target.kind !== 'rowGap') return;
        const row = createRow(payload.layout);
        store.dispatch({ type: 'addRow', row, index: target.index });
        store.select(row.id);
        break;
      }
      case 'move-block':
        if (target.kind === 'column') {
          store.dispatch({
            type: 'moveBlock',
            blockId: payload.blockId,
            columnId: target.columnId,
            index: target.index,
          });
        } else {
          store.dispatch({
            type: 'moveBlockToNewRow',
            blockId: payload.blockId,
            index: target.index,
          });
        }
        store.select(payload.blockId);
        break;
      case 'move-row':
        if (target.kind !== 'rowGap') return;
        store.dispatch({ type: 'moveRow', rowId: payload.rowId, index: target.index });
        store.select(payload.rowId);
        break;
    }
  }
}
