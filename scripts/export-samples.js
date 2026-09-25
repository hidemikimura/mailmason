// 実機確認用のサンプルを書き出す: npm run samples [-- テンプレート.json ...] [--icons <URL>] [--out <フォルダ>]
//
// テンプレートごとに次のファイルを作る（既定の出力先は samples/）
//   <名前>.html      整形した配信用 HTML（マージタグのまま）
//   <名前>.min.html  minify した配信用 HTML
//   <名前>.txt       テキストパート
//   <名前>.eml       HTML とテキストのマルチパートメール（サンプル値を差し込み済み）。
//                    Outlook（Windows / Mac）や Apple Mail で開くと、送信しなくても表示を確認できる
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { migrate, renderHtml, renderText, resolveTextPart } from '../src/core/index.js';

const root = fileURLToPath(new URL('..', import.meta.url));

/** プレビュー用のサンプル値（テンプレートで使うマージタグに合わせて増やしてよい） */
const SAMPLE_VALUES = {
  name: '山田 太郎',
  unsubscribe_url: 'https://example.com/unsubscribe',
  coupon: 'AUTUMN2026',
};

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {{ files: string[], icons: string, out: string }} */
  const args = { files: [], icons: '', out: join(root, 'samples') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--icons') args.icons = argv[++i] ?? '';
    else if (argv[i] === '--out') args.out = resolve(argv[++i] ?? 'samples');
    else args.files.push(resolve(argv[i]));
  }
  if (args.files.length === 0) {
    args.files = ['basic', 'kitchen-sink', 'content-blocks', 'backgrounds', 'tables'].map((name) =>
      join(root, 'test/fixtures/templates', `${name}.json`),
    );
  }
  return args;
}

/**
 * base64 を 76 文字ごとに改行する（メールの 1 行の長さの上限に収めるため）
 * @param {string} value
 */
function base64Lines(value) {
  return (
    Buffer.from(value, 'utf8')
      .toString('base64')
      .match(/.{1,76}/g)
      ?.join('\r\n') ?? ''
  );
}

/**
 * ヘッダー用の文字列（非 ASCII は MIME エンコード）
 * @param {string} value
 */
function encodeHeader(value) {
  return /^[\x20-\x7e]*$/.test(value)
    ? value
    : `=?UTF-8?B?${Buffer.from(value, 'utf8').toString('base64')}?=`;
}

/**
 * multipart/alternative のメール（.eml）を組み立てる
 * @param {{ subject: string, html: string, text: string }} mail
 */
function buildEml({ subject, html, text }) {
  const boundary = `mailmason-${Date.now().toString(36)}`;
  return [
    'From: Mailmason Sample <sample@example.com>',
    'To: you@example.com',
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(text),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    base64Lines(html),
    '',
    `--${boundary}--`,
    '',
  ].join('\r\n');
}

const args = parseArgs(process.argv.slice(2));
mkdirSync(args.out, { recursive: true });

for (const file of args.files) {
  const name = basename(file, extname(file));
  const { template, warnings } = migrate(readFileSync(file, 'utf8'));
  for (const warning of warnings) console.warn(`[${name}] ${warning.code}: ${warning.message}`);
  const htmlOptions = { socialIconBaseUrl: args.icons };

  const html = renderHtml(template, htmlOptions);
  const minified = renderHtml(template, { ...htmlOptions, minify: true });
  const { text, stale } = resolveTextPart(template);
  if (stale) console.warn(`[${name}] テキストパートの手編集が本文より古くなっています`);

  writeFileSync(join(args.out, `${name}.html`), html);
  writeFileSync(join(args.out, `${name}.min.html`), minified);
  writeFileSync(join(args.out, `${name}.txt`), text);
  writeFileSync(
    join(args.out, `${name}.eml`),
    buildEml({
      subject: `[Mailmason] ${template.body.settings.title || name}`,
      html: renderHtml(template, { ...htmlOptions, minify: true, mergeValues: SAMPLE_VALUES }),
      text:
        template.text.mode === 'manual'
          ? resolveTextPart(template, { mergeValues: SAMPLE_VALUES }).text
          : renderText(template, { mergeValues: SAMPLE_VALUES }),
    }),
  );
  const kb = (Buffer.byteLength(minified) / 1024).toFixed(1);
  console.log(`${name}: ${join(args.out, name)}.{html,min.html,txt,eml}（minify ${kb}KB）`);
}
