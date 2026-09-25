import { logger } from './logger.js';
import { outboundBlocked } from './outbound.js';

export function toE164(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('+')) return `+${trimmed.slice(1).replace(/\D/g, '')}`;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 7) return `+1758${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

export interface SmsArgs {
  to: string;
  body: string;
  forceChannel?: 'whatsapp' | 'sms';
}

export interface SmsResult {
  action: 'sent' | 'skipped';
  channel?: 'whatsapp' | 'sms';
  providerId?: string;
}

// Process-level dedup -- prevents identical (to + body) sends within 60 seconds.
const recentSends = new Map<string, number>();
const SMS_DEDUP_MS = 60_000;

// Periodic cleanup of stale dedup entries
setInterval(() => {
  const now = Date.now();
  for (const [k, ts] of recentSends) {
    if (now - ts > SMS_DEDUP_MS) recentSends.delete(k);
  }
}, 5 * 60 * 1000).unref();

async function getTwilioClient() {
  const sid   = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('[SMS] TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be set to use the twilio provider');
  const { default: twilio } = await import('twilio');
  return twilio(sid, token);
}

export async function sendSms(args: SmsArgs): Promise<SmsResult> {
  const provider = process.env.SMS_PROVIDER || 'dry_run';

  // Dedup key = to + first 40 chars of body
  const dedupKey = `${args.to}:${args.body.slice(0, 40)}`;
  const now = Date.now();
  const lastSent = recentSends.get(dedupKey);
  if (lastSent && now - lastSent < SMS_DEDUP_MS) {
    logger.info({ to: args.to }, '[SMS] duplicate suppressed (cooldown)');
    return { action: 'skipped' };
  }

  // MODE gate (lib/outbound.ts) — an unrecognised MODE fails closed to dry_run.
  if (provider === 'dry_run' || outboundBlocked('sms', { to: args.to })) {
    logger.info({ to: args.to, channel: 'dry_run', bodyPreview: args.body.slice(0, 60) }, '[SMS dry-run]');
    return { action: 'skipped' };
  }

  if (provider === 'twilio') {
    const client = await getTwilioClient();
    const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM || `whatsapp:${process.env.TWILIO_FROM_NUMBER!}`;

    // WhatsApp first, SMS fallback (unless forced to a specific channel)
    if (args.forceChannel !== 'sms') {
      try {
        const msg = await client.messages.create({
          from: whatsappFrom,
          to: `whatsapp:${args.to}`,
          body: args.body,
        });
        recentSends.set(dedupKey, now);
        logger.info({ to: args.to, channel: 'whatsapp', sid: msg.sid }, '[MSG] sent via WhatsApp');
        return { action: 'sent', channel: 'whatsapp', providerId: msg.sid };
      } catch (waErr: any) {
        const errCode = waErr?.code ?? waErr?.status;
        logger.info({ to: args.to, errCode, msg: waErr?.message }, '[MSG] WhatsApp failed, falling back to SMS');
      }
    }

    // SMS fallback (or forced SMS)
    if (args.forceChannel !== 'whatsapp') {
      try {
        const msg = await client.messages.create({
          from: process.env.TWILIO_FROM_NUMBER!,
          to: args.to,
          body: args.body,
        });
        recentSends.set(dedupKey, now);
        logger.info({ to: args.to, channel: 'sms', sid: msg.sid }, '[MSG] sent via SMS');
        return { action: 'sent', channel: 'sms', providerId: msg.sid };
      } catch (smsErr: any) {
        logger.error({ to: args.to, err: smsErr?.message }, '[MSG] SMS send failed');
        throw smsErr;
      }
    }

    return { action: 'skipped' };
  }

  if (provider === 'digicel') {
    throw new Error('[SMS] Digicel provider (SMS_PROVIDER=digicel) is not implemented. Set SMS_PROVIDER=twilio or SMS_PROVIDER=dry_run.');
  }

  throw new Error(`Unknown SMS_PROVIDER: ${provider}`);
}

// Preparation instructions aligned with ESGE/BSG/ASA outpatient guidelines,
// adapted for the Saint Lucian setting (Tapion Hospital, Rodney Bay clinic).
//
// Hazard H-10 / CLAUDE.md Tone rule: these are sent automatically, so they must
// carry administrative logistics only — never an instruction to take, hold,
// stop or change a medicine (a blanket "do not take insulin" risks DKA in type 1
// diabetes; a blanket anticoagulant hold risks thrombosis or bleeding). Patients
// on insulin, diabetes medicines or blood thinners are told to call the clinic
// for individual instructions instead. Enforced by src/test/outbound-safety.test.ts.
// Any wording change here needs the clinical owner's approval.
//
// GENERAL_PREP is kept as separate lines so each template takes only the lines
// that apply to it (Dr Kabiye's decisions): flexible sigmoidoscopy allows a
// light breakfast, so it gets no FASTING line; the pre-operative ASSESSMENT
// visit is a check-up, so it gets no fasting or sedation-transport lines; ERCP
// is done under general anaesthesia at Tapion, so it gets a GA transport line
// instead of the sedation one.
const PREP_WEAR =
  'WHAT TO WEAR: Loose, comfortable clothing (you will change into a gown). Remove all jewellery, piercings, watches, and hair accessories before arrival.';
const PREP_BRING =
  'WHAT TO BRING: Valid photo ID, insurance card (if applicable), a complete list of your current medications (including doses), any relevant referral letters, blood results, or imaging reports.';
const PREP_TRANSPORT =
  'TRANSPORT: Arrange a responsible adult to drive you home -- you CANNOT drive after sedation or anaesthesia. You should not take public transport alone. Plan for someone to stay with you for 24 hours after your procedure.';
const PREP_FASTING =
  'FASTING: Nothing to eat for 6 hours and nothing to drink for 2 hours before your appointment time, unless otherwise instructed below.';
const PREP_MEDICATIONS =
  'MEDICATIONS: If you take insulin, blood thinners or diabetes medicines, please call the clinic before your procedure for instructions. If you have any questions about your other medicines, please call us.';
const PREP_CONTINGENCIES =
  'CONTINGENCIES: If you develop fever, a new cough, vomiting, or feel unwell in the days before your procedure, call us immediately -- we may need to reschedule. If you have a medical emergency at any time, call 911 or go to the nearest emergency department (OKEU Hospital, St Jude\'s Hospital or Tapion Hospital) immediately -- do not wait.';

const GENERAL_PREP = [
  PREP_WEAR,
  PREP_BRING,
  PREP_TRANSPORT,
  PREP_FASTING,
  PREP_MEDICATIONS,
  PREP_CONTINGENCIES,
].join('\n');

const PREP_INSTRUCTIONS: Record<string, string> = {
  colonoscopy: [
    'COLONOSCOPY PREPARATION',
    'TWO DAYS BEFORE: Switch to a low-fibre diet (white bread, rice, chicken, fish -- avoid fruits, vegetables, seeds, nuts, whole grains).',
    'DAY BEFORE: Clear fluids only from morning (water, clear broth, black tea/coffee, apple juice -- no milk, no red/purple drinks, no alcohol). Take your prescribed bowel prep solution exactly as directed by the clinic.',
    'MORNING OF: Finish your bowel prep as directed. Clear fluids only, then nothing to drink for 2 hours before your appointment time.',
    'IMPORTANT: Good bowel preparation is essential for a safe and effective examination. If your prep is incomplete, the procedure may need to be repeated.',
    '',
    GENERAL_PREP,
  ].join('\n'),

  ogd: [
    'GASTROSCOPY (OGD) PREPARATION',
    'Nothing to eat for 6 hours before your appointment.',
    'You may drink water up to 2 hours before -- then nothing by mouth.',
    '',
    GENERAL_PREP,
  ].join('\n'),

  egd: [
    'GASTROSCOPY (OGD) PREPARATION',
    'Nothing to eat for 6 hours before your appointment.',
    'You may drink water up to 2 hours before -- then nothing by mouth.',
    '',
    GENERAL_PREP,
  ].join('\n'),

  // Dr Kabiye: an `ercp_workup` booking is the ERCP procedure itself, done
  // under general anaesthesia at Tapion Hospital — standard GA fasting, a
  // responsible adult to bring, take home and stay 24 h, and the call-the-clinic
  // lines for blood thinners and other medicines. No sedation wording. Matches
  // artifacts/front-desk/lib/instructions.ts `ercp_workup`.
  ercp_workup: [
    'ERCP PREPARATION -- TAPION HOSPITAL',
    'Your ERCP is done under general anaesthesia in hospital. Arrive at Tapion Hospital (La Toc, Castries) at the time given.',
    'Nothing to eat for 6 hours and nothing to drink for 2 hours before your appointment.',
    'BLOOD THINNERS: If you take blood thinners, please call the clinic before your appointment for instructions.',
    'Bring all recent blood results and imaging (ultrasound, CT, MRCP) to your appointment.',
    '',
    PREP_WEAR,
    PREP_BRING,
    'TRANSPORT: A responsible adult must bring you to Tapion Hospital, take you home, and stay with you for 24 hours after your procedure -- you CANNOT drive after a general anaesthetic. You should not take public transport alone.',
    PREP_MEDICATIONS,
    PREP_CONTINGENCIES,
  ].join('\n'),

  // Dr Kabiye: the `pre_op` booking type is the pre-operative ASSESSMENT visit
  // (a check-up before the operation), not the operation — no fasting, no
  // sedation transport. Matches artifacts/front-desk/lib/instructions.ts
  // `pre_op_assessment`. The day-of-surgery text is `surgery_theatre` below.
  pre_op: [
    'PRE-OPERATIVE ASSESSMENT VISIT',
    'This is a check-up visit before your operation, not the operation itself. No fasting is needed for this visit unless the clinic has told you otherwise.',
    'Write down any problems you or your family have had with anaesthetics in the past, any medical conditions you have (for example diabetes, heart disease, or asthma) and any allergies.',
    'Your medicines will be reviewed at this visit. Your instructions for the day of your operation will be given to you separately.',
    'WHAT TO BRING: Valid photo ID, insurance card (if applicable), all your current medicines in their original packaging, any letter or information you have about your planned operation, and the results of any blood tests, ECG, or scans done for your operation.',
    'Arrive 10 minutes early for registration. You are welcome to bring a family member or trusted person for support.',
    'If you develop any illness (fever, cough, cold) in the days before your operation, call us -- your operation may need to be postponed for your safety. If you have a medical emergency at any time, call 911 or go to the nearest emergency department (OKEU Hospital, St Jude\'s Hospital or Tapion Hospital) immediately -- do not wait.',
  ].join('\n'),

  // Day-of-surgery preparation (staff-booked `surgery_theatre`, from the
  // front-desk staff booking form). This is the text the `pre_op` key used to
  // carry, unchanged; it moved here because `pre_op` is the assessment visit.
  surgery_theatre: [
    'PRE-OPERATIVE INSTRUCTIONS -- OUTPATIENT SURGERY',
    'Nothing to eat for 6 hours and nothing to drink for 2 hours before your surgery time.',
    'Shower or bathe on the morning of surgery. Do not apply lotions, deodorant, or make-up to the surgical area.',
    'Leave all valuables at home.',
    'A responsible adult MUST accompany you and remain at the facility. You will need someone to stay with you for 24 hours after discharge.',
    'If you develop any illness (fever, cough, cold) in the days before surgery, call us immediately -- your surgery may need to be postponed for your safety.',
    '',
    GENERAL_PREP,
  ].join('\n'),

  // Dr Kabiye: light breakfast on the morning, so GENERAL_PREP's 6-hour
  // FASTING line is left out (it contradicted the light-breakfast line).
  flexi_sig: [
    'FLEXIBLE SIGMOIDOSCOPY PREPARATION',
    'Follow the bowel prep instructions provided (usually a single enema or mini-prep the morning of).',
    'Light breakfast only on the morning of the procedure (toast, tea -- avoid heavy or greasy food).',
    'You may not need sedation -- ask us about your options.',
    '',
    PREP_WEAR,
    PREP_BRING,
    PREP_TRANSPORT,
    PREP_MEDICATIONS,
    PREP_CONTINGENCIES,
  ].join('\n'),

  // Staff-booked fasting blood test (front-desk `lab_fasting`). Its reminders
  // go through the same /api/cron reminder jobs as every other
  // appointment_requests row. Matches artifacts/front-desk/lib/instructions.ts
  // `lab_fasting`. No sedation, no procedure logistics.
  lab_fasting: [
    'FASTING BLOOD TEST PREPARATION',
    'FASTING BLOOD TEST: Nothing to eat for 8-10 hours before your blood test. You may drink plain water. Please call the clinic if you take insulin or diabetes medicines, for instructions before fasting.',
    'WHAT TO BRING: Valid photo ID, insurance card (if applicable), and your blood test request form.',
    'If you have a medical emergency at any time, call 911 or go to the nearest emergency department (OKEU Hospital, St Jude\'s Hospital or Tapion Hospital) immediately -- do not wait.',
  ].join('\n'),

  new_consult: [
    'YOUR FIRST CONSULTATION',
    'Bring a valid photo ID, insurance card (if applicable), and your referral letter (if you were referred).',
    'Bring a list of all your current medications, including doses and any vitamins or supplements.',
    'Bring any recent blood results, imaging reports, or discharge summaries from other hospitals.',
    'Write down your main questions or concerns -- this helps us make the most of your appointment time.',
    'Arrive 10 minutes early to complete registration.',
    '',
    'EMERGENCY: If your symptoms worsen before your appointment (severe pain, bleeding, vomiting blood, high fever, difficulty breathing), do NOT wait -- call 911 or go to the nearest emergency department (OKEU Hospital, St Jude\'s Hospital or Tapion Hospital) immediately.',
  ].join('\n'),

  diabetic_foot: [
    'DIABETIC FOOT CLINIC',
    'Bring your glucose log / HbA1c result if available.',
    'Wear loose-fitting shoes or sandals that are easy to remove.',
    'Do NOT apply any creams or ointments to the wound on the day of your appointment -- the doctor needs to see it as-is.',
    'Bring a list of all medications including insulin type, dose, and timing.',
    'If you notice sudden worsening -- spreading redness, black areas, pus, fever, or inability to bear weight -- call 911 or go to the nearest emergency department (OKEU Hospital, St Jude\'s Hospital or Tapion Hospital) immediately. Do NOT wait for your appointment.',
    // GENERAL_PREP deliberately omitted: it carries sedation fasting and
    // transport rules, and a 6-hour fast is unnecessary (and a hypoglycaemia
    // risk) for a diabetic patient attending an outpatient foot review.
  ].join('\n'),
};

export function getPrepInstructions(appointmentType: string): string | null {
  return PREP_INSTRUCTIONS[appointmentType.toLowerCase()] ?? null;
}

/** All prep templates, for safety tests. */
export function allPrepInstructions(): Readonly<Record<string, string>> {
  return PREP_INSTRUCTIONS;
}

export function requiresPrep(appointmentType: string): boolean {
  return appointmentType.toLowerCase() in PREP_INSTRUCTIONS;
}

export function smsBodyBookingAck(opts: { firstName: string; appointmentType: string; phone: string }): string {
  const typeLabel = opts.appointmentType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return `Hi ${opts.firstName}, we've received your ${typeLabel} request at Amise Medical Services. Our team will confirm your appointment shortly. Questions? Call ${opts.phone}. -- Amise Medical`;
}

