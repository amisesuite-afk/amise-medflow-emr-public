/**
 * Fails the build if any web source file references a third-party QR-code or
 * chart-image service.
 *
 * Why: the dashboard used to render the patient questionnaire QR code with
 * `<img src="https://api.qrserver.com/...?data=<patient URL>">`, which sent the
 * questionnaire link — including its access token — to a vendor with no
 * agreement (compliance S-4 / A-7). These services receive whatever they
 * encode or plot in the URL, which in this codebase is usually a bearer link or
 * patient data. Generate QR codes locally instead (`LocalQrCode.tsx`, `qrcode`
 * package) and render charts client-side.
 *
 * Scans artifacts/, lib/ and e2e/ source (ts/tsx/js/mjs/html). iOS is out of
 * scope here (use CoreImage `CIQRCodeGenerator` there).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

// scripts/src/lint-no-external-qr.ts -> scripts/src -> scripts -> repo root
const REPO_ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

const FORBIDDEN_HOSTS = [
  'api.qrserver.com',
  'goqr.me',
  'chart.googleapis.com',
  'chart.apis.google.com',
  'quickchart.io',
  'image-charts.com',
  'api.qrcode-monkey.com',
  'qrcode.tec-it.com',
  'barcode.tec-it.com',
  'zxing.org',
];

const SCAN_DIRS = ['artifacts', 'lib', 'e2e'];
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.next', '.turbo', 'coverage']);
const EXTENSIONS = /\.(tsx?|jsx?|mjs|cjs|html)$/;

function walk(dir: string): string[] {
  let entries: string[];
  try { entries = readdirSync(dir); } catch { return []; }
  return entries.flatMap(name => {
    if (SKIP_DIRS.has(name)) return [];
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return EXTENSIONS.test(name) ? [p] : [];
  });
}

const violations: string[] = [];
for (const d of SCAN_DIRS) {
  for (const file of walk(join(REPO_ROOT, d))) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const host of FORBIDDEN_HOSTS) {
        if (line.includes(host)) violations.push(`${relative(REPO_ROOT, file)}:${i + 1}  ${host}`);
      }
    });
  }
}

if (violations.length > 0) {
  console.error('External QR/chart service referenced — these receive the encoded data (tokens, PHI):');
  for (const v of violations) console.error(`  ${v}`);
  console.error('Generate locally instead (artifacts/dashboard/src/components/LocalQrCode.tsx).');
  process.exit(1);
}
console.log(`lint:no-external-qr — OK (${SCAN_DIRS.join(', ')} clean of ${FORBIDDEN_HOSTS.length} hosts)`);
