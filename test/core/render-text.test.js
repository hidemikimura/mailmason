import { describe, expect, it } from 'vitest';
import { renderText } from '../../src/core/index.js';
import { loadFixture } from './helpers.js';

describe('renderText', () => {
  it('basic フィクスチャ', async () => {
    await expect(renderText(loadFixture('basic'))).toMatchFileSnapshot('./__snapshots__/basic.txt');
  });

  it('kitchen-sink フィクスチャ', async () => {
    await expect(renderText(loadFixture('kitchen-sink'))).toMatchFileSnapshot(
      './__snapshots__/kitchen-sink.txt',
    );
  });

  it('content-blocks フィクスチャ（表・メニュー・ボタンの並び・ギャラリー・動画）', async () => {
    await expect(renderText(loadFixture('content-blocks'))).toMatchFileSnapshot(
      './__snapshots__/content-blocks.txt',
    );
  });

  it('画像・ボタン・SNS・区切り線を決まった形にする', () => {
    const text = renderText(loadFixture('basic'));
    expect(text).toContain('[秋の新作] ( https://example.com/?utm_source=mail )');
    expect(text).toContain('▶ 新作を見る\n  https://example.com/new');
    expect(text).toContain('X: https://x.com/example');
    expect(text).toContain('-'.repeat(40));
    expect(text).toContain('配信停止はこちら ( {{unsubscribe_url}} )');
  });

  it('連続する空行を 1 行にまとめ、前後の空白を削る', () => {
    const text = renderText(loadFixture('kitchen-sink'));
    expect(text).not.toMatch(/\n{3,}/);
    expect(text).toBe(text.trim());
    expect(text.split('\n').every((line) => line === line.trimEnd())).toBe(true);
  });

  it('見出しの記号と区切り線の文字を変えられる', () => {
    const text = renderText(loadFixture('basic'), { headingPrefix: '■ ', dividerText: '━━━━' });
    expect(text).toContain('■ {{name}} 様');
    expect(text).toContain('\n━━━━\n');
  });

  it('折り返し幅を指定できる', () => {
    const text = renderText(loadFixture('kitchen-sink'), { wrapWidth: 30 });
    for (const line of text.split('\n')) {
      if (/https?:\/\//.test(line)) continue; // URL は切らない
      expect(line.length).toBeLessThanOrEqual(30);
    }
  });

  it('改行コードを CRLF にできる', () => {
    const text = renderText(loadFixture('basic'), { newline: '\r\n' });
    expect(text).toContain('\r\n');
    expect(text.replace(/\r\n/g, '')).not.toContain('\n');
  });

  it('mergeValues はエスケープせずに置き換える', () => {
    const text = renderText(loadFixture('basic'), { mergeValues: { name: '<山田> & 太郎' } });
    expect(text).toContain('<山田> & 太郎 様');
  });

  it('非表示設定のブロックもテキストには含める', () => {
    expect(renderText(loadFixture('kitchen-sink'))).toContain('カラム 2');
  });
});
