import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * test/fixtures/templates/<name>.json を読み込む（毎回新しいオブジェクト）
 * @param {string} name
 */
export function loadFixture(name) {
  const url = new URL(`../fixtures/templates/${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(fileURLToPath(url), 'utf8'));
}
