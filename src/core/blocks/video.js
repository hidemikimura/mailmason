// 動画: サムネイルに再生ボタンを重ね、動画のページにリンクする（メールでは動画を再生できないため）。
// サムネイルはセルの背景に敷き、Outlook（Windows）では VML で敷く。
// 背景画像を表示しないメールソフトでは、黒地に再生ボタンだけが出る（リンクは効く）
import { s } from '../model/schema.js';
import { escapeAttr } from '../richtext/entities.js';
import { styleAttr, TABLE_OPEN } from '../render-html/styles.js';
import { wrap } from '../render-html/lines.js';
import { cssUrl } from '../render-html/background.js';
import { imageHtml, imageWidthSchema, pixelWidth } from './image.js';

/**
 * @typedef {Object} VideoValues
 * @property {string} url 動画のページの URL
 * @property {{ src: string, alt: string, naturalWidth: number | null, naturalHeight: number | null, uploadData: Record<string, unknown> | null }} thumbnail
 * @property {'dark' | 'light' | 'none'} playButton 再生ボタンの見た目（none なら画像をそのまま出す）
 * @property {'16:9' | '4:3' | '1:1'} ratio 再生ボタン付きのときの縦横比（サムネイルははみ出す分を切る）
 * @property {{ unit: '%' | 'px', value: number }} width
 * @property {'left' | 'center' | 'right'} align
 */

/** 再生ボタンの直径（px） */
const PLAY_SIZE = 64;

/** 縦横比ごとの高さの割合と、スマホで使うクラス（高さを画面幅の vw で指定する。skeleton.js） */
export const VIDEO_RATIOS = {
  '16:9': { factor: 9 / 16, className: 'mm-video-169' },
  '4:3': { factor: 3 / 4, className: 'mm-video-43' },
  '1:1': { factor: 1, className: 'mm-video-11' },
};

/** これより狭い動画はスマホでも縮まない想定で、高さを変えない */
const MOBILE_MIN_WIDTH = 320;

// 半透明（rgba）は Outlook などが対応しないので不透明の色にする
const PLAY_STYLES = {
  dark: { background: '#1f2328', color: '#ffffff' },
  light: { background: '#ffffff', color: '#1f2328' },
};

/**
 * YouTube の URL から動画 ID を取り出す（youtube.com/watch?v=… / youtu.be/… / shorts / embed）
 * @param {string} url
 * @returns {string | null}
 */
export function youtubeVideoId(url) {
  const m =
    /^(?:https?:)?\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([\w-]{11})(?![\w-])/.exec(
      url.trim(),
    );
  return m ? m[1] : null;
}

/**
 * YouTube の URL ならサムネイル画像の情報を返す。1280×720 の maxresdefault は無い動画があるため
 * どの動画にもある 480×360 の hqdefault を使う（上下の黒帯は 16:9 で切り取られる）
 * @param {string} url
 * @returns {{ src: string, naturalWidth: number, naturalHeight: number } | null}
 */
