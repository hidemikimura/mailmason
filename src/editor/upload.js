// ローカルの画像ファイルのアップロード。
// エディタは画像を保存しない。受け取ったファイルを利用者のフック（onImageUpload）に渡し、
// 返ってきた URL をブロックに設定する（メールの画像は受信者が読める URL に置く必要があるため）。
// アップロード中はファイルの内容を object URL で仮表示する（テンプレートには入れない）
import { findRowIndex, locateBlock, locateColumn } from '../core/model/tree.js';
import { getIn, measureImage, patchAt, setIn } from './util.js';

/** @import { Template } from '../core/model/types.js' */
/** @import { Store } from '../core/store/store.js' */
/** @import { Translate } from './i18n.js' */

/**
 * 画像のアップロード・選択のフックが返す値。
 * - URL の文字列
 * - `{ url, data?, alt? }`: data は画像ブロックの `uploadData` にそのまま保存する任意のオブジェクト（JSON で表せる値）
 * - `{ src, alt? }`: 以前からの形（url と同じ扱い）
 * null / undefined は取り消し
 * @typedef {string | { url: string, data?: Record<string, unknown> | null, alt?: string } | { src: string, data?: Record<string, unknown> | null, alt?: string } | null | undefined} ImageResult
 */

/**
 * 画像のアップロード処理
 * blockId: 画像を入れるブロックの ID。背景画像では行・カラムの ID（メール全体は 'body'）で、target で区別する
 * @typedef {(file: File, context: { blockId: string, target: 'block' | 'row' | 'column' | 'body' }) => Promise<ImageResult>} ImageUploadHook
 */

/**
 * フックの戻り値を { src, alt, data } にそろえる（URL が無ければ null ＝取り消し）
 * @param {ImageResult} result
 * @returns {{ src: string, alt: string, data: Record<string, unknown> | null } | null}
 */
export function pickImage(result) {
  if (typeof result === 'string') return result ? { src: result, alt: '', data: null } : null;
  if (!result || typeof result !== 'object') return null;
  const r = /** @type {Record<string, unknown>} */ (result);
  const src = typeof r.url === 'string' && r.url ? r.url : typeof r.src === 'string' ? r.src : '';
  if (!src) return null;
  const data =
    r.data && typeof r.data === 'object' && !Array.isArray(r.data)
      ? /** @type {Record<string, unknown>} */ (r.data)
      : null;
  return { src, alt: typeof r.alt === 'string' ? r.alt : '', data };
}

/**
 * アップロード先。field は画像の URL を持つ values 内のパス（'src' や 'image.src'）
 * アップロード先。scope が block 以外（背景画像）のとき、blockId は行・カラムの ID（ボディは 'body'）
 * @typedef {{ blockId: string, field: string, scope?: 'block' | 'row' | 'column' | 'body' }} UploadTarget
 */

/**
 * @typedef {Object} UploadState
 * @property {'uploading' | 'error'} status
 * @property {string} field
 * @property {string} [preview] アップロード中の仮表示（object URL）
 * @property {string} [message] 失敗したときの説明
 */

/** アップロードできる画像の形式（メールで広く表示できるもの） */
export const UPLOAD_TYPES = Object.freeze(['image/png', 'image/jpeg', 'image/gif']);

/** 既定の上限（バイト） */
export const DEFAULT_MAX_IMAGE_SIZE = 5 * 1024 * 1024;

/** 画像の URL を持つブロックと、その項目 */
export const IMAGE_FIELDS = Object.freeze({ image: 'src', imageText: 'image.src' });

/**
 * ブロックの種類から画像の項目を返す（画像を持たないブロックは null）
 * @param {string} type
 * @returns {string | null}
 */
export function imageFieldOf(type) {
  return /** @type {Record<string, string>} */ (IMAGE_FIELDS)[type] ?? null;
}

/**
 * ファイルの一覧から画像だけを取り出す（DataTransfer や input の files から）
 * @param {FileList | File[] | null | undefined} files
 * @returns {File[]}
 */
export function imageFiles(files) {
  return [...(files ?? [])].filter((file) => file.type.startsWith('image/'));
}

/**
 * DataTransfer にファイルが含まれるか（dragover の時点では中身を読めないので種類で判断する）
 * @param {DataTransfer | null} data
 */
