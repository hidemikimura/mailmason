import { describe, expect, it } from 'vitest';
import { normalizeWith, s } from '../../src/core/model/schema.js';

describe('スキーマ正規化', () => {
  it('undefined は既定値になり警告しない', () => {
    const { value, warnings } = normalizeWith(s.number(), undefined, 5);
    expect(value).toBe(5);
    expect(warnings).toEqual([]);
  });

  it('範囲外の数値は既定値に置き換えて invalid-value を警告する', () => {
    const { value, warnings } = normalizeWith(s.number({ min: 0, max: 10 }), 11, 5, 'x');
    expect(value).toBe(5);
    expect(warnings).toMatchObject([{ code: 'invalid-value', path: 'x' }]);
  });

  it('integer 指定では小数を拒否する', () => {
    expect(normalizeWith(s.number({ integer: true }), 1.5, 1).value).toBe(1);
  });

  it('色は #rgb を #rrggbb に展開し小文字にそろえる', () => {
    expect(normalizeWith(s.color(), '#ABC', '#000000').value).toBe('#aabbcc');
    expect(normalizeWith(s.color(), '#FF0000', '#000000').value).toBe('#ff0000');
  });

  it('色の書式が不正なら既定値に戻す', () => {
    const { value, warnings } = normalizeWith(s.color(), 'red', '#000000');
    expect(value).toBe('#000000');
    expect(warnings).toHaveLength(1);
  });

  it('nullable でなければ null を拒否する', () => {
    expect(normalizeWith(s.color({ nullable: true }), null, '#000000').value).toBeNull();
    expect(normalizeWith(s.color(), null, '#000000').value).toBe('#000000');
  });

  it('spacing は数値 1 つを 4 辺に展開し、欠けた辺は既定値で補う', () => {
    const fallback = { top: 1, right: 2, bottom: 3, left: 4 };
    expect(normalizeWith(s.spacing(), 8, fallback).value).toEqual({
      top: 8,
      right: 8,
      bottom: 8,
      left: 8,
    });
    expect(normalizeWith(s.spacing(), { top: 10 }, fallback).value).toEqual({
      top: 10,
      right: 2,
      bottom: 3,
      left: 4,
    });
  });

  it('object は未知キーを削除して unknown-key を警告する', () => {
    const schema = s.object({ a: s.number() });
    const { value, warnings } = normalizeWith(schema, { a: 1, b: 2 }, { a: 0 }, 'obj');
    expect(value).toEqual({ a: 1 });
    expect(warnings).toMatchObject([{ code: 'unknown-key', path: 'obj.b' }]);
  });

  it('arrayOf は壊れた要素を取り除き、欠けた項目を補う', () => {
    const schema = s.arrayOf(s.object({ name: s.string(), n: s.number() }), () => ({
      name: '',
      n: 0,
    }));
    const { value, warnings } = normalizeWith(schema, [{ name: 'a' }, 'x', { n: 2 }], [], 'list');
    expect(value).toEqual([
      { name: 'a', n: 0 },
      { name: '', n: 2 },
    ]);
    expect(warnings).toMatchObject([{ code: 'invalid-value', path: 'list[1]' }]);
  });

  it('既定値を返すときは複製し、既定値オブジェクトを共有しない', () => {
    const fallback = { top: 0, right: 0, bottom: 0, left: 0 };
    const { value } = normalizeWith(s.spacing(), undefined, fallback);
    expect(value).toEqual(fallback);
    expect(value).not.toBe(fallback);
  });
});
