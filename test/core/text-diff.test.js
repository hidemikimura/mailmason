// 全文の手直しと本文の差分（diffLines / applyHunk）、resolveTextPart の diff
import { describe, expect, it } from 'vitest';
import {
  applyCommand,
  createBlock,
  createRow,
  createTemplate,
  migrate,
  renderText,
  resolveTextPart,
  textSourceHash,
} from '../../src/core/index.js';
import { applyHunk, applyHunkToBase, diffLines } from '../../src/core/text-diff.js';

describe('diffLines', () => {
  it('増えた行・消えた行・変わった行をまとめ、数を返す', () => {
    const diff = diffLines('a\nb\nc\nd', 'a\nB\nc\nd\ne');
    expect(diff.added).toBe(2);
    expect(diff.removed).toBe(1);
    expect(diff.hunks.map((h) => [h.start, h.removed, h.added])).toEqual([
      [1, ['b'], ['B']],
      [4, [], ['e']],
    ]);
  });

  it('変わった行の中の違いを、前後の同じ部分と分けて返す', () => {
    const [hunk] = diffLines('秋の新作が入荷しました。', '冬の新作が入荷しました。').hunks;
    expect(hunk.changes).toEqual([
      { prefix: '', removed: '秋', added: '冬', suffix: 'の新作が入荷しました。' },
    ]);
  });

  it('同じなら変更は無い', () => {
    expect(diffLines('a\nb', 'a\nb')).toEqual({ hunks: [], added: 0, removed: 0 });
  });
});

describe('applyHunk', () => {
  const base = 'こんにちは\n秋の新作です\nhttps://example.com/new';

  it('消えた行を手直しの文から探して置き換える', () => {
    const [hunk] = diffLines(base, 'こんにちは\n冬の新作です\nhttps://example.com/new').hunks;
    const content = 'いつもありがとうございます\n秋の新作です\nhttps://example.com/new';
    expect(applyHunk(content, hunk, base)).toBe(
      'いつもありがとうございます\n冬の新作です\nhttps://example.com/new',
    );
    expect(applyHunkToBase(base, hunk)).toBe('こんにちは\n冬の新作です\nhttps://example.com/new');
  });

  it('行を足すだけの変更は、直前の行の後ろに入れる', () => {
    const [hunk] = diffLines(
      base,
      `${base.replace('秋の新作です', '秋の新作です\n送料無料')}`,
    ).hunks;
    expect(applyHunk('秋の新作です\n手で足した行', hunk, base)).toBe(
      '秋の新作です\n送料無料\n手で足した行',
    );
  });

  it('手直しの文に見つからなければ null', () => {
    const [hunk] = diffLines(base, 'こんにちは\n冬の新作です\nhttps://example.com/new').hunks;
    expect(applyHunk('すっかり書き換えた文', hunk, base)).toBeNull();
  });
});

describe('全文の手直しの sourceText と diff', () => {
  function manualTemplate() {
    const template = createTemplate();
    const text = createBlock('text', { html: '<p>秋の新作です</p>' });
    template.body.rows.push(createRow('1', [[text]]));
    const auto = renderText(template);
    return {
      template: applyCommand(template, {
        type: 'setTextPart',
        content: `${auto}\n手で足した行`,
        sourceHash: textSourceHash(template),
        sourceText: auto,
      }),
      blockId: text.id,
    };
  }

  it('sourceText は manual のときだけ残す', () => {
    const { template } = manualTemplate();
    expect(migrate(template).template.text.sourceText).toBe('秋の新作です');
    const auto = {
      ...template,
      text: { mode: 'auto', content: null, sourceHash: null, sourceText: 'x' },
    };
    const { template: loaded, warnings } = migrate(auto);
    expect(loaded.text).not.toHaveProperty('sourceText');
    expect(warnings.map((w) => w.path)).toEqual(['text.sourceText']);
  });

  it('本文が変わると、手直しを始めた時点からの差分を返す', () => {
    const { template, blockId } = manualTemplate();
    expect(resolveTextPart(template).diff).toBeNull();
    const next = applyCommand(template, {
      type: 'updateBlockValues',
      blockId,
      patch: { html: '<p>冬の新作です</p>' },
    });
    const part = resolveTextPart(next);
    expect(part.stale).toBe(true);
    expect(part.text).toBe('秋の新作です\n手で足した行');
    expect(part.diff?.hunks.map((h) => [h.removed, h.added])).toEqual([
      [['秋の新作です'], ['冬の新作です']],
    ]);
  });

  it('sourceText の無い古いテンプレートは、古いとだけ返す（diff は null）', () => {
    const { template, blockId } = manualTemplate();
    const text = { ...template.text };
    delete text.sourceText;
    const old = applyCommand(
      { ...template, text },
      {
        type: 'updateBlockValues',
        blockId,
        patch: { html: '<p>冬の新作です</p>' },
      },
    );
    const part = resolveTextPart(old);
    expect(part.stale).toBe(true);
    expect(part.diff).toBeNull();
  });

  it('setTextPart は sourceText を省くと今のまま、null で消す', () => {
    const { template } = manualTemplate();
    const kept = applyCommand(template, { type: 'setTextPart', content: '書き換え' });
    expect(kept.text.sourceText).toBe('秋の新作です');
    const removed = applyCommand(template, {
      type: 'setTextPart',
      content: '書き換え',
      sourceText: null,
    });
    expect(removed.text).not.toHaveProperty('sourceText');
  });
});
