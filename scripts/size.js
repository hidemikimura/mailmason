// ビルドしたバンドルの大きさ（gzip）を表示し、上限を超えたら失敗する（npm run build の後に npm run size）。
// ESM 版は最初に読み込む mailmason.bundle.js と、後から読み込む dist/chunks/ を分けて出す
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));

/** 上限（gzip、KB） */
const BUDGETS = {
  'mailmason.bundle.js': 85,
  'mailmason.iife.js': 105,
};

/** @param {string} path */
const gzipKB = (path) => gzipSync(readFileSync(path), { level: 9 }).length / 1024;

if (!existsSync(join(dist, 'mailmason.bundle.js'))) {
  console.error('dist/ がありません。先に npm run build を実行してください');
  process.exit(1);
}

let failed = false;
const rows = [];
for (const [file, budget] of Object.entries(BUDGETS)) {
  const size = gzipKB(join(dist, file));
  const over = size > budget;
  failed ||= over;
  rows.push([file, size, `上限 ${budget}KB${over ? ' を超えています' : ''}`]);
}
const chunks = existsSync(join(dist, 'chunks'))
  ? readdirSync(join(dist, 'chunks')).filter((name) => name.endsWith('.js'))
  : [];
for (const name of chunks.sort()) {
  rows.push([`chunks/${name}`, gzipKB(join(dist, 'chunks', name)), '後から読み込む']);
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
