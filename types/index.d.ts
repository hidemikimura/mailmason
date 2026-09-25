// @hidemikimura/mailmason の型定義（手書き）。
// import すると <mailmason-editor> を登録する。core の型と関数もここから import できる
import { LitElement } from 'lit';
import type {
  BodySettings,
  Component,
  CustomBlock,
  Label,
  MergeTagDelimiters,
  RenderHtmlOptions,
  RenderTextOptions,
  Template,
  Warning,
} from './core/index.js';

export * from './core/index.js';

// ---------------------------------------------------------------------------
// プロパティに渡す型
// ---------------------------------------------------------------------------

/** 差し込み変数の候補 */
export interface MergeTag {
  /** `{{key}}` の key */
  key: string;
  /** 候補の一覧に出す名前 */
  label: string;
  /** グループ名。候補の一覧でグループごとにまとめる（無い候補は「その他」） */
  group?: string;
  /** プレビューで使う値 */
  sample?: string;
  /** 書き出しで値が無いときに使う値（mergeValues を渡したときだけ） */
  fallback?: string;
}

/**
 * 画像のフックの戻り値。null / undefined は取り消し。
 * data はブロックの uploadData に保存する任意のオブジェクト（JSON で表せる値、出力には使わない）。
 * alt は代替テキストが空のときだけ入れる
 */
export type ImageResult =
  | string
  | { url: string; data?: Record<string, unknown> | null; alt?: string }
  | { src: string; data?: Record<string, unknown> | null; alt?: string }
  | null
  | undefined;

/** 全体設定の「Web フォントを追加」に出す候補 */
export interface WebFontOption {
  /** フォント名（font-family に書く名前） */
  family: string;
  /** CSS の URL（https のみ） */
  url: string;
  /** 読み込めないメールソフトで使う端末のフォント（font-family の後ろに付ける。無ければ日本語のゴシック体） */
  fallback?: string;
  /** 候補の一覧での見出し（文字列か { ja, en }。無い候補は「その他」） */
  group?: Label;
}

/** 画像欄の「選択…」ボタンで呼ぶ（自前の画像ライブラリの画面などを開く） */
export type ImageSelectHook = (context: { current: string }) => Promise<ImageResult>;

/**
 * ローカルの画像ファイル（PNG・JPEG・GIF）と、エディタが作った QR コードの PNG を受け取ってアップロードする。
 * 例外を投げると失敗として表示する。data URL は Gmail や Outlook で表示されないので返さない
 */
export type ImageUploadHook = (
  file: File,
  context: {
    /** 画像を入れるブロックの ID。背景画像では行・カラムの ID（メール全体の背景は 'body'） */
    blockId: string;
    /** 画像の置き場所（ブロック、または背景画像の行・カラム・メール全体） */
    target: 'block' | 'row' | 'column' | 'body';
  },
) => Promise<ImageResult>;

/** 「コンポーネントとして保存」で呼ぶ。id を付けたコンポーネントを返すと一覧に加える */
export type SaveComponentHook = (
  component: Component,
) => Promise<Component | null | undefined | void>;

/** 「保存済み」の削除で呼ぶ。false を返すと取り消し */
export type DeleteComponentHook = (
  component: Component,
) => Promise<boolean | void> | boolean | void;

// ---------------------------------------------------------------------------
// イベント
// ---------------------------------------------------------------------------

/**
 * mm-warning の detail。コードによって項目が増える
 * （html-size: bytes / image-upload-*: fileName / *-failed: error / qr-*: blockId）
 */
export interface EditorWarning extends Warning {
  bytes?: number;
  fileName?: string;
  error?: unknown;
  blockId?: string;
  [key: string]: unknown;
}

/** 選択中の要素の種類 */
export type SelectionKind = 'row' | 'column' | 'block' | null;

export interface MmChangeDetail {
  /** 変更後のテンプレート（変更しないこと。保存するならそのまま JSON にしてよい） */
  template: Template;
  /** この通知までに行ったコマンドの名前（'updateBlockValues' など） */
  actions: string[];
}

export interface MmSelectDetail {
  /** 選択中の要素（まとめて選んだときは最後に選んだもの） */
  id: string | null;
  kind: SelectionKind;
  /** 選択中の要素すべて（まとめて選べるのは行どうし・ブロックどうし。選んでいなければ []） */
  ids: string[];
}

export interface MmViewDetail {
  view: 'edit' | 'preview';
  device: 'desktop' | 'mobile';
}

/** `<mailmason-editor>` が発火するイベント（すべて bubbles・composed の CustomEvent） */
export interface MailmasonEditorEventMap extends HTMLElementEventMap {
  /** 最初の描画が終わったとき */
  'mm-ready': CustomEvent<null>;
  /** 編集内容が変わったとき（1 フレームに 1 回まで。loadJson では発火しない） */
  'mm-change': CustomEvent<MmChangeDetail>;
  /** 選択が変わったとき */
  'mm-select': CustomEvent<MmSelectDetail>;
  /** 読み込み時の補正・未定義のマージタグ・HTML の大きさなどの警告 */
  'mm-warning': CustomEvent<EditorWarning>;
  /** ツールバーで表示を切り替えたとき（プロパティへの代入では発火しない） */
  'mm-view': CustomEvent<MmViewDetail>;
}

