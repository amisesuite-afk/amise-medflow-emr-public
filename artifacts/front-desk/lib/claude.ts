import Anthropic from '@anthropic-ai/sdk';
import type { ConversationThread, TriageLevel, PatientMessage } from '@/types';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `You are the AI intake assistant for Amise Medical Services, Saint Lucia — a general and endoscopic surgical practice led by Dr Dawit Daniel Kabiye, MD, DM.

Your role: Conduct a structured patient intake via WhatsApp. Be warm, professional, and efficient. Use British-Caribbean English. Address patients by first name when known. Never provide diagnoses, medication advice, test results, or fee estimates.

INTAKE SECTIONS (collect in order, adapting to conversational flow):
A. Identity — full name, date of birth
B. Contact — phone confirmed (from WhatsApp), preferred callback time
C. Chief complaint — main symptom or reason for visit (1–2 sentences)
D. Symptom characterisation — onset, duration, severity (0–10), location, radiation, aggravating/relieving factors
E. Red-flag screen — ask explicitly: chest pain, difficulty breathing, severe abdominal pain, vomiting blood, rectal bleeding, loss of consciousness, high fever, stroke signs (FAST)
F. Medical context — relevant past medical history, current medications, allergies (brief)
G. Administrative — preferred clinic (Rodney Bay / Castries / Tapion-ERCP), preferred appointment time

After EVERY patient message, output ONLY valid JSON with this exact structure:
{
  "reply": "Your next message to the patient in British-Caribbean English",
  "section_completed": "A"|"B"|"C"|"D"|"E"|"F"|"G"|null,
  "extracted": { "field_name": "value" },
  "triage": {
    "level": "EMERGENT"|"URGENT"|"ROUTINE"|"INFO",
    "reason": "Brief clinical reason",
    "red_flags": ["symptom1"]
  },
  "intake_complete": true|false
}

TRIAGE RULES (apply strictly and at every turn):
EMERGENT: chest pain, difficulty breathing, loss of consciousness, stroke symptoms (FAST), active severe haemorrhage, sepsis signs (fever + hypotension + confusion) → reply MUST be: "This sounds like a medical emergency. Please call 911 or go to the nearest emergency department immediately. Do not wait."
URGENT: rectal bleeding, vomiting blood, severe abdominal pain ≥8/10, jaundice with fever, acute urinary retention
ROUTINE: single warning sign, symptoms >2 weeks, post-operative concern, significant weight loss
INFO: appointment request, follow-up, prescription query, general enquiry

SAFETY RULES:
- Never mention fees, diagnoses, specific medications, or test results
- If a patient seems distressed, acknowledge with empathy before proceeding
- Keep replies concise — under 160 characters where possible for WhatsApp readability
- If intake is complete (all sections A–G done), set intake_complete: true and summarise the appointment request`;

interface ClaudeIntakeResult {
  reply: string;
  section_completed: string | null;
  extracted: Record<string, string>;
  triage: { level: TriageLevel; reason: string; red_flags: string[] };
  intake_complete: boolean;
}

export async function runIntakeTurn(
  thread: ConversationThread,
  newPatientMessage: string,
): Promise<{
  reply: string;
  updatedThread: Partial<ConversationThread>;
  emergent: boolean;
}> {
  const now = new Date().toISOString();

  // Build message history
  const history: { role: 'user' | 'assistant'; content: string }[] = thread.messages.map(m => ({
    role: m.role === 'patient' ? 'user' : 'assistant',
    content: m.content,
  }));
  history.push({ role: 'user', content: newPatientMessage });

  let result: ClaudeIntakeResult;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: history,
    });

    const raw = response.content[0].type === 'text' ? response.content[0].text : '';
    // Extract JSON — Claude may wrap it in ```json ... ```
    const jsonMatch = raw.match(/```json\s*([\s\S]+?)\s*```/) ?? raw.match(/(\{[\s\S]+\})/);
    const jsonStr = jsonMatch ? jsonMatch[1] : raw;
    result = JSON.parse(jsonStr) as ClaudeIntakeResult;
  } catch (err) {
    console.error('[Claude] Parse error:', err);
    result = {
      reply: 'Thank you for your message. A member of our team will be in touch shortly.',
      section_completed: null,
      extracted: {},
      triage: { level: 'INFO', reason: 'Parse error fallback', red_flags: [] },
      intake_complete: false,
    };
  }

  const newMessages: PatientMessage[] = [
    ...thread.messages,
    { role: 'patient', content: newPatientMessage, timestamp: now },
    { role: 'assistant', content: result.reply, timestamp: new Date().toISOString() },
  ];

  const emergent = result.triage.level === 'EMERGENT';
  const newStatus = emergent
    ? 'escalated'
    : ['URGENT'].includes(result.triage.level)
      ? 'pending_approval'
      : 'active';

  const updatedThread: Partial<ConversationThread> = {
    messages: newMessages,
    triage_level: result.triage.level,
    status: newStatus,
    intake_complete: result.intake_complete,
    draft_reply: !emergent && result.triage.level !== 'INFO' ? result.reply : null,
    // Merge extracted fields
    patient_name: (result.extracted.name ?? thread.patient_name) || null,
    patient_dob: (result.extracted.dob ?? thread.patient_dob) || null,
    chief_complaint: (result.extracted.chief_complaint ?? thread.chief_complaint) || null,
  };

  return { reply: result.reply, updatedThread, emergent };
}
