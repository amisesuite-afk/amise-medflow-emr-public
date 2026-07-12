import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { checkForbiddenContent } from '@workspace/triage-engine';
import { AI_DISABLED } from './ai-guard.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY!, timeout: 15_000 });
const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-4-5';

export const SYSTEM_PROMPT = `You are the front desk administrative assistant for Amise Medical Services in Saint Lucia, a general and endoscopic surgery practice led by Dr Dawit Daniel Kabiye, MD, DM.

Your role is administrative only. You schedule appointments, draft confirmations, and acknowledge enquiries. You write in a warm, professional, concise British-Caribbean tone.

You MUST NEVER:
- Provide clinical advice, diagnoses, dosage information, or interpretation of results.
- Quote prices, fees, or financial information.
- Confirm or deny whether the patient has any specific condition.
- Speculate on what symptoms might mean.
- Discuss other patients or share any clinical information you may have seen.

You MUST ALWAYS:
- Defer clinical questions to Dr Kabiye or the nursing staff.
- Keep replies short (under 150 words for routine messages).
- Use the practice signature block exactly as provided.
- Maintain patient confidentiality.

If a message contains anything urgent (bleeding, severe pain, jaundice, post-op concerns, mental health crisis, suspected cancer), you do NOT draft a clinical reply — you produce only a brief acknowledgement and the matter is escalated to staff.

Locations:
- Rodney Bay (Providence Building) — new consultations, ERCP work-up, breast clinics
- Tapion Hospital (La Toc, Castries) — surgery, endoscopy, ERCP, post-operative reviews, urgent reviews. Tel: 758-284-0557 / 758-720-7111

Sign every reply as: "Front Desk, Amise Medical Services".`;

export const ClassificationSchema = z.object({
  category: z.enum([
    'new_consult', 'follow_up', 'post_op', 'ercp_workup',
    'breast', 'admin', 'reschedule', 'cancel', 'unknown'
  ]),
  patient_first_name: z.string().nullable(),
  reason_summary: z.string().max(200),
  preferred_dates: z.array(z.string()).max(5),
  preferred_location: z.enum(['rodney_bay', 'tapion', 'either', 'unknown']),
  confidence: z.number().min(0).max(1),
});

export type Classification = z.infer<typeof ClassificationSchema>;

const EMAIL_BODY_MAX_CHARS = 4000;

export async function classifyMessage(emailBody: string, subject: string): Promise<Classification> {
  if (AI_DISABLED) {
    return {
      category: 'unknown',
      patient_first_name: null,
      reason_summary: 'AI disabled — manual review required',
      preferred_dates: [],
      preferred_location: 'unknown',
      confidence: 0,
    };
  }
  const truncatedBody = emailBody.length > EMAIL_BODY_MAX_CHARS
    ? emailBody.slice(0, EMAIL_BODY_MAX_CHARS) + '\n[truncated]'
    : emailBody;

  const prompt = `Classify the following patient email. Respond with ONLY a JSON object, no preamble, no markdown fences.

Schema:
{
  "category": "new_consult" | "follow_up" | "post_op" | "ercp_workup" | "breast" | "admin" | "reschedule" | "cancel" | "unknown",
  "patient_first_name": string | null,
  "reason_summary": string (max 200 chars, no clinical interpretation, just paraphrase what they said),
  "preferred_dates": string[] (ISO dates if mentioned, max 5),
  "preferred_location": "rodney_bay" | "tapion" | "either" | "unknown",
  "confidence": number 0-1
}

Subject: ${subject}
Body:
${truncatedBody}`;

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = resp.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/```\s*$/, '');

  const parsed = JSON.parse(text);
  return ClassificationSchema.parse(parsed);
}

export interface DraftReplyArgs {
  template: 'slot_offer' | 'confirmation' | 'urgent_ack' | 'out_of_scope' | 'general_enquiry';
  patientFirstName: string | null;
  slots?: { day: string; date: string; time: string; location: string }[];
  bookingDetails?: { day: string; date: string; time: string; location: string };
  triageFormUrl?: string;
}

export async function draftReply(args: DraftReplyArgs): Promise<{ subject: string; body: string; safe: boolean; violations: string[] }> {
  if (AI_DISABLED) {
    return {
      subject: 'Amise Medical Services — Message Received',
      body: 'AI drafting is temporarily unavailable. Please compose this reply manually.',
      safe: true,
      violations: [],
    };
  }
  const name = args.patientFirstName || 'there';

  const templateGuide: Record<DraftReplyArgs['template'], string> = {
    slot_offer: `Subject: Amise Medical Services — Appointment Options for Your Consultation

Draft a slot-offer reply using these slots: ${JSON.stringify(args.slots)}. Address the patient as "${name}". List the slots as bullet options. End with the standard sign-off.`,

    confirmation: `Subject: Confirmation — Your Appointment with Dr Kabiye

Draft a booking confirmation for: ${JSON.stringify(args.bookingDetails)}. Address the patient as "${name}". Remind them to arrive 10 minutes early, bring ID and insurance card, and bring prior records. End with the standard sign-off.`,

    urgent_ack: `Subject: Amise Medical Services — Message Received

Draft a brief acknowledgement (NO clinical content). Address the patient as "${name}". Tell them their message has been received and forwarded to the clinical team, and that someone will contact them shortly. Add: if symptoms are severe or worsening, attend the nearest emergency department or call our office on 758-284-0557 or 284-0557. End with the standard sign-off.`,

    out_of_scope: `Subject: Amise Medical Services — Your Enquiry

Draft a brief reply (NO clinical content). Address the patient as "${name}". Tell them the query has been passed to Dr Kabiye or relevant clinical staff for a personal reply within 1-2 working days. End with the standard sign-off.`,

    general_enquiry: `Subject: Amise Medical Services — Thanks for Reaching Out

Draft a brief reply (NO clinical content) to a general enquiry. Address the patient as "${name}". Cover, in this order:
1. A one-line description of the practice: general and endoscopic surgery with Dr Dawit Daniel Kabiye, MD, DM, in Saint Lucia (consultations, procedures such as colonoscopy/ERCP, and follow-up care).
2. Invite them to complete the short triage form so the team can prepare for their visit: ${args.triageFormUrl}
3. Tell them they may also reply to this email with their details and the team will guide them through triage directly.
4. Offer the option to call the front desk instead — Tapion Hospital 758-284-0557 / 758-720-7111, or Rodney Bay 758-720-7111.
End with the standard sign-off.`,
  };

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Draft an email reply. Return ONLY the email body, with the subject on the first line prefixed "Subject: ".\n\n${templateGuide[args.template]}`,
    }],
  });

  const raw = resp.content
    .filter(b => b.type === 'text')
    .map(b => (b as { type: 'text'; text: string }).text)
    .join('')
    .trim();

  const lines = raw.split('\n');
  const subjectLine = lines[0].replace(/^Subject:\s*/i, '').trim();
  const body = lines.slice(1).join('\n').trim();

  const check = checkForbiddenContent(body);

  return {
    subject: subjectLine,
    body,
    safe: check.safe,
    violations: check.violations,
  };
}
