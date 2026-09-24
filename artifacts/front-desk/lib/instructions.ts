/**
 * Procedure-specific patient instructions for Amise Medical Services.
 * Drafted for Dr Dawit Daniel Kabiye, MD, DM — General & Endoscopic Surgery, Saint Lucia.
 *
 * All content is administrative guidance only.
 * Clinical decisions remain with Dr Kabiye and the clinical team.
 */

// Relative import (not '@/lib/…') so scripts/src/lint-patient-instructions.ts
// can load this file under tsx without the Next.js path alias.
import { APPOINTMENT_TYPES, isAppointmentTypeKey, type AppointmentTypeKey } from './scheduling';

export interface ProcedureInstructions {
  displayName:    string;
  location:       string;
  duration:       string;
  beforeVisit:    string[];
  onTheDay:       string[];
  afterCare:      string[] | null;   // null for consultations
  whatToBring:    string[];
  urgentSigns:    string[];          // symptoms requiring immediate contact
  notes?:         string;
}

const URGENT_SIGNS_GENERAL = [
  'Temperature above 38.5 °C (101.3 °F)',
  'Increasing pain not controlled by prescribed painkillers',
  'Significant or persistent bleeding',
  'Wound opening, spreading redness, or discharge',
  'Inability to keep fluids down for more than 24 hours',
  'Difficulty breathing or chest pain',
];

// Hazard H-10 / CLAUDE.md Tone rule: these instructions are emailed to the
// patient automatically on booking (lib/email.ts), so they carry logistics
// only — never an instruction to take, hold, stop, skip or adjust a medicine.
// Patients on insulin, diabetes medicines or blood thinners are told to call
// the clinic for individual instructions. Wording approved by Dr Kabiye and
// matched to the api-server prep templates (artifacts/api-server/src/lib/sms.ts).
// Enforced by `pnpm --filter @workspace/scripts run lint:patient-instructions`.
// Any wording change here needs the clinical owner's approval.
const MEDICATIONS_CALL =
  'MEDICATIONS: If you take insulin, blood thinners or diabetes medicines, please call the clinic before your procedure for instructions. If you have any questions about your other medicines, please call us.';

const BLOOD_THINNERS_CALL =
  'BLOOD THINNERS: If you take blood thinners, please call the clinic before your appointment for instructions.';

// Standard pre-procedure fasting (ASA 2023 / ESAIC) for general anaesthesia,
// sedation, OGD and ERCP — the same 6 h food / 2 h clear-fluid rule as the
// api-server templates. Not used for colonoscopy (bowel prep needs fluid),
// minor procedures, or the diabetic foot clinic.
const FASTING_STANDARD =
  'Nothing to eat for 6 hours and nothing to drink for 2 hours before your appointment time (clear fluids such as water are fine until then).';

const BRING_STANDARD = [
  'Valid photo ID (passport or national ID)',
  'Health insurance card (if applicable)',
  'Complete list of current medications (name, dose, frequency)',
  'Any relevant prior test results, imaging, or hospital records',
];

