// メールクライアント互換の静的チェック。
// 実機での確認（docs/client-checklist.md）の前に、既知の落とし穴を出力 HTML から機械的に検査する
import { describe, expect, it } from 'vitest';
import { renderHtml } from '../../src/core/index.js';
import { loadFixture } from './helpers.js';

const VOID_TAGS = new Set(['img', 'br', 'meta', 'hr', 'input', 'link', 'base']);

/**
 * 条件付きコメントの中身を含めずに、通常の HTML 部分だけを取り出す
 * @param {string} html
 */
function withoutMsoBlocks(html) {
  return html.replace(/<!--\[if mso\]>[\s\S]*?<!\[endif\]-->/g, '');
}

/**
 * 開始・終了タグの対応を調べる（XHTML として整形式か）
 * @param {string} html
 * @returns {string[]} 問題の一覧
 */
function checkBalance(html) {
  const problems = [];
  /** @type {string[]} */
  const stack = [];
  const source = withoutMsoBlocks(html).replace(/<!--[\s\S]*?-->/g, '');
  for (const match of source.matchAll(/<(\/?)([a-zA-Z][\w:]*)\b[^>]*?(\/?)>/g)) {
    const [, closing, rawName, selfClosing] = match;
    const name = rawName.toLowerCase();
    if (VOID_TAGS.has(name)) {
      if (!selfClosing) problems.push(`<${name}> is not self-closed`);
      continue;
    }
    if (selfClosing) continue;
    if (!closing) {
      stack.push(name);
    } else if (stack.pop() !== name) {
      problems.push(`unexpected </${name}>`);
      break;
    }
  }
  if (stack.length > 0) problems.push(`unclosed: ${stack.join(', ')}`);
  return problems;
}

/**
 * フィクスチャを読み込み、HTML ブロックを除く（利用者が書いた生 HTML は検査の対象外）
 * @param {string} name
 */
function ownOutputOnly(name) {
  const template = loadFixture(name);
  for (const row of template.body.rows) {
    for (const column of row.columns) {
      column.blocks = column.blocks.filter((/** @type {any} */ b) => b.type !== 'html');
    }
  }
  return template;
}

const OUTPUTS = ['basic', 'kitchen-sink', 'content-blocks', 'backgrounds', 'tables'].flatMap(
  (name) => [
    { name, variant: 'pretty', html: renderHtml(ownOutputOnly(name)) },
    { name, variant: 'minify', html: renderHtml(ownOutputOnly(name), { minify: true }) },
    {
      name,
      variant: 'icons',
      html: renderHtml(ownOutputOnly(name), { socialIconBaseUrl: 'https://cdn.example.com/icons' }),
    },
  ],
);

