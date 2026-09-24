#!/usr/bin/env node
// Mailmason のテンプレート JSON を検査し、必要なら HTML とテキストパートを書き出す。
//
//   node validate.mjs <template.json> [--html out.html] [--text out.txt] [--values values.json]
//                     [--delimiters "{{,}}"] [--blocks blocks.mjs]
//
// --blocks: カスタムブロックの定義（defineBlock() の戻り値）の配列を `blocks` または default で export するモジュール
//
// 警告が無ければ終了コード 0、警告があれば 1、読み込めなければ 2。
// @hidemikimura/mailmason がインストールされたプロジェクトの中で実行する。
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/** @type {any} */
let core;
try {
  core = await import('@hidemikimura/mailmason/core');
} catch {
  console.error(
    '@hidemikimura/mailmason が見つかりません。プロジェクトで `npm install @hidemikimura/mailmason` してから実行してください。',
  );
  process.exit(2);
}

const args = process.argv.slice(2);
/** @param {string} name */
const option = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? null : (args[i + 1] ?? null);
};
const file = args.find((arg, i) => !arg.startsWith('--') && !args[i - 1]?.startsWith('--'));
if (!file) {
  console.error('使い方: node validate.mjs <template.json> [--html out.html] [--text out.txt]');
  process.exit(2);
}

const [open, close] = (option('--delimiters') ?? '{{,}}').split(',');
const mergeTagDelimiters = { open, close };
const values = option('--values') ? JSON.parse(readFileSync(option('--values'), 'utf8')) : null;
/** @type {any[]} */
let customBlocks = [];
if (option('--blocks')) {
  const mod = await import(pathToFileURL(resolve(option('--blocks'))).href);
  customBlocks = mod.blocks ?? mod.default ?? [];
  if (!Array.isArray(customBlocks)) {
    console.error(
      '--blocks のモジュールは、定義の配列を blocks か default で export してください。',
    );
    process.exit(2);
  }
}

const source = readFileSync(file, 'utf8');
const { valid, warnings, error } = core.validate(source, {
  mergeTagDelimiters,
  blocks: customBlocks,
});
if (error) {
  console.error(`読み込めません（${error.code}）: ${error.message}`);
  process.exit(2);
}

const { template } = core.migrate(source, { mergeTagDelimiters, blocks: customBlocks });
const blocks = template.body.rows.flatMap((row) => row.columns.flatMap((c) => c.blocks));
const types = Object.entries(
  blocks.reduce((acc, b) => ({ ...acc, [b.type]: (acc[b.type] ?? 0) + 1 }), {}),
)
  .map(([type, n]) => `${type}×${n}`)
  .join(' ');
const tags = [
  ...new Set(
    core
      .findMergeTags(template, { delimiters: mergeTagDelimiters, blocks: customBlocks })
      .map((u) => u.key),
  ),
];
const html = core.renderHtml(template, {
  minify: true,
  mergeTagDelimiters,
  mergeValues: values,
  blocks: customBlocks,
});
const kb = (Buffer.byteLength(html) / 1024).toFixed(1);

console.log(`行 ${template.body.rows.length} / ブロック ${blocks.length}（${types || 'なし'}）`);
console.log(`マージタグ: ${tags.length ? tags.join(', ') : 'なし'}`);
console.log(
  `HTML（minify）: ${kb}KB${Number(kb) > 90 ? '  ※ Gmail は約 102KB を超えると省略します' : ''}`,
);

const empty = blocks.filter(
  (b) =>
    ((b.type === 'image' || b.type === 'qr') && !b.values.src) ||
    (b.type === 'button' && !b.values.label) ||
    (b.type === 'text' && !b.values.html),
);
for (const b of empty) console.log(`注意: ${b.id}（${b.type}）は中身が空なので出力されません`);
const noAlt = blocks.filter(
  (b) => (b.type === 'image' || b.type === 'qr') && b.values.src && !b.values.alt,
);
for (const b of noAlt) console.log(`注意: ${b.id} の画像に代替テキスト（alt）がありません`);
const staleQr = blocks.filter((b) => b.type === 'qr' && core.qrStatus?.(b) === 'stale');
for (const b of staleQr) {
  console.log(
    `注意: ${b.id}（qr）は画像を作った後に内容や色が変わっています（エディタで作り直すか、generated を qrSignature(values) の値にする）`,
  );
}

if (option('--html')) {
  writeFileSync(
    option('--html'),
    core.renderHtml(template, { mergeTagDelimiters, mergeValues: values, blocks: customBlocks }),
  );
  console.log(`HTML を書き出しました: ${option('--html')}`);
}
if (option('--text')) {
  writeFileSync(
    option('--text'),
    core.resolveTextPart(template, {
      mergeTagDelimiters,
      mergeValues: values,
      blocks: customBlocks,
    }).text,
  );
  console.log(`テキストを書き出しました: ${option('--text')}`);
}

if (valid) {
  console.log('OK: 警告はありません');
} else {
  console.log(
    `警告 ${warnings.length} 件（読み込み時に自動で直されます。直してから保存してください）:`,
  );
  for (const w of warnings) console.log(`- [${w.code}] ${w.path}: ${w.message}`);
  process.exit(1);
}
