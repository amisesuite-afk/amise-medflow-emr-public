/**
 * Converts documents to Markdown via the markitdown Python CLI.
 * Supports: PDF, DOCX, XLSX, PPTX, HTML, CSV, and image types.
 * Falls back gracefully — callers should handle null return.
 */

import { execFile } from 'node:child_process';
import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { logger } from './logger.js';

const execFileAsync = promisify(execFile);

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf':                                                       'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/msword':                                                    'doc',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':    'xlsx',
  'application/vnd.ms-excel':                                             'xls',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/html':                                                             'html',
  'text/csv':                                                              'csv',
  'text/plain':                                                            'txt',
  'image/jpeg':                                                            'jpg',
  'image/png':                                                             'png',
  'image/webp':                                                            'webp',
};

export function supportsMarkitdown(mimeType: string): boolean {
  return mimeType in MIME_TO_EXT;
}

/**
 * Convert a base64-encoded document to Markdown.
 * Returns null on any failure (caller should fall back to Claude vision).
 */
export async function convertToMarkdown(
  base64Data: string,
  mimeType: string,
): Promise<string | null> {
  const ext = MIME_TO_EXT[mimeType];
  if (!ext) return null;

  const tmpPath = join(tmpdir(), `mdf-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);

  try {
    await writeFile(tmpPath, Buffer.from(base64Data, 'base64'));

    const { stdout, stderr } = await execFileAsync(
      'python3',
      ['-c', `from markitdown import MarkItDown; md = MarkItDown(); r = md.convert(${JSON.stringify(tmpPath)}); print(r.text_content)`],
      { maxBuffer: 10 * 1024 * 1024, timeout: 30_000 },
    );

    if (stderr?.trim()) logger.debug({ stderr }, '[markitdown] stderr');

    const text = stdout.trim();
    return text.length > 0 ? text : null;
  } catch (err) {
    logger.warn({ err, mimeType }, '[markitdown] conversion failed');
    return null;
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
}
