import Anthropic from '@anthropic-ai/sdk';
import type {
  ConversationThread, TriageLevel, PatientMessage,
  TriageSnapshot, AppointmentSlot,
} from '@/types';
import { adaptiveTriage, checkForbiddenContent } from '@workspace/triage-engine';
import { findSlots } from './calendar';
import { FORBIDDEN_PATTERNS } from './constants';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });

const SYSTEM_PROMPT = `You are the AI intake assistant for Amise Medical Services, Saint Lucia — a general and endoscopic surgical practice led by Dr Dawit Daniel Kabiye, MD, DM.

Your role: Conduct a structured patient intake via WhatsApp/SMS. Be warm, professional, and efficient. Use British-Caribbean English. Address patients by first name when known. Never provide diagnoses, medication advice, test results, or fee estimates.

INTAKE SECTIONS (collect in order, adapting to conversational flow):
A. Identity — full name, date of birth
B. Contact — phone confirmed from channel
C. Chief complaint — main symptom or reason for visit (1–2 sentences)
D. Symptom characterisation — onset, duration, severity (0–10), location, aggravating/relieving factors
E. Red-flag screen — ask explicitly: chest pain, difficulty breathing, severe abdominal pain, vomiting blood, rectal bleeding, loss of consciousness, high fever, stroke signs (FAST)
F. Medical context — relevant past medical history, current medications, allergies
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
  "intake_complete": true|false,
  "appointment_intent": true|false
}

TRIAGE RULES:
EMERGENT: chest pain, difficulty breathing, loss of consciousness, stroke symptoms (FAST), active severe haemorrhage, sepsis → reply MUST be: "This sounds like a medical emergency. Please call 911 or go to the nearest emergency department immediately. Do not wait."
URGENT: rectal bleeding, vomiting blood, severe abdominal pain ≥8/10, jaundice with fever, acute urinary retention
ROUTINE: single warning sign, symptoms >2 weeks, post-operative concern, significant weight loss
INFO: appointment request, follow-up, prescription query, general enquiry

Set appointment_intent: true when the patient is requesting or needs an appointment.

PRACTICE INFORMATION (use ONLY these facts when answering general/administrative questions — never invent locations, hours, services, or numbers not listed here):
- Rodney Bay (Providence Building) — consultations, follow-ups, administrative enquiries. Tel: 758-720-7111.
- Castries — follow-up and post-operative reviews.
- Tapion Hospital, La Toc, Castries — surgery, endoscopy, ERCP, urgent reviews. Tel: 758-284-0557 (urgent line 459-2227).
- Exact appointment days/times depend on the appointment type and are confirmed when booking.
- Patients should arrive 10 minutes early for appointments with a valid photo ID.
- Weekends are for emergencies only — direct to 911 / nearest ED.

GENERAL QUESTIONS:
If the patient asks a general administrative question (e.g. clinic locations, contact numbers, what to bring, directions, opening days) that does not require clinical judgement, answer it briefly and accurately using ONLY the PRACTICE INFORMATION above, in the "reply" field. If the answer isn't covered above, say a member of the team will confirm — never guess. Answering a general question does not need to advance the intake; "section_completed" and "extracted" may be null/empty, and "triage.level" should be "INFO".

SAFETY RULES:
- Never mention fees, diagnoses, specific medications, or test results
- Keep replies concise — under 160 characters where possible
- If intake is complete (sections A–G done), set intake_complete: true and appointment_intent: true`;

interface ClaudeIntakeResult {
  reply: string;
  section_completed: string | null;
  extracted: Record<string, string>;
  triage: { level: TriageLevel; reason: string; red_flags: string[] };
  intake_complete: boolean;
  appointment_intent: boolean;
}

