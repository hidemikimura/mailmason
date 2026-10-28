// エディタ UI の共通スタイル。色や寸法は CSS カスタムプロパティで上書きできる
import { css, unsafeCSS } from 'lit';

/** デザイントークンの既定値（ライト）。エディタの外で部品だけを使うときの初期値にもする */
export const LIGHT_TOKENS = Object.freeze({
  '--mm-color-bg': '#eef0f3',
  '--mm-color-surface': '#ffffff',
  '--mm-color-surface-2': '#f6f7f9',
  '--mm-color-text': '#1f2328',
  '--mm-color-muted': '#656d76',
  '--mm-color-border': '#d8dce1',
  '--mm-color-accent': '#2f6fed',
  '--mm-color-accent-text': '#ffffff',
  '--mm-color-accent-soft': 'rgba(47, 111, 237, 0.12)',
  '--mm-color-danger': '#cf222e',
  '--mm-radius': '6px',
  '--mm-font-family': "system-ui, -apple-system, 'Hiragino Kaku Gothic ProN', Meiryo, sans-serif",
  '--mm-font-size': '13px',
});

let tokenDefaultsRegistered = false;

/**
 * デザイントークンの初期値を登録する（どこにも指定が無いときに使われる）。
 * エディタはルート要素で指定するので、この初期値はエディタの外に置いた部品だけに効く
 */
export function registerTokenDefaults() {
  if (tokenDefaultsRegistered || typeof CSS === 'undefined' || !CSS.registerProperty) return;
  tokenDefaultsRegistered = true;
  for (const [name, initialValue] of Object.entries(LIGHT_TOKENS)) {
    try {
      CSS.registerProperty({ name, syntax: '*', inherits: true, initialValue });
    } catch {
      // 登録済み（同じページに別の版の mailmason があるなど）なら、そちらの初期値を使う
    }
  }
}

const lightDeclarations = Object.entries(LIGHT_TOKENS)
  .map(([name, value]) => `${name}: ${value};`)
  .join('\n');

/** ルート要素に置くデザイントークン（ライト / ダーク） */
export const tokens = css`
  :host {
    ${unsafeCSS(lightDeclarations)}
    --mm-palette-width: 232px;
    --mm-panel-width: 300px;
    color-scheme: light;
  }
  :host([color-mode='dark']) {
    --mm-color-bg: #16181c;
    --mm-color-surface: #1f2227;
    --mm-color-surface-2: #272b31;
    --mm-color-text: #e6e8eb;
    --mm-color-muted: #9aa3ad;
    --mm-color-border: #3a3f47;
    --mm-color-accent: #5b8def;
    --mm-color-accent-soft: rgba(91, 141, 239, 0.18);
    --mm-color-danger: #f85149;
    color-scheme: dark;
  }
  @media (prefers-color-scheme: dark) {
    :host([color-mode='auto']) {
      --mm-color-bg: #16181c;
      --mm-color-surface: #1f2227;
      --mm-color-surface-2: #272b31;
      --mm-color-text: #e6e8eb;
      --mm-color-muted: #9aa3ad;
      --mm-color-border: #3a3f47;
      --mm-color-accent: #5b8def;
      --mm-color-accent-soft: rgba(91, 141, 239, 0.18);
      --mm-color-danger: #f85149;
      color-scheme: dark;
    }
  }
`;

/** ボタン・入力欄などの共通部品 */
export const controls = css`
  :host {
    font-family: var(--mm-font-family);
    font-size: var(--mm-font-size);
    color: var(--mm-color-text);
  }
  button {
    font: inherit;
    color: inherit;
    background: var(--mm-color-surface);
    border: 1px solid var(--mm-color-border);
    border-radius: var(--mm-radius);
    padding: 4px 8px;
    cursor: pointer;
  }
  button:hover:not(:disabled) {
    background: var(--mm-color-surface-2);
  }
  button:disabled {
    opacity: 0.45;
    cursor: default;
  }
  button:focus-visible,
  input:focus-visible,
  select:focus-visible,
  textarea:focus-visible {
    outline: 2px solid var(--mm-color-accent);
    outline-offset: 1px;
  }
  button[aria-pressed='true'] {
    background: var(--mm-color-accent-soft);
    border-color: var(--mm-color-accent);
  }
  input,
  select,
  textarea {
    font: inherit;
    color: inherit;
    background: var(--mm-color-surface);
    border: 1px solid var(--mm-color-border);
    border-radius: var(--mm-radius);
    padding: 4px 6px;
    box-sizing: border-box;
    min-width: 0;
  }
  textarea {
    width: 100%;
    resize: vertical;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 12px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    white-space: nowrap;
  }
`;
