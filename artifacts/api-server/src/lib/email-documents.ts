import { sb, audit } from './supabase.js';
import { listUnreadMessages, listMessagesByQuery, getMessage, getAttachmentData, markRead } from './gmail.js';
import { extractDocumentInsights } from '../routes/portal.js';
import { errStr } from './logger.js';

const ATTACHMENT_MIME = new Set([
  'application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
]);

export interface EmailDocumentSummary {
  processed: number;
  documentsCreated: number;
  skipped: number;
  errors: { messageId: string; error: string }[];
}

// Synthetic providers for trusted internal forwarders (not in referring_providers
// to avoid the regular cron marking their routine emails as read).
const INTERNAL_FORWARDERS: Record<string, { name: string; default_document_type: string }> = {
  'dawitson@gmail.com': { name: 'Dr. Dawit (Internal Forward)', default_document_type: 'lab_report' },
};

// Resolve sender to { name, docType, providerId } using referring_providers +
// internal forwarder list. Falls through to the raw from address for any
// unknown sender — all PDFs enter the queue, none are silently discarded.
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
  // Unknown sender — still accept the PDF; AI extraction will identify document type
  return { providerName: fromEmail, docType: 'other', providerId: null, isKnown: false };
}

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
      const relevantAttachments = msg.attachments.filter(a => ATTACHMENT_MIME.has(a.mimeType));

      // Skip messages with no relevant attachments at all
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
              file_size_bytes:      attachment.size || buffer.length,
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

// Backfill: pull ALL emails with PDF/image attachments within the last `days`
// days — regardless of sender. Known providers and internal forwarders get their
// document type resolved; all others land as 'other' with an unknown-sender note.
// Safe to re-run — duplicate uploads counted as alreadyStored not errors.
export async function backfillDocumentEmails(days = 30, maxMessages = 200): Promise<EmailDocumentSummary & { alreadyStored: number }> {
  const summary: EmailDocumentSummary & { alreadyStored: number } = {
    processed: 0, documentsCreated: 0, skipped: 0, alreadyStored: 0, errors: [],
  };

  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000);
  const dateStr = `${cutoff.getFullYear()}/${String(cutoff.getMonth() + 1).padStart(2, '0')}/${String(cutoff.getDate()).padStart(2, '0')}`;

  // Broad query: any email with a PDF, image, or JPEG/PNG attachment
  const query = `has:attachment (filename:.pdf OR filename:.jpg OR filename:.jpeg OR filename:.png) after:${dateStr}`;

  let messageIds: string[];
  try {
    messageIds = await listMessagesByQuery(query, maxMessages);
  } catch (err) {
    summary.errors.push({ messageId: 'list', error: errStr(err) });
    return summary;
  }

  for (const id of messageIds) {
    try {
      const msg = await getMessage(id);
      const relevantAttachments = msg.attachments.filter(a => ATTACHMENT_MIME.has(a.mimeType));
      if (!relevantAttachments.length) { summary.skipped++; continue; }

      summary.processed++;
      const { providerName, docType, providerId, isKnown } = await resolveSender(msg.from);

      for (const attachment of relevantAttachments) {
        try {
          const buffer = await getAttachmentData(id, attachment.attachmentId);
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
              file_size_bytes:      attachment.size || buffer.length,
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
          void extractDocumentInsights(doc.id);
        } catch (err) {
          summary.errors.push({ messageId: id, error: errStr(err) });
        }
      }
    } catch (err) {
      summary.errors.push({ messageId: id, error: errStr(err) });
    }
  }

  return summary;
}