export function smsBodyStaffNewBooking(opts: {
  patientName: string;
  appointmentType: string;
  preferredSlot: string | null;
  patientPhone: string | null;
  bookingId: string;
}): string {
  const typeLabel = opts.appointmentType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const slot = opts.preferredSlot ? ` -- preferred: ${opts.preferredSlot}` : '';
  const phone = opts.patientPhone ? ` Ph: ${opts.patientPhone}` : '';
  return `NEW BOOKING [${opts.bookingId.slice(0, 8)}]: ${opts.patientName} -- ${typeLabel}${slot}.${phone} Action in the Amise dashboard.`;
}

export function smsBodyStaffEscalation(opts: {
  patientName: string;
  appointmentType: string;
  hoursWaiting: number;
  bookingId: string;
  patientPhone: string | null;
}): string {
  const typeLabel = opts.appointmentType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const phone = opts.patientPhone ? ` Ph: ${opts.patientPhone}` : '';
  return `UNACTIONED BOOKING [${opts.bookingId.slice(0, 8)}] ${opts.hoursWaiting}h: ${opts.patientName} -- ${typeLabel}.${phone} Please confirm or contact patient.`;
}

export function smsBody48h(opts: { day: string; date: string; time: string; location: string; prepInstructions?: string | null }): string {
  const base = `Reminder: appt with Dr Kabiye ${opts.day} ${opts.date} ${opts.time} at ${opts.location}. Reply C to confirm, R to reschedule. Amise Medical.`;
  if (opts.prepInstructions) {
    return `${base}\n\n${opts.prepInstructions}`;
  }
  return base;
}