const PROCEDURE_INSTRUCTIONS_DEFS = {

  // ── NEUTRAL (no procedure-specific instructions) ───────────────────────────
  // Sent for booking types mapped to `null` in APPOINTMENT_INSTRUCTIONS below
  // (and for unknown types) — logistics only, no fasting or preparation rules.
  // displayName is replaced with the booking type's own label at lookup time.

  general_appointment: {
    displayName: 'Appointment',
    location:    'As shown in your appointment details',
    duration:    'As advised by the clinic',
    beforeVisit: [
      'Our team will contact you with any preparation needed for this appointment.',
      'If you are not sure whether you need to prepare (for example, whether you need to fast), please call the clinic before your appointment.',
    ],
    onTheDay: [
      'Arrive 10 minutes early for registration.',
      'Bring your photo ID and insurance card.',
    ],
    afterCare: null,
    whatToBring: [
      ...BRING_STANDARD,
    ],
    urgentSigns: [
      'If your condition worsens before your appointment — do not wait, attend the nearest emergency department or call Tapion Hospital: 758-284-0557 / 758-720-7111',
    ],
  },

  // ── CONSULTATIONS ──────────────────────────────────────────────────────────

  new_consult: {
    displayName: 'New Consultation',
    location:    'Rodney Bay (Providence Building)',
    duration:    '45 minutes',
    beforeVisit: [
      'No special preparation is required for a consultation.',
      'Gather any relevant medical records, imaging reports, and discharge summaries you have.',
      'Write down your main symptoms — when they started, how they have changed, and anything that makes them better or worse.',
      'Note all medications you are currently taking, including vitamins and supplements.',
    ],
    onTheDay: [
      'Arrive at least 10 minutes early for registration.',
      'Bring your photo ID and insurance card.',
      'You are welcome to bring a family member or trusted person for support.',
    ],
    afterCare: null,
    whatToBring: [
      ...BRING_STANDARD,
      'Referral letter from your GP or specialist (if applicable)',
      'Any prior surgical operation notes or pathology reports',
    ],
    urgentSigns: [
      'Sudden worsening of the symptom that prompted the referral — go to the nearest emergency department or call Tapion Hospital: 758-284-0557 / 758-720-7111',
    ],
  },

  follow_up: {
    displayName: 'Follow-up Appointment',
    location:    'Rodney Bay (Providence Building)',
    duration:    '15 minutes',
    beforeVisit: [
      'No special preparation required.',
      'Review any test results or imaging you have received since your last visit.',
      'Note any new or changed symptoms you wish to discuss.',
    ],
    onTheDay: [
      'Arrive 10 minutes early.',
      'Bring a list of any new concerns or questions for Dr Kabiye.',
    ],
    afterCare: null,
    whatToBring: [
      ...BRING_STANDARD,
      'Results of any blood tests, scans, or investigations done since your last visit',
    ],
    urgentSigns: [
      'Any sudden or severe change in condition before your appointment — do not wait, contact us immediately or attend an emergency department.',
    ],
  },

  post_op: {
    displayName: 'Post-operative Review',
    location:    'Tapion Hospital (La Toc, Castries)',
    duration:    '20 minutes',
    beforeVisit: [
      'Do not remove or change your wound dressing before this appointment unless you have been specifically instructed to do so.',
      'Keep a note of any symptoms since your surgery — fever, pain levels, wound changes.',
      'If your wound is actively bleeding, or you have a high fever (above 38.5 °C), do not wait for this appointment — go to the nearest emergency department immediately.',
    ],
    onTheDay: [
      'Arrive 10 minutes early.',
      'Wear loose, comfortable clothing that allows easy access to the wound area.',
    ],
    afterCare: null,
    whatToBring: [
      ...BRING_STANDARD,
      'Your hospital discharge letter / operation notes',
      'List of medications prescribed at discharge',
    ],
    urgentSigns: URGENT_SIGNS_GENERAL,
  },

  // ── ENDOSCOPY ──────────────────────────────────────────────────────────────

  // The `ercp_workup` booking type is ambiguous in this codebase: the slot
  // engine books it as a 30-minute Rodney Bay consultation, but the booking
  // form files it under "Endoscopy & Procedures" at Tapion and it is the only
  // ERCP option staff can pick. The api-server 48 h reminder (sms.ts
  // ercp_workup) tells these patients to fast, so this entry carries the same
  // fasting rule rather than "eat normally" — the patient must never receive
  // both. Flagged for Dr Kabiye to confirm; do not relax without approval.
  ercp_workup: {
    displayName: 'ERCP / Biliary Investigation',
    location:    'Rodney Bay (Providence Building)',
    duration:    '30 minutes',
    beforeVisit: [
      FASTING_STANDARD,
      'If you are not sure whether you need to fast for this appointment, please call the clinic.',
      BLOOD_THINNERS_CALL,
      MEDICATIONS_CALL,
      'Arrange for a responsible adult to drive you home — you cannot drive if sedation is given.',
      'Gather all relevant imaging (ultrasound, CT, MRCP) and blood test results (especially liver function tests — LFTs and bilirubin).',
      'Make a note of all medications, particularly blood-thinning agents (warfarin, rivaroxaban, apixaban, clopidogrel, aspirin).',
      'Note any prior procedures on the bile duct, gallbladder, or pancreas.',
    ],
    onTheDay: [
      'Arrive 10 minutes early.',
    ],
    afterCare: null,
    whatToBring: [
      ...BRING_STANDARD,
      'All abdominal imaging (ultrasound, CT, MRCP scans) — digital or film',
      'Recent liver function blood test results',
      'Referral letter from your GP or gastroenterologist',
    ],
    urgentSigns: [
      'Fever with jaundice (yellow skin/eyes) — this may be cholangitis; go to Tapion Hospital emergency immediately',
      'Severe abdominal pain — attend the nearest emergency department',
    ],
  },

  ercp: {
    displayName: 'ERCP Procedure',
    location:    'Tapion Hospital (La Toc, Castries)',
    duration:    '60–90 minutes (plus recovery time)',
    beforeVisit: [
      FASTING_STANDARD,
      BLOOD_THINNERS_CALL,
      MEDICATIONS_CALL,
      'Arrange for a responsible adult to drive you home — sedation will be given and you cannot drive or operate machinery for 24 hours after.',
      'Plan for a full day at the hospital (arrival, preparation, procedure, and recovery).',
      'You may be required to stay overnight — arrange accordingly.',
    ],
    onTheDay: [
      'Arrive at the time given by Tapion Hospital admissions.',
      'Remove all jewellery, nail polish, and contact lenses.',
      'Wear loose, comfortable clothing.',
      'Bring a responsible adult who will stay until you are discharged.',
    ],
    afterCare: [
      'Rest at home for the remainder of the procedure day.',
      'Do not drive or operate machinery for 24 hours after sedation.',
      'You may have a mild sore throat — this is normal and will settle.',
      'Light diet on the day of the procedure; progress to normal diet as tolerated.',
      'You will be given discharge instructions by the nursing team at Tapion Hospital.',
      'Attend your follow-up appointment as scheduled.',
    ],
    whatToBring: [
      ...BRING_STANDARD,
      'Completed consent form (if sent in advance)',
      'All current medications in their original packaging',
      'Comfortable change of clothes if staying overnight',
    ],
    urgentSigns: [
      'Severe abdominal pain after the procedure',
      'High fever (above 38.5 °C)',
      'Vomiting blood or passing black/tarry stools',
      'Inability to keep fluids down',
      'Call Tapion Hospital immediately: 758-284-0557 / 758-720-7111',
    ],
  },

  colonoscopy: {
    displayName: 'Colonoscopy',
    location:    'Tapion Hospital (La Toc, Castries)',
    duration:    '30–60 minutes (plus preparation and recovery time)',
    beforeVisit: [
      '2 days before: Eat a low-fibre diet — avoid seeds, nuts, wholegrains, raw vegetables, salads, red meat, and high-fibre cereals. White bread, white rice, eggs, chicken, fish, and cooked vegetables are fine.',
      '1 day before: Clear liquids only — water, apple juice (no pulp), clear broth, plain jelly (no red or purple colours). No solid food at all.',
      'Bowel preparation medication: take exactly as prescribed and at the times specified. This is essential for a successful examination.',
      'Stay close to a toilet once you start the bowel preparation.',
      'On the day of your procedure: finish your bowel prep as directed. Clear fluids only, then nothing to drink for 2 hours before your appointment time.',
      MEDICATIONS_CALL,
      'Arrange for a responsible adult to drive you home — you cannot drive after sedation.',
    ],
    onTheDay: [
      'Arrive at the time stated on your appointment letter.',
      'Wear loose, comfortable clothing — you will be asked to change into a hospital gown.',
      'Remove all jewellery, nail polish, and contact lenses.',
      'Bring your responsible adult who will wait and take you home.',
    ],
    afterCare: [
      'Rest for the remainder of the day.',
      'Do not drive or make important decisions for 24 hours after sedation.',
      'You may have mild bloating or wind — this is normal and will pass.',
      'Return to your normal diet gradually — start with light foods.',
      'Results will be discussed at your follow-up appointment or by phone.',
      'If a biopsy or polyp removal was performed, avoid strenuous activity for 48 hours.',
    ],
    whatToBring: [
      ...BRING_STANDARD,
      'Your completed bowel preparation — ensure you have completed it fully',
      'Responsible adult to accompany you home',
    ],
    urgentSigns: [
      'Significant rectal bleeding (more than a small amount of streaking)',
      'Severe abdominal pain or distension',
      'High fever above 38.5 °C',
      'Feeling faint or unable to stand',
      'Go to the nearest emergency department or call Tapion Hospital: 758-284-0557 / 758-720-7111',
    ],
  },

  gastroscopy: {
    displayName: 'Gastroscopy (Upper GI Endoscopy / OGD)',
    location:    'Tapion Hospital (La Toc, Castries)',
    duration:    '15–30 minutes (plus preparation and recovery)',
    beforeVisit: [
      FASTING_STANDARD,
      MEDICATIONS_CALL,
      'If you take medication for acid reflux (proton pump inhibitors), check with Dr Kabiye whether to pause them.',
      'If sedation is planned: arrange for a responsible adult to drive you home.',
      'If throat spray only (no sedation): you may be able to drive yourself — confirm with the team.',
    ],
    onTheDay: [
      'Arrive at the time stated.',
      'Remove dentures, partial plates, or removable dental work before the procedure.',
      'Remove jewellery.',
      'Wear loose, comfortable clothing.',
    ],
    afterCare: [
      'If sedation was given: rest for the remainder of the day; do not drive or make important decisions for 24 hours.',
      'If throat spray only: you may eat and drink once your swallow reflex returns (usually 30–60 minutes).',
      'You may have a mild sore throat for 1–2 days — this is normal.',
      'Results and biopsy findings will be communicated at follow-up or by phone.',
    ],
    whatToBring: [
      ...BRING_STANDARD,
      'Responsible adult if sedation is planned',
    ],
    urgentSigns: [
      'Severe chest or abdominal pain after the procedure',
      'Vomiting blood or material that looks like coffee grounds',
      'Difficulty swallowing that is new or worsening',
      'High fever',
      'Contact Tapion Hospital immediately: 758-284-0557 / 758-720-7111',
    ],
  },

  // Preparation wording taken from the api-server `flexi_sig` template
  // (artifacts/api-server/src/lib/sms.ts), which says "light breakfast only".
  // The dashboard staff summary (BookingInboxTab.tsx) says "clear fluids only
  // on morning of procedure" — unresolved conflict, flagged for Dr Kabiye.
  flexi_sig: {
    displayName: 'Flexible Sigmoidoscopy',
    location:    'Tapion Hospital (La Toc, Castries)',
    duration:    '15–30 minutes (plus preparation and recovery time)',
    beforeVisit: [
      'Follow the bowel preparation instructions provided (usually a single enema or mini-prep on the morning of the procedure).',
      'Light breakfast only on the morning of the procedure (toast, tea — avoid heavy or greasy food).',
      MEDICATIONS_CALL,
      'You may not need sedation — ask us about your options.',
      'If sedation is planned: arrange for a responsible adult to drive you home — you cannot drive after sedation.',
      'If you develop fever, a new cough, vomiting, or feel unwell in the days before your procedure, call us — we may need to reschedule.',
    ],
    onTheDay: [
      'Arrive at the time stated.',
      'Wear loose, comfortable clothing — you will be asked to change into a hospital gown.',
      'Remove all jewellery, piercings, watches, and hair accessories before arrival.',
    ],
    afterCare: [
      'If sedation was given: rest for the remainder of the day; do not drive or make important decisions for 24 hours.',
      'You may have mild bloating or wind — this is normal and will pass.',
      'Results will be discussed at your follow-up appointment or by phone.',
    ],
    whatToBring: [
      ...BRING_STANDARD,
      'Responsible adult if sedation is planned',
    ],
    urgentSigns: [
      'Significant rectal bleeding (more than a small amount of streaking)',
      'Severe abdominal pain or distension',
      'High fever above 38.5 °C',
      'Go to the nearest emergency department or call Tapion Hospital: 758-284-0557 / 758-720-7111',
    ],
  },

  // ── BREAST ─────────────────────────────────────────────────────────────────

  breast: {
    displayName: 'Breast Clinic',
    location:    'Rodney Bay (Providence Building)',
    duration:    '45 minutes',
    beforeVisit: [
      'No special preparation is required for the clinic.',
      'Collect and bring all prior breast imaging (mammograms, ultrasound scans, MRI) and biopsy or pathology reports.',
      'Note when you first noticed any changes and how they have evolved.',
      'If you have a family history of breast or ovarian cancer, make a note of this.',
    ],
    onTheDay: [
      'Arrive 10 minutes early.',
      'Wear a two-piece outfit (separate top and bottom) for ease of examination.',
      'You are welcome to bring a trusted person for support.',
    ],
    afterCare: null,
    whatToBring: [
      ...BRING_STANDARD,
      'All prior breast imaging reports and films/digital copies',
      'Any prior biopsy or pathology reports',
      'GP referral letter',
    ],
    urgentSigns: [
      'Rapidly enlarging breast lump or swelling',
      'Breast redness, warmth, and fever (may indicate infection) — contact us promptly',
      'Nipple discharge that is bloody',
    ],
  },

  // ── THYROID CLINIC (consultation — NOT thyroid surgery, see thyroid_surgery) ─

  thyroid_clinic: {
    displayName: 'Thyroid Clinic',
    location:    'Rodney Bay (Providence Building)',
    duration:    '45 minutes',
    beforeVisit: [
      'No special preparation is required for the clinic. You may eat and drink normally.',
      'Collect and bring any thyroid blood test results, neck ultrasound or scan reports, and biopsy reports you have.',
      'Note when you first noticed any neck swelling or other symptoms and how they have changed.',
      'Note all medications you are currently taking, including vitamins and supplements.',
    ],
    onTheDay: [
      'Arrive at least 10 minutes early for registration.',
      'Wear a top with an open or low neckline so your neck can be examined easily.',
      'You are welcome to bring a family member or trusted person for support.',
    ],
    afterCare: null,
    whatToBring: [
      ...BRING_STANDARD,
      'Any thyroid blood test results',
      'Any neck ultrasound, scan, or biopsy reports',
      'Referral letter from your GP or specialist (if applicable)',
    ],
    urgentSigns: [
      'Difficulty breathing or swallowing, or rapidly increasing neck swelling — go to the nearest emergency department or call Tapion Hospital: 758-284-0557 / 758-720-7111',
    ],
  },

  // ── DIABETIC FOOT ──────────────────────────────────────────────────────────

  diabetic_foot: {
    displayName: 'Diabetic Foot Clinic',
    location:    'Rodney Bay (Providence Building)',
    duration:    '30 minutes',
    beforeVisit: [
      'Do NOT trim your toenails or attempt to treat any foot wounds or corns before this appointment.',
      'Record your blood sugar readings for the past 7 days if possible.',
      'Gather recent blood test results (HbA1c, kidney function, and cholesterol if available).',
      'Note any new or changing symptoms: numbness, tingling, colour change, pain, or swelling in your feet or legs.',
    ],
    onTheDay: [
      'Wear loose, comfortable footwear that is easy to remove.',
      'Wear clean socks.',
      'Arrive 10 minutes early.',
    ],
    afterCare: null,
    whatToBring: [
      ...BRING_STANDARD,
      'Recent blood sugar diary or glucometer readings',
      'HbA1c and kidney function blood test results',
      'List of all diabetes and blood pressure medications',
      'Any prior vascular studies (Doppler ultrasound) or foot X-rays',
    ],
    urgentSigns: [
      'Spreading redness, swelling, or warmth in the foot or leg — attend emergency',
      'Open wound with foul smell or discolouration — contact us same day',
      'Sudden loss of sensation or blood supply to the foot (pale, cold, painful) — emergency department immediately',
    ],
    notes: 'If you have an active foot wound, our team will coordinate with your diabetes team to ensure all aspects of your care are aligned.',
  },

  // ── TELEPHONE ──────────────────────────────────────────────────────────────

  telephone: {
    displayName: 'Telephone Review',
    location:    'Telephone — Dr Kabiye or a member of the team will call you',
    duration:    '15 minutes',
    beforeVisit: [
      'Ensure you are available at the number you provided at the booked time.',
      'Have your most recent test results and medication list to hand.',
      'Write down your questions or concerns in advance so you make the most of the call.',
    ],
    onTheDay: [
      'Be in a quiet place where you can speak freely.',
      'Have pen and paper ready to note any instructions given.',
    ],
    afterCare: null,
    whatToBring: [
      'Recent blood test or imaging results',
      'Current medication list',
      'Your questions and concerns written down',
    ],
    urgentSigns: [
      'If your condition deteriorates before the call — do not wait, attend the nearest emergency department or call Tapion Hospital: 758-284-0557 / 758-720-7111',
    ],
  },

  // ── PRE-OPERATIVE ASSESSMENT (clinic visit before an operation) ───────────
  // The `pre_op` booking type is the assessment visit, not the operation, so
  // there is no fasting here. Logistics mirror the api-server `pre_op`
  // template (illness before surgery, what to bring) minus its surgery-day
  // fasting / shower / escort rules.

  pre_op_assessment: {
    displayName: 'Pre-operative Assessment',
    location:    'Rodney Bay (Providence Building)',
    duration:    '45 minutes',
    beforeVisit: [
      'This is a check-up visit before your operation, not the operation itself. No fasting is needed for this visit unless the clinic has told you otherwise.',
      'Write down any problems you or your family have had with anaesthetics in the past.',
      'Note any medical conditions you have (for example diabetes, heart disease, or asthma) and any allergies.',
      'Note all medications you are currently taking, including vitamins and supplements — your medicines will be reviewed at this visit.',
      'Your instructions for the day of your operation will be given to you separately.',
    ],
    onTheDay: [
      'Arrive 10 minutes early for registration.',
      'Wear loose, comfortable clothing.',
      'You are welcome to bring a family member or trusted person for support.',
    ],
    afterCare: null,
    whatToBring: [
      ...BRING_STANDARD,
      'All current medications in their original packaging',
      'Any letter or information you have about your planned operation',
      'Results of any blood tests, ECG, or scans done for your operation',
    ],
    urgentSigns: [
      'If you develop any illness (fever, cough, cold) in the days before your operation, call us — your operation may need to be postponed for your safety.',
      'Sudden worsening of your condition before your operation — go to the nearest emergency department or call Tapion Hospital: 758-284-0557 / 758-720-7111',
    ],
  },

  // ── GENERAL ELECTIVE SURGERY (staff-scheduled surgery, day of operation) ──

  elective_surgery: {
    displayName: 'Elective Surgery',
    location:    'Tapion Hospital (La Toc, Castries)',
    duration:    'As per surgical team instructions',
    beforeVisit: [
      'Pre-operative assessment: you will be seen by the team before your surgery date to review your fitness for anaesthesia.',
      FASTING_STANDARD,
      MEDICATIONS_CALL,
      'Shower with soap or antiseptic wash (e.g. Dettol or Savlon) the evening before and the morning of surgery.',
      'Remove nail polish (fingers and toes), jewellery, piercings, and contact lenses before arriving.',
      'Do not apply creams, lotions, or deodorant to the surgical site on the day.',
      'Arrange for a responsible adult to drive you home after surgery.',
    ],
    onTheDay: [
      'Arrive at Tapion Hospital at the time stated in your admission letter.',
      'Wear loose, comfortable clothing that is easy to put on and take off.',
      'Do not bring valuables — leave jewellery, large sums of cash, and expensive items at home.',
    ],
    afterCare: [
      'Rest for the first 24–48 hours after returning home.',
      'Do not drive or operate machinery for 24 hours after a general anaesthetic.',
      'Keep the wound clean and dry for 48 hours unless instructed otherwise.',
      'No heavy lifting (anything over 5 kg) until cleared by Dr Kabiye at your post-op review.',
      'Take prescribed painkillers regularly to stay comfortable.',
      'Attend your post-operative review appointment as scheduled.',
    ],
    whatToBring: [
      ...BRING_STANDARD,
      'Hospital admission letter',
      'All current medications in their original packaging',
      'Comfortable change of clothes or overnight bag (if staying in hospital)',
      'Responsible adult to accompany you home',
    ],
    urgentSigns: URGENT_SIGNS_GENERAL,
  },

  // ── HERNIA REPAIR ──────────────────────────────────────────────────────────

  hernia_repair: {
    displayName: 'Hernia Repair (Laparoscopic or Open)',
    location:    'Tapion Hospital (La Toc, Castries)',
    duration:    '45–90 minutes',
    beforeVisit: [
      'Pre-operative assessment required before your surgery date.',
      FASTING_STANDARD,
      MEDICATIONS_CALL,
      'Shower with antiseptic wash the evening before and morning of surgery.',
      'Remove jewellery, nail polish, and contact lenses.',
      'Arrange transport — you cannot drive after general anaesthesia.',
    ],
    onTheDay: [
      'Arrive at the time on your admission letter.',
      'Wear loose, comfortable clothing.',
      'Bring your responsible adult.',
    ],
    afterCare: [
      'Rest for the first 24–48 hours at home.',
      'No lifting of anything heavier than 5 kg for 6 weeks.',
      'Light walking from Day 1 is encouraged — it helps with recovery.',
      'Do not drive for 1–2 weeks (until you can perform an emergency stop comfortably).',
      'Return to non-physical work in approximately 1–2 weeks (desk work) or 4–6 weeks (manual work).',
      'Attend post-op review at Tapion Hospital as scheduled.',
      'If laparoscopic: you may experience shoulder-tip discomfort from gas — walking and lying flat both help.',
    ],
    whatToBring: [
      ...BRING_STANDARD,
      'Hospital admission letter',
      'Overnight bag if staying in hospital',
      'Responsible adult',
    ],
    urgentSigns: URGENT_SIGNS_GENERAL,
  },

  // ── CHOLECYSTECTOMY ────────────────────────────────────────────────────────

  cholecystectomy: {
    displayName: 'Laparoscopic Cholecystectomy (Gallbladder Removal)',
    location:    'Tapion Hospital (La Toc, Castries)',
    duration:    '60–90 minutes',
    beforeVisit: [
      'Same preparation as for elective surgery above.',
      'Pre-operative assessment required.',
      FASTING_STANDARD,
      MEDICATIONS_CALL,
      'Arrange transport — cannot drive after anaesthesia.',
    ],
    onTheDay: [
      'Arrive at the time stated in your admission letter.',
      'Wear loose, comfortable clothing.',
    ],
    afterCare: [
      'Follow a low-fat diet for 4–6 weeks after surgery — avoid fried food, fatty cuts of meat, cream, and full-fat dairy.',
      'Some patients experience loose stools after gallbladder removal — this usually settles within weeks.',
      'Shoulder-tip pain from gas is common — walking and moving help it resolve.',
      'No heavy lifting for 4 weeks.',
      'Return to light activity within 1 week; normal activity usually by 4–6 weeks.',
      'Attend post-op review as scheduled.',
    ],
    whatToBring: [
      ...BRING_STANDARD,
      'Admission letter and consent form',
      'Overnight bag',
      'Responsible adult',
    ],
    urgentSigns: [
      ...URGENT_SIGNS_GENERAL,
      'Yellow skin or eyes (jaundice) after surgery — contact us immediately',
      'Severe pain in the right shoulder or upper abdomen after discharge',
    ],
  },

  // ── COLORECTAL / HAEMORRHOIDS ──────────────────────────────────────────────

  colorectal: {
    displayName: 'Colorectal / Haemorrhoid Surgery',
    location:    'Tapion Hospital (La Toc, Castries)',
    duration:    '30–60 minutes',
    beforeVisit: [
      'Bowel preparation: as prescribed by Dr Kabiye — follow timing instructions exactly.',
      FASTING_STANDARD,
      MEDICATIONS_CALL,
      'Arrange transport.',
    ],
    onTheDay: [
      'Arrive at the time stated.',
      'Wear loose, comfortable clothing.',
    ],
    afterCare: [
      'High-fibre diet and adequate fluid intake (at least 8 glasses of water per day) to keep stools soft.',
      'Stool softeners or laxatives as prescribed — do not strain.',
      'Sitz baths (sitting in warm water) for 10–15 minutes 2–3 times daily and after each bowel movement — this eases discomfort.',
      'Some bleeding on wiping or in the toilet bowl is expected for the first 1–2 weeks.',
      'Rest and avoid strenuous activity for 2 weeks.',
      'Return for post-op review as scheduled.',
    ],
    whatToBring: [
      ...BRING_STANDARD,
      'Admission letter',
      'Overnight bag if applicable',
      'Responsible adult',
    ],
    urgentSigns: [
      'Heavy or continuous rectal bleeding (more than spotting)',
      'Inability to pass urine',
      'High fever',
      'Severe uncontrolled pain',
    ],
  },

  // ── THYROID SURGERY ────────────────────────────────────────────────────────

  // Renamed from `thyroid`: that key collided with the `thyroid` booking type
  // (the Thyroid CLINIC, a consultation), so clinic patients were emailed
  // fasting and surgical instructions.
  thyroid_surgery: {
    displayName: 'Thyroid Surgery',
    location:    'Tapion Hospital (La Toc, Castries)',
    duration:    '90–180 minutes',
    beforeVisit: [
      'Pre-operative assessment including blood tests (thyroid function, calcium levels) and ENT vocal cord review.',
      FASTING_STANDARD,
      MEDICATIONS_CALL,
      'Arrange transport.',
    ],
    onTheDay: [
      'Arrive at the time stated in your admission letter.',
      'Wear loose clothing with a low or open neckline for comfort post-operatively.',
    ],
    afterCare: [
      'Soft or liquid diet for the first 1–2 days — swallowing may be mildly uncomfortable; this resolves quickly.',
      'Voice may be slightly hoarse for 1–2 weeks — this is usually temporary.',
      'Take prescribed thyroid medications (if total thyroidectomy) as directed — do not miss doses.',
      'Calcium supplements will be prescribed if parathyroid glands were affected — take as directed.',
      'Keep the neck incision clean and dry.',
      'Attend post-op review as scheduled.',
    ],
    whatToBring: [
      ...BRING_STANDARD,
      'Pre-op blood test results',
      'ENT report if available',
      'Admission letter and overnight bag',
      'Responsible adult',
    ],
    urgentSigns: [
      'Rapidly increasing neck swelling — emergency, go to Tapion Hospital immediately',
      'Difficulty breathing or swallowing after surgery — emergency',
      'Tingling or numbness around the mouth or in fingertips (low calcium sign) — contact us same day',
      'Complete loss of voice',
    ],
  },

  // ── MINOR PROCEDURES (lipoma, cyst, skin lesions) ─────────────────────────

  minor_procedure: {
    displayName: 'Minor Surgical Procedure',
    location:    'Rodney Bay (Providence Building) or Tapion Hospital',
    duration:    '15–45 minutes',
    beforeVisit: [
      'No fasting is needed. Please eat a light meal before your appointment.',
      'If you have been told you will have a general anaesthetic, the clinic will give you separate instructions.',
      MEDICATIONS_CALL,
      'Do not shave or apply cream to the area yourself.',
    ],
    onTheDay: [
      'Wear loose, comfortable clothing that allows easy access to the area being treated.',
      'Avoid heavy exercise on the day of the procedure.',
    ],
    afterCare: [
      'Keep the wound clean and dry for 48 hours.',
      'A waterproof dressing is fine for showering after 48 hours.',
      'Do not scratch or pick at the wound or sutures.',
      'Return for suture removal as advised (usually 7–14 days).',
      'Avoid sun exposure to the scar for 3–6 months to minimise pigmentation.',
    ],
    whatToBring: [
      ...BRING_STANDARD,
    ],
    urgentSigns: [
      'Spreading redness, increasing warmth, or discharge from the wound',
      'Wound opening or significant bleeding',
      'High fever',
    ],
  },
} satisfies Record<string, ProcedureInstructions>;

