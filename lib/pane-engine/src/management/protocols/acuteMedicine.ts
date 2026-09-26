import type { ManagementProtocol } from '../types.js';
import { EMERGENCY_REDIRECT } from './shared.js';

/**
 * Medical emergencies and acute medical conditions (clinical validation 2026-09, SURGEON-DECISIONS
 * G1–G3; owner decision 2026-09-25: the differential is condition-neutral, emergencies outside
 * surgery are recognised, first actions suggested, and the patient redirected to 911 / the nearest
 * emergency department). Each protocol: recognise → first actions (suggestions; the clinician acts)
 * → redirect wording for an outpatient clinic → definitive care where a surgeon in hospital would
 * act. Doses only where the cited guideline states them.
 */
export const acuteMedicineProtocols: ManagementProtocol[] = [
  // ── Acute coronary syndrome ─────────────────────────────────────────────────────────────
  {
    diseaseId: 'acute_coronary_syndrome',
    icd10Prefixes: ['I20.0', 'I21', 'I22', 'I24'],
    label: 'Acute Coronary Syndrome (STEMI / NSTEMI / unstable angina)',
    kind: 'emergency',
    guidelines: ['ESC 2023 acute coronary syndromes', 'NICE CG95 (2010, updated 2016) chest pain', 'NICE CG167 (2013) STEMI', 'ESC 2018 cardiovascular disease in pregnancy'],
    keyPoints: [
      'Atypical presentations are common in women, older people and people with diabetes: epigastric pain, breathlessness, nausea or "indigestion" — record a 12-lead ECG in every adult with unexplained upper abdominal or chest pain.',
      'Inferior STEMI often presents as epigastric pain with vomiting and is mislabelled biliary colic or gastritis.',
      'In pregnancy, spontaneous coronary artery dissection (SCAD) is a leading cause of ACS.',
    ],
    redFlags: [
      'ST elevation or new LBBB — STEMI: primary PCI pathway now.',
      'Ongoing pain, haemodynamic instability, arrhythmia or heart failure — very high risk; immediate transfer.',
      'Chest or epigastric pain with a normal ECG does not exclude ACS — serial ECG and troponin.',
    ],
    investigations: [
      { label: '12-lead ECG within 10 minutes of arrival; repeat if pain recurs', urgency: 'stat', tier: 1, category: 'bedside' },
      { label: 'High-sensitivity troponin at 0 h and 1–3 h (per local assay algorithm)', urgency: 'stat', tier: 1, category: 'bloods' },
      { label: 'FBC, U&E, glucose, lipids, coagulation', urgency: 'urgent', tier: 1, category: 'bloods' },
      { label: 'CXR (other causes, heart failure)', urgency: 'urgent', tier: 2, category: 'imaging-xr' },
      { label: 'Echocardiography (regional wall motion, complications)', urgency: 'urgent', tier: 2, category: 'other' },
    ],
    management: [
      { phase: 'immediate', step: EMERGENCY_REDIRECT },
      { phase: 'immediate', step: 'Aspirin 300 mg chewed now unless contraindicated (NICE CG95/CG167; ESC 2023: 150–300 mg loading).' },
      { phase: 'immediate', step: 'Oxygen only if SpO₂ < 90% (ESC 2023); GTN sublingual for pain if SBP > 90 mmHg; IV opioid with antiemetic for ongoing pain.' },
      { phase: 'immediate', step: 'STEMI: primary PCI (cath lab) within 120 minutes of diagnosis; if PCI cannot be delivered within 120 minutes, fibrinolysis (thrombolysis) within 10 minutes of the decision (ESC 2023).' },
      { phase: 'surgical', step: 'NSTE-ACS: cardiology — coronary angiography within 24 h if high risk, immediately if very high risk (ESC 2023).' },
      { phase: 'immediate', step: 'Pregnancy: ACS including SCAD — cardiology and obstetric team together; fetal monitoring as the obstetric team advises; no fibrinolysis for suspected SCAD without cardiology advice (ESC 2018 pregnancy).', onlyIf: 'pregnant' },
      { phase: 'followup', step: 'Secondary prevention (dual antiplatelet therapy, statin, beta-blocker, ACE inhibitor as indicated) and cardiac rehabilitation per cardiology; defer elective surgery (ESC/ESAIC 2022).' },
    ],
    medications: [
      { drugName: 'Aspirin', dose: '300 mg', frequency: 'Stat (chewed)', route: 'PO (oral)', indication: 'Suspected ACS — loading dose unless contraindicated', phase: 'immediate' },
      { drugName: 'Glyceryl trinitrate', dose: '400 micrograms (1 spray)', frequency: 'Every 5 min PRN, up to 3 doses', route: 'SL (sublingual)', indication: 'Ischaemic chest pain — only if SBP > 90 mmHg', phase: 'immediate' },
    ],
    referral: 'Emergency: 911 / emergency department → cardiology (cath lab). Never manage suspected ACS in the surgical clinic.',
  },

  // ── Atrial fibrillation ─────────────────────────────────────────────────────────────────
  {
    diseaseId: 'atrial_fibrillation',
    icd10Prefixes: ['I48'],
    label: 'Atrial Fibrillation (new or fast)',
    kind: 'medical',
    guidelines: ['NICE NG196 (2021) atrial fibrillation', 'ESC 2024 atrial fibrillation', 'Resuscitation Council UK 2021 tachyarrhythmia algorithm'],
    keyPoints: [
      'Haemodynamic instability (shock, syncope, myocardial ischaemia, acute heart failure) with fast AF → emergency synchronised DC cardioversion.',
      'Stable: rate control first line (beta-blocker or rate-limiting calcium-channel blocker); rhythm control if onset < 48 h or specialist choice.',
      'Assess stroke risk (CHA₂DS₂-VASc) and bleeding risk; offer a DOAC when indicated (NICE NG196).',
    ],
    redFlags: [
      'Hypotension, syncope, chest pain or heart failure with fast AF — emergency; transfer now.',
      'Pre-excited AF (WPW) — avoid AV-nodal blockers; specialist.',
      'New AF found before elective surgery — defer non-urgent surgery until assessed and rate controlled.',
    ],
    investigations: [
      { label: '12-lead ECG (confirm AF, rate, ischaemia, pre-excitation)', urgency: 'stat', tier: 1, category: 'bedside' },
      { label: 'Thyroid function tests (TSH, fT4), U&E, magnesium, FBC, troponin if chest pain', urgency: 'urgent', tier: 1, category: 'bloods' },
      { label: 'Echocardiography (structural heart disease, LV function)', urgency: 'routine', tier: 2, category: 'other' },
    ],
    management: [
      { phase: 'immediate', step: `If haemodynamically unstable: ${EMERGENCY_REDIRECT}` },
      { phase: 'immediate', step: 'Unstable fast AF: emergency synchronised DC cardioversion under sedation/anaesthesia (Resuscitation Council UK 2021).' },
      { phase: 'conservative', step: 'Stable: rate control first line — beta-blocker (e.g. bisoprolol) or rate-limiting calcium-channel blocker (diltiazem, verapamil); digoxin for sedentary patients or with heart failure (NICE NG196).' },
      { phase: 'conservative', step: 'Anticoagulation: assess CHA₂DS₂-VASc and bleeding risk; offer a DOAC (apixaban, dabigatran, edoxaban or rivaroxaban) when CHA₂DS₂-VASc ≥ 2 (consider ≥ 1 in men) — NICE NG196.' },
      { phase: 'conservative', step: 'Onset < 48 h and stable: rhythm control (electrical or pharmacological cardioversion) is an option with cardiology.' },
      { phase: 'followup', step: 'Cardiology / AF clinic; defer elective surgery until rate controlled and anticoagulation decided.' },
    ],
    medications: [
      { drugName: 'Bisoprolol', dose: '1.25–2.5 mg', frequency: 'OD, titrate', route: 'PO (oral)', indication: 'Rate control — first line (avoid in acute decompensated heart failure / asthma)', phase: 'conservative' },
      { drugName: 'Diltiazem', dose: '60 mg', frequency: 'TDS, titrate', route: 'PO (oral)', indication: 'Rate control — alternative (avoid with reduced LV function)', phase: 'conservative', alternativeTo: 'Bisoprolol' },
    ],
    referral: 'Cardiology / acute medicine; emergency transfer if unstable.',
  },

  // ── Acute heart failure ─────────────────────────────────────────────────────────────────
  {
    diseaseId: 'acute_heart_failure',
    icd10Prefixes: ['I50', 'I11.0'],
    label: 'Acute Heart Failure / Pulmonary Oedema',
    kind: 'emergency',
    guidelines: ['NICE CG187 (2014, updated 2021) acute heart failure', 'ESC 2021 heart failure'],
    keyPoints: [
      'Do NOT give a fluid bolus when heart-failure signs are present (raised JVP, crackles, peripheral oedema, orthopnoea).',
      'Bilateral red, swollen legs in heart failure are usually venous stasis, not bilateral cellulitis.',
      'Natriuretic peptide (BNP / NT-proBNP) helps rule heart failure in or out.',
    ],
    redFlags: [
      'SpO₂ < 90%, respiratory distress, pink frothy sputum — pulmonary oedema; emergency.',
      'Hypotension / cardiogenic shock — emergency; critical care.',
      'Chest pain or ECG changes — treat as ACS.',
    ],
    investigations: [
      { label: 'Natriuretic peptide (BNP or NT-proBNP)', urgency: 'urgent', tier: 1, category: 'bloods' },
      { label: '12-lead ECG and troponin', urgency: 'stat', tier: 1, category: 'bedside' },
      { label: 'Chest X-ray (CXR): congestion, effusions, cardiomegaly', urgency: 'urgent', tier: 2, category: 'imaging-xr' },
      { label: 'U&E, FBC, LFTs, TFTs, glucose; blood gas if hypoxic', urgency: 'urgent', tier: 1, category: 'bloods' },
      { label: 'Echocardiography within 48 h (NICE CG187)', urgency: 'urgent', tier: 2, category: 'other' },
    ],
    management: [
      { phase: 'immediate', step: `Acute pulmonary oedema / breathlessness at rest: ${EMERGENCY_REDIRECT}` },
      { phase: 'immediate', step: 'Sit upright; oxygen if SpO₂ < 90% (ESC 2021); no IV fluid bolus.' },
      { phase: 'immediate', step: 'IV loop diuretic: furosemide 20–40 mg IV if diuretic-naive, or 1–2 × the usual oral dose IV (ESC 2021); monitor urine output, U&E and weight.' },
      { phase: 'immediate', step: 'CPAP / non-invasive ventilation for cardiogenic pulmonary oedema with severe breathlessness or acidaemia (NICE CG187); nitrates only if SBP > 110 mmHg.' },
      { phase: 'conservative', step: 'Treat the precipitant (ACS, arrhythmia, infection, uncontrolled hypertension, fluid overload); fluid and salt restriction as advised.' },
      { phase: 'followup', step: 'Heart failure specialist team; start/optimise disease-modifying therapy after stabilisation (ESC 2021).' },
    ],
    medications: [
      { drugName: 'Furosemide', dose: '20–40 mg (or 1–2 × usual oral dose)', frequency: 'IV, review response', route: 'IV (intravenous)', indication: 'Congestion / pulmonary oedema (ESC 2021)', phase: 'immediate' },
    ],
    referral: 'Emergency department / acute medicine → cardiology (heart failure team).',
  },

  // ── Anaphylaxis ────────────────────────────────────────────────────────────────────────
  {
    diseaseId: 'anaphylaxis',
    icd10Prefixes: ['T78.0', 'T78.2', 'T88.6', 'T80.52'],
    label: 'Anaphylaxis',
    kind: 'emergency',
    paediatricDosing: true,
    guidelines: ['Resuscitation Council UK 2021 emergency treatment of anaphylaxis'],
    keyPoints: [
      'Airway, breathing or circulation problem with skin/mucosal change after a trigger = anaphylaxis: IM adrenaline FIRST — do not wait for antihistamines or steroids.',
      'Hypotension from anaphylaxis needs adrenaline, not a fluid bolus alone.',
      'Repeat IM adrenaline after 5 minutes if not improving; refractory after two doses → IV adrenaline infusion (specialist).',
    ],
    redFlags: [
      'Stridor, hoarse voice, wheeze, SpO₂ falling, hypotension, collapse — life-threatening.',
      'Refractory anaphylaxis after two IM doses — critical care now.',
    ],
    investigations: [
      { label: 'Mast cell tryptase: as soon as possible after resuscitation, at 1–2 h (no later than 4 h), and a baseline ≥ 24 h later (RCUK 2021)', urgency: 'urgent', tier: 1, category: 'bloods' },
      { label: 'Continuous SpO₂, ECG and BP monitoring', urgency: 'stat', tier: 1, category: 'bedside' },
    ],
    management: [
      { phase: 'immediate', step: EMERGENCY_REDIRECT },
      { phase: 'immediate', step: 'Remove the trigger; call for help; lie flat with legs raised (sit up if breathing is difficult).' },
      { phase: 'immediate', step: 'IM adrenaline 1 mg/mL (1:1000) into the anterolateral thigh: adult and child > 12 years 500 micrograms (0.5 mL); child 6–12 years 300 micrograms (0.3 mL); child 6 months–6 years 150 micrograms (0.15 mL); under 6 months 100–150 micrograms (RCUK 2021). Repeat after 5 minutes if no improvement.' },
      { phase: 'immediate', step: 'High-flow oxygen; IV access; IV fluid bolus of crystalloid for circulatory compromise — adults 500–1000 mL, children 10 mL/kg (RCUK 2021).' },
      { phase: 'immediate', step: 'Refractory (no improvement after two IM doses): low-dose IV adrenaline infusion by critical care / anaesthetist (RCUK 2021 refractory algorithm).' },
      { phase: 'conservative', step: 'After stabilisation with IM adrenaline: a non-sedating oral antihistamine may help skin symptoms; corticosteroids are not routinely indicated (RCUK 2021).' },
      { phase: 'followup', step: 'Observe (≥ 6–12 h per RCUK risk assessment); discharge with two adrenaline auto-injectors and training, written plan, allergy clinic referral; record the allergy.' },
    ],
    medications: [
      { drugName: 'Adrenaline 1 mg/mL (1:1000)', dose: 'Adult/child > 12 y: 500 micrograms (0.5 mL); 6–12 y: 300 micrograms (0.3 mL); 6 months–6 y: 150 micrograms (0.15 mL)', frequency: 'Repeat after 5 min if no improvement', route: 'IM (anterolateral thigh)', indication: 'Anaphylaxis — first-line treatment (RCUK 2021)', phase: 'immediate' },
      { drugName: 'Crystalloid (0.9% sodium chloride or Hartmann\'s)', dose: 'Adult 500–1000 mL; child 10 mL/kg', frequency: 'Bolus, reassess', route: 'IV (intravenous)', indication: 'Circulatory compromise in anaphylaxis (RCUK 2021)', phase: 'immediate' },
    ],
    referral: 'Emergency: 911 / emergency department; allergy clinic after discharge.',
  },

  // ── Acute asthma ────────────────────────────────────────────────────────────────────────
  {
    diseaseId: 'acute_asthma',
    icd10Prefixes: ['J45', 'J46'],
    label: 'Acute Asthma',
    kind: 'emergency',
    guidelines: ['BTS/SIGN 158 (2019) British guideline on the management of asthma'],
    keyPoints: [
      'Acute severe: PEF 33–50% best/predicted, RR ≥ 25, HR ≥ 110, cannot complete sentences.',
      'Life-threatening: SpO₂ < 92%, PEF < 33%, silent chest, cyanosis, poor effort, exhaustion, arrhythmia, hypotension, altered consciousness.',
      'In pregnancy treat as for a non-pregnant woman (BTS/SIGN 158).',
    ],
    redFlags: [
      'Life-threatening features — anaesthetic and critical care now.',
      'Rising or normal PaCO₂ in a breathless asthmatic — near-fatal asthma.',
    ],
    investigations: [
      { label: 'PEF (% best or predicted), SpO₂, RR, HR', urgency: 'stat', tier: 1, category: 'bedside' },
      { label: 'Arterial blood gas if SpO₂ < 92% or life-threatening features', urgency: 'stat', tier: 1, category: 'bloods' },
      { label: 'CXR if pneumothorax, consolidation or life-threatening asthma suspected', urgency: 'urgent', tier: 2, category: 'imaging-xr' },
    ],
    management: [
      { phase: 'immediate', step: `Acute severe or life-threatening asthma: ${EMERGENCY_REDIRECT}` },
      { phase: 'immediate', step: 'Oxygen to SpO₂ 94–98%.' },
      { phase: 'immediate', step: 'Nebulised salbutamol 5 mg (oxygen-driven), repeat every 15–30 minutes or back-to-back if severe.' },
      { phase: 'immediate', step: 'Nebulised ipratropium 500 micrograms 4–6-hourly for acute severe or life-threatening asthma or a poor response to beta-2 agonist.' },
      { phase: 'immediate', step: 'Steroid: prednisolone 40–50 mg orally daily for at least 5 days, or hydrocortisone 100 mg IV 6-hourly if unable to swallow.' },
      { phase: 'immediate', step: 'Acute severe asthma not responding, or life-threatening: IV magnesium sulfate 1.2–2 g over 20 minutes (single dose); anaesthetist and ICU for life-threatening or near-fatal features.' },
      { phase: 'immediate', step: 'Pregnancy: treat exactly as for a non-pregnant woman; continuous fetal monitoring in acute severe asthma; involve the obstetric team (BTS/SIGN 158).', onlyIf: 'pregnant' },
      { phase: 'followup', step: 'Review inhaler technique and preventer; written asthma action plan; follow-up within 2 working days of discharge.' },
    ],
    medications: [
      { drugName: 'Salbutamol', dose: '5 mg', frequency: 'Every 15–30 min as needed', route: 'Nebulised (oxygen-driven)', indication: 'Acute asthma — bronchodilator (BTS/SIGN 158)', phase: 'immediate' },
      { drugName: 'Ipratropium bromide', dose: '500 micrograms', frequency: '4–6-hourly', route: 'Nebulised', indication: 'Acute severe / life-threatening asthma', phase: 'immediate' },
      { drugName: 'Prednisolone', dose: '40–50 mg', frequency: 'OD for ≥ 5 days', route: 'PO (oral)', indication: 'Acute asthma — corticosteroid', phase: 'immediate' },
      { drugName: 'Hydrocortisone', dose: '100 mg', frequency: '6-hourly', route: 'IV (intravenous)', indication: 'If unable to take oral prednisolone', phase: 'immediate', alternativeTo: 'Prednisolone' },
      { drugName: 'Magnesium sulfate', dose: '1.2–2 g over 20 min', frequency: 'Single dose', route: 'IV (intravenous)', indication: 'Acute severe asthma not responding / life-threatening asthma', phase: 'immediate' },
    ],
    referral: 'Emergency department / respiratory; ICU for life-threatening asthma.',
  },

  // ── COPD exacerbation ───────────────────────────────────────────────────────────────────
  {
    diseaseId: 'copd_exacerbation',
    icd10Prefixes: ['J44.1', 'J44.0'],
    label: 'Acute Exacerbation of COPD',
    kind: 'emergency',
    guidelines: ['NICE NG115 (2018, updated 2019) COPD', 'BTS 2017 emergency oxygen', 'BTS/ICS 2016 acute hypercapnic respiratory failure', 'NICE NG114 (2018) COPD exacerbation antimicrobials'],
    keyPoints: [
      'Controlled oxygen: target SpO₂ 88–92% in people at risk of hypercapnic respiratory failure — uncontrolled oxygen at high concentration causes CO₂ retention and acidosis.',
      'Blood gas within 30–60 minutes of starting oxygen; NIV for persistent respiratory acidosis.',
      'Prednisolone 30 mg for 5 days; antibiotics only when sputum is purulent or there is pneumonia.',
    ],
    redFlags: [
      'pH < 7.35 with raised PaCO₂ — NIV; drowsiness or confusion — critical care.',
      'SpO₂ < 88% on controlled oxygen, exhaustion, new cyanosis or oedema — emergency.',
    ],
    investigations: [
      { label: 'Arterial (or venous) blood gas within 30–60 min of oxygen', urgency: 'stat', tier: 1, category: 'bloods' },
      { label: 'CXR (pneumonia, pneumothorax)', urgency: 'urgent', tier: 2, category: 'imaging-xr' },
      { label: 'ECG, FBC, U&E, CRP; sputum culture if purulent', urgency: 'urgent', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'immediate', step: `Severe breathlessness, drowsiness or SpO₂ < 88%: ${EMERGENCY_REDIRECT}` },
      { phase: 'immediate', step: 'Controlled oxygen via Venturi mask (24% or 28%) to a target SpO₂ of 88–92% (BTS 2017); repeat the blood gas after changes.' },
      { phase: 'immediate', step: 'Nebulised bronchodilators: salbutamol 2.5–5 mg and ipratropium 500 micrograms — air-driven (with nasal oxygen) if hypercapnic or acidotic.' },
      { phase: 'immediate', step: 'Prednisolone 30 mg orally daily for 5 days (NICE NG115).' },
      { phase: 'conservative', step: 'Antibiotic only if sputum is purulent or there is clinical/radiological pneumonia — amoxicillin, doxycycline or clarithromycin for 5 days (NICE NG114).' },
      { phase: 'immediate', step: 'Non-invasive ventilation if pH < 7.35 and PaCO₂ > 6.5 kPa persist despite optimal medical therapy (BTS/ICS 2016); escalation plan documented.' },
      { phase: 'conservative', step: 'Mild exacerbation managed at home: increase short-acting bronchodilator; oral prednisolone if increased breathlessness interferes with daily activities; safety-net advice.' },
      { phase: 'followup', step: 'Review within 2 weeks; inhaler technique, smoking cessation, pulmonary rehabilitation, vaccination.' },
    ],
    medications: [
      { drugName: 'Oxygen (Venturi 24–28%)', dose: 'Titrate to SpO₂ 88–92%', frequency: 'Continuous', route: 'Inhaled (Venturi mask)', indication: 'COPD with risk of hypercapnia — controlled oxygen (BTS 2017)', phase: 'immediate' },
      { drugName: 'Salbutamol', dose: '2.5–5 mg', frequency: '4–6-hourly or as needed', route: 'Nebulised (air-driven if hypercapnic)', indication: 'Bronchodilator', phase: 'immediate' },
      { drugName: 'Ipratropium bromide', dose: '500 micrograms', frequency: '6-hourly', route: 'Nebulised', indication: 'Bronchodilator', phase: 'immediate' },
      { drugName: 'Prednisolone', dose: '30 mg', frequency: 'OD for 5 days', route: 'PO (oral)', indication: 'COPD exacerbation (NICE NG115)', phase: 'immediate' },
    ],
    referral: 'Emergency department / respiratory medicine; community COPD team for mild exacerbations.',
  },

  // ── Pneumonia ──────────────────────────────────────────────────────────────────────────
  {
    diseaseId: 'pneumonia',
    icd10Prefixes: ['J12', 'J13', 'J14', 'J15', 'J16', 'J17', 'J18'],
    label: 'Pneumonia (community- or hospital-acquired)',
    kind: 'medical',
    guidelines: ['NICE NG138 (2019) pneumonia (community-acquired): antimicrobial prescribing', 'NICE CG191 (2014, updated 2019) pneumonia in adults', 'NICE NG139 (2019) hospital-acquired pneumonia', 'BTS 2017 emergency oxygen'],
    allergyAlternatives: {
      penicillin: 'Penicillin allergy (NICE NG138): low severity — doxycycline or clarithromycin; moderate/high severity — clarithromycin, or levofloxacin with microbiology advice.',
    },
    keyPoints: [
      'Lower-lobe pneumonia commonly presents as upper abdominal pain (right lower lobe mimics cholecystitis or appendicitis, especially in children) — CXR before abdominal surgery.',
      'CURB-65 (CRB-65 in the community) grades severity and guides antibiotic choice and admission.',
      'Immunosuppressed patients: consider Pneumocystis (PCP), drug-induced pneumonitis (e.g. methotrexate) and TB.',
    ],
    redFlags: [
      'CURB-65 ≥ 3, SpO₂ < 92%, NEWS2 ≥ 5, sepsis or confusion — high severity; hospital care.',
      'Immunosuppression (steroids, methotrexate, biologics, transplant, HIV) — broader differential and early specialist input.',
    ],
    investigations: [
      { label: 'Chest X-ray (CXR) — within 4 h of presentation (NICE CG191)', urgency: 'urgent', tier: 2, category: 'imaging-xr' },
      { label: 'FBC, U&E (urea for CURB-65), CRP, blood cultures if moderate/high severity', urgency: 'urgent', tier: 1, category: 'bloods' },
      { label: 'Sputum culture; urinary pneumococcal and Legionella antigens (moderate/high severity)', urgency: 'urgent', tier: 1, category: 'microbiology' },
      { label: 'Blood gas if SpO₂ < 94% or at risk of hypercapnia', urgency: 'urgent', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'immediate', step: `High severity (CURB-65 ≥ 3, sepsis, hypoxia) seen in clinic: ${EMERGENCY_REDIRECT}` },
      { phase: 'immediate', step: 'Oxygen to SpO₂ 94–98% (88–92% if at risk of hypercapnic respiratory failure, e.g. COPD — BTS 2017).' },
      { phase: 'conservative', step: 'Low severity (CURB-65 0–1): oral amoxicillin 500 mg three times daily for 5 days (NICE NG138).', onlyIf: 'no-penicillin-allergy' },
      { phase: 'immediate', step: 'Moderate severity: amoxicillin, adding clarithromycin if atypical pathogens are suspected; high severity: IV co-amoxiclav 1.2 g three times daily plus clarithromycin 500 mg twice daily — review at 48 h, total 5 days (NICE NG138).' },
      { phase: 'conservative', step: 'Penicillin allergy (NICE NG138): low severity — doxycycline or clarithromycin; moderate/high severity — clarithromycin, or levofloxacin with microbiology advice.', onlyIf: 'penicillin-allergy' },
      { phase: 'conservative', step: 'Immunosuppressed host: discuss early with respiratory/microbiology — consider Pneumocystis (PCP), methotrexate pneumonitis, TB and resistant organisms.' },
      { phase: 'followup', step: 'Review at 48–72 h; repeat CXR at 6 weeks if symptoms persist or high cancer risk (smoker > 50).' },
    ],
    medications: [
      { drugName: 'Amoxicillin', dose: '500 mg', frequency: 'TDS for 5 days', route: 'PO (oral)', indication: 'Low-severity community-acquired pneumonia (NICE NG138)', phase: 'conservative' },
      { drugName: 'Clarithromycin', dose: '500 mg', frequency: 'BD', route: 'PO / IV', indication: 'Atypical cover (moderate/high severity) or penicillin allergy (NICE NG138)', phase: 'conservative' },
    ],
    referral: 'Acute medicine / respiratory for moderate–high severity.',
  },

  // ── Sepsis ─────────────────────────────────────────────────────────────────────────────
  {
    diseaseId: 'sepsis',
    icd10Prefixes: ['A40', 'A41', 'R65.2', 'R65.1', 'R57.2'],
    label: 'Sepsis / Septic Shock',
    kind: 'emergency',
    guidelines: ['NICE NG51 (2016, updated 2024) suspected sepsis', 'Surviving Sepsis Campaign 2021', 'NICE CG151 (2012) neutropenic sepsis'],
    keyPoints: [
      'Fever is absent in many older, immunosuppressed and septic-shock patients — use NEWS2, lactate and clinical judgement.',
      'Antibiotics within 1 hour for high-risk sepsis (NEWS2 ≥ 7, or septic shock), after blood cultures.',
      'Asplenic patients (overwhelming post-splenectomy infection) and neutropenic patients deteriorate within hours.',
    ],
    redFlags: [
      'NEWS2 ≥ 7, SBP ≤ 90 mmHg, lactate ≥ 2 mmol/L, new confusion, mottled skin, no urine for 18 h — high risk.',
      'Previous splenectomy or chemotherapy with fever or sepsis signs — treat immediately.',
    ],
    investigations: [
      { label: 'Blood cultures before antibiotics (do not delay antibiotics)', urgency: 'stat', tier: 1, category: 'microbiology' },
      { label: 'Venous lactate and blood gas, FBC, U&E, LFTs, CRP, coagulation, glucose', urgency: 'stat', tier: 1, category: 'bloods' },
      { label: 'Urine dipstick and culture; CXR; source imaging as indicated', urgency: 'urgent', tier: 2, category: 'other' },
    ],
    management: [
      { phase: 'immediate', step: EMERGENCY_REDIRECT },
      { phase: 'immediate', step: 'Broad-spectrum IV antibiotics within 1 hour for high-risk sepsis per the local sepsis policy (NICE NG51); neutropenic sepsis — piperacillin-tazobactam within 1 hour (NICE CG151); asplenia — ceftriaxone without delay.' },
      { phase: 'immediate', step: 'Lactate > 2 mmol/L or SBP < 90 mmHg: IV crystalloid 500 mL over < 15 minutes and reassess; smaller aliquots with heart failure (NICE NG51).' },
      { phase: 'immediate', step: 'Oxygen to SpO₂ 94–98% (88–92% if at risk of hypercapnia); urine output monitoring; senior review and critical care if not improving.' },
      { phase: 'surgical', step: 'Source control (drainage, debridement, device removal) as early as feasible.' },
      { phase: 'followup', step: 'Review antibiotics at 48–72 h against cultures; asplenia — vaccination and prophylaxis review after recovery.' },
    ],
    referral: 'Emergency: 911 / emergency department → acute medicine, critical care, source-control team.',
  },

  // ── Diabetic ketoacidosis ─────────────────────────────────────────────────────────────
  {
    diseaseId: 'diabetic_ketoacidosis',
    icd10Prefixes: ['E10.1', 'E11.1', 'E13.1', 'E14.1', 'E08.1', 'E09.1'],
    label: 'Diabetic Ketoacidosis (including euglycaemic DKA)',
    kind: 'emergency',
    guidelines: ['JBDS 2023 management of DKA in adults', 'BSPED 2021 DKA guideline (children)', 'MHRA 2016/2020 SGLT2 inhibitors and DKA'],
    keyPoints: [
      'DKA = ketonaemia ≥ 3 mmol/L (or ketonuria 2+) with bicarbonate < 15 mmol/L and/or venous pH < 7.3; glucose may be NORMAL with SGLT2 inhibitors (euglycaemic DKA).',
      'Abdominal pain and vomiting are common in DKA — do not operate for DKA pain; treat DKA and reassess.',
      'Children: cerebral oedema risk — BSPED protocol, hourly neurological observations.',
    ],
    redFlags: [
      'pH < 7.1, bicarbonate < 5, ketones > 6, K⁺ < 3.5 or > 6, GCS < 12, SpO₂ < 92% — severe DKA; critical care.',
      'Child with DKA: headache, falling GCS, bradycardia or hypertension — cerebral oedema.',
    ],
    investigations: [
      { label: 'Capillary/blood ketones (β-hydroxybutyrate) and capillary glucose — hourly', urgency: 'stat', tier: 1, category: 'bedside' },
      { label: 'Venous blood gas (pH, bicarbonate, potassium) — at 60 min, 2 h, then 2-hourly', urgency: 'stat', tier: 1, category: 'bloods' },
      { label: 'U&E, FBC, blood cultures, urinalysis, ECG, CXR if indicated (find the precipitant)', urgency: 'urgent', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'immediate', step: EMERGENCY_REDIRECT },
      { phase: 'immediate', step: 'Adults: IV 0.9% sodium chloride — 1 L over the first hour (500 mL over 10–15 min if SBP < 90 mmHg), then per the JBDS fluid schedule, adjusted for age, heart failure and renal failure.' },
      { phase: 'immediate', step: 'Fixed-rate IV insulin infusion (FRIII) 0.1 units/kg/h (JBDS 2023).' },
      { phase: 'immediate', step: 'Continue long-acting (basal) insulin at the usual dose throughout (JBDS 2023).' },
      { phase: 'immediate', step: 'Potassium replacement in each litre of fluid by serum K⁺: > 5.5 mmol/L none; 3.5–5.5 mmol/L potassium chloride 40 mmol/L; < 3.5 mmol/L senior review for additional potassium (JBDS 2023).' },
      { phase: 'immediate', step: 'Add 10% glucose at 125 mL/h alongside the saline when glucose falls below 14 mmol/L — from the start in euglycaemic DKA (JBDS 2023).' },
      { phase: 'immediate', step: 'Stop any SGLT2 inhibitor (empagliflozin, dapagliflozin, canagliflozin); do not restart without specialist review (MHRA).' },
      { phase: 'conservative', step: 'Targets: ketones fall ≥ 0.5 mmol/L/h, bicarbonate rise ≥ 3 mmol/L/h, glucose fall 3 mmol/L/h; VTE prophylaxis; treat the precipitant; diabetes team review.' },
      { phase: 'immediate', step: 'Children and young people: follow the BSPED 2021 DKA protocol (different fluid volumes and insulin timing); hourly neurological observations for cerebral oedema; paediatric team.', onlyIf: 'under-16' },
      { phase: 'immediate', step: 'Pregnancy: DKA carries a high risk of fetal loss — obstetric team and continuous fetal monitoring; DKA can occur at lower glucose in pregnancy (JBDS 2023).', onlyIf: 'pregnant' },
    ],
    medications: [
      { drugName: 'Soluble insulin (fixed-rate IV infusion)', dose: '0.1 units/kg/h', frequency: 'Continuous', route: 'IV (intravenous)', indication: 'DKA — FRIII (JBDS 2023)', phase: 'immediate' },
      { drugName: 'Sodium chloride 0.9%', dose: '1 L over 1 h, then per JBDS schedule', frequency: 'Continuous', route: 'IV (intravenous)', indication: 'DKA fluid resuscitation', phase: 'immediate' },
      { drugName: 'Potassium chloride', dose: '40 mmol per litre if K⁺ 3.5–5.5 mmol/L', frequency: 'In each litre', route: 'IV (intravenous)', indication: 'Potassium replacement in DKA', phase: 'immediate' },
      { drugName: 'Glucose 10%', dose: '125 mL/h', frequency: 'Continuous when glucose < 14 mmol/L', route: 'IV (intravenous)', indication: 'Prevents hypoglycaemia while insulin clears ketones', phase: 'immediate' },
    ],
    referral: 'Emergency: 911 / emergency department → acute medicine / diabetes team; HDU if severe.',
  },

  // ── Hyperosmolar hyperglycaemic state ────────────────────────────────────────────────
  {
    diseaseId: 'hyperosmolar_hyperglycaemic_state',
    icd10Prefixes: ['E11.0', 'E10.0', 'E13.0'],
    label: 'Hyperosmolar Hyperglycaemic State (HHS)',
    kind: 'emergency',
    guidelines: ['JBDS 2022 management of HHS in adults'],
    keyPoints: [
      'HHS: hypovolaemia, glucose ≥ 30 mmol/L, osmolality ≥ 320 mOsm/kg, without significant ketonaemia.',
      'Fluids first: 0.9% sodium chloride; insulin only when glucose stops falling with fluids (or at once if ketones > 1 mmol/L), at a LOWER rate than DKA.',
      'High risk of VTE and foot ulceration.',
    ],
    redFlags: [
      'Osmolality > 350, sodium > 160, pH < 7.1, K⁺ outside 3.5–6, GCS < 12, SBP < 90 — critical care.',
    ],
    investigations: [
      { label: 'Serum osmolality (measured, or 2Na + glucose + urea) — hourly initially', urgency: 'stat', tier: 1, category: 'bloods' },
      { label: 'Capillary ketones, venous gas, U&E, glucose, FBC, CRP, blood cultures', urgency: 'stat', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'immediate', step: EMERGENCY_REDIRECT },
      { phase: 'immediate', step: 'IV 0.9% sodium chloride first — 1 L over the first hour, aiming for a positive balance of 3–6 L by 12 h (JBDS 2022).' },
      { phase: 'immediate', step: 'Insulin: not at the start — FRIII at 0.05 units/kg/h only once glucose stops falling with fluids alone, or at once if ketonaemia is > 1 mmol/L (JBDS 2022).' },
      { phase: 'conservative', step: 'Targets: glucose fall 4–6 mmol/L/h; sodium fall ≤ 10 mmol/L in 24 h; osmolality fall 3–8 mOsm/kg/h; potassium replacement per JBDS.' },
      { phase: 'conservative', step: 'Prophylactic LMWH (VTE prophylaxis) unless contraindicated; foot protection — heel protectors and daily foot checks (JBDS 2022).' },
    ],
    referral: 'Emergency: 911 / emergency department → acute medicine / diabetes team; HDU if severe.',
  },

  // ── Hypoglycaemia ──────────────────────────────────────────────────────────────────────
  {
    diseaseId: 'hypoglycaemia',
    icd10Prefixes: ['E16.0', 'E16.1', 'E16.2', 'E10.64', 'E11.64', 'E13.64'],
    label: 'Hypoglycaemia',
    kind: 'emergency',
    guidelines: ['JBDS-IP 2021/2023 hospital management of hypoglycaemia in adults with diabetes', 'NICE NG128 (2019) stroke — exclude hypoglycaemia'],
    keyPoints: [
      'Check capillary glucose in every patient with new neurological symptoms, confusion or seizure — hypoglycaemia mimics stroke.',
      'Sulfonylurea hypoglycaemia is prolonged and recurrent (24–72 h), especially with CKD — admit for monitoring.',
      'Never omit basal insulin in type 1 diabetes after treating a hypo.',
    ],
    redFlags: [
      'Unconscious, fitting or unable to swallow — IV glucose or IM glucagon now.',
      'Sulfonylurea- or long-acting-insulin hypoglycaemia — admission and prolonged monitoring.',
    ],
    investigations: [
      { label: 'Capillary blood glucose now and every 10–15 min until > 4 mmol/L, then hourly', urgency: 'stat', tier: 1, category: 'bedside' },
      { label: 'U&E / eGFR (renal impairment prolongs sulfonylurea and insulin action)', urgency: 'urgent', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'immediate', step: 'Conscious and able to swallow: 15–20 g quick-acting carbohydrate (e.g. 150–200 mL fruit juice or glucose tablets); recheck capillary glucose after 10–15 minutes and repeat up to three times (JBDS).' },
      { phase: 'immediate', step: 'Unconscious, fitting or not responding: IV glucose 10% 150–200 mL over 15 minutes (or 20% 75–100 mL), or glucagon 1 mg IM if no IV access (less effective after sulfonylureas) — JBDS.' },
      { phase: 'immediate', step: `If there is no prompt recovery, or sulfonylurea/long-acting insulin overdose: ${EMERGENCY_REDIRECT}` },
      { phase: 'conservative', step: 'Once glucose > 4 mmol/L: long-acting carbohydrate; continue to monitor capillary glucose — sulfonylurea hypoglycaemia may recur for 24–72 h (IV 10% glucose infusion if recurrent).' },
      { phase: 'followup', step: 'Review, reduce or stop the sulfonylurea (gliclazide) or insulin dose; check renal function; hypoglycaemia education; driving advice.' },
    ],
    medications: [
      { drugName: 'Glucose 10%', dose: '150–200 mL over 15 min', frequency: 'Repeat per capillary glucose', route: 'IV (intravenous)', indication: 'Severe hypoglycaemia (JBDS)', phase: 'immediate' },
      { drugName: 'Glucagon', dose: '1 mg', frequency: 'Once', route: 'IM (intramuscular)', indication: 'Severe hypoglycaemia without IV access (JBDS)', phase: 'immediate' },
    ],
    referral: 'Emergency department if not recovering; diabetes team.',
  },

  // ── Hyperkalaemia ──────────────────────────────────────────────────────────────────────
  {
    diseaseId: 'hyperkalaemia',
    icd10Prefixes: ['E87.5'],
    label: 'Hyperkalaemia',
    kind: 'emergency',
    guidelines: ['UK Kidney Association 2023 clinical practice guideline: treatment of acute hyperkalaemia in adults'],
    keyPoints: [
      'Severe (K⁺ ≥ 6.5 mmol/L) or any ECG change: cardiac monitoring and IV calcium to stabilise the myocardium.',
      'Calcium gluconate 10% 30 mL (not 10 mL) or calcium chloride 10% 10 mL (UKKA 2023).',
      'Insulin–glucose shifts potassium; monitor capillary glucose for ≥ 6 h (hypoglycaemia).',
    ],
    redFlags: [
      'ECG changes (peaked T, broad QRS, loss of P waves, bradycardia, sine wave) — emergency.',
      'K⁺ ≥ 6.5 mmol/L — emergency treatment and monitoring.',
    ],
    investigations: [
      { label: '12-lead ECG and continuous cardiac monitoring', urgency: 'stat', tier: 1, category: 'bedside' },
      { label: 'Repeat K⁺ (venous gas for speed), U&E, glucose, CK if rhabdomyolysis suspected', urgency: 'stat', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'immediate', step: EMERGENCY_REDIRECT },
      { phase: 'immediate', step: 'ECG changes: IV calcium gluconate 10% 30 mL over 5–10 minutes (or calcium chloride 10% 10 mL); repeat if ECG changes persist (UKKA 2023).' },
      { phase: 'immediate', step: 'K⁺ ≥ 6.0 mmol/L: soluble insulin 10 units in 25 g glucose IV over 15 minutes; capillary glucose monitoring for at least 6 h; if pre-treatment glucose < 7 mmol/L follow with 10% glucose at 50 mL/h for 5 h (UKKA 2023).' },
      { phase: 'immediate', step: 'Severe hyperkalaemia: nebulised salbutamol 10–20 mg as an adjunct (UKKA 2023).' },
      { phase: 'conservative', step: 'Stop potassium-raising drugs (ACE inhibitor/ARB, spironolactone, NSAIDs, trimethoprim, potassium supplements); treat the cause; potassium binder; renal team — dialysis if refractory or with AKI.' },
    ],
    medications: [
      { drugName: 'Calcium gluconate 10%', dose: '30 mL over 5–10 min', frequency: 'Repeat if ECG changes persist', route: 'IV (intravenous)', indication: 'Hyperkalaemia with ECG changes (UKKA 2023)', phase: 'immediate' },
      { drugName: 'Soluble insulin + glucose', dose: '10 units insulin in 25 g glucose', frequency: 'Over 15 min', route: 'IV (intravenous)', indication: 'K⁺ ≥ 6.0 mmol/L — shifts potassium (UKKA 2023)', phase: 'immediate' },
      { drugName: 'Salbutamol', dose: '10–20 mg', frequency: 'Once', route: 'Nebulised', indication: 'Adjunct in severe hyperkalaemia (UKKA 2023)', phase: 'immediate' },
    ],
    referral: 'Emergency department / renal team.',
  },

  // ── Hyponatraemia ──────────────────────────────────────────────────────────────────────
  {
    diseaseId: 'hyponatraemia',
    icd10Prefixes: ['E87.1'],
    label: 'Hyponatraemia',
    kind: 'medical',
    guidelines: ['European clinical practice guideline on hyponatraemia (Spasovski et al., 2014)', 'NICE CG174 (2013, updated 2017) IV fluids in adults'],
    keyPoints: [
      'Assess volume status first: hypovolaemic (vomiting, diarrhoea, stoma losses, diuretics) needs saline, not fluid restriction.',
      'Severe symptoms (vomiting, seizures, reduced consciousness): 150 mL 3% hypertonic saline over 20 min, repeat with sodium checks.',
      'Limit the rise to 10 mmol/L in the first 24 h and 8 mmol/L per 24 h thereafter (osmotic demyelination).',
    ],
    redFlags: [
      'Seizures, vomiting, drowsiness with low sodium — severe symptomatic hyponatraemia; emergency.',
      'Post-operative hyponatraemia on hypotonic fluids — stop them; high risk in young women and children.',
    ],
    investigations: [
      { label: 'Serum sodium (repeat after each hypertonic bolus and 6-hourly), serum osmolality, glucose', urgency: 'stat', tier: 1, category: 'bloods' },
      { label: 'Urine osmolality and urine sodium (before treatment if possible)', urgency: 'urgent', tier: 1, category: 'bloods' },
      { label: 'U&E, TFTs, 9 am cortisol (SIADH is a diagnosis of exclusion)', urgency: 'urgent', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'immediate', step: `Severe symptoms (seizure, reduced consciousness): ${EMERGENCY_REDIRECT}` },
      { phase: 'immediate', step: 'Severe symptoms: 150 mL 3% hypertonic saline IV over 20 minutes; recheck serum sodium at 20 minutes; repeat up to twice until sodium has risen by 5 mmol/L; HDU/ICU (European guideline 2014).' },
      { phase: 'immediate', step: 'Stop hypotonic IV fluids (5% glucose / dextrose 5%, 0.18% saline) — especially after surgery (NICE CG174).' },
      { phase: 'immediate', step: 'Stop thiazide diuretics (bendroflumethiazide, indapamide) and other causative drugs (SSRIs, carbamazepine) where possible.' },
      { phase: 'conservative', step: 'Hypovolaemic (e.g. high-output ileostomy, vomiting): restore volume with IV 0.9% saline or balanced crystalloid 0.5–1 mL/kg/h — do not fluid-restrict.' },
      { phase: 'conservative', step: 'Euvolaemic SIADH: fluid restriction is first line — not in hypovolaemia; treat the cause.' },
      { phase: 'conservative', step: 'Limit correction to 10 mmol/L in the first 24 h and 8 mmol/L in each further 24 h; repeat serum sodium 6-hourly while correcting.' },
    ],
    referral: 'Acute medicine / endocrinology; emergency department for severe symptoms.',
  },

  // ── Hypercalcaemia ─────────────────────────────────────────────────────────────────────
  {
    diseaseId: 'hypercalcaemia',
    icd10Prefixes: ['E83.52'],
    label: 'Hypercalcaemia (including hypercalcaemia of malignancy)',
    kind: 'medical',
    guidelines: ['Society for Endocrinology emergency guidance: acute hypercalcaemia (2016)'],
    keyPoints: [
      'Adjusted calcium > 3.0 mmol/L or symptoms (confusion, vomiting, polyuria, constipation, AKI) needs same-day treatment.',
      'PTH separates primary hyperparathyroidism (PTH not suppressed) from malignancy/myeloma (PTH suppressed).',
      'Rehydrate with IV 0.9% sodium chloride first; bisphosphonate once rehydrated.',
    ],
    redFlags: [
      'Calcium > 3.5 mmol/L, confusion, arrhythmia or AKI — emergency.',
      'Hypercalcaemia with lytic lesions, anaemia, AKI — myeloma until proven otherwise.',
    ],
    investigations: [
      { label: 'Adjusted calcium, phosphate, U&E, ALP, albumin', urgency: 'stat', tier: 1, category: 'bloods' },
      { label: 'PTH (parathyroid hormone) and vitamin D', urgency: 'urgent', tier: 1, category: 'bloods' },
      { label: 'Myeloma screen: serum protein electrophoresis and serum free light chains', urgency: 'urgent', tier: 1, category: 'bloods' },
      { label: 'ECG (short QT, arrhythmia)', urgency: 'urgent', tier: 1, category: 'bedside' },
    ],
    management: [
      { phase: 'immediate', step: `Severe (calcium > 3.5 mmol/L) or confused/unwell: ${EMERGENCY_REDIRECT}` },
      { phase: 'immediate', step: 'IV 0.9% sodium chloride rehydration (typically 4–6 L over 24 h if no heart failure; fluid balance monitoring) — SfE 2016.' },
      { phase: 'immediate', step: 'After rehydration: IV bisphosphonate (zoledronic acid or pamidronate — dose per renal function); denosumab if bisphosphonates are contraindicated (SfE 2016).' },
      { phase: 'immediate', step: 'Stop calcium and vitamin D supplements, thiazides and lithium.' },
      { phase: 'followup', step: 'Malignancy: oncology / haematology referral for the underlying cancer; primary hyperparathyroidism: endocrine surgery referral.' },
    ],
    referral: 'Oncology / haematology (malignancy, myeloma) or endocrinology; emergency department if severe.',
  },

  // ── Acute kidney injury (including obstructive uropathy) ─────────────────────────────
  {
    diseaseId: 'acute_kidney_injury',
    icd10Prefixes: ['N17', 'N13.8', 'N13.9', 'N99.0'],
    label: 'Acute Kidney Injury (including obstructive uropathy)',
    kind: 'medical',
    guidelines: ['NICE NG148 (2019) acute kidney injury'],
    keyPoints: [
      'Look for obstruction: urinary retention (bladder scan / catheter) and hydronephrosis on ultrasound.',
      'Stop or hold NSAIDs, ACE inhibitors / ARBs, diuretics, metformin and aminoglycosides (nephrotoxic and hypotensive drugs).',
      'After relief of chronic retention, watch for post-obstructive diuresis (fluid and electrolyte losses).',
    ],
    redFlags: [
      'Potassium ≥ 6.5 mmol/L, pulmonary oedema, severe acidosis, uraemic complications — emergency (renal team / dialysis).',
      'Anuria — obstruction until proven otherwise (catheter, ultrasound, urology).',
    ],
    investigations: [
      { label: 'U&E, potassium, bicarbonate/venous gas, FBC, CK', urgency: 'stat', tier: 1, category: 'bloods' },
      { label: 'Urinalysis (blood, protein) before catheterisation where possible', urgency: 'urgent', tier: 1, category: 'bedside' },
      { label: 'Bladder scan (post-void residual)', urgency: 'urgent', tier: 1, category: 'bedside' },
      { label: 'Renal tract ultrasound within 24 h if obstruction suspected or cause unknown (NICE NG148)', urgency: 'urgent', tier: 2, category: 'imaging-uss' },
    ],
    management: [
      { phase: 'immediate', step: 'Assess volume status; treat hypovolaemia with IV crystalloid and reassess; fluid balance chart and daily weights.' },
      { phase: 'immediate', step: 'Hold diuretics (furosemide, thiazides), NSAIDs, ACE inhibitors / ARBs and metformin — nephrotoxic or hypotensive in AKI (NICE NG148).' },
      { phase: 'immediate', step: 'Urinary retention / bladder outflow obstruction: catheterise; record the residual volume; monitor for post-obstructive diuresis (hourly urine output, U&E, replace losses).' },
      { phase: 'immediate', step: 'Hyperkalaemia: follow the hyperkalaemia protocol (ECG first).' },
      { phase: 'surgical', step: 'Upper-tract obstruction: urology referral for decompression (nephrostomy or ureteric stent).' },
      { phase: 'followup', step: 'Renal referral for AKI stage 3, no improvement, or complications. Stop or review anticholinergic drugs that precipitate retention (e.g. amitriptyline).' },
    ],
    referral: 'Renal team; urology for obstruction; emergency department for severe hyperkalaemia or pulmonary oedema.',
  },

  // ── Hypertensive emergency ──────────────────────────────────────────────────────────
  {
    diseaseId: 'hypertensive_emergency',
    icd10Prefixes: ['I16.1', 'I16.9', 'I67.4'],
    label: 'Hypertensive Emergency (malignant / accelerated hypertension, encephalopathy)',
    kind: 'emergency',
    guidelines: ['ESC/ESH 2018 arterial hypertension', 'ESC Council on Hypertension position paper 2019: hypertensive emergencies', 'NICE NG136 (2019, updated 2023) hypertension'],
    keyPoints: [
      'Hypertensive emergency = severe hypertension with acute organ damage (encephalopathy, papilloedema/retinal haemorrhage, AKI, pulmonary oedema, ACS, aortic dissection, eclampsia).',
      'Same-day referral when BP ≥ 180/120 with papilloedema or retinal haemorrhage, or life-threatening symptoms (NICE NG136).',
      'Lower BP in a controlled way — MAP by no more than 20–25% over the first hours; avoid rapid falls.',
    ],
    redFlags: [
      'Headache, confusion, seizures, visual loss, chest pain, breathlessness with BP ≥ 180/120 — emergency.',
      'Pregnant or postpartum: BP ≥ 160/110 — pre-eclampsia pathway.',
    ],
    investigations: [
      { label: 'Fundoscopy (papilloedema, haemorrhages, exudates)', urgency: 'stat', tier: 1, category: 'bedside' },
      { label: '12-lead ECG, troponin', urgency: 'stat', tier: 1, category: 'bedside' },
      { label: 'U&E, FBC and film (thrombotic microangiopathy), urine dipstick / protein', urgency: 'urgent', tier: 1, category: 'bloods' },
      { label: 'CT head (non-contrast) if neurological symptoms or encephalopathy', urgency: 'urgent', tier: 3, category: 'imaging-ct' },
    ],
    management: [
      { phase: 'immediate', step: `Same-day admission: ${EMERGENCY_REDIRECT}` },
      { phase: 'immediate', step: 'ICU/HDU with arterial line; IV labetalol or nicardipine (ESC 2019), reducing MAP by 20–25% over several hours.' },
      { phase: 'followup', step: 'Defer elective surgery until BP is controlled; investigate secondary causes; hypertension clinic follow-up.' },
    ],
    referral: 'Emergency department / acute medicine; critical care.',
  },

  // ── Acute stroke ──────────────────────────────────────────────────────────────────────
  {
    diseaseId: 'acute_stroke',
    icd10Prefixes: ['I63', 'I64', 'I61', 'I62'],
    label: 'Acute Stroke',
    kind: 'emergency',
    guidelines: ['NICE NG128 (2019, updated 2023) stroke and TIA in over 16s'],
    keyPoints: [
      'FAST positive (face, arm, speech) → time-critical emergency: record the time last known well.',
      'Exclude hypoglycaemia (capillary glucose) — a common stroke mimic.',
      'Thrombolysis within 4.5 h (contraindicated on an anticoagulant unless the stroke team confirms it is safe) and thrombectomy within 6 h (up to 24 h in selected patients) of onset.',
    ],
    redFlags: [
      'Reduced consciousness, on anticoagulants, severe headache — immediate CT (possible haemorrhage).',
    ],
    investigations: [
      { label: 'Capillary glucose (exclude hypoglycaemia)', urgency: 'stat', tier: 1, category: 'bedside' },
      { label: 'Non-contrast CT head immediately; CT angiography (± perfusion) if thrombectomy may be indicated', urgency: 'stat', tier: 3, category: 'imaging-ct' },
      { label: 'ECG, FBC, U&E, coagulation (on anticoagulants: time of last dose, renal function)', urgency: 'stat', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'immediate', step: EMERGENCY_REDIRECT },
      { phase: 'immediate', step: 'Direct admission to a hyperacute stroke unit / stroke team; nil by mouth until swallow screen.' },
      { phase: 'surgical', step: 'Ischaemic stroke: thrombolysis (alteplase or tenecteplase) within 4.5 h of onset if haemorrhage is excluded and no contraindication; mechanical thrombectomy for proximal anterior-circulation occlusion within 6 h (selected patients up to 24 h) — NICE NG128.' },
      { phase: 'immediate', step: 'On a DOAC or warfarin: thrombolysis is usually contraindicated (stroke team decides on timing/levels); thrombectomy remains an option; intracerebral haemorrhage on an anticoagulant — urgent reversal.' },
      { phase: 'conservative', step: 'Aspirin 300 mg once haemorrhage is excluded (if thrombolysed, from 24 h after it; thrombolysis is contraindicated on a DOAC unless the stroke team confirms it is safe); oxygen only if SpO₂ < 95%; swallow screen before oral intake.' },
      { phase: 'followup', step: 'Stroke rehabilitation; secondary prevention; defer elective surgery.' },
    ],
    referral: 'Emergency: 911 → hyperacute stroke unit.',
  },

  // ── TIA ────────────────────────────────────────────────────────────────────────────────
  {
    diseaseId: 'transient_ischaemic_attack',
    icd10Prefixes: ['G45'],
    label: 'Transient Ischaemic Attack (TIA)',
    kind: 'medical',
    guidelines: ['NICE NG128 (2019, updated 2023) stroke and TIA'],
    keyPoints: [
      'Do not use ABCD2 or other risk scores to decide urgency — assess every suspected TIA within 24 h (NICE NG128).',
      'Aspirin 300 mg immediately unless contraindicated (not if on an anticoagulant or bleeding disorder).',
      'Symptoms still present = stroke: emergency pathway.',
    ],
    redFlags: [
      'Ongoing or recurrent deficit — treat as acute stroke (911).',
      'TIA on anticoagulation — urgent imaging to exclude haemorrhage.',
    ],
    investigations: [
      { label: 'Carotid imaging (duplex ultrasound or CT/MR angiography)', urgency: 'urgent', tier: 2, category: 'imaging-uss' },
      { label: 'MRI brain (diffusion-weighted) if vascular territory or alternative diagnosis uncertain', urgency: 'urgent', tier: 3, category: 'imaging-mri' },
      { label: 'ECG (AF), FBC, glucose, lipids', urgency: 'urgent', tier: 1, category: 'bedside' },
    ],
    management: [
      { phase: 'immediate', step: 'Aspirin 300 mg immediately unless contraindicated (NICE NG128).' },
      { phase: 'immediate', step: 'Refer for specialist (TIA clinic / stroke specialist) assessment within 24 h of symptom onset; symptoms still present — acute stroke pathway (911).' },
      { phase: 'followup', step: 'Carotid endarterectomy within 7 days if symptomatic stenosis 50–99% (NASCET); secondary prevention; defer elective surgery until assessed; advise not to drive until reviewed.' },
    ],
    referral: 'TIA clinic / stroke specialist within 24 h.',
  },

  // ── Subarachnoid haemorrhage ───────────────────────────────────────────────────────────
  {
    diseaseId: 'subarachnoid_haemorrhage',
    icd10Prefixes: ['I60'],
    label: 'Subarachnoid Haemorrhage (suspected)',
    kind: 'emergency',
    guidelines: ['NICE NG228 (2022) subarachnoid haemorrhage caused by a ruptured aneurysm'],
    keyPoints: [
      'Thunderclap headache (maximal within 1 minute) = SAH until proven otherwise.',
      'Non-contrast CT head immediately; if CT within 6 h of onset is normal, do not routinely do a lumbar puncture; if CT after 6 h is normal, LP ≥ 12 h after onset for xanthochromia (NICE NG228).',
      'Nimodipine is ORAL: 60 mg every 4 hours (NICE NG228).',
    ],
    redFlags: [
      'Reduced consciousness, focal deficit, seizure, neck stiffness with sudden headache — emergency.',
      'Late presentation (days) — CT sensitivity falls; LP and/or CT angiography needed.',
    ],
    investigations: [
      { label: 'Non-contrast CT head immediately', urgency: 'stat', tier: 3, category: 'imaging-ct' },
      { label: 'Lumbar puncture ≥ 12 h after onset for xanthochromia if CT was done > 6 h after onset and is normal', urgency: 'urgent', tier: 1, category: 'other', conditional: 'CT > 6 h after onset and normal' },
      { label: 'CT angiography once SAH is confirmed (or late presentation per neurosurgery)', urgency: 'urgent', tier: 3, category: 'imaging-ct' },
    ],
    management: [
      { phase: 'immediate', step: EMERGENCY_REDIRECT },
      { phase: 'immediate', step: 'Refer immediately to neurosurgery once SAH is confirmed; analgesia, antiemetic, BP control per neurosurgical advice; reverse any anticoagulant.' },
      { phase: 'immediate', step: 'Nimodipine 60 mg orally (or via NG tube) every 4 hours for 21 days (NICE NG228).' },
      { phase: 'surgical', step: 'Aneurysm treatment (endovascular coiling or clipping) by the neurovascular team as early as possible.' },
    ],
    medications: [
      { drugName: 'Nimodipine', dose: '60 mg', frequency: 'Every 4 hours for 21 days', route: 'PO (oral / NG tube)', indication: 'Aneurysmal SAH — delayed cerebral ischaemia prevention (NICE NG228)', phase: 'immediate' },
    ],
    referral: 'Emergency: 911 → emergency department → neurosurgery.',
  },

  // ── Bacterial meningitis / meningococcal disease ─────────────────────────────────────
  {
    diseaseId: 'bacterial_meningitis',
    icd10Prefixes: ['G00', 'G01', 'G03', 'A39', 'A87'],
    label: 'Bacterial Meningitis / Meningococcal Disease (suspected)',
    kind: 'emergency',
    guidelines: ['NICE NG240 (2024) meningitis (bacterial) and meningococcal disease'],
    allergyAlternatives: {
      penicillin: 'History of anaphylaxis to penicillins or cephalosporins: chloramphenicol (NICE NG240); microbiology advice.',
      cephalosporin: 'History of anaphylaxis to cephalosporins: chloramphenicol (NICE NG240); microbiology advice.',
    },
    keyPoints: [
      'Do not delay antibiotics for lumbar puncture or imaging.',
      'Over 60 or immunocompromised: add amoxicillin/ampicillin for Listeria (NICE NG240).',
      'Dexamethasone with or before the first antibiotic dose in suspected bacterial meningitis (not for septicaemia alone).',
    ],
    redFlags: [
      'Non-blanching rash, shock, reduced consciousness, seizures — immediate antibiotics and transfer.',
    ],
    investigations: [
      { label: 'Blood cultures and meningococcal/pneumococcal PCR (do not delay antibiotics)', urgency: 'stat', tier: 1, category: 'microbiology' },
      { label: 'Lumbar puncture when safe (no contraindication), CSF glucose/protein/microscopy/PCR', urgency: 'urgent', tier: 1, category: 'other' },
      { label: 'FBC, CRP, lactate, glucose, coagulation', urgency: 'stat', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'immediate', step: EMERGENCY_REDIRECT },
      { phase: 'immediate', step: 'Suspected meningococcal disease outside hospital: IM or IV benzylpenicillin (or ceftriaxone) before transfer if it will not delay transfer — adults and children ≥ 10 years benzylpenicillin 1.2 g (NICE NG240).' },
      { phase: 'immediate', step: 'Hospital: ceftriaxone 2 g IV 12-hourly (adults) without delay (NICE NG240).' },
      { phase: 'immediate', step: 'Over 60 years or immunocompromised: add amoxicillin (or ampicillin) 2 g IV 4-hourly to cover Listeria (NICE NG240).' },
      { phase: 'immediate', step: 'Suspected bacterial meningitis (adults): dexamethasone 10 mg IV 6-hourly for 4 days, starting with or before the first antibiotic dose (NICE NG240).' },
      { phase: 'followup', step: 'Notify the public health authority; chemoprophylaxis for close contacts per public health advice; hearing test after recovery.' },
    ],
    medications: [
      { drugName: 'Ceftriaxone', dose: '2 g', frequency: '12-hourly', route: 'IV (intravenous)', indication: 'Bacterial meningitis — empirical (adults, NICE NG240)', phase: 'immediate' },
      { drugName: 'Amoxicillin', dose: '2 g', frequency: '4-hourly', route: 'IV (intravenous)', indication: 'Listeria cover — over 60 or immunocompromised (NICE NG240)', phase: 'immediate' },
      { drugName: 'Dexamethasone', dose: '10 mg', frequency: '6-hourly for 4 days', route: 'IV (intravenous)', indication: 'Suspected bacterial meningitis, with/before first antibiotic (NICE NG240)', phase: 'immediate' },
    ],
    referral: 'Emergency: 911 → emergency department → infectious diseases / acute medicine; public health notification.',
  },

  // ── Cauda equina syndrome ────────────────────────────────────────────────────────────
  {
    diseaseId: 'cauda_equina_syndrome',
    icd10Prefixes: ['G83.4'],
    label: 'Cauda Equina Syndrome (suspected)',
    kind: 'emergency',
    guidelines: ['GIRFT National Suspected Cauda Equina Syndrome Pathway (2023)', 'SBNS/BASS standards of care for suspected and confirmed CES (2018)'],
    keyPoints: [
      'Red flags: bilateral sciatica, saddle anaesthesia, new urinary retention or incontinence, faecal incontinence, sexual dysfunction.',
      'Emergency MRI of the lumbosacral spine (GIRFT: within 4 hours of presentation, 24/7).',
      'CES with retention (CES-R) has a worse prognosis than incomplete CES (CES-I) — do not wait for retention.',
    ],
    redFlags: [
      'Painless urinary retention or overflow incontinence with back pain — CES-R; emergency.',
      'Saddle anaesthesia or reduced anal tone — emergency MRI.',
    ],
    investigations: [
      { label: 'Emergency MRI lumbosacral spine', urgency: 'stat', tier: 3, category: 'imaging-mri' },
      { label: 'Bladder scan — post-void residual volume', urgency: 'stat', tier: 1, category: 'bedside' },
      { label: 'Documented perianal sensation and anal tone', urgency: 'stat', tier: 1, category: 'bedside' },
    ],
    management: [
      { phase: 'immediate', step: EMERGENCY_REDIRECT },
      { phase: 'immediate', step: 'Urinary retention: catheterise and record the residual volume.' },
      { phase: 'surgical', step: 'Immediate referral to the on-call spinal surgery (neurosurgery / orthopaedic spinal) team for decompression when MRI confirms compression.' },
      { phase: 'followup', step: 'Suspected CES without red flags: written safety-net advice to return immediately with any bladder, bowel or saddle symptoms.' },
    ],
    referral: 'Emergency: spinal surgery (neurosurgery / orthopaedic spinal) via the emergency department.',
  },

  // ── Spinal metastases / MSCC ──────────────────────────────────────────────────────────
  {
    diseaseId: 'metastatic_spinal_cord_compression',
    icd10Prefixes: ['G95.2', 'C79.5', 'G55.0'],
    label: 'Spinal Metastases / Metastatic Spinal Cord Compression (MSCC)',
    kind: 'emergency',
    guidelines: ['NICE NG234 (2023) spinal metastases and metastatic spinal cord compression'],
    keyPoints: [
      'Known cancer + new back pain (thoracic, progressive, nocturnal, band-like) = spinal metastases until proven otherwise.',
      'Neurological symptoms or signs: MRI whole spine within 24 h and contact the MSCC coordinator immediately; pain only: MRI within 1 week (NICE NG234).',
      'Dexamethasone 16 mg orally as soon as possible when there are neurological symptoms or signs (NICE NG234).',
    ],
    redFlags: [
      'Limb weakness, sensory level, bladder or bowel dysfunction — MSCC; emergency.',
    ],
    investigations: [
      { label: 'MRI whole spine (within 24 h with neurology; within 1 week for pain only)', urgency: 'urgent', tier: 3, category: 'imaging-mri' },
      { label: 'FBC, U&E, calcium (hypercalcaemia), glucose (before steroids)', urgency: 'urgent', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'immediate', step: `Neurological symptoms or signs: ${EMERGENCY_REDIRECT}` },
      { phase: 'immediate', step: 'Neurological symptoms or signs: dexamethasone 16 mg orally as soon as possible (with PPI cover and glucose monitoring); contact the MSCC coordinator / acute oncology immediately (NICE NG234).' },
      { phase: 'surgical', step: 'Definitive treatment within 24 h of confirmed MSCC: spinal surgery (decompression/stabilisation) or radiotherapy per oncology and spinal surgery.' },
      { phase: 'followup', step: 'Pain only (no neurology): MRI within 1 week; safety-net — report immediately any new weakness, numbness, bladder or bowel disturbance.' },
    ],
    medications: [
      { drugName: 'Dexamethasone', dose: '16 mg', frequency: 'Stat, then per oncology', route: 'PO (oral)', indication: 'MSCC with neurological symptoms/signs (NICE NG234)', phase: 'immediate' },
    ],
    referral: 'MSCC coordinator / acute oncology; spinal surgery.',
  },

  // ── First seizure ───────────────────────────────────────────────────────────────────
  {
    diseaseId: 'first_seizure',
    icd10Prefixes: ['R56.9', 'R56.8', 'G40'],
    label: 'First Seizure / Epilepsy',
    kind: 'medical',
    guidelines: ['NICE NG217 (2022) epilepsies in children, young people and adults'],
    keyPoints: [
      'Every adult after a first seizure needs a 12-lead ECG (cardiac syncope mimics seizures).',
      'Refer urgently to a first-seizure clinic / neurologist (seen within 2 weeks).',
      'In pregnancy or postpartum, a first seizure is eclampsia until proven otherwise — magnesium sulfate and obstetric emergency.',
    ],
    redFlags: [
      'Seizure > 5 minutes or recurrent without recovery — status epilepticus; emergency.',
      'Focal deficit, fever/meningism, head injury, anticoagulation — urgent imaging.',
    ],
    investigations: [
      { label: '12-lead ECG', urgency: 'urgent', tier: 1, category: 'bedside' },
      { label: 'Glucose, U&E, calcium, magnesium, FBC; pregnancy test in women of childbearing age', urgency: 'urgent', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'immediate', step: `Ongoing seizure > 5 minutes or not recovering: ${EMERGENCY_REDIRECT}` },
      { phase: 'followup', step: 'Urgent referral to a first-seizure clinic / neurologist (within 2 weeks) — NICE NG217.' },
      { phase: 'followup', step: 'Advise not to drive until reviewed and follow the local licensing rules; safety advice (bathing, heights, swimming, operating machinery).' },
    ],
    referral: 'First-seizure clinic / neurology.',
  },

  // ── Syncope ──────────────────────────────────────────────────────────────────────────
  {
    diseaseId: 'syncope',
    icd10Prefixes: ['R55', 'I44.2', 'I35.0'],
    label: 'Syncope (transient loss of consciousness)',
    kind: 'medical',
    guidelines: ['ESC 2018 syncope', 'NICE CG109 (2010, updated 2023) transient loss of consciousness'],
    keyPoints: [
      'Every patient needs a 12-lead ECG and lying/standing BP.',
      'High risk: exertional or supine syncope, palpitations before, ECG abnormality (conduction disease, heart block, long QT), structural heart disease, family history of sudden death.',
      'Uncomplicated vasovagal syncope: reassurance and education.',
    ],
    redFlags: [
      'Complete heart block, Mobitz II or bradycardia with syncope — emergency (pacing).',
      'Exertional syncope with a murmur — severe aortic stenosis until proven otherwise; avoid exertion.',
    ],
    investigations: [
      { label: '12-lead ECG', urgency: 'stat', tier: 1, category: 'bedside' },
      { label: 'Lying and standing BP; FBC, U&E, glucose', urgency: 'urgent', tier: 1, category: 'bedside' },
      { label: 'Echocardiography if murmur, exertional syncope or suspected structural heart disease', urgency: 'urgent', tier: 2, category: 'other' },
    ],
    management: [
      { phase: 'immediate', step: `High-risk features (heart block, exertional syncope, chest pain, abnormal ECG): ${EMERGENCY_REDIRECT}` },
      { phase: 'immediate', step: 'Complete heart block / symptomatic bradycardia: atropine and transcutaneous pacing per Resuscitation Council UK bradycardia algorithm; cardiology for permanent pacing.' },
      { phase: 'followup', step: 'High risk but stable: specialist cardiovascular assessment within 24 h (NICE CG109).' },
      { phase: 'followup', step: 'Uncomplicated vasovagal syncope: reassurance, trigger avoidance, counter-pressure manoeuvres, hydration.' },
    ],
    referral: 'Cardiology (urgent for high-risk features).',
  },
];
