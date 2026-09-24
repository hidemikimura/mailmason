// ローカルの画像ファイルのアップロード。
// エディタは画像を保存しない。受け取ったファイルを利用者のフック（onImageUpload）に渡し、
// 返ってきた URL をブロックに設定する（メールの画像は受信者が読める URL に置く必要があるため）。
// アップロード中はファイルの内容を object URL で仮表示する（テンプレートには入れない）
import { locateBlock } from '../core/model/tree.js';
import { measureImage, patchAt } from './util.js';

/** @import { Template } from '../core/model/types.js' */
/** @import { Store } from '../core/store/store.js' */
/** @import { Translate } from './i18n.js' */

/**
 * 画像のアップロード処理。URL（または { src, alt }）を返す
 * @typedef {(file: File, context: { blockId: string }) => Promise<string | { src: string, alt?: string } | null | undefined>} ImageUploadHook
 */

/**
 * アップロード先。field は画像の URL を持つ values 内のパス（'src' や 'image.src'）
 * @typedef {{ blockId: string, field: string }} UploadTarget
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
   * @returns {Promise<boolean>} 設定できたか
   */
  async upload(file, target) {
    const hook = this.host.hook();
    if (!hook) return false;
    const { blockId, field } = target;
    const problem = this.check(file);
    if (problem) {
      this._set(blockId, { status: 'error', field, message: problem.message });
      this.host.warn({
        ...problem,
        path: `block(${blockId}).values.${field}`,
        blockId,
        fileName: file.name,
      });
      return false;
    }

    const token = ++this._seq;
    this._tokens.set(blockId, token);
    const preview = URL.createObjectURL(file);
    this._set(blockId, { status: 'uploading', field, preview });
    const size = await measureImage(preview);

    /** @type {Awaited<ReturnType<ImageUploadHook>>} */
    let result;
    try {
      result = await hook(file, { blockId });
    } catch (error) {
      if (this._tokens.get(blockId) !== token) return false;
      const t = this.host.t();
      const detail = error instanceof Error && error.message ? `: ${error.message}` : '';
      this._set(blockId, { status: 'error', field, message: `${t('image.errorFailed')}${detail}` });
      this.host.warn({
        code: 'image-upload-failed',
        path: `block(${blockId}).values.${field}`,
        message: `Image upload failed${detail}`,
        blockId,
        fileName: file.name,
        error,
      });
      return false;
    }
    if (this._tokens.get(blockId) !== token) return false; // 後から別の画像が選ばれた
    this._tokens.delete(blockId);
    const done = this._apply(blockId, field, result, size);
    // 仮表示は設定した後に消す（先に消すと一瞬空になる）
    this._set(blockId, null);
    return done;
  }

  /**
   * フックの結果をブロックに設定する
   * @param {string} blockId
   * @param {string} field
   * @param {Awaited<ReturnType<ImageUploadHook>>} result
   * @param {{ width: number, height: number } | null} size
   */
  _apply(blockId, field, result, size) {
    const picked = typeof result === 'string' ? { src: result } : result;
    if (!picked?.src) return false; // フックが取り消した
    const store = this.host.store();
    const { template } = store.getState();
    const loc = locateBlock(template, blockId);
    if (!loc) return false; // アップロード中に削除された
    const block = template.body.rows[loc.rowIndex].columns[loc.columnIndex].blocks[loc.blockIndex];
    const base = field.includes('.') ? field.slice(0, field.lastIndexOf('.')) : '';
    const current = /** @type {Record<string, unknown>} */ (
      base ? /** @type {any} */ (block.values)[base] : block.values
    );
    /** @type {Record<string, unknown>} */
    const image = { src: picked.src };
    if (size) {
      image.naturalWidth = size.width;
      image.naturalHeight = size.height;
    }
    if (picked.alt && !current?.alt) image.alt = picked.alt;
    store.dispatch({
      type: 'updateBlockValues',
      blockId,
      patch: base ? patchAt(base, image) : image,
    });
    return true;
  }
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
