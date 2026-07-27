#!/usr/bin/env node
'use strict';

const { createClient } = require('@supabase/supabase-js');
const chokidar = require('chokidar');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

// ─── Config validation ────────────────────────────────────────────────────────

const required = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'WATCH_FOLDER'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[ERROR] Missing required config: ${key}\nCopy .env.template to .env and fill in all required values.`);
    process.exit(1);
  }
}

const WATCH_DIR  = path.resolve(process.env.WATCH_FOLDER);
const DONE_DIR   = path.join(WATCH_DIR, 'done');
const FAILED_DIR = path.join(WATCH_DIR, 'failed');
const MAX_BYTES  = 20 * 1024 * 1024; // 20 MB

const SUPPORTED = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.webp']);

const MIME_MAP = {
  '.pdf':  'application/pdf',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
};

// ─── Supabase client ──────────────────────────────────────────────────────────

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function safeMove(src, dest) {
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(src, dest);
  } catch {
    try { fs.copyFileSync(src, dest); fs.unlinkSync(src); } catch { /* give up */ }
  }
}

function stamp() { return new Date().toISOString().replace('T', ' ').slice(0, 19); }

function log(level, msg) { console.log(`[${stamp()}] [${level}] ${msg}`); }

function sanitiseFilename(name) {
  return name.replace(/[^a-zA-Z0-9._\-() ]/g, '_');
}

// ─── AI extraction trigger (optional — fires once DB row is created) ──────────

async function triggerExtraction(docId, filename) {
  const base   = (process.env.API_SERVER_URL || '').replace(/\/$/, '');
  const secret = process.env.CRON_SECRET;
  if (!base || !secret) return;

  try {
    const res = await fetch(`${base}/api/documents/${docId}/extract`, {
      method:  'POST',
      headers: { 'x-cron-secret': secret, 'content-type': 'application/json' },
    });
    if (res.ok) {
      log('AI', `Extraction queued for ${filename}`);
    } else {
      log('WARN', `Extraction trigger returned ${res.status} for ${filename}`);
    }
  } catch (err) {
    log('WARN', `Extraction trigger unreachable for ${filename}: ${err.message}`);
  }
}

// ─── Core processor ───────────────────────────────────────────────────────────

async function processFile(filePath) {
  const filename = path.basename(filePath);
  const ext      = path.extname(filename).toLowerCase();

  if (!SUPPORTED.has(ext)) return;

  // Wait for the file to finish writing (scanner lag, save-as, etc.)
  await sleep(1500);
  if (!fs.existsSync(filePath)) return; // moved by something else

  let buffer;
  try {
    buffer = fs.readFileSync(filePath);
  } catch (err) {
    log('ERROR', `Cannot read ${filename}: ${err.message}`);
    return;
  }

  if (buffer.length === 0) {
    log('SKIP', `${filename} — empty file, waiting for next write`);
    return;
  }

  if (buffer.length > MAX_BYTES) {
    const mb = (buffer.length / 1024 / 1024).toFixed(1);
    log('SKIP', `${filename} — ${mb} MB exceeds 20 MB limit → moved to failed/`);
    safeMove(filePath, path.join(FAILED_DIR, `${Date.now()}-${filename}`));
    return;
  }

  const mimeType    = MIME_MAP[ext];
  const safeName    = sanitiseFilename(filename);
  const storagePath = `local-upload/${Date.now()}-${safeName}`;

  log('→', `Uploading ${filename} (${(buffer.length / 1024).toFixed(0)} KB)…`);

  // ── Upload to Supabase Storage ──────────────────────────────────────────────
  const { error: uploadError } = await sb.storage
    .from('patient-documents')
    .upload(storagePath, buffer, { contentType: mimeType, upsert: false });

  if (uploadError) {
    const alreadyExists =
      uploadError.message?.includes('already exists') ||
      String(uploadError.statusCode) === '409';

    if (alreadyExists) {
      log('SKIP', `${filename} — already uploaded → moved to done/`);
      safeMove(filePath, path.join(DONE_DIR, `${Date.now()}-${filename}`));
      return;
    }

    log('ERROR', `Upload failed for ${filename}: ${uploadError.message}`);
    safeMove(filePath, path.join(FAILED_DIR, `${Date.now()}-${filename}`));
    return;
  }

  // ── Insert document row ─────────────────────────────────────────────────────
  const { data: doc, error: insertError } = await sb
    .from('documents')
    .insert({
      patient_id:           null,
      document_type:        'other',
      title:                filename,
      file_name:            filename,
      storage_path:         storagePath,
      mime_type:            mimeType,
      file_size_bytes:      buffer.length,
      source:               'local_folder',
      created_by:           null,
      ai_extraction_status: 'pending',
      notes:                `Uploaded from local folder on ${new Date().toISOString().slice(0, 10)}`,
    })
    .select('id')
    .single();

  if (insertError) {
    log('ERROR', `DB insert failed for ${filename}: ${insertError.message}`);
    // Roll back the storage upload
    await sb.storage.from('patient-documents').remove([storagePath]).catch(() => null);
    safeMove(filePath, path.join(FAILED_DIR, `${Date.now()}-${filename}`));
    return;
  }

  log('✓', `${filename} → Results Inbox queue  (id: ${doc.id})`);
  safeMove(filePath, path.join(DONE_DIR, `${Date.now()}-${filename}`));

  // Fire-and-forget extraction trigger — non-blocking, best-effort
  triggerExtraction(doc.id, filename);
}

// ─── Dedup guard (chokidar can fire add twice on some systems) ────────────────

const processing = new Set();

async function enqueue(filePath) {
  if (processing.has(filePath)) return;
  processing.add(filePath);
  try {
    await processFile(filePath);
  } catch (err) {
    log('ERROR', `Unexpected error processing ${path.basename(filePath)}: ${err.message}`);
  } finally {
    processing.delete(filePath);
  }
}

// ─── Startup ──────────────────────────────────────────────────────────────────

fs.mkdirSync(WATCH_DIR,  { recursive: true });
fs.mkdirSync(DONE_DIR,   { recursive: true });
fs.mkdirSync(FAILED_DIR, { recursive: true });

const watcher = chokidar.watch(WATCH_DIR, {
  ignored: [
    /(^|[/\\])\./,                    // dotfiles
    path.join(WATCH_DIR, 'done'),     // already-processed
    path.join(WATCH_DIR, 'failed'),   // error bin
  ],
  persistent:     true,
  ignoreInitial:  false,              // process any files already in the folder on start
  depth:          0,                  // top-level files only — not subdirectories
  awaitWriteFinish: {
    stabilityThreshold: 2000,         // wait until file size is stable for 2 s
    pollInterval:        200,
  },
});

watcher.on('add',   enqueue);
watcher.on('error', err => log('ERROR', `Watcher: ${err.message}`));

console.log('');
console.log('  ╔══════════════════════════════════════════╗');
console.log('  ║   MedFlow Document Watcher  v1.0         ║');
console.log('  ╚══════════════════════════════════════════╝');
console.log('');
console.log(`  Watching : ${WATCH_DIR}`);
console.log('  Accepts  : PDF, JPG, PNG, WEBP (max 20 MB)');
console.log(`  Done     : ${DONE_DIR}`);
console.log(`  Failed   : ${FAILED_DIR}`);
if (process.env.API_SERVER_URL) {
  console.log(`  AI server: ${process.env.API_SERVER_URL}`);
}
console.log('');
console.log('  Drop documents into the watch folder — they');
console.log('  will appear in Results Inbox automatically.');
console.log('');
console.log('  Press Ctrl+C to stop.');
console.log('');