export type InstructionKey = keyof typeof PROCEDURE_INSTRUCTIONS_DEFS;

export const PROCEDURE_INSTRUCTIONS: Readonly<Record<InstructionKey, ProcedureInstructions>> =
  PROCEDURE_INSTRUCTIONS_DEFS;

/**
 * Which instruction set is emailed for each bookable appointment type.
 *
 * Booking-type keys and instruction keys are separate namespaces: never look
 * an instruction set up by the raw booking type. Doing so previously sent the
 * New Consultation text for OGD, flexi-sig and pre-op bookings (no entry of
 * that name) and thyroid SURGERY text — including fasting — to Thyroid CLINIC
 * patients (same key).
 *
 * `null` = no procedure-specific instructions; the neutral
 * `general_appointment` set is sent under the booking type's own label.
 *
 * Typed as a Record over AppointmentTypeKey, so adding a booking type to
 * APPOINTMENT_TYPES without choosing its instructions here fails typecheck.
 * `pnpm --filter @workspace/scripts run lint:patient-instructions` checks the
 * same at runtime.
 *
 * Not reachable from any booking type (kept for staff-scheduled surgery and
 * procedures, looked up by instruction key): ercp, elective_surgery,
 * hernia_repair, cholecystectomy, colorectal, thyroid_surgery, minor_procedure.
 */
