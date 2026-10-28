// ビルドしたバンドルの大きさ（gzip）を表示し、上限を超えたら失敗する（npm run build の後に npm run size）。
// ESM 版は最初に読み込む mailmason.bundle.js と、後から読み込む dist/chunks/ を分けて出す
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));

/** 上限（gzip、KB） */
const BUDGETS = {
  'mailmason.bundle.js': 90,
  'mailmason.iife.js': 110,
};

/** @param {string} path */
const gzipKB = (path) => gzipSync(readFileSync(path), { level: 9 }).length / 1024;

/**
 * ファイルが静的に import する dist/chunks/ のファイル（たどった先も含む）。
 * バンドラーが共通のコードを別ファイルに分けても、最初に読み込む量として数えるため
 * @param {string} file dist からのパス
 * @param {Set<string>} [found]
 * @returns {Set<string>}
 */
function staticChunks(file, found = new Set()) {
  const source = readFileSync(join(dist, file), 'utf8');
  for (const match of source.matchAll(/(?:from|import)\s*"(\.{1,2}\/(?:chunks\/)?[^"]+\.js)"/g)) {
    const name = join(file, '..', match[1]).replace(/\\/g, '/');
    if (!name.startsWith('chunks/') || found.has(name)) continue;
    found.add(name);
    staticChunks(name, found);
  }
  return found;
}

if (!existsSync(join(dist, 'mailmason.bundle.js'))) {
  console.error('dist/ がありません。先に npm run build を実行してください');
  process.exit(1);
}

let failed = false;
const rows = [];
/** 最初に読み込むファイル（本体が静的に import するもの） */
const initial = staticChunks('mailmason.bundle.js');
for (const [file, budget] of Object.entries(BUDGETS)) {
  const parts = file === 'mailmason.bundle.js' ? [file, ...initial] : [file];
  const size = parts.reduce((sum, part) => sum + gzipKB(join(dist, part)), 0);
  const over = size > budget;
  failed ||= over;
  const label =
    parts.length > 1 ? `${file}（最初に読み込む ${parts.length} ファイルの合計）` : file;
  rows.push([label, size, `上限 ${budget}KB${over ? ' を超えています' : ''}`]);
}
const chunks = existsSync(join(dist, 'chunks'))
  ? readdirSync(join(dist, 'chunks')).filter((name) => name.endsWith('.js'))
  : [];
for (const name of chunks.sort()) {
  const path = `chunks/${name}`;
  const note = initial.has(path) ? '最初に読み込む（上の合計に含む）' : '後から読み込む';
  rows.push([path, gzipKB(join(dist, path)), note]);
}

const width = Math.max(...rows.map(([name]) => name.length));
for (const [name, size, note] of rows) {
  console.log(`${name.padEnd(width)}  ${size.toFixed(1).padStart(6)}KB  ${note}`);
}
if (failed) {
  console.error(
    '\nバンドルが上限を超えました。後から読み込めるものが無いか確かめてください（src/editor/lazy.js）',
  );
  process.exit(1);
}
