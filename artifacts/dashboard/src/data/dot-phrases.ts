export interface DotPhrase {
  trigger: string;   // without the leading dot
  label: string;     // short description shown in picker
  text: string;      // expanded text; |cursor| marks insertion point
}

export const DOT_PHRASES: DotPhrase[] = [
  // ── Shorthand words ──────────────────────────────────────────────────────────
  { trigger: 'nml',   label: 'Normal',                        text: 'within normal limits' },
  { trigger: 'wnl',   label: 'Within normal limits',          text: 'within normal limits' },
  { trigger: 'neg',   label: 'Negative / no findings',        text: 'no significant findings' },
  { trigger: 'nkda',  label: 'No known drug allergies',       text: 'No known drug allergies (NKDA)' },
  { trigger: 'sp',    label: 'Status post',                   text: 'status post ' },
  { trigger: 'co',    label: 'Complains of',                  text: 'complains of ' },
  { trigger: 'ho',    label: 'History of',                    text: 'history of ' },
  { trigger: 'hx',    label: 'History',                       text: 'history of ' },
  { trigger: 'sob',   label: 'Shortness of breath',           text: 'shortness of breath' },
  { trigger: 'cp',    label: 'Chest pain',                    text: 'chest pain' },
  { trigger: 'ha',    label: 'Headache',                      text: 'headache' },
  { trigger: 'abd',   label: 'Abdominal',                     text: 'abdominal' },
  { trigger: 'bilat', label: 'Bilateral',                     text: 'bilateral' },
  { trigger: 'htn',   label: 'Hypertension',                  text: 'hypertension' },
  { trigger: 'dm2',   label: 'Type 2 diabetes',               text: 'type 2 diabetes mellitus (T2DM)' },
  { trigger: 'dm1',   label: 'Type 1 diabetes',               text: 'type 1 diabetes mellitus (T1DM)' },
  { trigger: 'af',    label: 'Atrial fibrillation',           text: 'atrial fibrillation (AF)' },
  { trigger: 'chf',   label: 'Congestive heart failure',      text: 'congestive heart failure (CHF)' },
  { trigger: 'ckd',   label: 'Chronic kidney disease',        text: 'chronic kidney disease (CKD)' },
  { trigger: 'copd',  label: 'COPD',                          text: 'chronic obstructive pulmonary disease (COPD)' },
  { trigger: 'dvt',   label: 'Deep vein thrombosis',          text: 'deep vein thrombosis (DVT)' },
  { trigger: 'pe',    label: 'Pulmonary embolism',            text: 'pulmonary embolism (PE)' },
  { trigger: 'gerd',  label: 'GERD',                          text: 'gastro-oesophageal reflux disease (GERD)' },
  { trigger: 'ibd',   label: 'IBD',                           text: 'inflammatory bowel disease (IBD)' },

  // ── Physical examination normals ─────────────────────────────────────────────
  { trigger: 'exnml', label: 'Exam all normal',
    text: 'General: Alert and oriented, no acute distress. Cardiovascular: Regular rate and rhythm, no murmurs. Respiratory: Clear to auscultation bilaterally. Abdomen: Soft, non-tender, non-distended, bowel sounds present. Extremities: No oedema.' },
  { trigger: 'cvsnml', label: 'CVS normal',
    text: 'Regular rate and rhythm, no murmurs, rubs, or gallops. Peripheral pulses equal and present bilaterally.' },
  { trigger: 'rsnml',  label: 'Respiratory normal',
    text: 'Clear to auscultation bilaterally. No wheeze, crackles, or reduced air entry.' },
  { trigger: 'abdnml', label: 'Abdomen normal',
    text: 'Soft, non-tender, non-distended. Bowel sounds normal. No organomegaly. No guarding or rigidity.' },
  { trigger: 'abdsurg', label: 'Abdominal surgical exam',
    text: 'Abdomen: Soft. Tenderness: |localise|. Guarding: absent / present. Rigidity: absent / present. Rebound: absent / present. Bowel sounds: present / absent / hyperactive. Scar: ' },

  // ── HPI templates ────────────────────────────────────────────────────────────
  { trigger: 'hpi',   label: 'HPI template',
    text: 'The patient is a |age|-year-old |sex| who presents with |chief complaint| for the past |duration|. The pain/symptom is located in |site|, |character|, radiating to |radiation|. Aggravated by |exacerbating factors| and relieved by |relieving factors|. Severity |/10|. Associated with |associated symptoms|. No |pertinent negatives|.' },
  { trigger: 'hpiabd', label: 'HPI abdominal pain',
    text: 'The patient presents with |duration| history of abdominal pain, located in the |site|, |character| in nature, rated |/10| in severity. Pain is aggravated by |exacerbating factors| and relieved by |relieving factors|. Associated with |nausea/vomiting/fever/change in bowel habit|. No haematemesis, malaena, or rectal bleeding reported.' },
  { trigger: 'hpibr',  label: 'HPI breast lump',
    text: 'The patient presents with a |duration| history of a lump in the |right/left| breast, first noticed |how discovered|. The lump is |size|, |mobile/fixed|, |smooth/irregular|, |tender/non-tender|. No skin changes, nipple discharge, or axillary lymphadenopathy. No family history of breast cancer.' },
  { trigger: 'hpiercp', label: 'HPI biliary / ERCP workup',
    text: 'The patient presents with |duration| history of |RUQ pain / jaundice / pruritus|. Pain is |character| and radiates to |site|. Associated with |dark urine / pale stools / fever / nausea|. Jaundice onset: |date|. No prior biliary surgery. Liver function and imaging results documented separately.' },
  { trigger: 'hpihernia', label: 'HPI hernia',
    text: 'The patient presents with a |duration| history of a groin / umbilical / incisional lump. The lump is |reducible/irreducible|, |tender/non-tender|, and has been |increasing in size|. No symptoms of obstruction (vomiting, distension, inability to pass stool/flatus).' },
  { trigger: 'hpitx',  label: 'HPI trauma',
    text: 'The patient presents following |mechanism of injury| occurring at |time|. |Location of injury|. Haemodynamically |stable/unstable| on arrival. |LOC / GCS|. AMPLE history: Allergies: |/|. Medications: |/|. PMH: |/|. Last meal: |/|. Events: as above.' },

  // ── Assessment / impression ──────────────────────────────────────────────────
  { trigger: 'asx',   label: 'Assessment: asymptomatic finding',
    text: 'Asymptomatic finding of |diagnosis|. No acute intervention required at this time. Surveillance plan documented.' },
  { trigger: 'acholecystitis', label: 'Assessment: acute cholecystitis',
    text: 'Acute cholecystitis. Meets Tokyo Guidelines criteria for |mild/moderate/severe| disease. Recommended for cholecystectomy — |laparoscopic/open| approach planned. Anaesthetic and theatre team notified.' },
  { trigger: 'aappendix', label: 'Assessment: acute appendicitis',
    text: 'Acute appendicitis (Alvarado score: |/|). Alvarado classification: |/|. Recommended for laparoscopic appendicectomy. Consent obtained. NBM from |time|.' },

  // ── Plan templates ────────────────────────────────────────────────────────────
  { trigger: 'plan',   label: 'Plan template',
    text: '1. Investigations: \n2. Medications: \n3. Referrals: \n4. Follow-up: \n5. Patient education: \n6. Return precautions: ' },
  { trigger: 'planop', label: 'Plan: operative',
    text: 'Proceed to theatre for |procedure|. NBM from |time|. IV access and bloods taken. Consent signed. DVT prophylaxis: |/|. Antibiotic prophylaxis: |/|. Anaesthetic review requested. Theatre booked for |date/time|.' },
  { trigger: 'planf',  label: 'Plan: follow-up',
    text: 'Follow-up in |2/4/6| weeks. Review pathology results. Wound check at |timeframe|. Return to ED if: fever >38.5°C, worsening pain, wound breakdown, vomiting, inability to eat.' },
  { trigger: 'plandc', label: 'Plan: discharge',
    text: 'Discharge home today. Diet: normal/light. Activity: light/restricted for |duration|. Wound care instructions given. Analgesia: |medications|. Follow-up arranged: |date/location|. Return to ED if: fever, increased pain, wound concerns, inability to eat.' },

  // ── Procedures ───────────────────────────────────────────────────────────────
  { trigger: 'lap',   label: 'Laparoscopic approach',
    text: 'Laparoscopic approach. Pneumoperitoneum established with Veress needle. |X| port(s) placed. Findings: |/|. No intraoperative complications. Haemostasis confirmed. Ports closed in layers.' },
  { trigger: 'opnote', label: 'Operative note template',
    text: 'Procedure: |procedure name|\nSurgeon: Dr Dawit Daniel Kabiye\nAssistant: |/|\nAnaesthesia: General / Regional / Local\nPosition: Supine / Lloyd-Davies / Lateral\nFindings: |/|\nProcedure: |step-by-step|\nSpecimen: |sent for histopathology|\nEstimated blood loss: |mL|\nComplications: None / |/|\nClosure: |/|\nDrains: None / |/|\nPost-op plan: |/|' },

  // ── Common phrases ────────────────────────────────────────────────────────────
  { trigger: 'rwp',   label: 'Results will be reviewed',
    text: 'Results will be reviewed and the patient will be contacted accordingly.' },
  { trigger: 'fua',   label: 'Follow-up arranged',
    text: 'Follow-up appointment arranged. Patient advised to contact the rooms if symptoms worsen prior to scheduled review.' },
  { trigger: 'consent', label: 'Consent documented',
    text: 'Informed consent obtained. Procedure, alternatives, risks (including bleeding, infection, anaesthetic risk, organ injury, conversion to open), and benefits discussed. Patient verbally consented and written consent signed.' },
  { trigger: 'inf',   label: 'Patient informed',
    text: 'Patient informed of diagnosis, management plan, and expected course. Questions answered. Written information provided.' },
];

