// 手書きの型定義（types/core/index.d.ts）が実際のスキーマと合っているかを検査するための
// TypeScript ファイル（test/types/schema.gen.ts）を、スキーマから作る。
// 生成したファイルは npm run typecheck（tsc -p test/types）で型定義と突き合わせる:
//   npm run types:schema            生成して書き込む
//   npm run types:schema -- --check ファイルが最新か確かめる（違えば終了コード 1）
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import prettier from 'prettier';
import {
  blockStyleSchema,
  bodySettingsSchema,
  columnSettingsSchema,
  rowSettingsSchema,
  textPartSchema,
} from '../src/core/model/settings.js';
import { ROW_LAYOUT_NAMES } from '../src/core/model/layout.js';
import { BLOCK_TYPES, getBlockDef } from '../src/core/blocks/registry.js';
import { SOCIAL_SERVICES } from '../src/core/blocks/social.js';

/** @import { Schema } from '../src/core/model/schema.js' */

const root = fileURLToPath(new URL('..', import.meta.url));

/** 書き出し先（リポジトリのルートからの相対パス） */
export const SCHEMA_TYPES_FILE = 'test/types/schema.gen.ts';

/** @param {readonly (string | null)[]} values */
const union = (values) => values.map((v) => JSON.stringify(v)).join(' | ');

/**
 * スキーマを TypeScript の型にする
 * @param {Schema} schema
 * @returns {string}
 */
function typeOf(schema) {
  const info = schema.info ?? { type: 'any' };
  const nullable = info.nullable ? ' | null' : '';
  switch (info.type) {
    case 'string':
    case 'color':
      return `string${nullable}`;
    case 'number':
      return `number${nullable}`;
    case 'boolean':
      return 'boolean';
    case 'oneOf':
      return union(info.values ?? []);
    case 'record':
      return `Record<string, unknown>${nullable}`;
    case 'spacing':
      return '{ top: number; right: number; bottom: number; left: number }';
    case 'object':
      return `{ ${Object.entries(info.shape ?? {})
        .map(([key, child]) => `${key}: ${typeOf(child)};`)
        .join(' ')} }${nullable}`;
    case 'array':
      return `Array<${info.item ? typeOf(info.item) : 'unknown'}>`;
    default:
      return 'unknown';
  }
}

/** @returns {string} */
export function buildSchemaTypes() {
  /** @type {[string, string, Schema][]} 検査名・型定義の型・スキーマ */
  const checks = [
    ['BodySettings', 'BodySettings', bodySettingsSchema],
    ['RowSettings', 'RowSettings', rowSettingsSchema],
    ['ColumnSettings', 'ColumnSettings', columnSettingsSchema],
    ['BlockStyle', 'BlockStyle', blockStyleSchema],
    ['TextPart', 'TextPart', textPartSchema],
    ...BLOCK_TYPES.map(
      (type) =>
        /** @type {[string, string, Schema]} */ ([
          `Values_${type}`,
          `BlockValuesMap['${type}']`,
          /** @type {import('../src/core/blocks/types.js').CoreBlockDef} */ (getBlockDef(type))
            .schema,
        ]),
    ),
  ];
  return `// このファイルは scripts/schema-types.js が作る（手で直さない）。
// スキーマから作った型と、手書きの型定義（types/core/index.d.ts）が同じかを tsc で確かめる
import type {
  BlockStyle,
  BlockValuesMap,
  BodySettings,
  BuiltinBlockType,
  ColumnSettings,
  RowLayout,
  RowSettings,
  SocialService,
  TextPart,
} from '@hidemikimura/mailmason/core';

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

export type Checks = [
${checks.map(([, declared, schema]) => `  Expect<Equal<${declared}, ${typeOf(schema)}>>,`).join('\n')}
  Expect<Equal<BuiltinBlockType, ${union(BLOCK_TYPES)}>>,
  Expect<Equal<RowLayout, ${union(ROW_LAYOUT_NAMES)}>>,
  Expect<Equal<SocialService, ${union(SOCIAL_SERVICES)}>>,
];
`;
}

/** @returns {Promise<string>} prettier で整えた内容 */
export async function formattedSchemaTypes() {
  const config = (await prettier.resolveConfig(`${root}/${SCHEMA_TYPES_FILE}`)) ?? {};
  return prettier.format(buildSchemaTypes(), { ...config, parser: 'typescript' });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const content = await formattedSchemaTypes();
  const path = `${root}/${SCHEMA_TYPES_FILE}`;
  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = readFileSync(path, 'utf8');
    } catch {
      // 無ければ古いとみなす
    }
    if (current !== content) {
      console.error(`${SCHEMA_TYPES_FILE} is out of date. Run: npm run types:schema`);
      process.exit(1);
    }
  } else {
    writeFileSync(path, content);
    console.log(`wrote ${SCHEMA_TYPES_FILE}`);
  }
}
