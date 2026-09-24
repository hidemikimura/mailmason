import { describe, expect, it } from 'vitest';
import { parseHtml } from '../../src/core/richtext/parse.js';
import { serializeNodes } from '../../src/core/richtext/serialize.js';
import { sanitizeHtml } from '../../src/core/richtext/sanitize.js';
import { richTextToPlain } from '../../src/core/richtext/to-text.js';

describe('parseHtml', () => {
  it('要素・属性・テキストの木を作る', () => {
    expect(parseHtml('<p class="a" data-x=1 hidden>hi <b>you</b></p>')).toEqual([
      {
        type: 'element',
        tag: 'p',
        attrs: { class: 'a', 'data-x': '1', hidden: '' },
        children: [
          { type: 'text', value: 'hi ' },
          { type: 'element', tag: 'b', attrs: {}, children: [{ type: 'text', value: 'you' }] },
        ],
      },
    ]);
  });

  it('実体参照を復号する', () => {
    const [p] = parseHtml('<p title="a&amp;b">&lt;x&gt; &nbsp;&#12354;&#x3042;&copy;&unknown;</p>');
    expect(p).toMatchObject({ attrs: { title: 'a&b' } });
    expect(/** @type {any} */ (p).children[0].value).toBe('<x>  ああ©&unknown;');
  });

  it('コメント・DOCTYPE・条件付きコメントを読み飛ばす', () => {
    const nodes = parseHtml('<!DOCTYPE html><!-- c --><!--[if mso]>x<![endif]--><p>a</p>');
    expect(serializeNodes(nodes)).toBe('<p>a</p>');
  });

  it('script の中身はテキストとして読み、タグと解釈しない', () => {
    const [script] = parseHtml('<script>if (a < b) { "</p>" }</script>');
    expect(/** @type {any} */ (script).children[0].value).toBe('if (a < b) { "</p>" }');
  });

  it('閉じ忘れや余分な閉じタグがあっても壊れない', () => {
    expect(serializeNodes(parseHtml('<p>a<p>b</div></p>'))).toBe('<p>a</p><p>b</p>');
    expect(serializeNodes(parseHtml('<ul><li>a<li>b</ul>'))).toBe('<ul><li>a</li><li>b</li></ul>');
  });

  it('タグでない < はテキストとして扱う', () => {
    expect(serializeNodes(parseHtml('1 < 2 <3'))).toBe('1 &lt; 2 &lt;3');
  });
});

