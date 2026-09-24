import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  fnv1a,
  migrate,
  renderText,
  resolveTextPart,
  textSourceHash,
} from '../../src/core/index.js';
import { loadFixture } from './helpers.js';

describe('テキストパート', () => {
  it('fnv1a は 8 桁の 16 進数で、入力が変われば変わる', () => {
    expect(fnv1a('')).toBe('811c9dc5');
    expect(fnv1a('a')).toMatch(/^[0-9a-f]{8}$/);
    expect(fnv1a('a')).not.toBe(fnv1a('b'));
  });

  it('auto のときは自動生成を使う', () => {
    const template = migrate(loadFixture('basic')).template;
    expect(resolveTextPart(template)).toEqual({
      text: renderText(template),
      mode: 'auto',
      stale: false,
    });
  });

  it('manual のときは手編集の内容を使い、HTML 側が変わらなければ stale にならない', () => {
    let template = migrate(loadFixture('basic')).template;
    template = applyCommand(template, {
      type: 'setTextPart',
      content: '手編集したテキスト {{name}}',
      sourceHash: textSourceHash(template),
    });
    const part = resolveTextPart(template, { mergeValues: { name: '山田' } });
    expect(part).toEqual({ text: '手編集したテキスト 山田', mode: 'manual', stale: false });
  });

  it('手編集の後に HTML 側を変えると stale になる', () => {
    let template = migrate(loadFixture('basic')).template;
    template = applyCommand(template, {
      type: 'setTextPart',
      content: '手編集',
      sourceHash: textSourceHash(template),
    });
    template = applyCommand(template, {
      type: 'updateBlockValues',
      blockId: 'b_button01',
      patch: { label: '今すぐ見る' },
    });
    expect(resolveTextPart(template).stale).toBe(true);
  });

  it('手編集のテキストは折り返さない', () => {
    let template = migrate(loadFixture('basic')).template;
    template = applyCommand(template, { type: 'setTextPart', content: 'あ'.repeat(50) });
    expect(resolveTextPart(template, { wrapWidth: 20 }).text).toBe('あ'.repeat(50));
  });
});
