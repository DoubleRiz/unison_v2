import { jsPDF } from 'jspdf';
import { Song, SetlistTextNote, TiptapNode } from '../types';
import { transpose } from './musicLogic';
import { layoutSongContent } from './songLayout';
import { flattenParagraphRuns, tokenizeRuns, wrapTokensToLines, TextToken } from './setlistDocumentText';
import { TEXT_COLORS, TEXT_SIZES } from '../constants/textNoteStyles';
import { PdfFontSet, STANDARD_FONTS } from './pdfFonts';

export interface PdfContext {
  doc: jsPDF;
  margin: number;
  contentWidth: number;
  pageHeight: number;
  cursorY: number;
  /** Polices du document (par défaut : polices standard de jsPDF). */
  fonts?: PdfFontSet;
}

const fontsOf = (ctx: PdfContext): PdfFontSet => ctx.fonts ?? STANDARD_FONTS;

export const SONG_LINE_HEIGHT = 5.2;

export const startNewPage = (ctx: PdfContext): void => {
  ctx.doc.addPage();
  ctx.cursorY = 20;
};

export const sanitizePdfText = (text: string): string => {
  return text
    .replace(/[  -​  　]/g, ' ')
    .replace(/\t/g, '    ')
    .replace(/[‘’`]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/œ/g, 'oe').replace(/Œ/g, 'Oe')
    .normalize('NFD').replace(/[̀-ͯ]/g, '');
};

type Rgb = [number, number, number];

export interface SongBodyStyle {
  /** Police à chasse fixe (les accords sont placés en colonnes). */
  font: string;
  clean: (text: string) => string;
  lineHeight: number;
  textRgb: Rgb;
  chordRgb: Rgb;
  sectionRgb: Rgb;
  fontSize?: number;
}

/**
 * Dessine le texte d'une chanson avec la même mise en page que le site :
 * accords au-dessus des syllabes, lignes d'accords espacées comme saisies.
 */
export const renderSongBodyToPdf = (ctx: PdfContext, content: string, transposeSemitones: number, style: SongBodyStyle): void => {
  const { doc, margin, contentWidth, pageHeight } = ctx;
  const fontSize = style.fontSize ?? 11;
  doc.setFont(style.font, 'normal');
  doc.setFontSize(fontSize);
  const charWidth = doc.getTextWidth('M');
  const maxCols = Math.max(20, Math.floor(contentWidth / charWidth));
  // Ligne d'accords collée à ses paroles, comme sur le site.
  const chordGap = style.lineHeight * 0.8;

  const lines = layoutSongContent(style.clean(content), chord => transpose(chord, transposeSemitones), maxCols);

  lines.forEach((line) => {
    if (line.type === 'section') {
      if (ctx.cursorY + 3 + style.lineHeight > pageHeight - margin) startNewPage(ctx);
      ctx.cursorY += 3;
      doc.setFont(style.font, 'bold');
      doc.setTextColor(...style.sectionRgb);
      doc.text(line.text.toUpperCase(), margin, ctx.cursorY);
      ctx.cursorY += style.lineHeight;
      return;
    }
    if (line.type === 'blank') {
      ctx.cursorY += style.lineHeight;
      return;
    }

    const height = (line.chords.length > 0 && line.lyrics !== null ? chordGap : 0) + style.lineHeight;
    if (ctx.cursorY + height - style.lineHeight > pageHeight - margin) startNewPage(ctx);

    if (line.chords.length > 0) {
      doc.setFont(style.font, 'bold');
      doc.setTextColor(...style.chordRgb);
      line.chords.forEach(({ col, chord }) => doc.text(chord, margin + col * charWidth, ctx.cursorY));
      ctx.cursorY += line.lyrics !== null ? chordGap : style.lineHeight;
    }
    if (line.lyrics !== null) {
      doc.setFont(style.font, 'normal');
      doc.setTextColor(...style.textRgb);
      if (line.lyrics) doc.text(line.lyrics, margin, ctx.cursorY);
      ctx.cursorY += style.lineHeight;
    }
  });
};

export const renderSongToPdf = (ctx: PdfContext, song: Song, transposeSemitones: number): void => {
  const { doc, margin, contentWidth, pageHeight } = ctx;
  const fonts = fontsOf(ctx);

  // Le titre (24 pt) s'écrit sur sa ligne de base : on lui laisse la place de sa hauteur.
  ctx.cursorY += 8;
  if (ctx.cursorY + 22 > pageHeight - margin) startNewPage(ctx);
  if (ctx.cursorY < 28) ctx.cursorY = 28;

  doc.setFontSize(24);
  doc.setTextColor(0);
  doc.setFont(fonts.text, 'bold');
  doc.text(fonts.clean(song.title), margin, ctx.cursorY);
  ctx.cursorY += 7;

  doc.setFontSize(12);
  doc.setFont(fonts.text, 'normal');
  const keyText = transposeSemitones !== 0
    ? `${song.key} (${transposeSemitones > 0 ? '+' : ''}${transposeSemitones}) -> ${transpose(song.key, transposeSemitones)}`
    : song.key;
  doc.text(fonts.clean(`${song.artist} • ${keyText}`), margin, ctx.cursorY);
  ctx.cursorY += 13;

  renderSongBodyToPdf(ctx, song.content, transposeSemitones, {
    font: fonts.mono,
    clean: fonts.clean,
    lineHeight: SONG_LINE_HEIGHT,
    textRgb: [0, 0, 0],
    chordRgb: [36, 64, 214], // Unison blue
    sectionRgb: [0, 0, 0],
  });

  if (song.notes?.trim()) {
    ctx.cursorY += 5;
    if (ctx.cursorY > pageHeight - margin - 15) startNewPage(ctx);
    doc.setFont(fonts.text, 'bold');
    doc.setFontSize(8);
    doc.setTextColor(130, 130, 130);
    doc.text('NOTES', margin, ctx.cursorY);
    ctx.cursorY += 4;
    doc.setFont(fonts.text, 'normal');
    doc.setFontSize(8);
    doc.splitTextToSize(fonts.clean(song.notes), contentWidth).forEach((nl: string) => {
      if (ctx.cursorY > pageHeight - margin) startNewPage(ctx);
      doc.text(nl, margin, ctx.cursorY);
      ctx.cursorY += 4.5;
    });
  }
};

export const renderTextNoteToPdf = (ctx: PdfContext, note: SetlistTextNote): void => {
  const { doc, margin, contentWidth, pageHeight } = ctx;
  const color = TEXT_COLORS[note.color] || TEXT_COLORS.default;
  const size = TEXT_SIZES[note.size] || TEXT_SIZES.md;

  doc.setFontSize(size.pdfFontSize);
  doc.setTextColor(color.pdfRgb[0], color.pdfRgb[1], color.pdfRgb[2]);
  doc.setFont(fontsOf(ctx).text, 'bold');

  const lines = doc.splitTextToSize(fontsOf(ctx).clean(note.content), contentWidth);
  const textHeightTotal = lines.length * size.pdfLineSpacing;

  if (ctx.cursorY + textHeightTotal > pageHeight - margin) startNewPage(ctx);

  lines.forEach((line: string) => {
    if (ctx.cursorY > pageHeight - margin) startNewPage(ctx);
    doc.text(line, margin, ctx.cursorY);
    ctx.cursorY += size.pdfLineSpacing;
  });

  ctx.cursorY += 10;
};

const FONT_SIZE_NORMAL = 11;
const HEADING_FONT_SIZES: Record<number, number> = { 1: 18, 2: 14, 3: 12 };
const LINE_HEIGHT_RATIO = 0.5;

const lineHeightFor = (fontSize: number): number => fontSize * LINE_HEIGHT_RATIO;

const fontStyleFor = (token: TextToken, fonts: PdfFontSet): string => {
  const italic = token.italic && fonts.italic;
  if (token.bold && italic) return 'bolditalic';
  if (token.bold) return 'bold';
  if (italic) return 'italic';
  return 'normal';
};

export const renderParagraphToPdf = (
  ctx: PdfContext,
  node: TiptapNode,
  fontSize: number,
  prefix: string,
  textAlign: string
): void => {
  const runs = flattenParagraphRuns(node);
  const lineHeight = lineHeightFor(fontSize);

  if (runs.length === 0 || runs.every((r) => r.text.trim() === '')) {
    ctx.cursorY += lineHeight;
    return;
  }

  ctx.doc.setFontSize(fontSize);
  const fonts = fontsOf(ctx);
  const measure = (text: string, token: TextToken): number => {
    ctx.doc.setFont(fonts.text, fontStyleFor(token, fonts));
    return ctx.doc.getTextWidth(text);
  };

  const prefixWidth = prefix ? ctx.doc.getTextWidth(prefix) : 0;
  const tokens = tokenizeRuns(runs);
  const lines = wrapTokensToLines(tokens, ctx.contentWidth - prefixWidth, measure);

  lines.forEach((line, lineIndex) => {
    if (ctx.cursorY > ctx.pageHeight - ctx.margin) startNewPage(ctx);

    const lineWidth = line.reduce((sum, token) => sum + measure(token.text, token), 0)
      + (lineIndex === 0 ? prefixWidth : 0);

    let x = ctx.margin;
    if (textAlign === 'center') x = ctx.margin + (ctx.contentWidth - lineWidth) / 2;
    if (textAlign === 'right') x = ctx.margin + ctx.contentWidth - lineWidth;

    if (lineIndex === 0 && prefix) {
      ctx.doc.setFont(fonts.text, 'normal');
      ctx.doc.setTextColor(0, 0, 0);
      ctx.doc.text(prefix, x, ctx.cursorY);
      x += prefixWidth;
    }

    line.forEach((token) => {
      const width = measure(token.text, token);
      if (token.text.trim() !== '') {
        if (token.color) ctx.doc.setTextColor(token.color[0], token.color[1], token.color[2]);
        else ctx.doc.setTextColor(0, 0, 0);
        ctx.doc.setFont(fonts.text, fontStyleFor(token, fonts));
        ctx.doc.text(fonts.clean(token.text), x, ctx.cursorY);
      }
      x += width;
    });

    ctx.cursorY += lineHeight;
  });
};

export const renderTextNodeToPdf = (ctx: PdfContext, node: TiptapNode): void => {
  const textAlign = (node.attrs?.textAlign as string) || 'left';

  switch (node.type) {
    case 'heading': {
      const level = (node.attrs?.level as number) || 1;
      renderParagraphToPdf(ctx, node, HEADING_FONT_SIZES[level] || FONT_SIZE_NORMAL, '', textAlign);
      return;
    }
    case 'paragraph':
      renderParagraphToPdf(ctx, node, FONT_SIZE_NORMAL, '', textAlign);
      return;
    case 'bulletList':
      (node.content || []).forEach((item) =>
        (item.content || []).forEach((child) =>
          renderParagraphToPdf(ctx, child, FONT_SIZE_NORMAL, '• ', (child.attrs?.textAlign as string) || 'left')
        )
      );
      return;
    case 'orderedList':
      (node.content || []).forEach((item, index) =>
        (item.content || []).forEach((child) =>
          renderParagraphToPdf(ctx, child, FONT_SIZE_NORMAL, `${index + 1}. `, (child.attrs?.textAlign as string) || 'left')
        )
      );
      return;
    default:
      return;
  }
};
