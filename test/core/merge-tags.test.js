import { describe, expect, it } from 'vitest';
import {
  extractMergeTags,
  findMergeTags,
  migrate,
  replaceMergeTags,
} from '../../src/core/index.js';
import { loadFixture } from './helpers.js';

describe('マージタグ', () => {
  it('キーを取り出す（前後の空白は許容）', () => {
    expect(extractMergeTags('{{name}} と {{ user.id }} と {{bad key}}')).toEqual([
      'name',
      'user.id',
    ]);
  });

  it('区切り文字を変えられる', () => {
    expect(extractMergeTags('%%a%% {{b}}', { open: '%%', close: '%%' })).toEqual(['a']);
  });

  it('値があるキーだけ置き換える', () => {
    expect(replaceMergeTags('{{a}}-{{b}}', { a: 'x' })).toBe('x-{{b}}');
  });

  it('エスケープ関数を通して置き換える', () => {
    const escape = (/** @type {string} */ v) => v.replace(/&/g, '&amp;');
    expect(replaceMergeTags('{{a}}', { a: 'A&B' }, { escape })).toBe('A&amp;B');
  });

  it('テンプレート全体の使用箇所を列挙する', () => {
    const template = migrate(loadFixture('basic')).template;
    template.body.settings.preheader = '{{name}} 様へ';
    expect(findMergeTags(template)).toEqual([
      { key: 'name', blockId: null, field: 'body.settings.preheader' },
      { key: 'name', blockId: 'b_text0001', field: 'html' },
      { key: 'unsubscribe_url', blockId: 'b_text0002', field: 'html' },
    ]);
  });
});
