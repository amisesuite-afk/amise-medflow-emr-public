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

  // ── Procedure-specific operative notes ───────────────────────────────────────
  { trigger: 'lapchole', label: 'Operative note: laparoscopic cholecystectomy',
    text: 'Procedure: Laparoscopic cholecystectomy\nSurgeon: Dr Dawit Daniel Kabiye\nAssistant: |/|\nAnaesthesia: General endotracheal\nPosition: Supine, reverse Trendelenburg, left lateral tilt\nAccess: Hassan technique / Veress needle at umbilicus. 4-port technique — 10 mm umbilical, 5 mm epigastric, 5 mm RUQ working, 5 mm lateral.\nFindings: |Gallbladder distended/contracted/inflamed/gangrenous|. |Adhesions: none/omental/duodenal|. Common bile duct: |not dilated / dilated to X mm|.\nProcedure: Critical view of safety (CVS) confirmed. Cystic duct and cystic artery individually clipped × 2 proximally and × 1 distally and divided. Gallbladder dissected off liver bed with diathermy. Haemostasis confirmed. On-table cholangiogram: |not performed / performed — see report|. Gallbladder delivered in retrieval bag via umbilical port. Liver bed dry. Port sites closed: fascia at 10 mm port closed with 0-Vicryl. Skin closed with subcuticular sutures.\nSpecimen: Gallbladder sent for histopathology\nEstimated blood loss: <50 mL\nSwab count: Correct ×2\nComplications: None\nPost-op plan: Regular diet when tolerating. Discharge day 0–1. Follow-up 2 weeks.' },

  { trigger: 'appen', label: 'Operative note: laparoscopic appendicectomy',
    text: 'Procedure: Laparoscopic appendicectomy\nSurgeon: Dr Dawit Daniel Kabiye\nAssistant: |/|\nAnaesthesia: General endotracheal\nPosition: Supine, left lateral tilt, Trendelenburg\nAccess: Hassan technique at umbilicus. 3-port technique — 10 mm umbilical, 5 mm suprapubic, 5 mm left iliac fossa.\nFindings: Appendix: |acutely inflamed / perforated / gangrenous / normal|. |Faecolith: present/absent|. Free fluid: |none / <50 mL serous / purulent — washed out|. Peritonitis: |localised / generalised|. Other: |/|.\nProcedure: Appendix identified and elevated. Mesoappendix divided with LigaSure / diathermy. Base of appendix secured with Endoloops × 2. Appendix divided and delivered in retrieval bag via umbilical port. Appendix stump: |inverted / not inverted|. Peritoneal lavage with |X| L warm saline. Haemostasis confirmed. Ports closed: fascia at 10 mm site closed with 0-Vicryl. Skin subcuticular.\nSpecimen: Appendix sent for histopathology\nEstimated blood loss: <50 mL\nSwab count: Correct ×2\nComplications: None\nPost-op plan: IV antibiotics × |24 h / 5 days|. Diet as tolerated. Discharge day |1–2|. Follow-up 2 weeks.' },

  { trigger: 'hernia', label: 'Operative note: laparoscopic TAPP hernia repair',
    text: 'Procedure: Laparoscopic totally extra-peritoneal (TEP) / transabdominal preperitoneal (TAPP) inguinal hernia repair — |right / left / bilateral|\nSurgeon: Dr Dawit Daniel Kabiye\nAssistant: |/|\nAnaesthesia: General endotracheal\nPosition: Supine, slight Trendelenburg\nAccess: |TEP: balloon dissector via infraumbilical incision. 3-port technique — 10 mm infraumbilical, 5 mm × 2 midline. / TAPP: standard 3-port — 10 mm umbilical, 5 mm bilateral.\nFindings: |Direct / indirect| hernia, |right / left|. Sac: |reducible / irreducible|. Contents: |omentum / bowel / empty|. Femoral ring: |normal / patent|.\nProcedure: Preperitoneal space developed. Hernia sac reduced. Cooper\'s ligament, iliopubic tract, and cord structures clearly identified. Nerve identification: genitofemoral and lateral femoral cutaneous nerves identified and preserved. Flat mesh (|15 × 10 cm|) positioned to cover direct, indirect, and femoral spaces. Mesh fixed with tacks / non-fixation. Peritoneum closed with running 2/0 PDS. Haemostasis confirmed.\nEstimated blood loss: <20 mL\nSwab count: Correct ×2\nComplications: None\nPost-op plan: Mobilise day 0. Light activity 2 weeks. Heavy lifting restricted 6 weeks. Follow-up 2–4 weeks.' },

  { trigger: 'thyroid', label: 'Operative note: thyroidectomy',
    text: 'Procedure: |Hemithyroidectomy / Total thyroidectomy| — |right / left|\nSurgeon: Dr Dawit Daniel Kabiye\nAssistant: |/|\nAnaesthesia: General endotracheal\nPosition: Supine, neck extended, shoulder roll\nAccess: Kocher collar incision 2 cm above sternal notch.\nFindings: |Thyroid: left/right lobe — nodule X cm, consistency, adherence|. RLN identified bilaterally using nerve monitoring. Parathyroid glands: |identified and preserved / autotransplanted|.\nProcedure: Subplatysmal flaps raised. Strap muscles divided in midline. Thyroid lobe mobilised. Superior thyroid artery and vein ligated and divided near capsule. RLN identified in the tracheo-oesophageal groove and traced to laryngeal entry. Inferior thyroid artery ligated medially. Berry\'s ligament divided. Specimen delivered. Haemostasis. Strap muscles approximated. Drain placed. Wound closed in layers.\nSpecimen: Thyroid specimen sent for histopathology / frozen section.\nEstimated blood loss: |<50 / X| mL\nComplications: None\nPost-op plan: Check Ca²⁺ at 6 h and 24 h. Thyroxine supplementation: |/|. Discharge day 1–2. Follow-up 2 weeks + histology review.' },

  { trigger: 'endoscopy', label: 'OGD report template',
    text: 'Procedure: Oesophagogastroduodenoscopy (OGD)\nEndoscopist: Dr Dawit Daniel Kabiye\nScope: |Olympus GIF-H190 / /|\nSedation: |IV midazolam X mg + fentanyl X mcg / unsedated|\nIndication: |/|\nOesophagus: |Normal mucosa. No varices, stricture, or Barrett\'s change. / |/||\nGastro-oesophageal junction: Z-line at |X| cm. |Normal / hiatus hernia X cm|.\nStomach: |Normal rugal folds. No ulceration or mass. Antrum: normal. Pylorus: normal. / |/||\nDuodenum: |D1 and D2 normal. No ulceration. / |/||\nBiopsies: |Antrum ×2 for H. pylori / corpus ×2 / |site| ×2 — sent for histopathology / none taken|.\nTherapy: |None / Haemostasis: / Dilation: / Polypectomy: /|\nConclusion: |/|\nPlan: |/|' },

  { trigger: 'colon', label: 'Colonoscopy report template',
    text: 'Procedure: Colonoscopy\nEndoscopist: Dr Dawit Daniel Kabiye\nScope: |Olympus CF-H190L / /|\nSedation: |IV midazolam X mg + fentanyl X mcg|\nBowel prep: |Adequate / Inadequate — Boston Bowel Prep Score: R X / T X / L X (total /9)|\nIndication: |/|\nCaecum reached: |Yes — confirmed by ileocaecal valve and appendix orifice / No — reached |X||\nWithdrawal time: |X| min\nFindings:\n  Caecum/ascending colon: |Normal / |/||\n  Transverse colon: |Normal / |/||\n  Descending colon: |Normal / |/||\n  Sigmoid: |Normal / diverticulosis — uncomplicated / |/||\n  Rectum: |Normal / haemorrhoids — |grade| / |/||\nPolyps: |None / X polyp(s) found — location, size, morphology (Paris |/|), removed by |cold snare / hot snare / biopsy forceps / EMR|, retrieved.\nBiopsies: |None / Site ×2|\nConclusion: |/|\nSurveillance plan: |Per BSG 2019 guidelines — low risk: 5 yr / intermediate risk: 3 yr / high risk: 1 yr / no surveillance / cancer pathway|' },

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
  acute_cholecystitis:    ['hpiercp', 'acholecystitis', 'abdsurg', 'planop', 'lapchole'],
  acute_cholangitis:      ['hpiercp', 'abdsurg', 'planop', 'lapchole'],
  cbd_obstruction:        ['hpiercp', 'abdsurg', 'planop'],
  gallstone_pancreatitis: ['hpiercp', 'abdsurg', 'planop'],
  acute_appendicitis:     ['hpiabd', 'aappendix', 'abdsurg', 'planop', 'appen'],
  diverticulitis:         ['hpiabd', 'abdsurg', 'plan', 'planop'],
  hernia_reducible:       ['hpihernia', 'plan', 'planop', 'hernia'],
  hernia_strangulated:    ['hpihernia', 'planop', 'hernia'],
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