export function matchDotPhrases(trigger: string): DotPhrase[] {
  if (!trigger) return [];
  const q = trigger.toLowerCase();
  return DOT_PHRASES.filter(p => p.trigger.startsWith(q) || p.label.toLowerCase().includes(q)).slice(0, 8);
}

// Differential ID → relevant dot-phrase triggers in order of clinical usefulness
const DX_PHRASE_MAP: Record<string, string[]> = {
  acute_cholecystitis:    ['hpiercp', 'acholecystitis', 'abdsurg', 'planop', 'opnote'],
  acute_cholangitis:      ['hpiercp', 'abdsurg', 'planop', 'opnote'],
  cbd_obstruction:        ['hpiercp', 'abdsurg', 'planop'],
  gallstone_pancreatitis: ['hpiercp', 'abdsurg', 'planop'],
  acute_appendicitis:     ['hpiabd', 'aappendix', 'abdsurg', 'planop', 'opnote'],
  diverticulitis:         ['hpiabd', 'abdsurg', 'plan', 'planop'],
  hernia_reducible:       ['hpihernia', 'plan', 'planop', 'opnote'],
  hernia_strangulated:    ['hpihernia', 'planop', 'opnote'],
  breast_cancer:          ['hpibr', 'plan', 'planop'],
  fibroadenoma:           ['hpibr', 'plan'],
  upper_gi_bleed:         ['hpiabd', 'abdnml', 'plan'],
  lower_gi_bleed:         ['hpiabd', 'abdnml', 'plan'],
  colorectal_cancer:      ['hpiabd', 'plan'],
  oesophageal_cancer:     ['hpi', 'plan'],
  peptic_ulcer:           ['hpiabd', 'abdnml', 'plan'],
  gord:                   ['hpi', 'plan'],
  haemorrhoids:           ['hpiabd', 'plan'],
  liver_disease:          ['hpi', 'abdnml', 'plan'],
  postop_complication:    ['hpi', 'planf', 'fua'],
  acs:                    ['hpi', 'cvsnml', 'plan'],
  aortic_dissection:      ['hpitx', 'plan'],
  pulmonary_embolism:     ['hpi', 'rsnml', 'plan'],
  pneumonia:              ['hpi', 'rsnml', 'plan'],
  renal_colic:            ['hpi', 'plan'],
  uti:                    ['hpi', 'plan'],
  pyelonephritis:         ['hpi', 'plan'],
  sepsis:                 ['hpi', 'exnml', 'plan'],
  diabetic_foot:          ['hpi', 'exnml', 'plan', 'planop'],
  skin_abscess:           ['hpi', 'planop', 'opnote'],
  necrotising_fasciitis:  ['hpi', 'planop', 'opnote'],
};

export function getSuggestedPhrases(dxId: string | null, count = 4): DotPhrase[] {
  if (!dxId) return [];
  const triggers = DX_PHRASE_MAP[dxId] ?? ['hpi', 'plan'];
  return triggers
    .slice(0, count)
    .map(t => DOT_PHRASES.find(p => p.trigger === t))
    .filter((p): p is DotPhrase => p !== undefined);
}
