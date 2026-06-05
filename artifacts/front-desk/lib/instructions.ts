/**
 * Procedure-specific patient instructions for Amise Medical Services.
 * Drafted for Dr Dawit Daniel Kabiye, MD, DM — General & Endoscopic Surgery, Saint Lucia.
 *
 * All content is administrative guidance only.
 * Clinical decisions remain with Dr Kabiye and the clinical team.
 */

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

const BRING_STANDARD = [
  'Valid photo ID (passport or national ID)',
  'Health insurance card (if applicable)',
  'Complete list of current medications (name, dose, frequency)',
  'Any relevant prior test results, imaging, or hospital records',
];

export const PROCEDURE_INSTRUCTIONS: Record<string, ProcedureInstructions> = {

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
      'Sudden worsening of the symptom that prompted the referral — go to the nearest emergency department or call Tapion Hospital: 459-2227 / 284-0557',
    ],
  },

  follow_up: {
    displayName: 'Follow-up Appointment',
    location:    'Castries',
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
    location:    'Castries',
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

  ercp_workup: {
    displayName: 'ERCP Work-up Consultation',
    location:    'Rodney Bay (Providence Building)',
    duration:    '30 minutes',
    beforeVisit: [
      'No special preparation is required for the work-up consultation.',
      'Gather all relevant imaging (ultrasound, CT, MRCP) and blood test results (especially liver function tests — LFTs and bilirubin).',
      'Make a note of all medications, particularly blood-thinning agents (warfarin, rivaroxaban, apixaban, clopidogrel, aspirin).',
      'Note any prior procedures on the bile duct, gallbladder, or pancreas.',
    ],
    onTheDay: [
      'Arrive 10 minutes early.',
      'You may eat and drink normally before this consultation.',
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
      'Nil by mouth: no food or drink (including water) from midnight the night before your procedure.',
      'Blood thinners (warfarin, rivaroxaban, apixaban, clopidogrel, aspirin): stop as specifically instructed by Dr Kabiye. Do not stop without instruction.',
      'Diabetic patients: adjust your insulin or oral medications as directed. Do not skip meals the day before. On the procedure day, hold your morning diabetes medications unless told otherwise.',
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
      'Call Tapion Hospital immediately: 459-2227 / 284-0557',
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
      'After midnight on the day of procedure: nil by mouth (no food or drink including water). Small sips of water to take essential medications only — check with Dr Kabiye.',
      'Blood thinners: stop as instructed by Dr Kabiye.',
      'Diabetic patients: adjust insulin and medications as directed.',
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
      'Go to the nearest emergency department or call Tapion Hospital: 459-2227 / 284-0557',
    ],
  },

  gastroscopy: {
    displayName: 'Gastroscopy (Upper GI Endoscopy / OGD)',
    location:    'Tapion Hospital (La Toc, Castries)',
    duration:    '15–30 minutes (plus preparation and recovery)',
    beforeVisit: [
      'Nil by mouth: no food or milk for 6 hours before the procedure.',
      'Clear fluids (water only) permitted up to 2 hours before the procedure.',
      'Continue your regular medications with a small sip of water unless told otherwise.',
      'If you take medication for acid reflux (proton pump inhibitors), check with Dr Kabiye whether to pause them.',
      'Diabetic patients: adjust medications as directed.',
      'Blood thinners: stop as instructed.',
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
      'Contact Tapion Hospital immediately: 459-2227 / 284-0557',
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
      'If your condition deteriorates before the call — do not wait, attend the nearest emergency department or call Tapion Hospital: 459-2227 / 284-0557',
    ],
  },

  // ── GENERAL ELECTIVE SURGERY (used for pre-op instructions) ───────────────

  elective_surgery: {
    displayName: 'Elective Surgery',
    location:    'Tapion Hospital (La Toc, Castries)',
    duration:    'As per surgical team instructions',
    beforeVisit: [
      'Pre-operative assessment: you will be seen by the team before your surgery date to review your fitness for anaesthesia.',
      'Nil by mouth: no food for 6 hours before surgery; no clear fluids for 2 hours before.',
      'Blood thinners: stop exactly as instructed by Dr Kabiye. Do not stop without being told to do so.',
      'Diabetic medications: hold morning insulin/tablets on the day of surgery unless instructed otherwise.',
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
      'Nil by mouth from midnight the night before surgery.',
      'Stop blood-thinning medications as directed by Dr Kabiye.',
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
      'Attend post-op review at Castries as scheduled.',
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
      'Nil by mouth from midnight.',
      'Stop blood thinners as directed.',
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
      'Nil by mouth from midnight.',
      'Stop blood-thinning medications as instructed.',
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

  thyroid: {
    displayName: 'Thyroid Surgery',
    location:    'Tapion Hospital (La Toc, Castries)',
    duration:    '90–180 minutes',
    beforeVisit: [
      'Pre-operative assessment including blood tests (thyroid function, calcium levels) and ENT vocal cord review.',
      'Nil by mouth from midnight.',
      'Stop blood thinners and thyroid-affecting medications as directed.',
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
      'No special fasting is required for most minor procedures under local anaesthesia.',
      'If a general anaesthetic is planned, nil by mouth instructions will be given separately.',
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
};

/**
 * Returns the instructions for a given appointment type.
 * Falls back to new_consult if the type is not found.
 */
export function getInstructions(appointmentType: string): ProcedureInstructions {
  return (
    PROCEDURE_INSTRUCTIONS[appointmentType] ??
    PROCEDURE_INSTRUCTIONS['new_consult']
  );
}

/**
 * Returns a plain-text version of instructions for SMS / short-form WhatsApp.
 */
export function shortInstructions(appointmentType: string): string {
  const inst = getInstructions(appointmentType);
  const key  = inst.beforeVisit[0] ?? 'No special preparation required.';
  return `Preparation: ${key} What to bring: ${inst.whatToBring.slice(0, 2).join('; ')}. Questions? Call 459-2227.`;
}
