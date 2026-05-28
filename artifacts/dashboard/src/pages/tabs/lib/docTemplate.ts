/**
 * Amise Medical Services — Document Design System
 * Canonical spec: CLAUDE.md §Document Design Spec
 *
 * Token definitions and HTML builder utilities shared by every
 * clinical PDF output (encounter note, referral, discharge, inpatient summary).
 *
 * Rules enforced here:
 *   • No filled colour bars behind body text.
 *   • Section headers = plain bold navy on white.
 *   • Masthead = "AMISE MEDICAL SERVICES" → document type → gold rule.
 *   • Patient/meta = two-column label : value grid, no borders.
 *   • Red-flag callouts = gold left border only, no fill.
 *   • Footer = navy rule → mute italic note → contact strip.
 */

// ── Brand logo SVG ────────────────────────────────────────────────────────────
// Two facing-profile silhouettes (blue left, red right) + logotype.
// width/height attrs keep the rendered size small; viewBox defines coordinate space.
export const AMISE_LOGO_SVG = `<svg width="120" height="28" viewBox="0 0 200 46" xmlns="http://www.w3.org/2000/svg">
  <path d="M12,2 C16,0 22,2 24,7 C25,10 24,12 23,13 C24,13 27,15 29,17 C30,18 30,20 29,21 C28,23 25,23 25,25 C24,27 23,30 21,32 C19,34 16,35 13,35 C10,35 8,33 7,31 C5,29 4,25 4,20 C4,15 5,9 7,5 C8,3 10,2 12,2Z" fill="#0B2545"/>
  <path d="M54,2 C50,0 44,2 42,7 C41,10 42,12 43,13 C42,13 39,15 37,17 C36,18 36,20 37,21 C38,23 41,23 41,25 C42,27 43,30 45,32 C47,34 50,35 53,35 C56,35 58,33 59,31 C61,29 62,25 62,20 C62,15 61,9 59,5 C58,3 56,2 54,2Z" fill="#922b21"/>
  <line x1="70" y1="4" x2="70" y2="42" stroke="#d1d5db" stroke-width="0.8"/>
  <text x="78" y="22" font-family="Arial,Helvetica,sans-serif" font-size="21" font-weight="900" fill="#0B2545" letter-spacing="1.2">AMISE</text>
  <text x="78" y="32" font-family="Arial,Helvetica,sans-serif" font-size="7.5" fill="#555" letter-spacing="2">MEDICAL SERVICES</text>
  <text x="78" y="41" font-family="Arial,Helvetica,sans-serif" font-size="6.5" fill="#888" letter-spacing="0.5">Saint Lucia</text>
</svg>`;

// ── Colour tokens ─────────────────────────────────────────────────────────────
export const T = {
  navy: '#0B2545',
  gold: '#C8A24B',
  teal: '#1F7A8C',
  ink:  '#1A1A1A',
  mute: '#6B7280',
} as const;

