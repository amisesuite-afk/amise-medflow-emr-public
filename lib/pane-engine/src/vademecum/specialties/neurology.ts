import { registerModule } from '../registry.js';
import { PRIOR_TIER as T } from '../priors.js';

// Pane model 1.0.0 — neurological emergencies (clinval endorenal / acutemed clusters).
// Approximate sensitivities, to be signed off:
//  - Stroke / TIA: NICE NG128 (2019, 2022 update); Goldstein & Simel, JAMA 2005 "Is this patient
//    having a stroke?" — facial paresis, arm drift, abnormal speech (any one: LR+ ≈ 5.5); sudden
//    onset; AF and vascular risk. TIA: the deficit has resolved.
//  - SAH: NICE NG228 (2022); Perry et al., JAMA 2013 (Ottawa SAH rule) — thunderclap / worst
//    headache peaking within an hour, neck stiffness, onset on exertion, loss of consciousness,
//    age ≥ 40; late presenters may have headache only.
//  - Bacterial meningitis / meningococcal disease: NICE NG240 (2024); van de Beek et al., NEJM
//    2004 — fever, headache, neck stiffness, altered mental state (triad ≈ 44 %; ≥ 2 of 4 in
//    95 %); non-blanching rash in meningococcal disease; Attia et al., JAMA 1999.
//  - Seizure: NICE NG217 (2022) epilepsies — witnessed convulsion, tongue bite, post-ictal
//    confusion.
//  - Cauda equina syndrome: GIRFT national suspected CES pathway (2023); Deyo et al., JAMA 1992 —
//    urinary retention (sensitivity ≈ 0.9), saddle anaesthesia (≈ 0.75), bilateral sciatica,
//    leg weakness.
//  - Metastatic spinal cord compression: NICE NG234 (2023) — known cancer (breast, prostate,
//    lung, myeloma) with new thoracic / band-like / nocturnal spinal pain, then limb weakness,
//    sensory level, sphincter disturbance.
registerModule({
  specialty: 'neurology',
  system: 'nervous',
  diseases: [
    {
      id: 'stroke', label: 'Stroke (Ischaemic / Haemorrhagic Cerebrovascular Event)', icd10: 'I63.9', prior: T.uncommon, course: 'acute',
      features: { stroke_imaging: 0.75, focal_weakness: 0.80, facial_weakness: 0.55, limb_weakness: 0.70, speech_disturbance: 0.55, limb_numbness: 0.30, visual_disturbance: 0.25, ataxia: 0.15, sudden_onset: 0.90, headache: 0.20, confusion: 0.20, gcs_drop: 0.15, severe_hypertension: 0.25, raised_bp: 0.60, irregular_pulse: 0.20, known_af: 0.20, vascular_risk: 0.85, nausea_vomiting: 0.15, dizziness: 0.15, symptoms_resolved: 0.05 },
    },
    {
      id: 'tia', label: 'Transient Ischaemic Attack (TIA)', icd10: 'G45.9', prior: T.uncommon, course: 'acute',
      features: { symptoms_resolved: 0.90, focal_weakness: 0.60, facial_weakness: 0.30, limb_weakness: 0.50, speech_disturbance: 0.50, limb_numbness: 0.30, visual_disturbance: 0.25, sudden_onset: 0.90, vascular_risk: 0.85, raised_bp: 0.50, known_af: 0.15, irregular_pulse: 0.10 },
    },
    {
      id: 'sah', label: 'Subarachnoid Haemorrhage (SAH)', icd10: 'I60.9', prior: T.rare, course: 'acute',
      features: { sah_imaging: 0.90, headache: 0.98, thunderclap_headache: 0.85, sudden_onset: 0.90, severe_pain: 0.80, neck_stiffness: 0.45, nausea_vomiting: 0.55, photophobia: 0.30, syncope: 0.20, loss_of_consciousness: 0.20, confusion: 0.20, gcs_drop: 0.15, seizure: 0.07, focal_weakness: 0.10, raised_bp: 0.50, exertional_symptoms: 0.20 },
    },
    {
      id: 'meningitis', label: 'Bacterial Meningitis / Meningococcal Disease', icd10: 'G00.9', prior: T.rare, course: 'acute',
      features: { csf_bacterial: 0.85, fever: 0.85, headache: 0.85, neck_stiffness: 0.70, confusion: 0.60, photophobia: 0.35, non_blanching_rash: 0.25, nausea_vomiting: 0.55, seizure: 0.15, gcs_drop: 0.25, tachycardia: 0.60, hypotension: 0.15, immunosuppression: 0.15, lethargy: 0.40, poor_feeding: 0.20, elevated_wbc: 0.70, raised_crp: 0.80 },
    },
    {
      id: 'seizure', label: 'Seizure (First Seizure / Epilepsy)', icd10: 'R56.9', prior: T.uncommon, course: 'acute',
      features: { seizure: 0.95, loss_of_consciousness: 0.70, confusion: 0.50, tongue_bite: 0.30, urinary_incontinence: 0.30, headache: 0.20, known_epilepsy: 0.40, injury_from_fall: 0.20 },
    },
    {
      id: 'cauda_equina', label: 'Cauda Equina Syndrome', icd10: 'G83.4', prior: T.rare, course: 'acute',
      features: { cauda_compression_imaging: 0.90, back_pain: 0.95, sciatica: 0.70, bilateral_leg_symptoms: 0.50, urinary_retention_symptoms: 0.75, saddle_anaesthesia: 0.75, limb_weakness: 0.45, limb_numbness: 0.50, urinary_incontinence: 0.35, faecal_incontinence: 0.20, gait_disturbance: 0.30, reduced_anal_tone: 0.50 },
    },
    {
      id: 'mscc', label: 'Metastatic Spinal Cord Compression / Spinal Metastases (MSCC)', icd10: 'G95.20', prior: T.rare, course: 'subacute',
      features: { spinal_mets_imaging: 0.85, back_pain: 0.95, known_malignancy: 0.85, nocturnal_pain: 0.45, bone_pain: 0.40, limb_weakness: 0.55, limb_numbness: 0.45, bilateral_leg_symptoms: 0.40, gait_disturbance: 0.40, urinary_retention_symptoms: 0.25, urinary_incontinence: 0.15, weight_loss: 0.30, progressive_course: 0.60, hypercalcaemia_lab: 0.15 },
    },
  ],
  features: [
    { id: 'stroke_imaging', label: 'CT/MRI: acute infarct or intracerebral haemorrhage', question: 'Does brain imaging show an acute infarct or haemorrhage?', category: 'investigation', baseRate: 0.001 },
    { id: 'sah_imaging', label: 'CT: subarachnoid blood / CSF xanthochromia', question: 'Does CT show subarachnoid blood, or the CSF xanthochromia?', category: 'investigation', baseRate: 0.0005 },
    { id: 'csf_bacterial', label: 'CSF: turbid / neutrophilic / organisms on Gram stain', question: 'Is the CSF turbid or neutrophilic, or are organisms seen?', category: 'investigation', baseRate: 0.0005 },
    { id: 'cauda_compression_imaging', label: 'MRI: cauda equina compression', question: 'Does MRI show compression of the cauda equina?', category: 'investigation', baseRate: 0.0005 },
    { id: 'spinal_mets_imaging', label: 'MRI: spinal metastases / epidural cord compression', question: 'Does MRI show spinal metastases or epidural cord compression?', category: 'investigation', baseRate: 0.001 },
    { id: 'focal_weakness', label: 'Focal weakness (face, arm or leg)', question: 'Is there new weakness of the face, arm or leg?', category: 'sign', baseRate: 0.01 },
    { id: 'facial_weakness', label: 'Facial droop / weakness', question: 'Is there new facial weakness or droop?', category: 'sign', baseRate: 0.005 },
    { id: 'limb_weakness', label: 'Limb weakness', question: 'Is there weakness of an arm or leg?', category: 'sign', baseRate: 0.02 },
    { id: 'speech_disturbance', label: 'Speech disturbance (slurred speech, word-finding difficulty)', question: 'Is there slurred speech or difficulty finding or understanding words?', category: 'sign', baseRate: 0.005 },
    { id: 'visual_disturbance', label: 'Visual disturbance (loss, blurring, double vision)', question: 'Is there new visual loss, blurring or double vision?', category: 'symptom', baseRate: 0.02 },
    { id: 'ataxia', label: 'Ataxia / unsteadiness', question: 'Is there new unsteadiness or incoordination?', category: 'sign', baseRate: 0.01 },
    { id: 'gait_disturbance', label: 'Difficulty walking', question: 'Is there new difficulty walking?', category: 'sign', baseRate: 0.02 },
    { id: 'symptoms_resolved', label: 'Neurological symptoms fully resolved', question: 'Have the neurological symptoms completely resolved?', category: 'history', baseRate: 0.02 },
    { id: 'thunderclap_headache', label: 'Thunderclap / worst-ever sudden headache', question: 'Did the headache reach maximum intensity within a minute ("worst ever")?', category: 'symptom', baseRate: 0.002 },
    { id: 'neck_stiffness', label: 'Neck stiffness / meningism', question: 'Is there neck stiffness or meningism?', category: 'sign', baseRate: 0.005 },
    { id: 'photophobia', label: 'Photophobia', question: 'Is there photophobia?', category: 'symptom', baseRate: 0.01 },
    { id: 'non_blanching_rash', label: 'Non-blanching (petechial / purpuric) rash', question: 'Is there a non-blanching petechial or purpuric rash?', category: 'sign', baseRate: 0.002 },
    { id: 'seizure', label: 'Seizure / convulsion', question: 'Has there been a seizure?', category: 'symptom', baseRate: 0.005 },
    { id: 'tongue_bite', label: 'Lateral tongue bite', question: 'Is there a bitten tongue?', category: 'sign', baseRate: 0.002 },
    { id: 'urinary_incontinence', label: 'Urinary incontinence', question: 'Is there new urinary incontinence?', category: 'symptom', baseRate: 0.02 },
    { id: 'known_epilepsy', label: 'Known epilepsy', question: 'Does the patient have epilepsy?', category: 'history', baseRate: 0.01 },
    { id: 'back_pain', label: 'Back pain', question: 'Is there back pain?', category: 'symptom', baseRate: 0.07 },
    { id: 'sciatica', label: 'Sciatica (leg pain radiating below the knee)', question: 'Is there pain radiating down the leg below the knee?', category: 'symptom', baseRate: 0.02 },
    { id: 'bilateral_leg_symptoms', label: 'Bilateral leg pain, numbness or weakness', question: 'Are both legs affected?', category: 'symptom', baseRate: 0.01 },
    { id: 'saddle_anaesthesia', label: 'Saddle / perianal numbness', question: 'Is there numbness in the saddle area, perineum or buttocks?', category: 'symptom', baseRate: 0.001 },
    { id: 'reduced_anal_tone', label: 'Reduced anal tone', question: 'Is anal tone reduced on examination?', category: 'sign', baseRate: 0.001 },
  ],
});
