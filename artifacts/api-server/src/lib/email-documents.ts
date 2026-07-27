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

      const { data: provider } = await sb()
        .from('referring_providers')
        .select('id, name, provider_type, default_document_type')
        .eq('email', msg.from.toLowerCase())
        .eq('active', true)
        .maybeSingle();

      if (!provider) {
        summary.skipped++;
        continue;
      }

      summary.processed++;

      const relevantAttachments = msg.attachments.filter(a => ATTACHMENT_MIME.has(a.mimeType));

      if (!relevantAttachments.length) {
        await markRead(id);
        continue;
      }

      let allOk = true;

      for (const attachment of relevantAttachments) {
        try {
          const buffer = await getAttachmentData(id, attachment.attachmentId);
          const ext = attachment.filename.includes('.') ? attachment.filename.slice(attachment.filename.lastIndexOf('.')) : '';
          const storagePath = `received-email/${id}-${attachment.attachmentId}${ext}`;

          const { error: uploadError } = await sb()
            .storage
            .from('patient-documents')
            .upload(storagePath, buffer, {
              contentType: attachment.mimeType,
              upsert: false,
            });

          if (uploadError) throw uploadError;

          const { data: doc, error: insertError } = await sb()
            .from('documents')
            .insert({
              patient_id:           null,
              document_type:        provider.default_document_type,
              title:                attachment.filename || `${provider.name} document`,
              file_name:            attachment.filename,
              storage_path:         storagePath,
              mime_type:            attachment.mimeType,
              file_size_bytes:      attachment.size || buffer.length,
              source:               'received_email',
              created_by:           null,
              ai_extraction_status: 'pending',
              notes:                `Received by email from ${provider.name} (${msg.from}), subject: "${msg.subject}".`,
            })
            .select('id')
            .single();

          if (insertError) throw insertError;

          summary.documentsCreated++;

          await audit({
            action:     'extract',
            entityType: 'document',
            entityId:   doc.id,
            payload:    { source: 'received_email', provider_id: provider.id, message_id: id },
          });

          void extractDocumentInsights(doc.id);
        } catch (err) {
          allOk = false;
          summary.errors.push({ messageId: id, error: errStr(err) });
        }
      }

      if (allOk) {
        await markRead(id);
      }
    } catch (err) {
      summary.errors.push({ messageId: id, error: errStr(err) });
    }
  }

  return summary;
}

// Backfill: process ALL messages (read or unread) from known providers
// within the last `days` days. Skips any message whose attachment has already
// been stored (upsert: false on storage upload will throw — caught and counted
// as a skip rather than an error so re-runs are safe).
export async function backfillDocumentEmails(days = 30, maxMessages = 100): Promise<EmailDocumentSummary & { alreadyStored: number }> {
  const summary: EmailDocumentSummary & { alreadyStored: number } = {
    processed: 0, documentsCreated: 0, skipped: 0, alreadyStored: 0, errors: [],
  };

  // Build Gmail query: messages from any known active lab/radiology provider
  const { data: providers } = await sb()
    .from('referring_providers')
    .select('id, name, email, provider_type, default_document_type')
    .eq('active', true)
    .not('email', 'is', null);

  const activeProviders = (providers ?? []).filter(p => p.email);
  if (!activeProviders.length) return summary;

  const fromParts = activeProviders.map(p => `from:${p.email as string}`).join(' OR ');
  // YYYY/MM/DD format for Gmail after: filter
  const cutoff = new Date(Date.now() - days * 24 * 3600 * 1000);
  const dateStr = `${cutoff.getFullYear()}/${String(cutoff.getMonth() + 1).padStart(2, '0')}/${String(cutoff.getDate()).padStart(2, '0')}`;
  const query = `(${fromParts}) after:${dateStr} -in:sent`;

  let messageIds: string[];
  try {
    messageIds = await listMessagesByQuery(query, maxMessages);
  } catch (err) {
    summary.errors.push({ messageId: 'list', error: errStr(err) });
    return summary;
  }

  const providerByEmail = new Map(activeProviders.map(p => [p.email as string, p]));

  for (const id of messageIds) {
    try {
      const msg = await getMessage(id);
      const provider = providerByEmail.get(msg.from.toLowerCase());

      if (!provider) {
        summary.skipped++;
        continue;
      }

      summary.processed++;

      const relevantAttachments = msg.attachments.filter(a => ATTACHMENT_MIME.has(a.mimeType));
      if (!relevantAttachments.length) continue;

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
            // "already exists" — this message was already stored
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
              document_type:        provider.default_document_type,
              title:                attachment.filename || `${provider.name} document`,
              file_name:            attachment.filename,
              storage_path:         storagePath,
              mime_type:            attachment.mimeType,
              file_size_bytes:      attachment.size || buffer.length,
              source:               'received_email',
              created_by:           null,
              ai_extraction_status: 'pending',
              notes:                `Received by email from ${provider.name as string} (${msg.from}), subject: "${msg.subject}".`,
            })
            .select('id')
            .single();

          if (insertError) throw insertError;

          summary.documentsCreated++;
          await audit({
            action: 'extract', entityType: 'document', entityId: doc.id,
            payload: { source: 'received_email_backfill', provider_id: provider.id, message_id: id },
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