function runForbiddenCheck(text: string): string {
  for (const p of FORBIDDEN_PATTERNS) {
    if (p.test(text)) {
      console.warn('[SAFETY] Forbidden content in Claude reply — using safe fallback');
      return 'Thank you for your message. A member of our team will be in touch with you shortly.';
    }
  }
  return text;
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

  // 1. Run PANE triage engine on the incoming message (staff-side only)
  const pane = adaptiveTriage({ freeText: newPatientMessage, symptoms: [] });

  const triageSnapshot: TriageSnapshot = {
    acuity:            pane.acuity,
    score:             pane.score,
    reasons:           pane.reasons,
    recommendedAction: pane.recommendedAction,
    appointmentType:   pane.appointmentType,
    frontDeskScript:   pane.frontDeskScript,
    questionsToAsk:    pane.questionsToAsk,
  };

  // 2. Build Claude history — exclude system messages from conversation
  const history: { role: 'user' | 'assistant'; content: string }[] = thread.messages
    .filter(m => m.role !== 'system')
    .map(m => ({
      role:    m.role === 'patient' ? 'user' : 'assistant',
      content: m.content,
    }));

  // Inject triage context for Claude (instructs tone; NOT sent to patient)
  const triageCtx = [
    `[TRIAGE ENGINE — internal context only, must not appear in patient reply]`,
    `Acuity: ${pane.acuity.toUpperCase()} | Score: ${pane.score} | Action: ${pane.recommendedAction}`,
    pane.reasons.length       ? `Reasons: ${pane.reasons.slice(0, 4).join('; ')}`        : '',
    pane.questionsToAsk.length? `Suggested questions: ${pane.questionsToAsk.slice(0,3).join(' / ')}` : '',
  ].filter(Boolean).join('\n');

  history.push({
    role:    'user',
    content: `${triageCtx}\n\nPatient message: ${newPatientMessage}`,
  });

  // 3. Call Claude
  let result: ClaudeIntakeResult;
  try {
    const response = await anthropic.messages.create({
      model:      'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system:     SYSTEM_PROMPT,
      messages:   history,
    });
    const raw = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = raw.match(/```json\s*([\s\S]+?)\s*```/) ?? raw.match(/(\{[\s\S]+\})/);
    result = JSON.parse(jsonMatch ? jsonMatch[1] : raw) as ClaudeIntakeResult;
  } catch (err) {
    console.error('[Claude] Parse error:', err);
    result = {
      reply:             'Thank you for your message. A member of our team will be in touch shortly.',
      section_completed: null,
      extracted:         {},
      triage:            { level: 'INFO', reason: 'Parse error fallback', red_flags: [] },
      intake_complete:   false,
      appointment_intent: false,
    };
  }

  // 4. Safety filter on every Claude reply
  const safeReply = runForbiddenCheck(result.reply);

  // 5. Build updated message list with triage system message (staff-only)
  const triageSystemMsg: PatientMessage = {
    role:      'system',
    content:   `Triage: ${pane.acuity.toUpperCase()} | Score ${pane.score} | ${pane.recommendedAction}`,
    timestamp: now,
    meta:      { type: 'triage_result', payload: triageSnapshot },
  };

  const newMessages: PatientMessage[] = [
    ...thread.messages,
    { role: 'patient',   content: newPatientMessage, timestamp: now },
    triageSystemMsg,
    { role: 'assistant', content: safeReply,          timestamp: new Date().toISOString() },
  ];

  // 6. Appointment intent: find available slots
  const appointmentIntent = result.appointment_intent;
  const isBookable =
    appointmentIntent &&
    result.intake_complete &&
    pane.recommendedAction !== 'emergency_now' &&
    pane.recommendedAction !== 'same_day_call';

  let slots: AppointmentSlot[] = [];
  if (isBookable) {
    try {
      const found = await findSlots(pane.appointmentType, 3);
      slots = found.map(s => ({
        start:           s.start.toISOString(),
        end:             s.end.toISOString(),
        location:        s.location,
        appointmentType: s.appointmentType,
        display:         s.display,
      }));
    } catch (err) {
      console.error('[scheduling] findSlots error:', err);
    }

    if (slots.length > 0) {
      const slotsSystemMsg: PatientMessage = {
        role:      'system',
        content:   `Slots for ${pane.appointmentType}: ${slots.map(s => s.display).join(' | ')}`,
        timestamp: new Date().toISOString(),
        meta:      { type: 'appointment_slots', payload: slots },
      };
      newMessages.push(slotsSystemMsg);
    }
  }

  // 7. Build patient-facing draft (scheduling info only; no clinical content)
  //    Staff will review + pick slot + approve before anything is sent.
  const emergent = result.triage.level === 'EMERGENT';
  let draftReply: string | null = null;

  if (!emergent) {
    if (slots.length > 0) {
      const slotLines = slots.map((s, i) => `${i + 1}. ${s.display}`).join('\n');
      draftReply = [
        `Good day${thread.patient_name ? ' ' + thread.patient_name.split(' ')[0] : ''},`,
        ``,
        `Thank you for contacting Amise Medical Services. We have the following appointment options available for you:`,
        ``,
        slotLines,
        ``,
        `Please let us know your preferred option and we will confirm your appointment.`,
        ``,
        `Front Desk, Amise Medical Services`,
      ].join('\n');
    } else {
      draftReply = safeReply;
    }
  }

  const newStatus: ConversationThread['status'] = emergent
    ? 'escalated'
    : result.triage.level === 'URGENT' || slots.length > 0
      ? 'pending_approval'
      : 'active';

  const updatedThread: Partial<ConversationThread> = {
    messages:        newMessages,
    triage_level:    result.triage.level,
    status:          newStatus,
    intake_complete: result.intake_complete,
    draft_reply:     draftReply,
    patient_name:    (result.extracted['name']            ?? thread.patient_name)    || null,
    patient_dob:     (result.extracted['dob']             ?? thread.patient_dob)     || null,
    chief_complaint: (result.extracted['chief_complaint'] ?? thread.chief_complaint) || null,
  };

  return { reply: safeReply, updatedThread, emergent };
}

