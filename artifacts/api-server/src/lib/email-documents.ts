import { sb, audit } from './supabase.js';
import { listUnreadMessages, getMessage, getAttachmentData, markRead } from './gmail.js';
import { extractDocumentInsights } from '../routes/portal.js';

const ATTACHMENT_MIME = new Set([
  'application/pdf', 'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
]);

// Supabase/Postgrest/Storage errors are plain objects (not Error instances),
// so String(err) collapses them to "[object Object]". Stringify those instead.
function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null) {
    try {
      return JSON.stringify(err);
    } catch {
      // fall through
    }
  }
  return String(err);
}

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
    summary.errors.push({ messageId: 'list', error: String(err) });
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
          summary.errors.push({ messageId: id, error: errorMessage(err) });
        }
      }

      if (allOk) {
        await markRead(id);
      }
    } catch (err) {
      summary.errors.push({ messageId: id, error: errorMessage(err) });
    }
  }

  return summary;
}
