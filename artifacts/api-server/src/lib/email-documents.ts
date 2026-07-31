import { sb, audit } from './supabase.js';
import { listUnreadMessages, listMessagesByQuery, getMessage, getAttachmentData, markRead } from './gmail.js';
import { extractDocumentInsights } from '../routes/portal.js';
import { errStr } from './logger.js';

const ATTACHMENT_MIME = new Set([
  'application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
]);

// Skip attachments larger than 20 MB — avoids OOM on large image/PDF newsletters
const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export interface EmailDocumentSummary {
  processed: number;
  documentsCreated: number;
  skipped: number;
  errors: { messageId: string; error: string }[];
}

const INTERNAL_FORWARDERS: Record<string, { name: string; default_document_type: string }> = {
  'dawitson@gmail.com': { name: 'Dr. Dawit (Internal Forward)', default_document_type: 'lab_report' },
};

async function resolveSender(fromEmail: string): Promise<{
  providerName: string;
  docType: string;
  providerId: string | null;
  isKnown: boolean;
}> {
  const fromKey = fromEmail.toLowerCase();
  const { data: reg } = await sb()
    .from('referring_providers')
    .select('id, name, default_document_type')
    .eq('email', fromKey)
    .eq('active', true)
    .maybeSingle();

  if (reg) {
    return { providerName: reg.name as string, docType: reg.default_document_type as string, providerId: reg.id as string, isKnown: true };
  }
  const int = INTERNAL_FORWARDERS[fromKey];
  if (int) {
    return { providerName: int.name, docType: int.default_document_type, providerId: null, isKnown: true };
  }
  return { providerName: fromEmail, docType: 'other', providerId: null, isKnown: false };
}

// ─── Regular cron: process unread inbox messages ──────────────────────────────
// Fires extraction asynchronously (fire-and-forget) — max 20 messages, so
// peak concurrency stays manageable under normal cron cadence.
export async function processIncomingDocumentEmails(maxMessages = 20): Promise<EmailDocumentSummary> {
  const summary: EmailDocumentSummary = { processed: 0, documentsCreated: 0, skipped: 0, errors: [] };

  let messageIds: string[];
  try {
    messageIds = await listUnreadMessages(maxMessages);
  } catch (err) {
    summary.errors.push({ messageId: 'list', error: errStr(err) });
    return summary;
  }

  for (const id of messageIds) {
    try {
      const msg = await getMessage(id);
      const relevantAttachments = msg.attachments.filter(
        a => ATTACHMENT_MIME.has(a.mimeType) && (a.size ?? 0) <= MAX_ATTACHMENT_BYTES,
      );

      if (!relevantAttachments.length) {
        summary.skipped++;
        await markRead(id);
        continue;
      }

      summary.processed++;
      const { providerName, docType, providerId, isKnown } = await resolveSender(msg.from);
      let allOk = true;

      for (const attachment of relevantAttachments) {
        try {
          const buffer = await getAttachmentData(id, attachment.attachmentId);
          if (buffer.length > MAX_ATTACHMENT_BYTES) { summary.skipped++; continue; }

          const ext = attachment.filename.includes('.') ? attachment.filename.slice(attachment.filename.lastIndexOf('.')) : '';
          const storagePath = `received-email/${id}-${attachment.attachmentId}${ext}`;

          const { error: uploadError } = await sb()
            .storage
            .from('patient-documents')
            .upload(storagePath, buffer, { contentType: attachment.mimeType, upsert: false });

          if (uploadError) throw uploadError;

          const { data: doc, error: insertError } = await sb()
            .from('documents')
            .insert({
              patient_id:           null,
              document_type:        docType,
              title:                attachment.filename || `${providerName} document`,
              file_name:            attachment.filename,
              storage_path:         storagePath,
              mime_type:            attachment.mimeType,
              file_size_bytes:      buffer.length,
              source:               'received_email',
              created_by:           null,
              ai_extraction_status: 'pending',
              notes:                `Received by email from ${providerName} (${msg.from}), subject: "${msg.subject}".${isKnown ? '' : ' ⚠ Unknown sender — review before filing.'}`,
            })
            .select('id')
            .single();

          if (insertError) throw insertError;

          summary.documentsCreated++;
          await audit({
            action: 'extract', entityType: 'document', entityId: doc.id,
            payload: { source: 'received_email', provider_id: providerId, message_id: id, known_sender: isKnown },
          });
          // Fire-and-forget is safe here: cron batches are small (≤20 messages)
          void extractDocumentInsights(doc.id);
        } catch (err) {
          allOk = false;
          summary.errors.push({ messageId: id, error: errStr(err) });
        }
      }

      if (allOk) await markRead(id);
    } catch (err) {
      summary.errors.push({ messageId: id, error: errStr(err) });
    }
  }

  return summary;
}