// ── Shared print CSS ──────────────────────────────────────────────────────────
export const DOC_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
/* Page container — A4-width centered card in the browser */
body{font-family:Arial,Helvetica,sans-serif;font-size:10.5px;color:${T.ink};line-height:1.25;background:#e8e8e8}
.page{max-width:210mm;margin:0 auto;background:#fff;padding:18mm 20mm;min-height:297mm}
/* Masthead */
.mast-wrap{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px}
.mast-org{font-size:15px;font-weight:700;color:${T.navy};text-transform:uppercase;letter-spacing:.6px;margin-bottom:3px}
.mast-doc{font-size:11px;color:${T.ink};margin-bottom:4px}
.mast-meta{font-size:8.5px;color:${T.mute};margin-top:1px}
/* Gold rule spans FULL width — sits below the flex row, not inside it */
.gold-rule{border:none;border-top:.75pt solid ${T.gold};margin:8px 0 10px;display:block;width:100%}
/* Meta / patient block */
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:5px 24px;margin-bottom:14px}
.meta-lbl{font-size:9.5px;font-weight:700;color:${T.navy};margin-bottom:1px;text-transform:uppercase;letter-spacing:.04em}
.meta-val{font-size:10.5px;color:${T.ink};line-height:1.3}
.meta-sub{font-size:9px;color:${T.mute}}
/* Section headers — plain bold navy, no bar */
.sec-hdr{font-size:11px;font-weight:700;color:${T.navy};margin:14px 0 4px;padding:0}
/* Two-column key-value table */
.kv-tbl{width:100%;border-collapse:collapse;margin:4px 0}
.kv-lbl{width:28%;font-size:10px;font-weight:700;color:${T.navy};vertical-align:top;padding:3px 8px 3px 0;line-height:1.3}
.kv-val{font-size:10.5px;color:${T.ink};vertical-align:top;padding:3px 0;line-height:1.3}
.kv-row-rule{border-top:.25pt solid #E5E7EB}
/* Bullet lists */
.bul-wrap{padding-left:0;margin:4px 0}
.bul-item{display:flex;gap:6px;margin:2px 0;padding-left:6px}
.bul-dot{color:${T.navy};font-weight:700;flex-shrink:0;line-height:1.25}
.bul-text{font-size:10.5px;color:${T.ink};line-height:1.25}
/* Red-flag callout — gold left border, no fill */
.callout{border-left:1.5pt solid ${T.gold};padding:5px 10px;margin:10px 0}
.callout-hdr{font-size:11px;font-weight:700;color:${T.navy};margin-bottom:3px}
.callout-body{font-size:10.5px;color:${T.ink};line-height:1.3}
/* Signature */
.sig{margin-top:22px}
.sig-line{border-bottom:1px solid #333;width:200px;height:22px;margin-bottom:3px}
.sig-name{font-weight:700;font-size:11px;color:${T.ink}}
.sig-role{font-size:9.5px;color:${T.mute};margin-top:1px}
/* Footer */
.footer-rule{border:none;border-top:.5pt solid ${T.navy};margin:18px 0 5px;display:block;width:100%}
.footer-note{font-size:8.5px;font-style:italic;color:${T.mute};line-height:1.4}
.footer-row{display:flex;justify-content:space-between;align-items:flex-start;margin-top:3px}
/* Pair columns */
.col2{display:grid;grid-template-columns:1fr 1fr;gap:0 20px}
/* Utility */
p{margin:3px 0}
@page{margin:0;size:A4}
@media print{
  body{background:#fff}
  .page{padding:18mm 20mm;max-width:none;min-height:auto;margin:0}
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
}
`;

// ── HTML escape ───────────────────────────────────────────────────────────────
export function escH(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Masthead block ────────────────────────────────────────────────────────────
export function masthead(
  docType: string,
  siteName: string,
  siteAddress: string,
  now: string,
  logoSvg: string,
): string {
  // Gold rule is OUTSIDE the flex row so it spans the full page width
  return `<div class="mast-wrap">
  <div>
    <div class="mast-org">Amise Medical Services</div>
    <div class="mast-doc">${escH(docType)}</div>
    <div class="mast-meta">${escH(siteName)} · ${escH(siteAddress)}</div>
    <div class="mast-meta">Tel: 1 (758) 720 7111 · amisesuite@gmail.com · ${escH(now)}</div>
  </div>
  <div style="flex-shrink:0;margin-left:14px">${logoSvg}</div>
</div>
<hr class="gold-rule">`;
}

// ── Patient / meta block ──────────────────────────────────────────────────────
export interface MetaField { label: string; value: string; sub?: string }

export function metaGrid(fields: MetaField[]): string {
  const cells = fields
    .filter(f => f.value)
    .map(f => `<div>
      <div class="meta-lbl">${escH(f.label)}</div>
      <div class="meta-val">${escH(f.value)}</div>
      ${f.sub ? `<div class="meta-sub">${escH(f.sub)}</div>` : ''}
    </div>`).join('');
  return cells ? `<div class="meta-grid">${cells}</div>` : '';
}

// ── Section header ────────────────────────────────────────────────────────────
export function secHdr(title: string): string {
  return `<div class="sec-hdr">${escH(title)}</div>`;
}

// ── Section block (header + body) ─────────────────────────────────────────────
export function sec(title: string, bodyHtml: string): string {
  if (!bodyHtml.trim()) return '';
  return `${secHdr(title)}<div>${bodyHtml}</div>`;
}

// ── Key / value table ─────────────────────────────────────────────────────────
export function kvTable(rows: [string, string][], hairlines = false): string {
  const filled = rows.filter(([, v]) => v.trim());
  if (!filled.length) return '';
  return `<table class="kv-tbl">${filled.map(([l, v], i) =>
    `<tr${hairlines && i > 0 ? ' class="kv-row-rule"' : ''}><td class="kv-lbl">${escH(l)}</td><td class="kv-val">${escH(v)}</td></tr>`
  ).join('')}</table>`;
}

// ── Bullet list ───────────────────────────────────────────────────────────────
export function bul(text: string): string {
  return `<div class="bul-item"><span class="bul-dot">•</span><span class="bul-text">${escH(text)}</span></div>`;
}

export function bulList(items: string[]): string {
  const filled = items.filter(Boolean);
  return filled.length ? `<div class="bul-wrap">${filled.map(bul).join('')}</div>` : '';
}

// ── Inline bullet from multiline text ────────────────────────────────────────
export function inlineText(text: string): string {
  return text.split('\n').map(line => {
    const trimmed = line.trim();
    if (!trimmed) return '<p style="margin:2px 0">&nbsp;</p>';
    if (/^[•·\-]\s/.test(trimmed))
      return `<div class="bul-item"><span class="bul-dot">•</span><span class="bul-text">${escH(trimmed.replace(/^[•·\-]\s*/,''))}</span></div>`;
    return `<p style="font-size:10.5px;color:${T.ink};line-height:1.25;margin:2px 0">${escH(trimmed)}</p>`;
  }).join('');
}

// ── Red-flag callout ──────────────────────────────────────────────────────────
export function callout(heading: string, bodyHtml: string): string {
  return `<div class="callout"><div class="callout-hdr">${escH(heading)}</div><div class="callout-body">${bodyHtml}</div></div>`;
}

// ── Footer ────────────────────────────────────────────────────────────────────
export function footer(disclaimer: string): string {
  const contact = 'Amise Medical Services · Rodney Bay / Castries · Tapion Hospital · 720 7111 / 459 2227';
  return `<hr class="footer-rule">
<div class="footer-row">
  <div class="footer-note">${escH(disclaimer)}</div>
</div>
<div class="footer-row">
  <div class="footer-note">${escH(contact)}</div>
  <div class="footer-note">Confidential</div>
</div>`;
}

// ── Signature block ───────────────────────────────────────────────────────────
export function signoff(name: string, role: string, licenceLine: string): string {
  return `<div class="sig">
  <div class="sig-line"></div>
  <div class="sig-name">${escH(name)}</div>
  <div class="sig-role">${escH(role)}</div>
  <div class="sig-role">${escH(licenceLine)}</div>
</div>`;
}

// ── Full document wrapper ─────────────────────────────────────────────────────
export function wrapDoc(titleText: string, bodyHtml: string): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escH(titleText)}</title>
<style>${DOC_CSS}</style>
</head><body><div class="page">${bodyHtml}</div></body></html>`;
}
