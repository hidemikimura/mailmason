import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { validate } from '../../src/core/index.js';

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
