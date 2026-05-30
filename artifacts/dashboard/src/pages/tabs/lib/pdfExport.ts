/**
 * PDF export utilities for Amise clinical documents.
 *
 * saveBlobAsPDF renders the full HTML document (including <head> styles)
 * inside a hidden same-origin iframe so CSS applies correctly, then
 * captures with html2canvas and converts to a jsPDF blob download.
 *
 * Root cause of the previous failure: host.innerHTML = html on a <div>
 * strips <html>/<head>/<style> tags, so the document CSS was never applied
 * and html2canvas captured unstyled content.
 *
 * Falls back to printDoc (browser print dialog) if jsPDF or canvas fails.
 */

// ── Browser print (fallback / quick preview) ─────────────────────────────────

export function printDoc(html: string): void {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => { try { win.print(); } catch { /* */ } }, 500);
}

// ── PDF blob via jsPDF + html2canvas ─────────────────────────────────────────

export async function saveBlobAsPDF(html: string, filename: string): Promise<void> {
  // jsPDF v4+ uses named export `jsPDF`; v2/v3 used default export — handle both.
  const [jsPDFModule, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const JsPDF: new (opts: object) => any =
    (jsPDFModule as { jsPDF?: unknown }).jsPDF as never
    ?? (jsPDFModule as { default?: unknown }).default as never;
  if (!JsPDF) throw new Error('[pdfExport] jsPDF not found in module');

  // Hidden iframe — document.write() correctly parses the full HTML document
  // including <head><style> tags, so all CSS classes apply to the rendered page.
  const iframe = document.createElement('iframe');
  iframe.style.cssText =
    'position:fixed;left:-9999px;top:0;width:794px;height:5000px;border:none;visibility:hidden';
  document.body.appendChild(iframe);

  try {
    const iDoc = iframe.contentDocument!;
    iDoc.open();
    iDoc.write(html);
    iDoc.close();

    // Two rAF ticks: first for layout, second for paint.
    await new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    // Expand iframe to the full rendered height so nothing is clipped.
    const pageEl = iDoc.querySelector<HTMLElement>('.page') ?? iDoc.body;
    const totalH = Math.max(pageEl.scrollHeight, pageEl.offsetHeight, 200);
    iframe.style.height = `${totalH + 40}px`;

    // One more tick after resize.
    await new Promise<void>(r => requestAnimationFrame(() => r()));

    const canvas = await html2canvas(pageEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 794,
      scrollX: 0,
      scrollY: 0,
    });

    const A4_W_MM = 210;
    const A4_H_MM = 297;
    const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const imgData  = canvas.toDataURL('image/png');
    const imgW     = A4_W_MM;
    const imgH     = (canvas.height / canvas.width) * A4_W_MM;
    const pageCount = Math.ceil(imgH / A4_H_MM);

    for (let i = 0; i < pageCount; i++) {
      if (i > 0) doc.addPage();
      doc.addImage(imgData, 'PNG', 0, -(i * A4_H_MM), imgW, imgH);
    }

    _triggerDownload(doc.output('blob') as Blob, filename);
  } catch (err) {
    console.error('[pdfExport] jsPDF render failed, falling back to print dialog', err);
    printDoc(html);
  } finally {
    document.body.removeChild(iframe);
  }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _triggerDownload(blob: Blob, filename: string): void {
  const isIOS =
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const url = URL.createObjectURL(blob);
  if (isIOS) {
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return;
  }
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1_500);
}
