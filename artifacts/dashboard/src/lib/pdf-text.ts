/**
 * Reads the text layer of a report PDF in the browser (pdf.js). Nothing is uploaded or sent
 * anywhere to read it, and no OCR is attempted: a scanned PDF (no text layer) is reported as such
 * and staff paste the text or enter the results by hand. The iOS app does the same with PDFKit
 * (ReportTextExtractor.swift); pages are separated by a form feed so the parsers can tell pages
 * apart.
 */

/** One positioned piece of text from pdf.js `getTextContent()`. */
export interface PdfTextPiece {
  str: string;
  /** Left edge (PDF units). */
  x: number;
  /** Baseline (PDF units, origin bottom-left). */
  y: number;
  width: number;
  height: number;
  hasEOL?: boolean;
}

/**
 * Rebuilds reading-order lines from positioned text: pieces on the same baseline (within half a
 * line height) form one line, left to right; a visible gap between two pieces becomes a space
 * (table columns become runs of spaces, which the parsers collapse).
 */
export function assemblePdfLines(pieces: PdfTextPiece[]): string[] {
  const items = pieces.filter(p => p.str.length > 0);
  if (items.length === 0) return [];
  const sorted = [...items].sort((a, b) => (b.y - a.y) || (a.x - b.x));
  const lines: { y: number; h: number; items: PdfTextPiece[] }[] = [];
  for (const p of sorted) {
    const h = p.height > 0 ? p.height : 10;
    const line = lines.find(l => Math.abs(l.y - p.y) <= Math.max(2, Math.min(l.h, h) * 0.5));
    if (line) { line.items.push(p); line.h = Math.max(line.h, h); } else lines.push({ y: p.y, h, items: [p] });
  }
  lines.sort((a, b) => b.y - a.y);
  return lines.map(l => {
    const row = [...l.items].sort((a, b) => a.x - b.x);
    let text = '';
    let prevEnd: number | null = null;
    for (const p of row) {
      if (prevEnd !== null) {
        const gap = p.x - prevEnd;
        const h = p.height > 0 ? p.height : l.h;
        if (gap > h * 1.5) text += '  ';
        else if (gap > h * 0.15 && !text.endsWith(' ') && !p.str.startsWith(' ')) text += ' ';
      }
      text += p.str;
      prevEnd = p.x + p.width;
    }
    return text.replace(/\s+$/, '');
  });
}

/** At least 20 letters or digits: a scanned page often yields only a few stray characters. */
export function hasUsableText(text: string): boolean {
  let n = 0;
  for (const c of text) if (/[\p{L}\p{N}]/u.test(c) && ++n >= 20) return true;
  return false;
}

export type PdfTextResult =
  | { kind: 'text'; text: string; pageCount: number }
  | { kind: 'noTextLayer'; pageCount: number }
  | { kind: 'locked' }
  | { kind: 'unreadable' };

/** Hard limits so a hostile or huge PDF cannot hang the tab. */
const MAX_PAGES = 30;

/** pdf.js is loaded on first use only (it is large and most sessions never import a report). */
export async function extractPdfText(data: ArrayBuffer): Promise<PdfTextResult> {
  const [pdfjs, worker] = await Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({
    // pdf.js takes ownership of (detaches) the buffer it is given: hand it a copy.
    data: new Uint8Array(data.slice(0)),
    // Nothing is fetched: no external fonts, CMaps or scripts.
    disableFontFace: true,
    useSystemFonts: false,
    enableXfa: false,
    stopAtErrors: false,
  });
  let doc: Awaited<typeof task.promise>;
  try {
    doc = await task.promise;
  } catch (err) {
    void task.destroy();
    if (err instanceof pdfjs.PasswordException) return { kind: 'locked' };
    return { kind: 'unreadable' };
  }
  try {
    const pages: string[] = [];
    const count = Math.min(doc.numPages, MAX_PAGES);
    for (let i = 1; i <= count; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      const pieces: PdfTextPiece[] = [];
      for (const item of content.items) {
        if (!('str' in item)) continue;
        const t = item.transform as number[];
        pieces.push({ str: item.str, x: t[4], y: t[5], width: item.width, height: item.height || Math.abs(t[3]) || 10, hasEOL: item.hasEOL });
      }
      pages.push(assemblePdfLines(pieces).join('\n'));
      page.cleanup();
    }
    const text = pages.join('\n\u000C\n');
    return hasUsableText(text) ? { kind: 'text', text, pageCount: doc.numPages } : { kind: 'noTextLayer', pageCount: doc.numPages };
  } catch {
    return { kind: 'unreadable' };
  } finally {
    void task.destroy();
  }
}
