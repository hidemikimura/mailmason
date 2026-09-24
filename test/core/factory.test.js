import { describe, expect, it } from 'vitest';
import {
  BLOCK_TYPES,
  MailmasonError,
  TEMPLATE_VERSION,
  cloneRow,
  createBlock,
  createId,
  createRow,
  createTemplate,
} from '../../src/core/index.js';

describe('createId', () => {
  it('接頭辞 + 8 文字の base36 を返す', () => {
    expect(createId('b')).toMatch(/^b_[0-9a-z]{8}$/);
  });

  it('連続して呼んでも重複しない', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => createId('r')));
    expect(ids.size).toBe(1000);
  });
});

describe('createTemplate', () => {
  it('現行バージョンの空テンプレートを返す', () => {
    const template = createTemplate();
    expect(template.version).toBe(TEMPLATE_VERSION);
    expect(template.body.rows).toEqual([]);
    expect(template.body.settings.width).toBe(600);
    expect(template.text).toEqual({ mode: 'auto', content: null, sourceHash: null });
  });

  it('theme で既定値を上書きできる', () => {
    const template = createTemplate({ width: 640, linkColor: '#ff0000' });
    expect(template.body.settings.width).toBe(640);
    expect(template.body.settings.linkColor).toBe('#ff0000');
    expect(template.body.settings.fontSize).toBe(16);
  });
});

describe('createRow', () => {
  it('レイアウトの分割数だけカラムを作る', () => {
    expect(createRow('1').columns).toHaveLength(1);
    expect(createRow('1:2').columns).toHaveLength(2);
    expect(createRow('1:1:1:1').columns).toHaveLength(4);
  });

  it('カラムごとの初期ブロックを受け取れる', () => {
    const block = createBlock('text');
    const row = createRow('1:1', [[], [block]]);
    expect(row.columns[1].blocks).toEqual([block]);
  });

  it('未知のレイアウトは MailmasonError', () => {
    expect(() => createRow(/** @type {any} */ ('3:1'))).toThrow(MailmasonError);
  });
});

describe('createBlock', () => {
  it.each(BLOCK_TYPES)('%s ブロックを既定値で作れる', (type) => {
    const block = createBlock(type);
    expect(block.id).toMatch(/^b_/);
    expect(block.type).toBe(type);
    expect(block.hideOn).toBeNull();
  });

  it('values を既定値に深くマージする', () => {
    const block = createBlock('button', { label: '購入', innerPadding: { top: 20 } });
    expect(block.values.label).toBe('購入');
    expect(block.values.innerPadding).toEqual({ top: 20, right: 24, bottom: 12, left: 24 });
  });

  it('不正な values は既定値に戻す', () => {
    const block = createBlock('spacer', { height: -5 });
    expect(block.values.height).toBe(24);
  });

  it('スペーサーは余白 0 が既定', () => {
    expect(createBlock('spacer').style.padding).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });

  it('未知の type は MailmasonError', () => {
    expect(() => createBlock('countdown')).toThrow(MailmasonError);
  });
});

describe('cloneRow', () => {
  it('配下すべてに新しい ID を振り、内容は同じ', () => {
    const row = createRow('1:1', [[createBlock('text', { html: '<p>a</p>' })], []]);
    const copy = cloneRow(row);
    expect(copy.id).not.toBe(row.id);
    expect(copy.columns[0].id).not.toBe(row.columns[0].id);
    expect(copy.columns[0].blocks[0].id).not.toBe(row.columns[0].blocks[0].id);
    expect(copy.columns[0].blocks[0].values).toEqual(row.columns[0].blocks[0].values);
  });
});
