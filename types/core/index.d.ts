// @hidemikimura/mailmason/core の型定義（手書き）。
// 公開 API だけを定義する。実装（src/core）を変えたら合わせて直す。
// ずれは test/core/types.test.js と test/types（npm run typecheck）で検出する

// ---------------------------------------------------------------------------
// 基本の型
// ---------------------------------------------------------------------------

/** 行のレイアウト（12 分割の比） */
export type RowLayout = '1' | '1:1' | '1:1:1' | '1:2' | '2:1' | '1:1:1:1';

/** 余白（px） */
export interface Spacing {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/** 横位置 */
export type Align = 'left' | 'center' | 'right';

/** 色（`#rrggbb`） */
export type Color = string;

/** 背景画像の位置（横 縦） */
export type BackgroundPosition =
  | 'left top'
  | 'center top'
  | 'right top'
  | 'left center'
  | 'center center'
  | 'right center'
  | 'left bottom'
  | 'center bottom'
  | 'right bottom';

/**
 * 背景画像（src が空なら背景画像なし）。Outlook（Windows）では VML で敷く。
 * 背景画像のある要素の中の背景画像は、Outlook では表示せず背景色になる
 */
export interface BackgroundImage {
  /** 画像の URL */
  src: string;
  /** cover: 全面を覆う / contain: 全体が入る / auto: 原寸 */
  size: 'cover' | 'contain' | 'auto';
  position: BackgroundPosition;
  repeat: 'no-repeat' | 'repeat';
  /** アップロード時にアプリが返した任意のデータ（出力には使わない） */
  uploadData: Record<string, unknown> | null;
}

/** メール全体の設定（`body.settings`） */
export interface BodySettings {
  /** 本文の幅（px、320〜1200 の整数） */
  width: number;
  /** 外側の背景色 */
  backgroundColor: Color;
  /** 外側の背景画像 */
  backgroundImage: BackgroundImage;
  /** 本文の背景色 */
  contentBackgroundColor: Color;
  /** 本文の背景画像 */
  contentBackgroundImage: BackgroundImage;
  /** 基本のフォント */
  fontFamily: string;
  /** 基本の文字サイズ（px、8〜72） */
  fontSize: number;
  /** 行の高さ（倍率、0.8〜3） */
  lineHeight: number;
  /** 文字色 */
  textColor: Color;
  /** リンクの色 */
  linkColor: Color;
  /** プリヘッダー（受信一覧で件名の後ろに出る短い文） */
  preheader: string;
  /** HTML の title */
  title: string;
}

/** 行の設定 */
export interface RowSettings {
  backgroundColor: Color | null;
  backgroundImage: BackgroundImage;
  padding: Spacing;
  /** カラムの間隔（px、0〜100 の整数） */
  columnGap: number;
  /** スマホではカラムを縦に並べる */
  stackOnMobile: boolean;
  hideOn: 'mobile' | null;
}

/** カラムの設定 */
export interface ColumnSettings {
  backgroundColor: Color | null;
  backgroundImage: BackgroundImage;
  padding: Spacing;
  verticalAlign: 'top' | 'middle' | 'bottom';
}

/** ブロックの共通スタイル */
export interface BlockStyle {
  backgroundColor: Color | null;
  padding: Spacing;
}

/** アップロード時にアプリが返した任意のデータ（出力には使わない） */
export type UploadData = Record<string, unknown> | null;

// ---------------------------------------------------------------------------
// 標準ブロックの values
// ---------------------------------------------------------------------------

/** テキスト（リッチテキスト）。文字設定が null の項目はボディ設定を使う */
export interface TextValues {
  /** 許可したタグだけの HTML（p / h1〜h3 / ul / ol / li / br / strong / em / u / s / a / span） */
  html: string;
  fontFamily: string | null;
  /** 8〜72 */
  fontSize: number | null;
  /** 0.8〜3 */
  lineHeight: number | null;
  color: Color | null;
}

/** 画像の幅（% はブロック幅に対する割合） */
export interface ImageWidth {
  unit: '%' | 'px';
  /** 1〜1200 */
  value: number;
}

/** 画像 */
export interface ImageValues {
  /** 画像の URL。空なら出力しない */
  src: string;
  alt: string;
  href: string;
  width: ImageWidth;
  align: Align;
  /** 画像の実際の幅（px）。あると Outlook 用に height 属性を出す */
  naturalWidth: number | null;
  naturalHeight: number | null;
  uploadData: UploadData;
}

/** ボタン。label が空なら出力しない */
export interface ButtonValues {
  label: string;
  href: string;
  backgroundColor: Color;
  color: Color;
  /** 8〜72 */
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  /** 0〜100 の整数 */
  borderRadius: number;
  innerPadding: Spacing;
  /** auto: 文字に合わせる / full: 全幅 */
  width: 'auto' | 'full';
  align: Align;
}

/** 区切り線 */
export interface DividerValues {
  /** 1〜20 の整数 */
  thickness: number;
  color: Color;
  lineStyle: 'solid' | 'dashed' | 'dotted';
  /** ブロック幅に対する %（1〜100 の整数） */
  widthPercent: number;
  align: Align;
}

/** スペーサー */
export interface SpacerValues {
  /** 高さ（px、1〜500 の整数） */
  height: number;
}

/** 画像＋テキストの画像 */
export interface ImageTextImage {
  src: string;
  alt: string;
  href: string;
  naturalWidth: number | null;
  naturalHeight: number | null;
  uploadData: UploadData;
}

/** 画像＋テキスト（スマホでは縦に並ぶ） */
export interface ImageTextValues {
  image: ImageTextImage;
  imagePosition: 'left' | 'right';
  /** 画像の幅（ブロック幅に対する %、10〜90 の整数） */
  imageWidthPercent: number;
  /** テキスト（TextValues['html'] と同じ許可タグ） */
  html: string;
}

/** 画像ギャラリー・動画のサムネイルの画像 */
export interface MediaImage {
  src: string;
  alt: string;
  naturalWidth: number | null;
  naturalHeight: number | null;
  uploadData: UploadData;
}

/** 画像ギャラリーの 1 枚 */
export interface GalleryItem {
  image: MediaImage;
  href: string;
}

/** 画像ギャラリー（2〜4 列の格子） */
export interface GalleryValues {
  /** src が空の項目は出力しない */
  items: GalleryItem[];
  columns: '2' | '3' | '4';
  /** 画像の間の余白（px、0〜40 の整数） */
  gap: number;
  /** スマホでは 1 列に並べて画面幅いっぱいに広げる */
  stackOnMobile: boolean;
}

/** 動画（サムネイルに再生ボタンを重ねて動画のページにリンクする） */
export interface VideoValues {
  /** 動画のページの URL */
  url: string;
  /** サムネイル。src が空なら出力しない */
  thumbnail: MediaImage;
  /** none なら画像ブロックと同じ出力 */
  playButton: 'dark' | 'light' | 'none';
  /** 再生ボタンがあるときの縦横比（はみ出す分は切る） */
  ratio: '16:9' | '4:3' | '1:1';
  width: ImageWidth;
  align: Align;
}

/** ボタンの並びの 1 つ */
export interface ButtonsItem {
  label: string;
  href: string;
  backgroundColor: Color;
  color: Color;
}

/** ボタンの並び（見た目は共通、色はボタンごと） */
export interface ButtonsValues {
  /** label が空の項目は出力しない */
  items: ButtonsItem[];
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  borderRadius: number;
  innerPadding: Spacing;
  /** ボタンの間隔（px、0〜60 の整数） */
  gap: number;
  /** ブロックの幅を等分してボタンの幅をそろえる */
  equalWidth: boolean;
  stackOnMobile: boolean;
  align: Align;
}

/** メニューの項目 */
export interface MenuItem {
  label: string;
  /** 空なら文字だけ */
  href: string;
}

/** メニュー（リンクを区切り文字でつないで 1 行に並べる） */
export interface MenuValues {
  /** label が空の項目は出力しない */
  items: MenuItem[];
  /** 区切り文字（空なら空白） */
  separator: string;
  /** 項目の間隔（px、0〜60 の整数） */
  spacing: number;
  fontSize: number;
  fontWeight: 'normal' | 'bold';
  /** null ならボディの文字色 */
  color: Color | null;
  separatorColor: Color;
  underline: boolean;
  align: Align;
}

/** 表の列 */
export interface TableColumn {
  /** 表の幅に対する %（1〜100 の整数）。null の列は残りを等分する */
  width: number | null;
  align: Align;
}

/** 表 */
export interface TableValues {
  /**
   * 行ごとのセル。各セルは段落を持たないリッチテキスト（strong / em / u / s / a / span / br）。
   * 読み込み時に列の数（columns）にそろえる。行は 1〜50、列は 1〜8
   */
  cells: string[][];
  columns: TableColumn[];
  /** 1 行目を見出し（th）にする */
  headerRow: boolean;
  headerBackgroundColor: Color;
  /** null なら本文と同じ */
  headerColor: Color | null;
  borderColor: Color;
  /** 0〜8 の整数（0 で罫線なし） */
  borderWidth: number;
  /** 0〜40 の整数 */
  cellPadding: number;
  striped: boolean;
  stripeColor: Color;
  fontSize: number | null;
  color: Color | null;
}

/** SNS のサービス */
export type SocialService =
  'x' | 'facebook' | 'instagram' | 'line' | 'youtube' | 'tiktok' | 'linkedin' | 'website' | 'email';

/** SNS リンクの項目 */
export interface SocialItem {
  service: SocialService;
  /** 空の項目は出力しない（mailto: も可） */
  url: string;
}

/** SNS リンク */
export interface SocialValues {
  items: SocialItem[];
  /** 16〜64 の整数 */
  iconSize: number;
  align: Align;
  iconStyle: 'color' | 'mono';
}

/** QR コード（画像はエディタが作って onImageUpload でアップロードする） */
export interface QrValues {
  /** QR にする文字列（差し込み変数は使えない） */
  content: string;
  /** 表示サイズ（px、48〜600 の整数） */
  size: number;
  ecLevel: 'L' | 'M' | 'Q' | 'H';
  /** 周りの余白（升目の数、0〜8 の整数） */
  margin: number;
  color: Color;
  backgroundColor: Color;
  /** アップロードした QR 画像の URL。空なら出力しない */
  src: string;
  alt: string;
  href: string;
  align: Align;
  /** src の画像を作ったときの設定（qrSignature() の値） */
  generated: string | null;
  uploadData: UploadData;
}

/** 生の HTML（そのまま出力する） */
export interface HtmlValues {
  html: string;
}

/** 標準ブロックの type と values の対応 */
export interface BlockValuesMap {
  text: TextValues;
  image: ImageValues;
  button: ButtonValues;
  divider: DividerValues;
  spacer: SpacerValues;
  imageText: ImageTextValues;
  gallery: GalleryValues;
  video: VideoValues;
  buttons: ButtonsValues;
  menu: MenuValues;
  table: TableValues;
  social: SocialValues;
  qr: QrValues;
  html: HtmlValues;
}

/** 標準ブロックの type */
export type BuiltinBlockType = keyof BlockValuesMap;

/** カスタムブロックの type（英小文字・数字・ハイフン。ハイフンを 1 つ以上含む） */
export type CustomBlockType = `${string}-${string}`;

/** ブロックの共通部分 */
export interface BlockBase<T extends string = string, V = Record<string, unknown>> {
  id: string;
  type: T;
  values: V;
  style: BlockStyle;
  hideOn: 'mobile' | null;
}

/** 標準ブロック。`BlockOf<'table'>` のように type を指定して使う */
export type BlockOf<T extends BuiltinBlockType> = BlockBase<T, BlockValuesMap[T]>;

/** 標準ブロックのどれか（type で絞り込める） */
export type BuiltinBlock = { [T in BuiltinBlockType]: BlockOf<T> }[BuiltinBlockType];

/** カスタムブロック（values の形はアプリの定義で決まる） */
export type CustomBlockData = BlockBase<CustomBlockType, Record<string, unknown>>;

/**
 * ブロック。`block.type === 'table'` のように調べると values の型が絞り込まれる。
 * 新しいバージョンで増えたブロックなど、未知の type のブロック（読み込み時に `unknown-block-type`）も
 * テンプレートに残るので、type で分岐するときは既定の分岐も用意する
 */
export type Block = BuiltinBlock | CustomBlockData;

/** カラム */
export interface Column {
  id: string;
  settings: ColumnSettings;
  blocks: Block[];
}

/** 行 */
export interface Row {
  id: string;
  layout: RowLayout;
  settings: RowSettings;
  /** レイアウトの数だけ並ぶ */
  columns: Column[];
}

/** 本文 */
export interface Body {
  settings: BodySettings;
  rows: Row[];
}

/** テキストパート（手編集の状態） */
export interface TextPart {
  mode: 'auto' | 'manual';
  /** 手編集したテキスト（manual のとき） */
  content: string | null;
  /** 手編集を始めた時点の自動生成テキストのハッシュ */
  sourceHash: string | null;
}

/** テンプレート JSON（保存するのはこれだけ） */
export interface Template {
  version: 1;
  body: Body;
  text: TextPart;
}

/** オブジェクトを深く省略可能にする（配列の要素も省略可能。省略した項目は既定値で補う） */
export type DeepPartial<T> = T extends readonly (infer U)[]
  ? DeepPartial<U>[]
  : T extends object
    ? { [K in keyof T]?: DeepPartial<T[K]> }
    : T;

// ---------------------------------------------------------------------------
// 警告とエラー
// ---------------------------------------------------------------------------

/** 読み込み時の補正・書き出し時の注意などの警告コード */
export type WarningCode =
  | 'missing-version'
  | 'invalid-value'
  | 'unknown-key'
  | 'regenerated-id'
  | 'layout-mismatch'
  | 'unknown-block-type'
  | 'sanitized-html'
  | 'unknown-merge-tag'
  | 'html-size'
  | 'stale-text'
  | 'image-upload-type'
  | 'image-upload-size'
  | 'image-upload-failed'
  | 'qr-missing'
  | 'qr-stale'
  | 'qr-too-long'
  | 'qr-failed'
  | 'component-save-failed'
  | 'component-delete-failed'
  | 'invalid-component'
  | 'block-action-failed'
  | (string & {});

/** 警告 */
export interface Warning {
  code: WarningCode;
  /** 問題の場所（例: `body.rows[0].columns[0].blocks[1].values.width`） */
  path: string;
  message: string;
}

/** MailmasonError の code */
export type MailmasonErrorCode =
  | 'invalid-json'
  | 'invalid-template'
  | 'invalid-version'
  | 'unsupported-version'
  | 'invalid-layout'
  | 'unknown-block-type'
  | 'not-found'
  | 'duplicate-id'
  | 'invalid-command'
  | 'invalid-component'
  | 'invalid-block-definition'
  | (string & {});

/** Mailmason が投げるエラー */
export declare class MailmasonError extends Error {
  constructor(code: MailmasonErrorCode, message: string, options?: { path?: string });
  code: MailmasonErrorCode;
  path: string | null;
}

// ---------------------------------------------------------------------------
// 部品を作る
// ---------------------------------------------------------------------------

/** テンプレートのバージョン */
export declare const TEMPLATE_VERSION: 1;

/** 行（r）・カラム（c）・ブロック（b）の ID を作る */
export declare function createId(prefix: 'r' | 'c' | 'b'): string;

/** 空のテンプレートを作る。theme はボディ設定の初期値 */
export declare function createTemplate(theme?: Partial<BodySettings>): Template;

/** 行を作る。columnBlocks[i] が i 番目のカラムの初期ブロック */
export declare function createRow(layout?: RowLayout, columnBlocks?: Block[][]): Row;

/** 空のカラムを作る */
export declare function createColumn(blocks?: Block[]): Column;

/**
 * ブロックを作る。values は既定値に深くマージし、スキーマで整える
 * @throws {MailmasonError} unknown-block-type
 */
export declare function createBlock<T extends BuiltinBlockType>(
  type: T,
  values?: DeepPartial<BlockValuesMap[T]>,
  options?: BlocksOption,
): BlockOf<T>;
/** カスタムブロック（または type が string の変数）。標準ブロックの type は上の形で検査する */
export declare function createBlock<T extends string>(
  type: T extends BuiltinBlockType ? never : T,
  values?: Record<string, unknown>,
  options?: BlocksOption,
): Block;

/** 行を複製する（配下すべてに新しい ID を振る） */
export declare function cloneRow(row: Row): Row;

/** ブロックを複製する（新しい ID を振る） */
export declare function cloneBlock<B extends Block>(block: B): B;

/** ボディ設定の既定値 */
export declare function defaultBodySettings(): BodySettings;

/** レイアウトごとのカラムの比 */
export declare const ROW_LAYOUTS: Readonly<Record<RowLayout, readonly number[]>>;

/** レイアウトの一覧（パレットの並び順） */
export declare const ROW_LAYOUT_NAMES: readonly RowLayout[];

/** レイアウトのカラムの比（例: '1:2' → [4, 8]） */
export declare function getLayoutSpans(layout: RowLayout): readonly number[];

/** カラムの寸法（px） */
export interface ColumnBox {
  columnId: string;
  /** カラムの外側の幅（隙間を含む） */
  outerWidth: number;
  gapLeft: number;
  gapRight: number;
  /** カラムの余白を除いた幅 */
  contentWidth: number;
}

/** 行の寸法（px） */
export interface RowBox {
  rowId: string;
  /** 行の余白を除いた幅 */
  contentWidth: number;
  columns: ColumnBox[];
}

/** 各行・各カラムの幅（px、整数）を求める（行 ID → 寸法） */
export declare function computeLayout(template: Template): Map<string, RowBox>;

/** 標準ブロックの type 一覧（パレットの並び順） */
export declare const BLOCK_TYPES: readonly BuiltinBlockType[];

/** SNS のサービスの一覧 */
export declare const SOCIAL_SERVICES: readonly SocialService[];

// ---------------------------------------------------------------------------
// 探す
// ---------------------------------------------------------------------------

/** 行の位置（無ければ -1） */
export declare function findRowIndex(template: Template, rowId: string): number;

/** カラムの位置 */
export declare function locateColumn(
  template: Template,
  columnId: string,
): { rowIndex: number; columnIndex: number } | null;

/** ブロックの位置 */
export declare function locateBlock(
  template: Template,
  blockId: string,
): { rowIndex: number; columnIndex: number; blockIndex: number } | null;

// ---------------------------------------------------------------------------
// ブロックごとの補助
// ---------------------------------------------------------------------------

/** QR 画像を作ったときの設定の署名（values.generated に入れる値） */
export declare function qrSignature(
  values: Pick<QrValues, 'content' | 'size' | 'ecLevel' | 'margin' | 'color' | 'backgroundColor'>,
): string;

/**
 * QR コードのブロックの状態。empty: 内容が空 / missing: 画像が未作成 /
 * stale: 作成後に設定が変わった / ok
 */
export declare function qrStatus(block: Block): 'empty' | 'missing' | 'stale' | 'ok';

/** YouTube の URL から動画 ID を取り出す（watch / youtu.be / shorts / embed / live） */
export declare function youtubeVideoId(url: string): string | null;

/** YouTube の URL ならサムネイル画像（480×360 の hqdefault）の情報を返す */
export declare function youtubeThumbnail(
  url: string,
): { src: string; naturalWidth: number; naturalHeight: number } | null;

// ---------------------------------------------------------------------------
// カスタムブロック
// ---------------------------------------------------------------------------

/** 表示用の文字列。言語ごとに変えるときは `{ ja: '…', en: '…' }` */
export type Label = string | Record<string, string>;

/** select / align の選択肢 */
export interface CustomChoice {
  value: string;
  label: Label;
}

/** action の run に渡す情報 */
export interface CustomActionContext {
  /** ブロックの今の values */
  values: Record<string, unknown>;
  blockId: string;
  locale: string;
}

/** カスタムブロックの設定項目 */
export interface CustomField {
  kind:
    | 'text'
    | 'textarea'
    | 'url'
    | 'number'
    | 'color'
    | 'select'
    | 'align'
    | 'toggle'
    | 'image'
    | 'list'
    | 'action'
    | 'element';
  /** values のキー（action 以外は必須） */
  key?: string;
  label: Label;
  /** 入力欄の下に出す説明 */
  help?: Label;
  /** 既定値（省略時は種類ごとの既定値） */
  default?: unknown;
  /** 差し込み変数を使えるか（text / textarea / url / image の代替テキスト） */
  mergeTags?: boolean;
  placeholder?: Label;
  /** number: 最小値 / list: 最少件数 */
  min?: number;
  /** number: 最大値 / list: 最多件数 */
  max?: number;
  step?: number;
  /** number: 単位（'px' など） */
  unit?: string;
  integer?: boolean;
  /** number / color: 空（null）を許す */
  nullable?: boolean;
  /** select / align の選択肢 */
  choices?: CustomChoice[];
  /** list: 1 件分の設定項目（list と action は置けない） */
  fields?: CustomField[];
  /** list: 各項目の見出し */
  itemLabel?: Label | ((item: Record<string, unknown>, index: number) => string);
  /** action: 押したときに呼ぶ。返した値を values にマージする（null / undefined なら何もしない） */
  run?: (
    context: CustomActionContext,
  ) =>
    | Promise<Record<string, unknown> | null | undefined>
    | Record<string, unknown>
    | null
    | undefined;
  /** element: 設定欄に置くカスタム要素のタグ名 */
  tagName?: string;
  /** 条件付きで表示する */
  visible?: (values: Record<string, unknown>) => boolean;
}

/** renderHtml の ctx.image に渡す画像 */
export interface CustomImageParams {
  src: string;
  alt?: string;
  href?: string;
  /** 表示幅（px）。既定はブロック幅 */
  width?: number;
  naturalWidth?: number | null;
  naturalHeight?: number | null;
  align?: Align;
}

/** renderHtml の ctx.button に渡すボタン */
export interface CustomButtonParams {
  label: string;
  href?: string;
  backgroundColor?: Color;
  color?: Color;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  borderRadius?: number;
  innerPadding?: Spacing;
  width?: 'auto' | 'full';
}

/** renderHtml に渡す道具 */
export interface CustomHtmlContext {
  /** ブロックの内容幅（px、ブロックの余白を除く） */
  width: number;
  /** メール全体の設定 */
  body: BodySettings;
  blockId: string;
  locale: string;
  /** 差し込み値（書き出しで渡されたとき） */
  mergeValues: Record<string, string> | null;
  /** テキストを HTML 用にエスケープする */
  escape(text: string): string;
  /** 属性値用にエスケープする */
  escapeAttr(text: string): string;
  /** エスケープして改行を `<br />` にする */
  text(text: string): string;
  /** メール向けの img（リンク付きなら a で包む）。src が空なら空文字 */
  image(image: CustomImageParams): string;
  /** メール向けのボタン（Outlook では VML の角丸ボタン）。label が空なら空文字 */
  button(button: CustomButtonParams): string;
}

/** renderText に渡す情報 */
export interface CustomTextContext {
  blockId: string;
  locale: string;
}

/** defineBlock() に渡す定義 */
export interface CustomBlockInput {
  /** 英小文字・数字・ハイフン。ハイフンを 1 つ以上含む（例: 'acme-coupon'） */
  type: string;
  label: Label;
  /** パレットのアイコン（SVG の文字列） */
  icon?: string;
  fields: CustomField[];
  /** 配信用の HTML。空文字・null なら出力しない */
  renderHtml(
    values: Record<string, any>,
    ctx: CustomHtmlContext,
  ): string | string[] | null | undefined;
  /** テキストパート（省略時は出さない） */
  renderText?(values: Record<string, any>, ctx: CustomTextContext): string | null | undefined;
  /** ブロックを包むセルの横位置 */
  align?(values: Record<string, any>): Align;
  /** 共通スタイルの既定値 */
  defaultStyle?: { backgroundColor?: Color | null; padding?: number | Spacing };
}

/** defineBlock() の戻り値。エディタの `blocks` と書き出しの `blocks` オプションに渡す */
export interface CustomBlock {
  readonly custom: true;
  readonly type: string;
  readonly label: Label;
  readonly icon: string | null;
  readonly fields: readonly CustomField[];
  /** 新しいブロックの values */
  defaults(): Record<string, unknown>;
}

/**
 * カスタムブロックを定義する
 * @throws {MailmasonError} invalid-block-definition
 */
export declare function defineBlock(input: CustomBlockInput): CustomBlock;

/** カスタムブロックの定義を渡すオプション（渡さないとカスタムブロックは未知のブロックになる） */
export interface BlocksOption {
  blocks?: readonly CustomBlock[] | null;
}

// ---------------------------------------------------------------------------
// コンポーネント（保存した行・ブロック）
// ---------------------------------------------------------------------------

/** 保存するコンポーネント。id はアプリが保存するときに付ける */
export interface Component {
  id?: string;
  /** 表示名 */
  name: string;
  kind: 'row' | 'block';
  /** 作ったときのテンプレートのバージョン */
  version: number;
  content: Row | Block;
}

/** テンプレートの行またはブロックをコンポーネントとして切り出す（見つからなければ null） */
export declare function extractComponent(
  template: Template,
  id: string,
  options: { name: string },
): Component | null;

/**
 * コンポーネントを、テンプレートに入れられる行またはブロックにする（中身を整え、ID を振り直す）
 * @throws {MailmasonError} invalid-component / unsupported-version
 */
export declare function instantiateComponent(
  component: unknown,
  options?: BlocksOption & { mergeTagDelimiters?: MergeTagDelimiters },
):
  | { kind: 'row'; row: Row; warnings: Warning[] }
  | { kind: 'block'; block: Block; warnings: Warning[] };

/** 行またはブロックの ID か（コンポーネントとして保存できるか） */
export declare function componentKindOf(
  template: Template,
  id: string | null,
): 'row' | 'block' | null;

// ---------------------------------------------------------------------------
// 読み込みと検査
// ---------------------------------------------------------------------------

export interface MigrateOptions extends BlocksOption {
  mergeTagDelimiters?: MergeTagDelimiters;
}

/**
 * テンプレート（オブジェクトまたは JSON 文字列）を今の形に整える。欠けた項目は補い、直した箇所を警告で返す
 * @throws {MailmasonError} invalid-json / invalid-template / invalid-version / unsupported-version
 */
export declare function migrate(
  input: unknown,
  options?: MigrateOptions,
): { template: Template; warnings: Warning[] };

/** テンプレートを検査する（例外を投げない） */
export declare function validate(
  input: unknown,
  options?: MigrateOptions,
): { valid: boolean; warnings: Warning[]; error: MailmasonError | null };

// ---------------------------------------------------------------------------
// コマンドとストア
// ---------------------------------------------------------------------------

export interface AddRowCommand {
  type: 'addRow';
  layout?: RowLayout;
  index?: number;
  /** 作った行（省略時は layout から作る） */
  row?: Row;
}
export interface MoveRowCommand {
  type: 'moveRow';
  rowId: string;
  index: number;
}
export interface DuplicateRowCommand {
  type: 'duplicateRow';
  rowId: string;
}
export interface RemoveRowCommand {
  type: 'removeRow';
  rowId: string;
}
export interface SetRowLayoutCommand {
  type: 'setRowLayout';
  rowId: string;
  layout: RowLayout;
}
export interface UpdateRowSettingsCommand {
  type: 'updateRowSettings';
  rowId: string;
  patch: DeepPartial<RowSettings>;
}
export interface UpdateColumnSettingsCommand {
  type: 'updateColumnSettings';
  columnId: string;
  patch: DeepPartial<ColumnSettings>;
}
export interface UpdateBodySettingsCommand {
  type: 'updateBodySettings';
  patch: Partial<BodySettings>;
}
export interface AddBlockCommand {
  type: 'addBlock';
  columnId: string;
  index?: number;
  /** 作ったブロック（省略時は blockType と values から作る） */
  block?: Block;
  blockType?: string;
  values?: Record<string, unknown>;
}
export interface MoveBlockCommand {
  type: 'moveBlock';
  blockId: string;
  columnId: string;
  index: number;
}
export interface MoveBlockToNewRowCommand {
  type: 'moveBlockToNewRow';
  blockId: string;
  index: number;
  layout?: RowLayout;
}
export interface DuplicateBlockCommand {
  type: 'duplicateBlock';
  blockId: string;
}
export interface RemoveBlockCommand {
  type: 'removeBlock';
  blockId: string;
}
export interface UpdateBlockValuesCommand {
  type: 'updateBlockValues';
  blockId: string;
  /** values に深くマージする（配列と任意のオブジェクトの項目は置き換え） */
  patch: Record<string, unknown>;
}
export interface UpdateBlockStyleCommand {
  type: 'updateBlockStyle';
  blockId: string;
  patch: DeepPartial<BlockStyle>;
}
export interface SetBlockHideOnCommand {
  type: 'setBlockHideOn';
  blockId: string;
  hideOn: 'mobile' | null;
}
export interface SetTextPartCommand {
  type: 'setTextPart';
  content: string;
  sourceHash?: string | null;
}
export interface ResetTextPartCommand {
  type: 'resetTextPart';
}
export interface LoadTemplateCommand {
  type: 'loadTemplate';
  template: Template;
}

/** テンプレートを変更するコマンド。mergeKey が同じ連続した変更は 1 つの履歴にまとめる */
export type Command = (
  | AddRowCommand
  | MoveRowCommand
  | DuplicateRowCommand
  | RemoveRowCommand
  | SetRowLayoutCommand
  | UpdateRowSettingsCommand
  | UpdateColumnSettingsCommand
  | UpdateBodySettingsCommand
  | AddBlockCommand
  | MoveBlockCommand
  | MoveBlockToNewRowCommand
  | DuplicateBlockCommand
  | RemoveBlockCommand
  | UpdateBlockValuesCommand
  | UpdateBlockStyleCommand
  | SetBlockHideOnCommand
  | SetTextPartCommand
  | ResetTextPartCommand
  | LoadTemplateCommand
) & { mergeKey?: string };

/**
 * コマンドを適用した新しいテンプレートを返す（元は変えない）
 * @throws {MailmasonError} not-found / invalid-command など
 */
export declare function applyCommand(
  template: Template,
  command: Command,
  warnings?: Warning[],
  options?: BlocksOption,
): Template;

export interface StoreState {
  template: Template;
  /** 選択中の行・カラム・ブロックの ID */
  selection: string | null;
}

export type StoreAction =
  Command | { type: 'undo' } | { type: 'redo' } | { type: 'select'; id: string | null };

export type StoreListener = (
  state: StoreState,
  prev: StoreState,
  action: StoreAction,
  warnings: Warning[],
) => void;

export interface StoreOptions {
  /** 保持する履歴の上限（既定 100） */
  historyLimit?: number;
  /** mergeKey が同じ変更をまとめる時間（ミリ秒、既定 500） */
  mergeWindow?: number;
  /** 現在時刻（テスト用） */
  now?: () => number;
  blocks?: readonly CustomBlock[] | (() => readonly CustomBlock[] | null) | null;
}

/** 履歴付きのストア */
export interface Store {
  getState(): StoreState;
  /** コマンドを適用する（変わったら true） */
  dispatch(command: Command): boolean;
  select(id: string | null): void;
  undo(): boolean;
  redo(): boolean;
  canUndo(): boolean;
  canRedo(): boolean;
  /** 変更を購読する。戻り値で解除 */
  subscribe(listener: StoreListener): () => void;
}

export declare function createStore(template: Template, options?: StoreOptions): Store;

// ---------------------------------------------------------------------------
// 書き出し
// ---------------------------------------------------------------------------

/** 差し込み変数の区切り */
export interface MergeTagDelimiters {
  open: string;
  close: string;
}

export interface RenderHtmlOptions extends BlocksOption {
  /** 改行・インデントを入れない（既定 false） */
  minify?: boolean;
  /** マージタグを値に置き換える（値は HTML 用にエスケープする） */
  mergeValues?: Record<string, string> | null;
  mergeTagDelimiters?: MergeTagDelimiters;
  /** SNS アイコン PNG の置き場所（空ならテキストリンク） */
  socialIconBaseUrl?: string;
  /** 'ja' | 'en'（既定 'ja'） */
  locale?: string;
  /** html 要素の lang（既定は locale） */
  lang?: string;
  /** Outlook（Windows）用のフォント（既定 'Arial, sans-serif'） */
  outlookFontFamily?: string;
}

/** Gmail が省略する大きさより少し小さい、警告を出す HTML の大きさ（バイト） */
export declare const HTML_SIZE_WARNING_BYTES: number;

/**
 * 配信用 HTML（XHTML 1.0 Transitional、テーブル＋インライン CSS）。
 * input はテンプレート（オブジェクトまたは JSON 文字列）。読み込み時と同じように整えてから書き出す
 * @throws {MailmasonError} テンプレートとして解釈できないとき
 */
export declare function renderHtml(input: unknown, options?: RenderHtmlOptions): string;

export interface RenderTextOptions extends BlocksOption {
  /** 折り返す桁数（全角 = 2 桁、0 は折り返さない。URL は折らない） */
  wrapWidth?: number;
  newline?: '\n' | '\r\n';
  /** 見出しの前に付ける記号（例: '■ '） */
  headingPrefix?: string;
  /** 区切り線（既定は '-' × 40） */
  dividerText?: string;
  locale?: string;
  /** マージタグを値に置き換える（エスケープしない） */
  mergeValues?: Record<string, string> | null;
  mergeTagDelimiters?: MergeTagDelimiters;
}

/** 自動生成のテキストパート（手編集は使わない。配信には resolveTextPart を使う） */
export declare function renderText(input: unknown, options?: RenderTextOptions): string;

export interface ResolvedTextPart {
  text: string;
  mode: 'auto' | 'manual';
  /** 手編集したテキストが本文より古い */
  stale: boolean;
}

/** 配信に使うテキストパート（手編集があればそれ、無ければ自動生成） */
export declare function resolveTextPart(
  input: unknown,
  options?: RenderTextOptions,
): ResolvedTextPart;

/** 自動生成テキストのハッシュ（手編集が古いかの判定に使う） */
export declare function textSourceHash(input: unknown, options?: RenderTextOptions): string;

/** FNV-1a の 32 ビットハッシュ（16 進数 8 桁） */
export declare function fnv1a(value: string): string;

// ---------------------------------------------------------------------------
// 差し込み変数・リッチテキスト
// ---------------------------------------------------------------------------

/** 既定の区切り（`{{` `}}`） */
export declare const DEFAULT_DELIMITERS: Readonly<MergeTagDelimiters>;

/** マージタグの正規表現（g フラグ付き。1 番目のグループがキー） */
export declare function mergeTagPattern(delimiters?: MergeTagDelimiters): RegExp;

/** 文字列に含まれるマージタグのキー（出現順、重複あり） */
export declare function extractMergeTags(value: string, delimiters?: MergeTagDelimiters): string[];

/** マージタグを値に置き換える（値の無いキーはそのまま） */
export declare function replaceMergeTags(
  value: string,
  values: Record<string, string>,
  options?: { delimiters?: MergeTagDelimiters; escape?: (value: string) => string },
): string;

/** テンプレートで使っているマージタグ */
export interface MergeTagUsage {
  key: string;
  /** ブロックの中なら ID（ボディ設定なら null） */
  blockId: string | null;
  /** 使っている項目（例: 'html'、'body.settings.preheader'） */
  field: string;
}

export declare function findMergeTags(
  template: Template,
  options?: BlocksOption & { delimiters?: MergeTagDelimiters },
): MergeTagUsage[];

/** テキストブロック用に HTML を許可タグへ整える */
export declare function sanitizeHtml(
  html: string,
  options?: { delimiters?: MergeTagDelimiters },
): string;

/** 文字列の表示幅（全角 = 2） */
export declare function stringWidth(value: string): number;
