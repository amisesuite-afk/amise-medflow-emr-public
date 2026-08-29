/**
 * End-to-end pipeline test: real PDF → markitdown → clinical-parser
 * Run from api-server directory:  npx tsx test-pipeline.ts
 */
import { readFileSync } from 'fs';
import { convertToMarkdown } from './src/lib/markitdown.js';
import { parseClinicalDocument } from './src/lib/clinical-parser.js';

const PDF_PATH = '/tmp/sample-referral.pdf';

const pdfBytes = readFileSync(PDF_PATH);
const base64   = pdfBytes.toString('base64');
console.log(`\nPDF: ${(pdfBytes.length / 1024).toFixed(1)} KB → ${(base64.length / 1024).toFixed(1)} KB base64`);

// ── Step 1: markitdown ────────────────────────────────────────────────────
console.log('\nStep 1: markitdown (local Python) …');
const markdown = await convertToMarkdown(base64, 'application/pdf');
if (!markdown) { console.error('markitdown returned null'); process.exit(1); }
console.log(`  extracted ${markdown.length} chars\n`);
console.log('─── markitdown output (first 500 chars) ────────────────────');
console.log(markdown.slice(0, 500) + (markdown.length > 500 ? '\n…' : ''));
console.log('────────────────────────────────────────────────────────────\n');

// ── Step 2: clinical-parser ───────────────────────────────────────────────
console.log('Step 2: clinical-parser (native, zero tokens) …');
const { extracted, confidence } = parseClinicalDocument(markdown);

const pct = (confidence * 100).toFixed(0);
const verdict = confidence >= 0.75 ? '✓  SKIP CLAUDE (zero tokens)' : '✗  FALLBACK TO CLAUDE';

console.log('\n' + '═'.repeat(62));
console.log('  RESULT');
console.log('═'.repeat(62));
console.log(`  Confidence : ${pct}%   ${verdict}`);
console.log('─'.repeat(62));
console.log('  Patient    :', extracted.patientName);
console.log('  Diagnosis  :', extracted.diagnosis);
console.log('  Staging    :', extracted.staging);
console.log('  Histology  :', extracted.histology);
console.log('  MMR        :', extracted.mmrStatus);
console.log('  Assessment :', extracted.currentAssessment?.slice(0, 80));
console.log('  Plan       :', extracted.plan?.split('\n').filter(Boolean).slice(0, 3));
console.log('  Meds       :', extracted.medications);
console.log('  Invest.    :', extracted.investigations.slice(0, 3));
console.log('  Key flags  :', extracted.keyFlags);
console.log('  Pending    :', extracted.pendingActions);
console.log('═'.repeat(62) + '\n');
