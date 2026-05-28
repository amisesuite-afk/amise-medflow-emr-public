/**
 * PDF export utilities for Amise clinical documents.
 *
 * Uses jsPDF + html2canvas to convert the rendered HTML document
 * (including the `.page` container) into a real .pdf blob and
 * trigger a file download — no print dialog required.
 *
 * Falls back gracefully: if jsPDF fails, opens the print dialog so
 * the user can still Save as PDF via the browser.
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

  // Mount HTML off-screen at A4 pixel width (794 px ≈ 210 mm @ 96 dpi).
  // No z-index so html2canvas can capture the off-screen element reliably.
  const host = document.createElement('div');
  host.style.cssText =
    'position:fixed;left:-9999px;top:0;width:794px;background:#fff;overflow:visible';
  host.innerHTML = html;
  document.body.appendChild(host);

  try {
    const pageEl = host.querySelector<HTMLElement>('.page') ?? host;

    // Capture at 2× for retina sharpness.
    const canvas = await html2canvas(pageEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 794,
    });

    const A4_W_MM = 210;
    const A4_H_MM = 297;
    const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const imgData   = canvas.toDataURL('image/png');
    const imgW      = A4_W_MM;
    const imgH      = (canvas.height / canvas.width) * A4_W_MM;
    const pageCount = Math.ceil(imgH / A4_H_MM);

    for (let i = 0; i < pageCount; i++) {
      if (i > 0) doc.addPage();
      doc.addImage(imgData, 'PNG', 0, -(i * A4_H_MM), imgW, imgH);
    }

    const pdfBlob = doc.output('blob') as Blob;
    _triggerDownload(pdfBlob, filename);
  } catch (err) {
    console.error('[pdfExport] jsPDF render failed, falling back to print dialog', err);
    printDoc(html);
  } finally {
    document.body.removeChild(host);
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
