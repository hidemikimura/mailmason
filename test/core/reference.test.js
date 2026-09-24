import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { REFERENCE_FILES, formattedReference } from '../../scripts/reference.js';
import { validate } from '../../src/core/index.js';

const root = fileURLToPath(new URL('../..', import.meta.url));

describe('テンプレート JSON リファレンス', () => {
  it('生成したファイルが最新（スキーマを変えたら npm run docs:reference）', async () => {
    const expected = await formattedReference();
    for (const file of REFERENCE_FILES) {
      expect(readFileSync(`${root}/${file}`, 'utf8'), file).toBe(expected);
    }
  });

  it('例のテンプレートは警告なしで読み込める', async () => {
    const json = /```json\n([\s\S]*?)\n```/.exec(await formattedReference())?.[1] ?? '';
    const result = validate(JSON.parse(json));
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });
});
