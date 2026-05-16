import { google, gmail_v1 } from 'googleapis';

function getAuth() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON must be set');
  }
  const creds = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.send',
    ],
    subject: process.env.GMAIL_USER,
  });
}

function getGmail() {
  return google.gmail({ version: 'v1', auth: getAuth() });
}

export async function listUnreadMessages(maxResults = 20): Promise<string[]> {
  const gmail = getGmail();
  const { data } = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread -in:sent -from:me',
    maxResults,
  });
  return (data.messages || []).map(m => m.id!);
}

export interface ParsedMessage {
  id: string;
  threadId: string;
  from: string;
  fromName: string | null;
  subject: string;
  body: string;
  receivedAt: Date;
}

export async function getMessage(id: string): Promise<ParsedMessage> {
  const gmail = getGmail();
  const { data } = await gmail.users.messages.get({ userId: 'me', id, format: 'full' });

  const headers = data.payload?.headers || [];
  const get = (n: string) => headers.find(h => h.name?.toLowerCase() === n.toLowerCase())?.value || '';

  const fromRaw = get('From');
  const fromName = fromRaw.match(/^"?([^"<]+?)"?\s*</)?.[1]?.trim() || null;
  const fromEmail = fromRaw.match(/<([^>]+)>/)?.[1] || fromRaw;

  const body = extractPlainBody(data.payload);

  return {
    id,
    threadId: data.threadId!,
    from: fromEmail,
    fromName,
    subject: get('Subject'),
    body,
    receivedAt: new Date(Number(data.internalDate)),
  };
}

function extractPlainBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return Buffer.from(payload.body.data, 'base64url').toString('utf-8');
  }
  for (const part of payload.parts || []) {
    if (part.mimeType === 'text/plain' && part.body?.data) {
      return Buffer.from(part.body.data, 'base64url').toString('utf-8');
    }
  }
  for (const part of payload.parts || []) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      const html = Buffer.from(part.body.data, 'base64url').toString('utf-8');
      return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }
  return '';
}

export async function markRead(id: string): Promise<void> {
  const gmail = getGmail();
  await gmail.users.messages.modify({
    userId: 'me',
    id,
    requestBody: { removeLabelIds: ['UNREAD'] },
  });
}

export type Mode = 'dry_run' | 'supervised' | 'auto';

export interface SendArgs {
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyTo?: string;
}

export interface SendResult {
  action: 'sent' | 'drafted' | 'skipped';
  gmailId?: string;
}

export async function sendOrDraft(args: SendArgs, force?: Mode): Promise<SendResult> {
  const mode: Mode = (force || process.env.MODE || 'dry_run') as Mode;
  const gmail = getGmail();

  const raw = buildRfc822(args);
  const encoded = Buffer.from(raw).toString('base64url');

  if (mode === 'dry_run') {
    return { action: 'skipped' };
  }

  if (mode === 'supervised') {
    const { data } = await gmail.users.drafts.create({
      userId: 'me',
      requestBody: { message: { raw: encoded, threadId: args.threadId } },
    });
    return { action: 'drafted', gmailId: data.id! };
  }

  const { data } = await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: encoded, threadId: args.threadId },
  });
  return { action: 'sent', gmailId: data.id! };
}

function buildRfc822(args: SendArgs): string {
  const lines = [
    `To: ${args.to}`,
    `From: ${process.env.GMAIL_USER}`,
    `Subject: ${args.subject}`,
    'Content-Type: text/plain; charset=UTF-8',
  ];
  if (args.inReplyTo) {
    lines.push(`In-Reply-To: ${args.inReplyTo}`);
    lines.push(`References: ${args.inReplyTo}`);
  }
  lines.push('', args.body);
  return lines.join('\r\n');
}