describe('sanitizeHtml', () => {
  it.each([
    ['正規形はそのまま', '<p>a<br>b</p>', '<p>a<br>b</p>'],
    ['裸のテキストは段落で包む', 'hello <b>world</b>', '<p>hello <strong>world</strong></p>'],
    [
      'i / strike / ins を読み替える',
      '<p><i>a</i><strike>b</strike><ins>c</ins></p>',
      '<p><em>a</em><s>b</s><u>c</u></p>',
    ],
    [
      'div を段落にし、末尾の <br> を除く',
      '<div>line1</div><div>line2<br></div><div><br></div>',
      '<p>line1</p><p>line2</p><p><br></p>',
    ],
    ['script は中身ごと削除', '<p>a<script>alert(1)</script>b</p>', '<p>ab</p>'],
    ['javascript: のリンクは外す', '<p><a href="javascript:alert(1)">x</a></p>', '<p>x</p>'],
    [
      'target は _blank だけ残す',
      '<p><a href="https://a.jp" target="_top" rel="x">a</a></p>',
      '<p><a href="https://a.jp">a</a></p>',
    ],
    [
      'マージタグのリンクは残す',
      '<p><a href="{{url}}">x</a></p>',
      '<p><a href="{{url}}">x</a></p>',
    ],
    [
      'mailto / tel / # は残す',
      '<p><a href="mailto:a@b.jp">m</a><a href="tel:03">t</a><a href="#top">h</a></p>',
      '<p><a href="mailto:a@b.jp">m</a><a href="tel:03">t</a><a href="#top">h</a></p>',
    ],
    [
      'font color と rgb() の色を正規化し、許可外のスタイルを捨てる',
      '<p><font color="#F00">r</font><span style="color: rgb(0, 128, 0); font-size: 20px">g</span></p>',
      '<p><span style="color:#ff0000">r</span><span style="color:#008000">g</span></p>',
    ],
    ['スタイルの無い span は外す', '<p><span class="x">a</span></p>', '<p>a</p>'],
    [
      '親の揃えを子の段落に引き継ぐ',
      '<div style="text-align: center"><p>a</p><p style="text-align:right">b</p></div>',
      '<p style="text-align:center">a</p><p style="text-align:right">b</p>',
    ],
    ['align 属性も揃えとして読む', '<p align="right">a</p>', '<p style="text-align:right">a</p>'],
    ['空白をまとめ、端の空白を削る', '  <p>  a\n   b  </p>  ', '<p>a b</p>'],
    ['h4 以下は h3 にする', '<h5>x</h5>', '<h3>x</h3>'],
    ['表のセルは段落にする', '<table><tr><td>A</td><td>B</td></tr></table>', '<p>A</p><p>B</p>'],
    [
      'Word の余計な要素・属性を捨てる',
      '<p class="MsoNormal" style="mso-x:1">W<o:p></o:p></p>',
      '<p>W</p>',
    ],
    [
      'リスト直下のリストは直前の項目の子にする',
      '<ul><li>one</li><ul><li>nested</li></ul></ul>',
      '<ul><li>one<ul><li>nested</li></ul></li></ul>',
    ],
    [
      'li の中の段落は改行でつなぐ',
      '<ul><li><p>a</p><p>b</p></li></ul>',
      '<ul><li>a<br>b</li></ul>',
    ],
    ['空の段落・リスト項目は捨てる', '<p></p><p> </p><ul><li> </li></ul>', ''],
    ['画像は取り除く', '<p>a<img src="x.png">b</p>', '<p>ab</p>'],
  ])('%s', (_label, input, expected) => {
    expect(sanitizeHtml(input)).toBe(expected);
  });

  it('冪等（2 回かけても変わらない）', () => {
    const messy = '<div>a<b>b</b><div>c<ul><li>d<li>e</ul></div></div>x<br><br>';
    const once = sanitizeHtml(messy);
    expect(sanitizeHtml(once)).toBe(once);
  });

  it('区切り文字を変えたマージタグのリンクも残せる', () => {
    const html = '<p><a href="%%url%%">x</a></p>';
    expect(sanitizeHtml(html)).toBe('<p>x</p>');
    expect(sanitizeHtml(html, { delimiters: { open: '%%', close: '%%' } })).toBe(html);
  });
});

describe('richTextToPlain', () => {
  it('段落は空行、<br> は改行にする', () => {
    expect(richTextToPlain('<p>a<br>b</p><p>c</p>')).toBe('a\nb\n\nc');
  });

  it('リンクは「テキスト ( URL )」、同じなら URL だけ', () => {
    expect(richTextToPlain('<p><a href="https://a.jp">A</a></p>')).toBe('A ( https://a.jp )');
    expect(richTextToPlain('<p><a href="https://a.jp">https://a.jp</a></p>')).toBe('https://a.jp');
    expect(richTextToPlain('<p><a href="mailto:x@a.jp">x@a.jp</a></p>')).toBe('x@a.jp');
  });

  it('リストに記号・番号を付け、入れ子は字下げする', () => {
    expect(
      richTextToPlain('<ul><li>a<ul><li>b</li></ul></li></ul><ol><li>c</li><li>d</li></ol>'),
    ).toBe('・a\n  ・b\n\n1. c\n2. d');
  });

  it('見出しの記号を付けられる', () => {
    expect(richTextToPlain('<h1>T</h1>', { headingPrefix: '■ ' })).toBe('■ T');
  });

  it('NBSP は空白にする', () => {
    expect(richTextToPlain('<p>a&nbsp;b</p>')).toBe('a b');
  });
});