export function hasFiles(data) {
  return !!data && [...data.types].includes('Files');
}

/**
 * @typedef {Object} UploaderHost
 * @property {() => Store} store
 * @property {() => ImageUploadHook | null} hook
 * @property {() => number} maxSize
 * @property {() => Translate} t
 * @property {(warning: Record<string, unknown> & { code: string, path: string, message: string }) => void} warn
 * @property {(uploads: ReadonlyMap<string, UploadState>) => void} onChange 状態が変わったとき
 */

export class ImageUploader {
  /** @param {UploaderHost} host */
  constructor(host) {
    this.host = host;
    /** @type {Map<string, UploadState>} ブロック ID → 状態 */
    this.uploads = new Map();
    /** @type {Map<string, number>} ブロックごとの最新の依頼（古い結果で上書きしないため） */
    this._tokens = new Map();
    this._seq = 0;
  }

  /** @param {string} blockId @param {UploadState | null} state */
  _set(blockId, state) {
    const prev = this.uploads.get(blockId);
    if (prev?.preview && prev.preview !== state?.preview) URL.revokeObjectURL(prev.preview);
    const next = new Map(this.uploads);
    if (state) next.set(blockId, state);
    else next.delete(blockId);
    this.uploads = next;
    this.host.onChange(next);
  }

  /**
   * アップロードの前に失敗したことを表示する（QR コードが作れなかったときなど）
   * @param {string} blockId
   * @param {string} field
   * @param {string} message
   */
  fail(blockId, field, message) {
    this._set(blockId, { status: 'error', field, message });
  }

  /** 失敗の表示を消す（選択が変わったときなど） */
  clearErrors() {
    if (![...this.uploads.values()].some((s) => s.status === 'error')) return;
    const next = new Map([...this.uploads].filter(([, s]) => s.status !== 'error'));
    this.uploads = next;
    this.host.onChange(next);
  }

  /**
   * ファイルを確かめる。問題があれば説明を返す
   * @param {File} file
   * @returns {{ code: string, message: string } | null}
   */
  check(file) {
    const t = this.host.t();
    if (!UPLOAD_TYPES.includes(file.type)) {
      return { code: 'image-upload-type', message: t('image.errorType') };
    }
    const max = this.host.maxSize();
    if (max > 0 && file.size > max) {
      return {
        code: 'image-upload-size',
        message: t('image.errorSize', { max: Math.round((max / 1024 / 1024) * 10) / 10 }),
      };
    }
    return null;
  }

  /**
   * ファイルをアップロードして、ブロックの画像に設定する
   * @param {File} file
   * @param {UploadTarget} target
   * @param {{ patch?: Record<string, unknown>, measure?: boolean }} [options]
   *   patch: 設定できたときに一緒に values へ入れる値 / measure: 実寸（naturalWidth・naturalHeight）を設定するか（既定 true）
   * @returns {Promise<boolean>} 設定できたか
   */
  async upload(file, target, options = {}) {
    const hook = this.host.hook();
    if (!hook) return false;
    const { blockId, field } = target;
    const scope = target.scope ?? 'block';
    const path = targetPath(target);
    const problem = this.check(file);
    if (problem) {
      this._set(blockId, { status: 'error', field, message: problem.message });
      this.host.warn({
        ...problem,
        path,
        blockId,
        fileName: file.name,
      });
      return false;
    }

    const token = ++this._seq;
    this._tokens.set(blockId, token);
    const preview = URL.createObjectURL(file);
    this._set(blockId, { status: 'uploading', field, preview });
    const measure = scope === 'block' && (options.measure ?? true);
    const size = measure ? await measureImage(preview) : null;

    /** @type {Awaited<ReturnType<ImageUploadHook>>} */
    let result;
    try {
      result = await hook(file, { blockId, target: scope });
    } catch (error) {
      if (this._tokens.get(blockId) !== token) return false;
      const t = this.host.t();
      const detail = error instanceof Error && error.message ? `: ${error.message}` : '';
      this._set(blockId, { status: 'error', field, message: `${t('image.errorFailed')}${detail}` });
      this.host.warn({
        code: 'image-upload-failed',
        path,
        message: `Image upload failed${detail}`,
        blockId,
        fileName: file.name,
        error,
      });
      return false;
    }
    if (this._tokens.get(blockId) !== token) return false; // 後から別の画像が選ばれた
    this._tokens.delete(blockId);
    const done =
      scope === 'block'
        ? this._apply(blockId, field, result, size, options.patch)
        : this._applyBackground(target, result);
    // 仮表示は設定した後に消す（先に消すと一瞬空になる）
    this._set(blockId, null);
    return done;
  }