export function youtubeThumbnail(url) {
  const id = youtubeVideoId(url);
  return id
    ? { src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`, naturalWidth: 480, naturalHeight: 360 }
    : null;
}

/** @type {import('./types.js').CoreBlockDef} */
export const videoBlock = {
  type: 'video',
  defaults: () => ({
    url: '',
    thumbnail: { src: '', alt: '', naturalWidth: null, naturalHeight: null, uploadData: null },
    playButton: 'dark',
    ratio: '16:9',
    width: { unit: '%', value: 100 },
    align: 'center',
  }),
  schema: s.object({
    url: s.string(),
    thumbnail: s.object({
      src: s.string(),
      alt: s.string(),
      naturalWidth: s.number({ min: 1, integer: true, nullable: true }),
      naturalHeight: s.number({ min: 1, integer: true, nullable: true }),
      uploadData: s.record({ nullable: true }),
    }),
    playButton: s.oneOf(['dark', 'light', 'none']),
    ratio: s.oneOf(['16:9', '4:3', '1:1']),
    width: imageWidthSchema,
    align: s.oneOf(['left', 'center', 'right']),
  }),
  mergeTagFields: ['url', 'thumbnail.alt'],
  cellAlign: (block) => /** @type {any} */ (block.values.align),

  renderHtml(block, ctx) {
    const v = /** @type {VideoValues} */ (/** @type {unknown} */ (block.values));
    const { thumbnail } = v;
    if (!thumbnail.src) return [];
    const width = pixelWidth(v.width, ctx);
    if (v.playButton === 'none') {
      return [imageHtml({ ...thumbnail, href: v.url, width, align: v.align })];
    }
    const ratio = VIDEO_RATIOS[v.ratio];
    const height = Math.max(PLAY_SIZE + 16, Math.round(width * ratio.factor));
    const cls = width > MOBILE_MIN_WIDTH ? `mm-video ${ratio.className}` : 'mm-video';
    const src = escapeAttr(thumbnail.src);
    const play = PLAY_STYLES[v.playButton];
    const button =
      `<table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0"><tr>` +
      `<td width="${PLAY_SIZE}" height="${PLAY_SIZE}" align="center" valign="middle"` +
      styleAttr(
        `width:${PLAY_SIZE}px`,
        `height:${PLAY_SIZE}px`,
        `background-color:${play.background}`,
        'border-radius:50%',
        `color:${play.color}`,
        'font-family:Arial,sans-serif',
        'font-size:26px',
        `line-height:${PLAY_SIZE}px`,
        'text-align:center',
        'text-indent:4px',
      ) +
      `>&#9654;&#65038;</td></tr></table>`;
    const name = thumbnail.alt || (ctx.options.locale === 'ja' ? '動画を再生' : 'Play video');
    const label = ` title="${escapeAttr(name)}" aria-label="${escapeAttr(name)}"`;
    const content = v.url
      ? `<a href="${escapeAttr(v.url)}" target="_blank"${label}${styleAttr('display:block', 'text-decoration:none')}>${button}</a>`
      : button;
    return [
      wrap(
        `${TABLE_OPEN.replace('width="100%"', `width="${width}"`)}${styleAttr(`width:100%`, `max-width:${width}px`)}>`,
        [
          wrap(
            '<tr>',
            [
              wrap(
                `<td class="${cls}" background="${src}" bgcolor="#000000" width="${width}" height="${height}" align="center" valign="middle"` +
                  styleAttr(
                    `height:${height}px`,
                    'background-color:#000000',
                    `background-image:url('${escapeAttr(cssUrl(thumbnail.src))}')`,
                    'background-position:center center',
                    'background-size:cover',
                    'background-repeat:no-repeat',
                  ) +
                  '>',
                [
                  '<!--[if gte mso 9]>',
                  `<v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false"${styleAttr(`width:${width}px`, `height:${height}px`)}>`,
                  `<v:fill type="frame" src="${src}" color="#000000" />`,
                  `<v:textbox inset="0,${Math.round((height - PLAY_SIZE) / 2)}px,0,0">`,
                  '<![endif]-->',
                  content,
                  '<!--[if gte mso 9]>',
                  '</v:textbox>',
                  '</v:rect>',
                  '<![endif]-->',
                ],
                '</td>',
              ),
            ],
            '</tr>',
          ),
        ],
        '</table>',
      ),
    ];
  },

  renderText(block) {
    const v = /** @type {VideoValues} */ (/** @type {unknown} */ (block.values));
    if (!v.thumbnail.src && !v.url) return '';
    if (!v.url) return v.thumbnail.alt ? `[${v.thumbnail.alt}]` : '';
    return v.thumbnail.alt ? `▶ ${v.thumbnail.alt}\n  ${v.url}` : `▶ ${v.url}`;
  },
};
