// このファイルは scripts/schema-types.js が作る（手で直さない）。
// スキーマから作った型と、手書きの型定義（types/core/index.d.ts）が同じかを tsc で確かめる
import type {
  BlockStyle,
  BlockValuesMap,
  BodySettings,
  BuiltinBlockType,
  ColumnSettings,
  RowLayout,
  RowSettings,
  SocialService,
  TextPart,
} from '@hidemikimura/mailmason/core';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Expect<T extends true> = T;

export type Checks = [
  Expect<
    Equal<
      BodySettings,
      {
        width: number;
        backgroundColor: string;
        backgroundImage: {
          src: string;
          size: 'cover' | 'contain' | 'auto';
          position:
            | 'left top'
            | 'center top'
            | 'right top'
            | 'left center'
            | 'center center'
            | 'right center'
            | 'left bottom'
            | 'center bottom'
            | 'right bottom';
          repeat: 'no-repeat' | 'repeat';
          uploadData: Record<string, unknown> | null;
        };
        contentBackgroundColor: string;
        contentBackgroundImage: {
          src: string;
          size: 'cover' | 'contain' | 'auto';
          position:
            | 'left top'
            | 'center top'
            | 'right top'
            | 'left center'
            | 'center center'
            | 'right center'
            | 'left bottom'
            | 'center bottom'
            | 'right bottom';
          repeat: 'no-repeat' | 'repeat';
          uploadData: Record<string, unknown> | null;
        };
        fontFamily: string;
        webFonts: Array<{ family: string; url: string }>;
        fontSize: number;
        mobileFontSize: number | null;
        lineHeight: number;
        textColor: string;
        linkColor: string;
        preheader: string;
        title: string;
      }
    >
  >,
  Expect<
    Equal<
      RowSettings,
      {
        backgroundColor: string | null;
        backgroundImage: {
          src: string;
          size: 'cover' | 'contain' | 'auto';
          position:
            | 'left top'
            | 'center top'
            | 'right top'
            | 'left center'
            | 'center center'
            | 'right center'
            | 'left bottom'
            | 'center bottom'
            | 'right bottom';
          repeat: 'no-repeat' | 'repeat';
          uploadData: Record<string, unknown> | null;
        };
        padding: { top: number; right: number; bottom: number; left: number };
        columnGap: number;
        stackOnMobile: boolean;
        hideOn: 'mobile' | 'desktop' | null;
      }
    >
  >,
  Expect<
    Equal<
      ColumnSettings,
      {
        backgroundColor: string | null;
        backgroundImage: {
          src: string;
          size: 'cover' | 'contain' | 'auto';
          position:
            | 'left top'
            | 'center top'
            | 'right top'
            | 'left center'
            | 'center center'
            | 'right center'
            | 'left bottom'
            | 'center bottom'
            | 'right bottom';
          repeat: 'no-repeat' | 'repeat';
          uploadData: Record<string, unknown> | null;
        };
        padding: { top: number; right: number; bottom: number; left: number };
        verticalAlign: 'top' | 'middle' | 'bottom';
      }
    >
  >,
  Expect<
    Equal<
      BlockStyle,
      {
        backgroundColor: string | null;
        padding: { top: number; right: number; bottom: number; left: number };
      }
    >
  >,
  Expect<
    Equal<TextPart, { mode: 'auto' | 'manual'; content: string | null; sourceHash: string | null }>
  >,
  Expect<
    Equal<
      BlockValuesMap['text'],
      {
        html: string;
        fontFamily: string | null;
        fontSize: number | null;
        mobileFontSize: number | null;
        lineHeight: number | null;
        color: string | null;
      }
    >
  >,
  Expect<
    Equal<
      BlockValuesMap['image'],
      {
        src: string;
        alt: string;
        href: string;
        width: { unit: '%' | 'px'; value: number };
        align: 'left' | 'center' | 'right';
        naturalWidth: number | null;
        naturalHeight: number | null;
        uploadData: Record<string, unknown> | null;
      }
    >
  >,
  Expect<
    Equal<
      BlockValuesMap['button'],
      {
        label: string;
        href: string;
        backgroundColor: string;
        color: string;
        fontSize: number;
        mobileFontSize: number | null;
        fontWeight: 'normal' | 'bold';
        borderRadius: number;
        innerPadding: { top: number; right: number; bottom: number; left: number };
        width: 'auto' | 'full';
        align: 'left' | 'center' | 'right';
      }
    >
  >,
  Expect<
    Equal<
      BlockValuesMap['divider'],
      {
        thickness: number;
        color: string;
        lineStyle: 'solid' | 'dashed' | 'dotted';
        widthPercent: number;
        align: 'left' | 'center' | 'right';
      }
    >
  >,
  Expect<Equal<BlockValuesMap['spacer'], { height: number }>>,
  Expect<
    Equal<
      BlockValuesMap['imageText'],
      {
        image: {
          src: string;
          alt: string;
          href: string;
          naturalWidth: number | null;
          naturalHeight: number | null;
          uploadData: Record<string, unknown> | null;
        };
        imagePosition: 'left' | 'right';
        imageWidthPercent: number;
        html: string;
      }
    >
  >,
  Expect<
    Equal<
      BlockValuesMap['gallery'],
      {
        items: Array<{
          image: {
            src: string;
            alt: string;
            naturalWidth: number | null;
            naturalHeight: number | null;
            uploadData: Record<string, unknown> | null;
          };
          href: string;
        }>;
        columns: '2' | '3' | '4';
        gap: number;
        stackOnMobile: boolean;
      }
    >
  >,
  Expect<
    Equal<
      BlockValuesMap['video'],
      {
        url: string;
        thumbnail: {
          src: string;
          alt: string;
          naturalWidth: number | null;
          naturalHeight: number | null;
          uploadData: Record<string, unknown> | null;
        };
        playButton: 'dark' | 'light' | 'none';
        ratio: '16:9' | '4:3' | '1:1';
        width: { unit: '%' | 'px'; value: number };
        align: 'left' | 'center' | 'right';
      }
    >
  >,
  Expect<
    Equal<
      BlockValuesMap['buttons'],
      {
        items: Array<{ label: string; href: string; backgroundColor: string; color: string }>;
        fontSize: number;
        mobileFontSize: number | null;
        fontWeight: 'normal' | 'bold';
        borderRadius: number;
        innerPadding: { top: number; right: number; bottom: number; left: number };
        gap: number;
        equalWidth: boolean;
        stackOnMobile: boolean;
        align: 'left' | 'center' | 'right';
      }
    >
  >,
  Expect<
    Equal<
      BlockValuesMap['menu'],
      {
        items: Array<{ label: string; href: string }>;
        separator: string;
        spacing: number;
        fontSize: number;
        mobileFontSize: number | null;
        fontWeight: 'normal' | 'bold';
        color: string | null;
        separatorColor: string;
        underline: boolean;
        align: 'left' | 'center' | 'right';
      }
    >
  >,
  Expect<
    Equal<
      BlockValuesMap['table'],
      {
        cells: Array<Array<string>>;
        columns: Array<{ width: number | null; align: 'left' | 'center' | 'right' }>;
        merges: Array<{ row: number; column: number; rowSpan: number; colSpan: number }>;
        headerRow: boolean;
        headerBackgroundColor: string;
        headerColor: string | null;
        borderColor: string;
        borderWidth: number;
        cellPadding: number;
        striped: boolean;
        stripeColor: string;
        fontSize: number | null;
        mobileFontSize: number | null;
        color: string | null;
        mobileLayout: 'table' | 'stack';
      }
    >
  >,
  Expect<
    Equal<
      BlockValuesMap['social'],
      {
        items: Array<{
          service:
            | 'x'
            | 'facebook'
            | 'instagram'
            | 'line'
            | 'youtube'
            | 'tiktok'
            | 'linkedin'
            | 'website'
            | 'email';
          url: string;
        }>;
        iconSize: number;
        align: 'left' | 'center' | 'right';
        iconStyle: 'color' | 'mono';
      }
    >
  >,
  Expect<
    Equal<
      BlockValuesMap['qr'],
      {
        content: string;
        size: number;
        ecLevel: 'L' | 'M' | 'Q' | 'H';
        margin: number;
        color: string;
        backgroundColor: string;
        src: string;
        alt: string;
        href: string;
        align: 'left' | 'center' | 'right';
        generated: string | null;
        uploadData: Record<string, unknown> | null;
      }
    >
  >,
  Expect<Equal<BlockValuesMap['html'], { html: string }>>,
  Expect<
    Equal<
      BuiltinBlockType,
      | 'text'
      | 'image'
      | 'button'
      | 'divider'
      | 'spacer'
      | 'imageText'
      | 'gallery'
      | 'video'
      | 'buttons'
      | 'menu'
      | 'table'
      | 'social'
      | 'qr'
      | 'html'
    >
  >,
  Expect<Equal<RowLayout, '1' | '1:1' | '1:1:1' | '1:2' | '2:1' | '1:1:1:1'>>,
  Expect<
    Equal<
      SocialService,
      | 'x'
      | 'facebook'
      | 'instagram'
      | 'line'
      | 'youtube'
      | 'tiktok'
      | 'linkedin'
      | 'website'
      | 'email'
    >
  >,
];
