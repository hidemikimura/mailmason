// 実機確認用のテストメールを送る: npm run samples:send [-- テンプレート.json ...] [オプション]
//
// SMTP の設定は環境変数か、リポジトリ直下の .env.samples（Git 管理外）に書く（.env.samples.example を参照）。
//
// オプション:
//   --to a@example.com,b@example.com  宛先（MAIL_TO より優先）
//   --dry-run                          送らずに samples/sent/ へ .eml を書き出す
//   --image-base <URL>                 サンプル画像の置き場所（既定はドキュメントサイトの demo/）
//   --icons <URL>                      SNS アイコン PNG の置き場所（socialIconBaseUrl）
//   --embed                            サンプル画像を公開 URL ではなくメールに埋め込む（cid:）
//
// テンプレートの画像 URL（https://example.com/images/*）は、受信者が読めるサンプル画像に差し替え、
// 差し込み変数にはサンプル値を入れて、HTML（minify）とテキストパートのマルチパートで送る。
// 送る前に画像の URL が読めるか確かめ、読めなければ送らない（GitHub Pages への反映前など）。
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import nodemailer from 'nodemailer';
import { migrate, renderHtml, resolveTextPart } from '../src/core/index.js';

const root = fileURLToPath(new URL('..', import.meta.url));

const DEFAULT_TEMPLATES = [
  'test/fixtures/templates/basic.json',
  'skills/mailmason-templates/examples/newsletter.json',
  'skills/mailmason-templates/examples/announcement.json',
  'test/fixtures/templates/kitchen-sink.json',
  'test/fixtures/templates/content-blocks.json',
];

const DEFAULT_IMAGE_BASE = 'https://hidemikimura.github.io/mailmason/demo/';

/** サンプル値（テンプレートで使うマージタグに合わせて増やしてよい） */
const SAMPLE_VALUES = {
  name: '山田 太郎',
  unsubscribe_url: 'https://example.com/unsubscribe',
  coupon: 'AUTUMN2026',
};

/** @param {string[]} argv */
function parseArgs(argv) {
  /** @type {{ files: string[], to: string, dryRun: boolean, imageBase: string, icons: string, embed: boolean }} */
  const args = {
    files: [],
    to: '',
    dryRun: false,
    imageBase: DEFAULT_IMAGE_BASE,
    icons: '',
    embed: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--to') args.to = argv[++i] ?? '';
    else if (arg === '--dry-run') args.dryRun = true;
    else if (arg === '--image-base') args.imageBase = argv[++i] ?? DEFAULT_IMAGE_BASE;
    else if (arg === '--icons') args.icons = argv[++i] ?? '';
    else if (arg === '--embed') args.embed = true;
    else args.files.push(resolve(arg));
  }
  if (args.files.length === 0) args.files = DEFAULT_TEMPLATES.map((f) => join(root, f));
  if (!args.imageBase.endsWith('/')) args.imageBase += '/';
  return args;
}

const SAMPLE_IMAGE = /https:\/\/example\.com\/images\/([\w-]+)\.(?:png|jpe?g)/g;
const SAMPLE_IMAGE_DIR = join(root, 'docs/public/demo');

/** PNG で用意しているサンプル画像（それ以外の写真は JPEG） */
const PNG_SAMPLES = new Set(['logo', 'qr']);

/** サンプル画像のファイル名 @param {string} name */
const sampleFile = (name) => `${name}.${PNG_SAMPLES.has(name) ? 'png' : 'jpg'}`;

/**
 * example.com の画像を、公開しているサンプル画像（embed なら cid:）に差し替える
 * @param {string} json
 * @param {string} base
 * @param {boolean} embed
 * @returns {{ json: string, files: string[] }} 差し替えた JSON と、使ったサンプル画像のファイル名
 */
function withSampleImages(json, base, embed) {
  /** @type {Set<string>} */
  const files = new Set();
  const replaced = json.replace(SAMPLE_IMAGE, (_, name) => {
    const file = sampleFile(name);
    files.add(file);
    return embed ? `cid:${file}@mailmason` : `${base}${file}`;
  });
  return { json: replaced, files: [...files] };
}

/**
 * 画像の URL が読めるか確かめる
 * @param {string[]} urls
 * @returns {Promise<string[]>} 読めなかった URL と理由
 */
