import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { createBlock, createRow, createTemplate, validate } from '../../src/core/index.js';

const skills = fileURLToPath(new URL('../../skills/', import.meta.url));
const names = readdirSync(skills, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name);

describe('AI 用スキル', () => {
  it.each(names)('%s の SKILL.md は name と description を持つ', (name) => {
    const text = readFileSync(`${skills}${name}/SKILL.md`, 'utf8');
    const front = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '';
    expect(/^name: (.+)$/m.exec(front)?.[1]).toBe(name);
    const description = /^description: (.+)$/m.exec(front)?.[1] ?? '';
    expect(description.length).toBeGreaterThan(20);
    expect(description.length).toBeLessThanOrEqual(1024);
  });

  const examples = readdirSync(`${skills}mailmason-templates/examples`).filter((f) =>
    f.endsWith('.json'),
  );
  it.each(examples)('例 %s は警告なしで読み込める', (file) => {
    const json = readFileSync(`${skills}mailmason-templates/examples/${file}`, 'utf8');
    const result = validate(json);
    expect(result.error).toBeNull();
    expect(result.warnings).toEqual([]);
  });
});

describe('検査スクリプト（validate.mjs）', () => {
  const script = `${skills}mailmason-templates/scripts/validate.mjs`;
  const dir = mkdtempSync(join(tmpdir(), 'mailmason-validate-'));

  /**
   * テンプレートを書き出して検査スクリプトを動かす
   * @param {unknown} template
   * @param {string[]} [args]
   */
  function run(template, args = []) {
    const file = join(dir, `t-${Math.random().toString(36).slice(2)}.json`);
    writeFileSync(file, JSON.stringify(template));
    const result = spawnSync(process.execPath, [script, file, ...args], { encoding: 'utf8' });
    return { status: result.status, out: result.stdout + result.stderr };
  }

  /** @param {any[]} blocks */
  function templateWith(blocks) {
    const template = createTemplate();
    template.body.rows.push(createRow('1', [blocks]));
    return template;
  }

  it('代替テキストが空の画像は「メモ」で、終了コードに影響しない', () => {
    const image = createBlock('image', { src: 'https://example.com/logo.png', alt: '' });
    const { status, out } = run(templateWith([image]));
    expect(status).toBe(0);
    expect(out).toContain(`メモ: ${image.id} の画像は代替テキスト（alt）が空です`);
    expect(out).toContain('OK: 警告はありません');
  });

  it('指定の文の知らない参照はエラー（終了コード 1）', () => {
    const button = {
      ...createBlock('button', { label: '購入', href: 'https://example.com/' }),
      text: { mode: 'custom', content: '{@label} {@alt}' },
    };
    const { status, out } = run(templateWith([button]));
    expect(status).toBe(1);
    expect(out).toContain(`エラー: ${button.id} のテキストパートの指定の文`);
    expect(out).toContain('{@alt}');
  });

  it('--text-options でテキストパートの作り方を渡せる', () => {
    const template = templateWith([
      createBlock('text', { html: '<p>共通</p>' }),
      { ...createBlock('text', { html: '<p>スマホ用</p>' }), hideOn: 'desktop' },
      createBlock('button', { label: '購入', href: 'https://example.com/' }),
    ]);
    const options = join(dir, 'text-options.json');
    writeFileSync(
      options,
      JSON.stringify({ textVariant: 'desktop', textTemplates: { button: '{@label}：{@href}' } }),
    );
    const out = join(dir, 'out.txt');
    const { status } = run(template, ['--text-options', options, '--text', out]);
    expect(status).toBe(0);
    expect(readFileSync(out, 'utf8')).toBe('共通\n\n購入：https://example.com/');
  });

  it('例 order-notice.json のテキストパートは指定の文と扱いのとおりに出る', () => {
    const out = join(dir, 'order.txt');
    const { status } = run(
      JSON.parse(readFileSync(`${skills}mailmason-templates/examples/order-notice.json`, 'utf8')),
      ['--text', out],
    );
    expect(status).toBe(0);
    const text = readFileSync(out, 'utf8');
    expect(text).not.toContain('デモショップ'); // ロゴは出さない
    expect(text).toContain('■ ご注文内容\n商品 | 数量 | 金額');
    expect(text).toContain(
      '次の URL からご確認ください。\nhttps://example.com/mypage/orders/{{order_id}}',
    );
    expect(text).toContain('HTML 版もあります'); // テキストだけの文
  });
});
