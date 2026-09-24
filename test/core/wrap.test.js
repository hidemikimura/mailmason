import { describe, expect, it } from 'vitest';
import { wrapText } from '../../src/core/render-text/wrap.js';
import { stringWidth } from '../../src/core/text/width.js';

describe('stringWidth', () => {
  it('全角は 2、半角は 1 と数える', () => {
    expect(stringWidth('abc')).toBe(3);
    expect(stringWidth('あいう')).toBe(6);
    expect(stringWidth('ｱｲｳ')).toBe(3);
    expect(stringWidth('Ａ１')).toBe(4);
  });
});

describe('wrapText', () => {
  it('0 なら折り返さない', () => {
    expect(wrapText('あ'.repeat(100), 0)).toBe('あ'.repeat(100));
  });

  it('全角を 2 桁として折り返す', () => {
    expect(wrapText('あいうえおかきくけこ', 10)).toBe('あいうえお\nかきくけこ');
  });

  it('英単語の途中では切らない', () => {
    expect(wrapText('hello world again', 12)).toBe('hello world\nagain');
  });

  it('URL は行幅を超えても切らない', () => {
    const url = 'https://example.com/very/long/path/to/page';
    expect(wrapText(`see ${url}`, 20)).toBe(`see\n${url}`);
  });

  it('句読点は行頭に置かず前の行にぶら下げる', () => {
    expect(wrapText('あいうえお。かきく', 10)).toBe('あいうえお。\nかきく');
  });

  it('箇条書きの続きの行は記号の幅だけ字下げする', () => {
    expect(wrapText('・あいうえおかきくけこ', 12)).toBe('・あいうえお\n  かきくけこ');
  });

  it('区切り線は折り返さずに行幅で切る', () => {
    expect(wrapText('-'.repeat(40), 30)).toBe('-'.repeat(30));
  });

  it('行幅より長い英数字の塊は文字単位で切る', () => {
    expect(wrapText('abcdefghij', 4)).toBe('abcd\nefgh\nij');
  });
});