// ---------------------------------------------------------------------------
// エディタ
// ---------------------------------------------------------------------------

/**
 * ノーコードメールエディタ本体 `<mailmason-editor>`。
 *
 * @fires mm-ready / mm-change / mm-select / mm-warning / mm-view
 * @csspart toolbar / palette / canvas / settings / preview
 * @slot toolbar ツールバーの右端に置く要素（保存ボタンなど）
 */
export declare class MailmasonEditor extends LitElement {
  /** 現在のテンプレート（コピー）。代入すると loadJson() と同じ */
  get template(): Template;
  set template(value: Template | string);
  /** 新規テンプレートの既定デザイン（読み込んだ JSON には適用しない） */
  theme: Partial<BodySettings>;
  /** UI の言語（属性 locale、既定 'ja'） */
  locale: 'ja' | 'en' | (string & {});
  /** UI 文言の部分上書き（例: `{ 'toolbar.preview': '確認' }`） */
  messages: Record<string, string>;
  /** 差し込み変数の候補 */
  mergeTags: MergeTag[];
  /** 差し込み変数の区切り（既定 `{{` `}}`） */
  mergeTagDelimiters: MergeTagDelimiters;
  /**
   * 区切り開始文字（`{{` など）を入力したときに、差し込み変数の候補を出す
   * （属性 merge-tag-trigger、既定 true。属性で消すときは merge-tag-trigger="false"）
   */
  mergeTagTrigger: boolean;
  /** 画像欄の「選択…」ボタンで呼ぶ */
  onImageSelect: ImageSelectHook | null;
  /** ローカルの画像ファイル（と QR コードの PNG）をアップロードする。無ければ QR コードのブロックは出ない */
  onImageUpload: ImageUploadHook | null;
  /**
   * 全体設定の「Web フォントを追加」に出す候補（既定は Google Fonts の日本語・欧文フォント）。
   * 自社のフォントを足すときは `[...editor.webFontOptions, { family, url, fallback }]`、空の配列で URL の指定だけになる
   */
  webFontOptions: readonly WebFontOption[];
  /** カスタムブロックの定義（defineBlock() の戻り値）。loadJson より前に設定する */
  blocks: readonly CustomBlock[];
  /** 保存済みのコンポーネント。パレットの「保存済み」に出す */
  components: readonly Component[];
  onSaveComponent: SaveComponentHook | null;
  onDeleteComponent: DeleteComponentHook | null;
  /** アップロードできる画像の上限（バイト、0 で無制限。属性 max-image-size、既定 5MB） */
  maxImageSize: number;
  /** SNS アイコン PNG の置き場所（属性 social-icon-base-url。空ならテキストリンク） */
  socialIconBaseUrl: string;
  /** Outlook（Windows）用のフォント（属性 outlook-font-family、既定 'Arial, sans-serif'） */
  outlookFontFamily: string;
  /** Undo の履歴の上限（属性 history-limit、既定 100） */
  historyLimit: number;
  /** エディタ UI の配色（属性 color-mode、既定 'light'。メールの色ではない） */
  colorMode: 'light' | 'dark' | 'auto';
  /** 編集画面かプレビューか（属性 view） */
  view: 'edit' | 'preview';
  /** プレビューの幅（属性 preview-device） */
  previewDevice: 'desktop' | 'mobile';

  /**
   * テンプレート（オブジェクトまたは JSON 文字列）を読み込む。直した箇所を返す（mm-warning も発火）。
   * 履歴はクリアし、mm-change は発火しない
   * @throws {import('./core/index.js').MailmasonError} テンプレートとして解釈できないとき
   */
  loadJson(json: unknown): Warning[];
  /** 現在のテンプレートのコピー */
  getJson(): Template;
  /** 配信用 HTML。mergeValues を渡したときだけ、値の無いキーに mergeTags の fallback を使う */
  exportHtml(options?: RenderHtmlOptions): string;
  /** テキストパート（手直しがあればそれ、無ければ自動生成） */
  exportText(options?: RenderTextOptions): string;
  /** HTML とテキストをまとめて書き出す */
  export(options?: { html?: RenderHtmlOptions; text?: RenderTextOptions }): {
    html: string;
    text: string;
  };
  /** コンポーネントを複製して入れる（選択中の要素の後ろ）。入れた要素の ID（入れられなければ null） */
  insertComponent(component: Component): string | null;
  /** 元に戻す（できたら true） */
  undo(): boolean;
  /** やり直す（できたら true） */
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  /** 行・カラム・ブロックを ID で選択する（null で解除）。配列なら行どうし・ブロックどうしをまとめて選ぶ */
  select(id: string | readonly string[] | null): void;

  addEventListener<K extends keyof MailmasonEditorEventMap>(
    type: K,
    listener: (this: MailmasonEditor, event: MailmasonEditorEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
  removeEventListener<K extends keyof MailmasonEditorEventMap>(
    type: K,
    listener: (this: MailmasonEditor, event: MailmasonEditorEventMap[K]) => unknown,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}

declare global {
  interface HTMLElementTagNameMap {
    'mailmason-editor': MailmasonEditor;
  }
}