export function smsBody2h(opts: { location: string }): string {
  return `Reminder: your appt with Dr Kabiye is in 2 hours at ${opts.location}. See you soon. Amise Medical.`;
}

export function smsBodyIntakeReminder(opts: { firstName: string; portalOrigin: string }): string {
  return `Hi ${opts.firstName}, before your visit with Dr Kabiye please take 2 mins to complete your pre-visit questionnaire: ${opts.portalOrigin}/patient/intake -- it helps us prepare for your appointment. Amise Medical.`;
}

export function smsBodyPostVisit(opts: { firstName: string }): string {
  return `Hi ${opts.firstName}, we hope your visit with Dr Kabiye went well yesterday. If you have any concerns about your recovery, please call us on 758-284-0557. For a medical emergency, call 911 or go to the nearest ED. -- Amise Medical`;
}

export function smsBodyStaffChangeRequest(opts: {
  patientName: string;
  appointmentType: string;
  changeType: 'reschedule' | 'cancel';
  appointmentDate: string;
  patientPhone: string | null;
  requestId: string;
}): string {
  const typeLabel = opts.appointmentType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const action = opts.changeType === 'cancel' ? 'CANCEL REQUEST' : 'RESCHEDULE REQUEST';
  const phone = opts.patientPhone ? ` Ph: ${opts.patientPhone}` : '';
  return `${action} [${opts.requestId.slice(0, 8)}]: ${opts.patientName} -- ${typeLabel} on ${opts.appointmentDate}.${phone} Please contact patient to confirm.`;
}
