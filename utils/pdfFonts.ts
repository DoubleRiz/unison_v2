import type { jsPDF } from 'jspdf';

// Atkinson Hyperlegible Mono (Braille Institute, licence OFL — voir public/fonts/OFL.txt) :
// police conçue pour la lisibilité, à chasse fixe pour garder les accords alignés sur les paroles.
// Embarquée dans le PDF, elle couvre tous les accents et la ponctuation française (« » ’ … — œ),
// contrairement aux polices standard de jsPDF (Helvetica/Courier) limitées au WinAnsi.
export const PDF_FONT = 'AtkinsonMono';

const FILES = {
  normal: 'AtkinsonHyperlegibleMono-Regular.ttf',
  bold: 'AtkinsonHyperlegibleMono-Bold.ttf',
} as const;

let cache: Promise<Record<keyof typeof FILES, string>> | null = null;

const toBase64 = (buf: ArrayBuffer): string => {
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
};

const loadFonts = () => {
  if (!cache) {
    const base = import.meta.env.BASE_URL || '/';
    cache = Promise.all(
      (Object.keys(FILES) as (keyof typeof FILES)[]).map(async style => {
        const res = await fetch(`${base}fonts/${FILES[style]}`);
        if (!res.ok) throw new Error(`Police PDF introuvable : ${FILES[style]}`);
        return [style, toBase64(await res.arrayBuffer())] as const;
      })
    ).then(entries => Object.fromEntries(entries) as Record<keyof typeof FILES, string>);
    cache.catch(() => { cache = null; });
  }
  return cache;
};

/** Enregistre la police lisible dans le document. Renvoie false si elle n'a pas pu être chargée. */
export const registerPdfFonts = async (doc: jsPDF): Promise<boolean> => {
  try {
    const fonts = await loadFonts();
    (Object.keys(fonts) as (keyof typeof FILES)[]).forEach(style => {
      doc.addFileToVFS(FILES[style], fonts[style]);
      doc.addFont(FILES[style], PDF_FONT, style);
    });
    return true;
  } catch {
    return false;
  }
};

/** Normalise le texte : forme composée (NFC) pour que les accents saisis en « é = e + ◌́ » s'affichent,
 *  et remplace les rares signes absents de la police. */
export const normalizePdfText = (text: string): string =>
  text
    .normalize('NFC')
    .replace(/[  -   　]/g, ' ')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\t/g, '    ')
    .replace(/→/g, '->')
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b');

/** Repli quand la police embarquée est indisponible : ASCII/WinAnsi pour Courier. */
export const fallbackPdfText = (text: string): string =>
  normalizePdfText(text)
    .replace(/[‘’`]/g, "'")
    .replace(/[“”«»]/g, '"')
    .replace(/…/g, '...')
    .replace(/[—–]/g, '-')
    .replace(/œ/g, 'oe').replace(/Œ/g, 'OE');