// ─── Backfill: sweep last N days, all PDF/image senders ──────────────────────
// Extractions are run SEQUENTIALLY (awaited) with a 300 ms stagger to prevent
// the simultaneous-buffer spike that caused SIGSEGV (exit 139) on Render.
export async function backfillDocumentEmails(days = 30, maxMessages = 100): Promise<EmailDocumentSummary & { alreadyStored: number }> {
  const summary: EmailDocumentSummary & { alreadyStored: number } = {
    processed: 0, documentsCreated: 0, skipped: 0, alreadyStored: 0, errors: [],
  };

  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000);
  const dateStr = `${cutoff.getFullYear()}/${String(cutoff.getMonth() + 1).padStart(2, '0')}/${String(cutoff.getDate()).padStart(2, '0')}`;

  const query = `has:attachment (filename:.pdf OR filename:.jpg OR filename:.jpeg OR filename:.png) after:${dateStr}`;

  let messageIds: string[];
  try {
    messageIds = await listMessagesByQuery(query, maxMessages);
  } catch (err) {
    summary.errors.push({ messageId: 'list', error: errStr(err) });
    return summary;
  }

  // Collect doc IDs during upload, then extract sequentially — avoids launching
  // 100+ concurrent Claude vision calls that spike memory and crash the process.
  const pendingExtractions: string[] = [];

  for (const id of messageIds) {
    try {
      const msg = await getMessage(id);
      const relevantAttachments = msg.attachments.filter(
        a => ATTACHMENT_MIME.has(a.mimeType) && (a.size ?? 0) <= MAX_ATTACHMENT_BYTES,
      );
      if (!relevantAttachments.length) { summary.skipped++; continue; }

      summary.processed++;
      const { providerName, docType, providerId, isKnown } = await resolveSender(msg.from);

      for (const attachment of relevantAttachments) {
        try {
          const buffer = await getAttachmentData(id, attachment.attachmentId);
          if (buffer.length > MAX_ATTACHMENT_BYTES) { summary.skipped++; continue; }

          const ext = attachment.filename.includes('.') ? attachment.filename.slice(attachment.filename.lastIndexOf('.')) : '';
          const storagePath = `received-email/${id}-${attachment.attachmentId}${ext}`;

          const { error: uploadError } = await sb()
            .storage
            .from('patient-documents')
            .upload(storagePath, buffer, { contentType: attachment.mimeType, upsert: false });

          if (uploadError) {
            if ((uploadError as { statusCode?: number | string }).statusCode === 409 ||
                uploadError.message?.includes('already exists')) {
              summary.alreadyStored++;
              continue;
            }
            throw uploadError;
          }

          const { data: doc, error: insertError } = await sb()
            .from('documents')
            .insert({
              patient_id:           null,
              document_type:        docType,
              title:                attachment.filename || `${providerName} document`,
              file_name:            attachment.filename,
              storage_path:         storagePath,
              mime_type:            attachment.mimeType,
              file_size_bytes:      buffer.length,
              source:               'received_email',
              created_by:           null,
              ai_extraction_status: 'pending',
              notes:                `Received by email from ${providerName} (${msg.from}), subject: "${msg.subject}".${isKnown ? '' : ' ⚠ Unknown sender — review before filing.'}`,
            })
            .select('id')
            .single();

          if (insertError) throw insertError;

          summary.documentsCreated++;
          await audit({
            action: 'extract', entityType: 'document', entityId: doc.id,
            payload: { source: 'received_email_backfill', provider_id: providerId, message_id: id, known_sender: isKnown },
          });
          pendingExtractions.push(doc.id);
        } catch (err) {
          summary.errors.push({ messageId: id, error: errStr(err) });
        }
      }
    } catch (err) {
      summary.errors.push({ messageId: id, error: errStr(err) });
    }
  }

  // Sequential extraction with stagger — one document at a time, 300 ms apart
  for (const docId of pendingExtractions) {
    try {
      await extractDocumentInsights(docId);
    } catch {
      // extraction errors are already logged inside extractDocumentInsights
    }
    await new Promise(r => setTimeout(r, 300));
  }

  return summary;
}
