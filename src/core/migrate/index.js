// テンプレート JSON の読込: バージョン移行 → 正規化
import { MailmasonError } from '../errors.js';
import { TEMPLATE_VERSION } from '../model/factory.js';
import { warn } from '../model/schema.js';
import { isPlainObject } from '../model/utils.js';
import { normalizeTemplate } from './normalize.js';

/** @import { Warning } from '../model/schema.js' */
/** @import { Template } from '../model/types.js' */
/** @import { MergeTagDelimiters } from '../merge-tags.js' */

/**
 * @typedef {Object} MigrateOptions
 * @property {MergeTagDelimiters} [mergeTagDelimiters] リンク先にマージタグだけを書いたリンクを残すため（既定 `{{` `}}`）
 * @property {readonly import('../blocks/types.js').CoreBlockDef[] | null} [blocks] カスタムブロックの定義（渡さないと未知のブロックとして扱う）
 */

/**
 * バージョン n → n+1 への変換関数。`migrations[n]` を順に適用する。
 * 追加するときは変換前後のフィクスチャを必ず用意すること。
 * @type {Record<number, (json: Record<string, unknown>) => Record<string, unknown>>}
 */
const migrations = {};

/**
 * JSON（オブジェクトまたは文字列）を現行バージョンのテンプレートにする。
 * 直せる不備は直して warnings に記録し、テンプレートとして解釈できないときだけ例外を投げる。
 * 入力は変更しない。
 *
 * @param {unknown} input
 * @param {MigrateOptions} [options]
 * @returns {{ template: Template, warnings: Warning[] }}
 * @throws {MailmasonError} invalid-json / invalid-template / invalid-version / unsupported-version
 */
export function migrate(input, options = {}) {
  let json = input;
  if (typeof json === 'string') {
    try {
      json = JSON.parse(json);
    } catch (error) {
      throw new MailmasonError('invalid-json', `Template is not valid JSON: ${String(error)}`);
    }
  }
  if (!isPlainObject(json)) {
    throw new MailmasonError('invalid-template', 'Template must be a JSON object.');
  }

  /** @type {Warning[]} */
  const warnings = [];
  const ctx = { path: '', warnings };

  let version = json.version;
  if (version === undefined) {
    warn({ path: 'version', warnings }, 'missing-version', 'Missing version; assumed current.');
    version = TEMPLATE_VERSION;
  }
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new MailmasonError(
      'invalid-version',
      `Invalid template version ${JSON.stringify(version)}.`,
      {
        path: 'version',
      },
    );
  }
  if (version > TEMPLATE_VERSION) {
    throw new MailmasonError(
      'unsupported-version',
      `Template version ${version} is newer than this library supports (${TEMPLATE_VERSION}).`,
      { path: 'version' },
    );
  }

  /** @type {Record<string, unknown>} */
  let current = structuredClone(json);
  for (let v = version; v < TEMPLATE_VERSION; v++) {
    const step = migrations[v];
    if (!step) {
      throw new MailmasonError('unsupported-version', `No migration from version ${v}.`);
    }
    current = step(current);
  }

  return {
    template: normalizeTemplate(current, ctx, {
      delimiters: options.mergeTagDelimiters,
      blocks: options.blocks ?? null,
    }),
    warnings,
  };
}

/**
 * テンプレートを検証する（読み込まずに問題点だけ知りたいとき）
 * @param {unknown} input
 * @param {MigrateOptions} [options]
 * @returns {{ valid: boolean, warnings: Warning[], error: MailmasonError | null }}
 */
export function validate(input, options = {}) {
  try {
    const { warnings } = migrate(input, options);
    return { valid: warnings.length === 0, warnings, error: null };
  } catch (error) {
    if (error instanceof MailmasonError) return { valid: false, warnings: [], error };
    throw error;
  }
}