describe.each(OUTPUTS)('メールクライアント互換: $name ($variant)', ({ html }) => {
  it('XHTML として整形式（タグの対応が取れていて、空要素は自己終了）', () => {
    expect(checkBalance(html)).toEqual([]);
  });

  it('条件付きコメントの開始と終了が対応している', () => {
    const opens = html.match(/<!--\[if [^\]]+\]>(<!-->)?/g) ?? [];
    const closes = html.match(/(<!--)?<!\[endif\]-->/g) ?? [];
    expect(opens.length).toBeGreaterThan(0);
    expect(opens.length).toBe(closes.length);
  });

  it('レイアウト用のテーブルはすべて role="presentation" で余白と枠線を 0 にしている', () => {
    const tables = html.match(/<table\b[^>]*>/g) ?? [];
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) {
      // 表ブロック（データの表）は読み上げで表として扱わせるため role を付けない
      if (!/class="mm-table( [^"]*)?"/.test(table)) expect(table).toContain('role="presentation"');
      expect(table).toContain('cellpadding="0"');
      expect(table).toContain('cellspacing="0"');
      expect(table).toContain('border="0"');
    }
  });

  it('画像は width 属性・alt・border:0 を持ち、Outlook が縮めない', () => {
    const images = html.match(/<img\b[^>]*>/g) ?? [];
    expect(images.length).toBeGreaterThan(0);
    for (const img of images) {
      expect(img).toMatch(/ width="\d+"/);
      expect(img).toMatch(/ alt="/);
      expect(img).toMatch(/border:0/);
    }
  });

  it('多くのメーラーが対応していない CSS・要素を使わない', () => {
    // 背景画像は、background 属性（古いメーラー向け）と CSS を併せて出すセル・表だけに使う
    // （動画ブロックのセル、背景画像を設定した外側・本文・行・カラム。画像を出さないメーラーでは背景色）
    const body = html
      .slice(html.indexOf('<body'))
      .replace(/<td[^>]* background="[^"]*"[^>]*>/g, '<td>')
      .replace(
        /<table role="presentation" width="100%"[^>]*background-image:url\('[^']*'\)[^>]*>/,
        '<table>',
      );
    expect(body).not.toMatch(/display:\s*(flex|grid)/);
    expect(body).not.toMatch(/position:\s*(absolute|fixed|relative)/);
    expect(body).not.toMatch(/float:/);
    expect(body).not.toMatch(/background-image|url\(/);
    expect(body).not.toMatch(/rgba?\(|hsla?\(/); // Outlook は #rrggbb のみ
    expect(body).not.toMatch(/var\(--/);
    expect(body).not.toMatch(/<(script|form|input|iframe|video|audio|object|embed|svg)\b/i);
    expect(body).not.toMatch(/\b(margin|padding):[^;"]*-\d/); // 負の余白
  });

  it('セルには margin を使わない（Outlook が無視する）。余白は td の padding で付ける', () => {
    for (const td of html.match(/<td\b[^>]*>/g) ?? []) expect(td).not.toMatch(/margin/);
  });

  it('リンクは新しいタブで開き、href は許可したスキームかマージタグだけ', () => {
    const links = withoutMsoBlocks(html).match(/<a\b[^>]*>/g) ?? [];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toContain('target="_blank"');
      const href = /href="([^"]*)"/.exec(link)?.[1];
      if (href !== undefined) expect(href).toMatch(/^(https?:|mailto:|tel:|#|\{\{)/);
    }
  });

  it('本文の外枠は Outlook 用に固定幅のテーブルで囲む', () => {
    expect(html).toMatch(/<!--\[if mso\]><table role="presentation" width="\d+"/);
    expect(html).toMatch(/class="mm-container" width="\d+"/);
  });

  it('Outlook 用の設定（PNG 許可・96dpi・フォント指定）を head に入れる', () => {
    expect(html).toContain('<o:AllowPNG/>');
    expect(html).toContain('<o:PixelsPerInch>96</o:PixelsPerInch>');
    expect(html).toMatch(/<!--\[if mso\]>[\s\S]*font-family:[^;]+!important/);
  });
});

describe('メールクライアント互換: 検査関数', () => {
  it('崩れた HTML を検出する', () => {
    expect(checkBalance('<table><tr><td></tr></table>')).not.toEqual([]);
    expect(checkBalance('<p>a<br>b</p>')).toEqual(['<br> is not self-closed']);
    expect(checkBalance('<div><p>a</p>')).toEqual(['unclosed: div']);
    expect(checkBalance('<p>a<br />b</p><!--[if mso]><table><![endif]-->')).toEqual([]);
  });
});

describe('メールクライアント互換: 出力サイズ', () => {
  it('サンプルの minify 出力は Gmail の省略（約 102KB）よりずっと小さい', () => {
    for (const name of ['basic', 'kitchen-sink', 'content-blocks', 'backgrounds', 'tables']) {
      const bytes = new TextEncoder().encode(
        renderHtml(loadFixture(name), { minify: true }),
      ).length;
      expect(bytes).toBeLessThan(20 * 1024);
    }
  });

  it('1 カラムの行はカラム用の入れ子テーブルを作らない', () => {
    const html = renderHtml(loadFixture('basic'));
    // バナー行: 行のセルの直下にブロックのテーブル
    expect(html).toMatch(
      /<td style="padding:0;">\s*<table role="presentation"[^>]*>\s*<tr>\s*<td align="center"/,
    );
  });
});
