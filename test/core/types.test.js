// 手書きの型定義（types/）と実装がずれていないかを確かめる。
// 型の中身（values の形など）は test/types の tsc（npm run typecheck）で検査する
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import * as core from '../../src/core/index.js';
import { SCHEMA_TYPES_FILE, formattedSchemaTypes } from '../../scripts/schema-types.js';

const root = fileURLToPath(new URL('../..', import.meta.url));
const read = (/** @type {string} */ path) => readFileSync(`${root}/${path}`, 'utf8');

/**
 * 型定義で宣言している値（関数・定数・クラス）の名前
 * @param {string} source
 */
function declaredValues(source) {
  return [
    ...new Set(
      [...source.matchAll(/^export declare (?:function|const|class) (\w+)/gm)].map((m) => m[1]),
    ),
  ].sort();
}

describe('型定義', () => {
  it('core の型定義は、実装が export する値をすべて宣言している（余分も無い）', () => {
    expect(declaredValues(read('types/core/index.d.ts'))).toEqual(Object.keys(core).sort());
  });

  it('エディタの型定義は core をそのまま再 export し、MailmasonEditor を宣言している', () => {
    const types = read('types/index.d.ts');
    const entry = read('src/index.js');
    expect(types).toContain("export * from './core/index.js';");
    expect(entry).toContain("export * from './core/index.js';");
    expect(declaredValues(types)).toEqual(['MailmasonEditor']);
    expect(entry).toMatch(/export \{ MailmasonEditor \}/);
    expect(types).toContain("'mailmason-editor': MailmasonEditor;");
  });

  it('エディタの公開プロパティとイベントを型定義に書いている', () => {
    const types = read('types/index.d.ts');
    const source = read('src/editor/mailmason-editor.js');
    const properties = /static properties = \{([\s\S]*?)\n {2}\};/.exec(source)?.[1] ?? '';
    const publicProps = [...properties.matchAll(/^ {4}(\w+):/gm)]
      .map((m) => m[1])
      .filter((name) => !name.startsWith('_'));
    expect(publicProps.length).toBeGreaterThan(10);
    for (const name of publicProps) expect(types, name).toMatch(new RegExp(`^  ${name}: `, 'm'));
    const events = [
      ...new Set([...source.matchAll(/new CustomEvent\('(mm-[\w-]+)'/g)].map((m) => m[1])),
    ];
    for (const name of events) expect(types, name).toContain(`'${name}': CustomEvent<`);
  });

  it(`${SCHEMA_TYPES_FILE} が最新（スキーマを変えたら npm run types:schema）`, async () => {
    expect(read(SCHEMA_TYPES_FILE)).toBe(await formattedSchemaTypes());
  });

  it('package.json の types が手書きの型定義を指している', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.types).toBe('./types/index.d.ts');
    expect(pkg.exports['.'].types).toBe('./types/index.d.ts');
    expect(pkg.exports['./core'].types).toBe('./types/core/index.d.ts');
    expect(pkg.files).toContain('types');
    expect(pkg.scripts['build:types']).toBeUndefined();
  });
});