export const APPOINTMENT_INSTRUCTIONS: Readonly<Record<AppointmentTypeKey, InstructionKey | null>> = {
  new_consult:               'new_consult',
  follow_up:                 'follow_up',
  telephone:                 'telephone',
  ogd:                       'gastroscopy',
  colonoscopy:               'colonoscopy',
  ercp_workup:               'ercp_workup',
  flexi_sig:                 'flexi_sig',
  breast:                    'breast',
  thyroid:                   'thyroid_clinic',
  diabetic_foot:             'diabetic_foot',
  pre_op:                    'pre_op_assessment',
  post_op:                   'post_op',
  // Anaesthesia pre-assessment and lab visits have no approved patient
  // instruction set yet (e.g. lab_fasting needs a fasting-bloods rule signed
  // off by Dr Kabiye) — send the neutral set and let staff give specifics.
  anaesthesia_preassessment: null,
  lab_fasting:               null,
  lab_collection:            null,
  lab_urine:                 null,
  lab_histology:             null,
};

function isInstructionKey(key: string): key is InstructionKey {
  return Object.prototype.hasOwnProperty.call(PROCEDURE_INSTRUCTIONS, key);
}

/**
 * Returns the patient instructions for a booking/appointment type.
 *
 *  1. A bookable type (APPOINTMENT_TYPES key) goes through
 *     APPOINTMENT_INSTRUCTIONS; a `null` mapping gives the neutral set
 *     labelled with the booking type's name.
 *  2. Otherwise, a string that is itself an instruction key (e.g. `ercp`,
 *     `hernia_repair` for staff-scheduled surgery) gets that set.
 *  3. Anything else gets the neutral set — never another type's preparation.
 */
export function getInstructionsForAppointment(appointmentType: string): ProcedureInstructions {
  if (isAppointmentTypeKey(appointmentType)) {
    const key = APPOINTMENT_INSTRUCTIONS[appointmentType];
    if (key) return PROCEDURE_INSTRUCTIONS[key];
    return { ...PROCEDURE_INSTRUCTIONS.general_appointment, displayName: APPOINTMENT_TYPES[appointmentType].label };
  }
  if (isInstructionKey(appointmentType)) return PROCEDURE_INSTRUCTIONS[appointmentType];
  console.warn(`[instructions] No instruction mapping for appointment type "${appointmentType}" — sending neutral instructions`);
  return PROCEDURE_INSTRUCTIONS.general_appointment;
}

/**
 * Returns a plain-text version of instructions for SMS / short-form WhatsApp.
 */
export function shortInstructions(appointmentType: string): string {
  const inst = getInstructionsForAppointment(appointmentType);
  const key  = inst.beforeVisit[0] ?? 'No special preparation required.';
  return `Preparation: ${key} What to bring: ${inst.whatToBring.slice(0, 2).join('; ')}. Questions? Call 758-284-0557.`;
}