async function unreachable(urls) {
  const results = await Promise.all(
    urls.map(async (url) => {
      try {
        const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(10000) });
        const type = res.headers.get('content-type') ?? '';
        if (!res.ok) return `${url}（HTTP ${res.status}）`;
        if (!type.startsWith('image/')) return `${url}（画像ではない: ${type}）`;
        return null;
      } catch (error) {
        return `${url}（${/** @type {Error} */ (error).message}）`;
      }
    }),
  );
  return results.filter((r) => r !== null);
}

/** @param {string} message */
function fail(message) {
  console.error(message);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const env = process.env;
const recipients = (args.to || env.MAIL_TO || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

/** @type {import('nodemailer').Transporter} */
let transport;
if (args.dryRun) {
  transport = nodemailer.createTransport({
    streamTransport: true,
    buffer: true,
    newline: 'windows',
  });
} else {
  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    fail(
      'SMTP の設定がありません。.env.samples.example を .env.samples にコピーして、SMTP_HOST・SMTP_USER・SMTP_PASS を書いてください（送らずに確かめるなら --dry-run）。',
    );
  }
  if (recipients.length === 0) fail('宛先がありません。MAIL_TO か --to で指定してください。');
  const port = Number(env.SMTP_PORT || 587);
  transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port,
    secure: env.SMTP_SECURE ? env.SMTP_SECURE === 'true' : port === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
  try {
    await transport.verify();
  } catch (error) {
    fail(`SMTP サーバーに接続できません: ${/** @type {Error} */ (error).message}`);
  }
}

const from = env.MAIL_FROM || env.SMTP_USER || 'Mailmason <sample@example.com>';
const stamp = new Date().toLocaleString('ja-JP', { hour12: false }).replace(/\//g, '-');
const out = join(root, 'samples/sent');
if (args.dryRun) mkdirSync(out, { recursive: true });

const mails = args.files.map((file) => {
  const name = basename(file, extname(file));
  const images = withSampleImages(readFileSync(file, 'utf8'), args.imageBase, args.embed);
  const { template, warnings } = migrate(images.json);
  for (const w of warnings) console.warn(`[${name}] ${w.code}: ${w.message}`);
  return { name, template, images: images.files };
});

const used = [...new Set(mails.flatMap((m) => m.images))];
if (args.embed) {
  const missing = used.filter((f) => !existsSync(join(SAMPLE_IMAGE_DIR, f)));
  if (missing.length) fail(`サンプル画像がありません: ${missing.join(', ')}`);
} else if (used.length) {
  const bad = await unreachable(used.map((f) => args.imageBase + f));
  if (bad.length) {
    const message = [
      'サンプル画像を読み込めません。受信したメールでは画像がリンク切れになります。',
      ...bad.map((b) => `  - ${b}`),
      '',
      `docs/public/demo/ の画像を push して GitHub Pages に反映されてから送るか、--embed で画像をメールに埋め込んでください。`,
    ].join('\n');
    if (args.dryRun) console.warn(message);
    else fail(message);
  }
}

for (const { name, template, images } of mails) {
  const html = renderHtml(template, {
    minify: true,
    mergeValues: SAMPLE_VALUES,
    socialIconBaseUrl: args.icons,
  });
  const { text } = resolveTextPart(template, { mergeValues: SAMPLE_VALUES });
  const kb = (Buffer.byteLength(html) / 1024).toFixed(1);
  const subject = `[Mailmason テスト ${stamp}] ${template.body.settings.title || name}`;

  const info = await transport.sendMail({
    from,
    to: recipients.length ? recipients : ['you@example.com'],
    subject,
    html,
    text,
    headers: { 'X-Mailmason-Template': name },
    attachments: args.embed
      ? images.map((f) => ({
          filename: f,
          path: join(SAMPLE_IMAGE_DIR, f),
          cid: `${f}@mailmason`,
          contentDisposition: 'inline',
        }))
      : [],
  });

  if (args.dryRun) {
    const path = join(out, `${name}.eml`);
    writeFileSync(path, /** @type {Buffer} */ (info.message));
    console.log(`${name}: ${path} に書き出しました（HTML ${kb}KB）`);
  } else {
    console.log(
      `${name}: ${recipients.join(', ')} に送信しました（HTML ${kb}KB、${info.messageId}）`,
    );
  }
  if (Number(kb) > 90)
    console.warn(`[${name}] HTML が 90KB を超えています（Gmail は約 102KB で省略します）`);
}