  /**
   * フックの結果を背景画像（ボディ・行・カラムの設定）に設定する
   * @param {UploadTarget} target field は 'backgroundImage.src' など
   * @param {Awaited<ReturnType<ImageUploadHook>>} result
   */
  _applyBackground(target, result) {
    const picked = pickImage(result);
    if (!picked) return false;
    const store = this.host.store();
    const { template } = store.getState();
    const base = target.field.slice(0, target.field.lastIndexOf('.'));
    const patch = patchAt(base, { src: picked.src, uploadData: picked.data });
    if (target.scope === 'body') {
      store.dispatch({ type: 'updateBodySettings', patch });
    } else if (target.scope === 'row') {
      if (findRowIndex(template, target.blockId) === -1) return false;
      store.dispatch({ type: 'updateRowSettings', rowId: target.blockId, patch });
    } else {
      if (!locateColumn(template, target.blockId)) return false;
      store.dispatch({ type: 'updateColumnSettings', columnId: target.blockId, patch });
    }
    return true;
  }

  /**
   * フックの結果をブロックに設定する
   * @param {string} blockId
   * @param {string} field
   * @param {Awaited<ReturnType<ImageUploadHook>>} result
   * @param {{ width: number, height: number } | null} size
   * @param {Record<string, unknown>} [extra] 一緒に設定する値
   */
  _apply(blockId, field, result, size, extra) {
    const picked = pickImage(result);
    if (!picked) return false; // フックが取り消した
    const store = this.host.store();
    const { template } = store.getState();
    const loc = locateBlock(template, blockId);
    if (!loc) return false; // アップロード中に削除された
    const block = template.body.rows[loc.rowIndex].columns[loc.columnIndex].blocks[loc.blockIndex];
    const base = field.includes('.') ? field.slice(0, field.lastIndexOf('.')) : '';
    const current = /** @type {Record<string, unknown> | undefined} */ (
      base ? getIn(block.values, base) : block.values
    );
    /** @type {Record<string, unknown>} */
    const image = { src: picked.src, uploadData: picked.data }; // data が無ければ前の画像のデータを消す
    if (size) {
      image.naturalWidth = size.width;
      image.naturalHeight = size.height;
    }
    if (picked.alt && !current?.alt) image.alt = picked.alt;
    Object.assign(image, extra);
    /** @type {Record<string, unknown>} */
    let patch = image;
    if (base) {
      // リストの中（'items.0.image' など）は配列ごと差し替える（パッチは配列をマージしないため）
      const top = base.split('.')[0];
      const updated = setIn(block.values, base, { ...current, ...image });
      patch = /\.\d+(\.|$)/.test(base) ? { [top]: updated[top] } : patchAt(base, image);
    }
    store.dispatch({ type: 'updateBlockValues', blockId, patch });
    return true;
  }
}

/**
 * 警告の path（どの項目のアップロードか）
 * @param {UploadTarget} target
 */
function targetPath({ blockId, field, scope = 'block' }) {
  if (scope === 'body') return `body.settings.${field}`;
  if (scope === 'row') return `row(${blockId}).settings.${field}`;
  if (scope === 'column') return `column(${blockId}).settings.${field}`;
  return `block(${blockId}).values.${field}`;
}

/**
 * @param {Template} template
 * @param {string | null} blockId
 * @returns {UploadTarget | null} 画像を持つブロックならアップロード先
 */
export function uploadTargetOf(template, blockId) {
  if (!blockId) return null;
  const loc = locateBlock(template, blockId);
  if (!loc) return null;
  const block = template.body.rows[loc.rowIndex].columns[loc.columnIndex].blocks[loc.blockIndex];
  const field = imageFieldOf(block.type);
  return field ? { blockId, field } : null;
}
