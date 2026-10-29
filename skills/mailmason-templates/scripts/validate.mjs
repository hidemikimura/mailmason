#!/usr/bin/env node
// Mailmason のテンプレート JSON を検査し、必要なら HTML とテキストパートを書き出す。
//
//   node validate.mjs <template.json> [--html out.html] [--text out.txt] [--values values.json]
//                     [--delimiters "{{,}}"] [--blocks blocks.mjs] [--text-options text-options.json]
//
// --blocks: カスタムブロックの定義（defineBlock() の戻り値）の配列を `blocks` または default で export するモジュール
// --text-options: テキストパートの作り方（エディタの textOptions と同じ。textVariant・textTemplates・wrapWidth など）の JSON
//
// 警告（スキーマに合わない値など）か、テキストパートの指定の文の知らない参照（{@名前}）があれば終了コード 1、
// 無ければ 0、読み込めなければ 2。「注意」・「メモ」は終了コードに影響しない。
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
/** テキストパートの作り方（エディタの textOptions と同じ値を渡す） */
const textOptions = option('--text-options')
  ? JSON.parse(readFileSync(option('--text-options'), 'utf8'))
  : {};
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
for (const b of noAlt) {
  console.log(
    `メモ: ${b.id} の画像は代替テキスト（alt）が空です。ロゴなど飾りの画像ならこのままでよい（テキストパートにも出ません）。内容を伝える画像なら alt を書いてください`,
  );
}
const staleQr = blocks.filter((b) => b.type === 'qr' && core.qrStatus?.(b) === 'stale');
for (const b of staleQr) {
  console.log(
    `注意: ${b.id}（qr）は画像を作った後に内容や色が変わっています（エディタで作り直すか、generated を qrSignature(values) の値にする）`,
  );
}

// テキストパート（エディタと同じ作り方で確かめる。差し込み前）
const textBase = { ...textOptions, mergeTagDelimiters, blocks: customBlocks };
const part = core.resolveTextPart(template, textBase);
for (const ref of part.unknownRefs ?? []) {
  console.log(
    `エラー: ${ref.blockId} のテキストパートの指定の文（または textTemplates）が、このブロックに無い {@${ref.name}} を参照しています`,
  );
}
for (const id of part.staleBlockIds ?? []) {
  console.log(
    `注意: ${id} のテキストパートの指定の文は、指定した後にブロックの内容が変わっています（利用者に確認してもらう）`,
  );
}
if (part.mode === 'manual' && part.stale) {
  const counts = part.diff
    ? `（本文の変更: +${part.diff.added} 行 / −${part.diff.removed} 行）`
    : '';
  console.log(
    `注意: テキストパートは全文が手で直されていて、その後に本文が変わっています${counts}。利用者に確認してもらう`,
  );
}
const unknownRefCount = part.unknownRefs?.length ?? 0;

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
    core.resolveTextPart(template, { ...textBase, mergeValues: values }).text,
  );
  console.log(`テキストを書き出しました: ${option('--text')}`);
}

if (valid && unknownRefCount === 0) {
  console.log('OK: 警告はありません');
} else {
  if (!valid) {
    console.log(
      `警告 ${warnings.length} 件（読み込み時に自動で直されます。直してから保存してください）:`,
    );
    for (const w of warnings) console.log(`- [${w.code}] ${w.path}: ${w.message}`);
  }
  if (unknownRefCount > 0) {
    console.log(
      `エラー ${unknownRefCount} 件: 参照は書いたまま出力されます。参照できる名前は schema.md の「テキストパートの参照」を見てください`,
    );
  }
  process.exit(1);
}