// ── Procedure-prep adjustment drafting ──────────────────────────────────────
//
// For endoscopy procedures (colonoscopy, gastroscopy), the standard prep
// instructions are sent immediately and automatically — they are pre-vetted,
// generic, and contain no patient-specific clinical content.
//
// Separately, if the patient has mentioned anything in their own words during
// intake that suggests they're on an anticoagulant/antiplatelet, a diabetes
// medication, or have renal impairment/dialysis/a stoma/IBD/prior bowel
// surgery, Claude drafts a short flagging note for clinical staff to review.
//
// This draft NEVER specifies medication stop-timing, dose changes, or prep
// product substitutions itself — those remain Dr Kabiye's decision. It is
// always queued for human approval before it reaches the patient, and drafting
// it never blocks or delays the standard confirmation/prep email.

const PROCEDURE_PREP_TYPES = new Set(['colonoscopy', 'gastroscopy']);

export function isProcedurePrepEligible(appointmentType: string): boolean {
  return PROCEDURE_PREP_TYPES.has(appointmentType);
}

export interface ProcedurePrepAdjustmentResult {
  /** Empty string if nothing relevant was found in the patient's messages. */
  body: string;
  flagged: boolean;
  safe: boolean;
  violations: string[];
}

export async function draftProcedurePrepAdjustment(
  procedureType: string,
  patientFirstName: string | null,
  patientMessages: string[],
): Promise<ProcedurePrepAdjustmentResult> {
  const name = patientFirstName || 'the patient';
  const context = patientMessages.join('\n').trim();

  if (!context) {
    return { body: '', flagged: false, safe: true, violations: [] };
  }

  const prompt = `Below are messages a patient sent during intake, ahead of a ${procedureType} appointment.

Patient messages:
"""
${context}
"""

Check ONLY for mentions of:
- Blood thinners / antiplatelets (e.g. warfarin, apixaban/Eliquis, rivaroxaban/Xarelto, dabigatran, clopidogrel, aspirin, heparin)
- Diabetes medications (insulin, metformin, gliclazide, or "diabetic"/"diabetes")
- Kidney/renal disease, dialysis, a stoma, inflammatory bowel disease, or prior bowel surgery

If NONE of these are mentioned, respond with exactly: NONE

If one or more ARE mentioned, write a short internal note (2-4 sentences max) for Dr Kabiye's clinical team, addressed to the team (not the patient), that:
1. Names ${name} and lists which of the above categories were mentioned, quoting the relevant phrase from the patient.
2. States that the standard ${procedureType} prep instructions have already been sent, and asks the team to contact the patient with any necessary adjustment to medication timing or prep product BEFORE their prep begins.

Do NOT suggest a specific stop date, dose change, or alternative prep product yourself — that is for the clinical team to decide. Return ONLY the note text (or NONE), no preamble.`;

  const response = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 300,
    messages:   [{ role: 'user', content: prompt }],
  });

  const raw = (response.content[0].type === 'text' ? response.content[0].text : '').trim();

  if (!raw || raw.toUpperCase() === 'NONE') {
    return { body: '', flagged: false, safe: true, violations: [] };
  }

  const check = checkForbiddenContent(raw);
  return {
    body:       raw,
    flagged:    true,
    safe:       check.safe,
    violations: check.violations,
  };
}
