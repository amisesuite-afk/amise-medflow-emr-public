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

const _isIOS =
  typeof navigator !== 'undefined' && (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );

export async function saveBlobAsPDF(html: string, filename: string): Promise<void> {
  // On iOS Safari, window.open must be called synchronously inside the user
  // gesture (tap) or it gets blocked as a popup.  Open a placeholder window
  // now, then navigate it to the blob URL once the PDF is ready.
  const iosWin = _isIOS ? window.open('', '_blank') : null;
  if (iosWin) {
    iosWin.document.write(
      '<html><body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;margin:0">' +
      '<p style="font-size:16px;color:#555">Generating PDF&#8230;</p></body></html>'
    );
    iosWin.document.close();
  }

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

    const blob = doc.output('blob') as Blob;
    if (iosWin) {
      const url = URL.createObjectURL(blob);
      iosWin.location.href = url;
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } else {
      _triggerDownload(blob, filename);
    }
  } catch (err) {
    console.error('[pdfExport] jsPDF render failed, falling back to print dialog', err);
    if (iosWin) iosWin.close();
    printDoc(html);
  } finally {
    document.body.removeChild(iframe);
  }
}

// ── Word (.doc) export — wraps HTML in Office namespace so Word opens it ─────
//
// Word 2007+ treats any file with .doc extension containing a full HTML document
// (with the Office:Word XML namespace header) as an editable Word document.
// No server-side processing or npm packages required.
//
// Usage: downloadAsWord(bodyHtml, 'Colonoscopy_Report', 'Colonoscopy Report')
// bodyHtml should be the inner HTML content (letterhead, headings, text, sig).

export function downloadAsWord(bodyHtml: string, filename: string, docTitle?: string): void {
  const title = (docTitle ?? filename).replace(/</g, '&lt;');
  const html =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40">` +
    `<head><meta charset="utf-8"><title>${title}</title>` +
    `<!--[if gte mso 9]><xml><w:WordDocument><w:View>Normal</w:View><w:Zoom>0</w:Zoom><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->` +
    `<style>` +
    `@page WordSection1{size:8.5in 11in;margin:1in 1in 1in 1in;mso-header-margin:.5in;mso-footer-margin:.5in}` +
    `div.WordSection1{page:WordSection1}` +
    `body{font-family:Arial,Helvetica,sans-serif;font-size:11pt;color:#1A1A1A;line-height:1.5}` +
    `h1{font-size:15pt;font-weight:700;color:#0B2545;margin:0 0 4px}` +
    `h2{font-size:11pt;color:#374151;font-weight:400;margin:0 0 12px}` +
    `h3{font-size:11pt;font-weight:700;color:#0B2545;border-bottom:.75pt solid #C8A24B;padding-bottom:3px;margin:14px 0 6px}` +
    `table{border-collapse:collapse;width:100%;margin:4px 0}` +
    `td{font-size:10pt;vertical-align:top;padding:3px 8px 3px 0}` +
    `td.lbl{font-weight:700;color:#0B2545;width:30%;white-space:nowrap}` +
    `p.allergy{color:#dc2626;font-weight:700;font-size:11pt;border:1pt solid #fecaca;padding:4px 8px;margin:8px 0}` +
    `pre,p.narrative{white-space:pre-wrap;font-family:Georgia,"Times New Roman",serif;font-size:11pt;line-height:1.6;margin-top:12px}` +
    `.sig{margin-top:48pt}.sig-line{border-bottom:1pt solid #333;width:220px;height:24px;display:inline-block}` +
    `.footer{margin-top:36pt;border-top:.5pt solid #0B2545;padding-top:6px;font-size:8pt;color:#6B7280;font-style:italic}` +
    `</style></head>` +
    `<body><div class="WordSection1">${bodyHtml}</div></body></html>`;

  const blob = new Blob([html], { type: 'application/msword;charset=utf-8' });
  _triggerDownload(blob, filename.endsWith('.doc') ? filename : `${filename}.doc`);
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
