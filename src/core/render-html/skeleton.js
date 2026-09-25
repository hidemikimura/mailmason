// HTML の骨格: DOCTYPE、head（メタ・Outlook 設定・メディアクエリ）、プリヘッダー、外枠
import { escapeText } from '../richtext/entities.js';
import { styleAttr } from './styles.js';
import { wrap } from './lines.js';
import {
  backgroundAttr,
  backgroundDecls,
  hasBackgroundImage,
  vmlPageBackground,
  withVmlBackground,
} from './background.js';
import { TABLE_OPEN } from './styles.js';

/** @import { Lines, Wrapped } from './lines.js' */
/** @import { BodySettings } from '../model/types.js' */
/** @import { ResolvedHtmlOptions } from '../blocks/types.js' */

/** プリヘッダーの後ろを埋める不可視文字（本文の冒頭がプレビューに混ざらないようにする） */
const PREHEADER_FILLER = '&#847;&zwnj;&nbsp;'.repeat(40);

/**
 * @param {BodySettings} body
 * @param {ResolvedHtmlOptions} options
 * @returns {Wrapped}
 */
function head(body, options) {
  const breakpoint = body.width + 20;
  return wrap(
    '<head>',
    [
      '<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0" />',
      '<meta http-equiv="X-UA-Compatible" content="IE=edge" />',
      '<meta name="x-apple-disable-message-reformatting" />',
      '<meta name="format-detection" content="telephone=no, date=no, address=no, email=no" />',
      '<meta name="color-scheme" content="light dark" />',
      '<meta name="supported-color-schemes" content="light dark" />',
      `<title>${escapeText(body.title)}</title>`,
      '<!--[if mso]>',
      '<noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>',
      `<style type="text/css">table,td,div,p,h1,h2,h3,li,a,span,center{font-family:${options.outlookFontFamily} !important;}</style>`,
      '<![endif]-->',
      wrap(
        '<style type="text/css">',
        [
          'body{margin:0;padding:0;width:100%;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}',
          'table,td{border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;}',
          'img{border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;}',
          'a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;font-size:inherit !important;font-family:inherit !important;font-weight:inherit !important;line-height:inherit !important;}',
          wrap(
            `@media only screen and (max-width:${breakpoint}px){`,
            [
              '.mm-col{display:block !important;width:100% !important;max-width:100% !important;padding-left:0 !important;padding-right:0 !important;}',
              '.mm-it-text{padding-top:12px !important;}',
              '.mm-stack-gap{padding-top:12px !important;}',
              '.mm-fluid{max-width:100% !important;height:auto !important;}',
              '.mm-video-169{height:50vw !important;}',
              '.mm-video-43{height:67vw !important;}',
              '.mm-video-11{height:89vw !important;}',
              '.mm-hide-mobile{display:none !important;max-height:0 !important;overflow:hidden !important;mso-hide:all !important;}',
            ],
            '}',
          ),
        ],
        '</style>',
      ),
    ],
    '</head>',
  );
}

/**
 * @param {BodySettings} body
 * @param {ResolvedHtmlOptions} options
 * @param {Lines} rows 本文テーブルの中身（行の <tr> 群）
 * @returns {Lines}
 */
export function skeleton(body, options, rows) {
  const preheader = body.preheader
    ? [
        `<div${styleAttr('display:none', 'font-size:1px', `color:${body.backgroundColor}`, 'line-height:1px', 'max-height:0', 'max-width:0', 'opacity:0', 'overflow:hidden', 'mso-hide:all')}>${escapeText(body.preheader)}${PREHEADER_FILLER}</div>`,
      ]
    : [];
  const container = `<table role="presentation" class="mm-container" width="${body.width}" cellpadding="0" cellspacing="0" border="0"${styleAttr('width:100%', `max-width:${body.width}px`, `background-color:${body.contentBackgroundColor}`)}>`;
  // 本文の背景画像: 行をまとめて 1 つのセルに入れ、そのセルに背景を敷く（Outlook は VML）
  const content = hasBackgroundImage(body.contentBackgroundImage)
    ? [
        wrap(
          '<tr>',
          [
            wrap(
              `<td${backgroundAttr(body.contentBackgroundImage)}${styleAttr(`background-color:${body.contentBackgroundColor}`, ...backgroundDecls(body.contentBackgroundImage))}>`,
              withVmlBackground(
                body.contentBackgroundImage,
                body.contentBackgroundColor,
                body.width,
                [wrap(`${TABLE_OPEN}>`, rows, '</table>')],
              ),
              '</td>',
            ),
          ],
          '</tr>',
        ),
      ]
    : rows;
  const outerImage = body.backgroundImage;

  return [
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">',
    wrap(
      `<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" lang="${options.lang}">`,
      [
        head(body, options),
        wrap(
          `<body${styleAttr('margin:0', 'padding:0', 'word-spacing:normal', `background-color:${body.backgroundColor}`)}>`,
          [
            ...vmlPageBackground(outerImage, body.backgroundColor),
            ...preheader,
            wrap(
              `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"${styleAttr(`background-color:${body.backgroundColor}`, ...backgroundDecls(outerImage))}>`,
              [
                wrap(
                  '<tr>',
                  [
                    wrap(
                      `<td align="center"${backgroundAttr(outerImage)}>`,
                      [
                        `<!--[if mso]><table role="presentation" width="${body.width}" align="center" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->`,
                        wrap(container, content, '</table>'),
                        '<!--[if mso]></td></tr></table><![endif]-->',
                      ],
                      '</td>',
                    ),
                  ],
                  '</tr>',
                ),
              ],
              '</table>',
            ),
          ],
          '</body>',
        ),
      ],
      '</html>',
    ),
  ];
}
