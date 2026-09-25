import type { ManagementProtocol } from '../types.js';
import { EMERGENCY_REDIRECT } from './shared.js';

/**
 * Surgical, endoscopic and allied protocols added after the clinical validation (2026-09,
 * SURGEON-DECISIONS A10, A24, B1–B8, B12–B16, G2.1–G2.3, G2.17). Each protocol names the guideline
 * its content follows (`guidelines`), and dose lines quote only doses the guideline states.
 */
export const surgicalAdditionsProtocols: ManagementProtocol[] = [
  // ── B1 Variceal haemorrhage ────────────────────────────────────────────────────────────
  {
    diseaseId: 'variceal_bleed',
    icd10Prefixes: ['I85', 'I86.4', 'I98.3'],
    label: 'Acute Variceal Haemorrhage',
    kind: 'bleeding',
    guidelines: ['Baveno VII (2022) portal hypertension', 'BSG 2015 UK guidelines on variceal haemorrhage in cirrhosis', 'EASL 2018 decompensated cirrhosis'],
    keyPoints: [
      'Suspected variceal bleeding: start a vasoactive drug (terlipressin) and antibiotic prophylaxis BEFORE endoscopy.',
      'Restrictive transfusion: transfuse at Hb < 70 g/L, target 70–80 g/L — over-transfusion raises portal pressure and rebleeding (Baveno VII).',
      'Endoscopy within 12 h of presentation once resuscitated; band ligation for oesophageal varices, cyanoacrylate for gastric varices.',
    ],
    redFlags: [
      'Haemodynamic instability — major haemorrhage protocol; airway protection before endoscopy if encephalopathic or massive haematemesis.',
      'Child-Pugh C (< 14) or B > 7 with active bleeding at endoscopy — pre-emptive TIPS within 72 h.',
      'Uncontrolled bleeding despite banding — balloon tamponade or oesophageal stent as a bridge to rescue TIPS.',
    ],
    investigations: [
      { label: 'FBC, coagulation, U&E, LFTs, group and crossmatch', urgency: 'stat', tier: 1, category: 'bloods' },
      { label: 'Glasgow-Blatchford score; Child-Pugh and MELD (liver disease severity)', urgency: 'stat', tier: 1, category: 'bedside' },
      { label: 'OGD within 12 h of presentation (after resuscitation)', urgency: 'stat', tier: 3, category: 'endoscopy' },
      { label: 'Blood cultures, ascitic tap if ascites (spontaneous bacterial peritonitis)', urgency: 'urgent', tier: 1, category: 'microbiology' },
    ],
    management: [
      { phase: 'immediate', step: EMERGENCY_REDIRECT },
      { phase: 'immediate', step: 'Two large-bore cannulae; cautious crystalloid resuscitation; restrictive transfusion — transfuse when Hb < 70 g/L to a target of 70–80 g/L (Baveno VII).' },
      { phase: 'immediate', step: 'Vasoactive drug as soon as variceal bleeding is suspected: terlipressin 2 mg IV every 4 h until bleeding is controlled, then 1 mg every 4 h, for 2–5 days (Baveno VII / BSG 2015).' },
      { phase: 'immediate', step: 'Antibiotic prophylaxis: ceftriaxone 1 g IV daily for up to 7 days (Baveno VII).' },
      { phase: 'surgical', step: 'Endoscopy within 12 h: endoscopic band ligation (oesophageal varices); cyanoacrylate injection (gastric varices) — Baveno VII.' },
      { phase: 'surgical', step: 'High risk of failure (Child-Pugh C < 14, or Child-Pugh B > 7 with active bleeding at endoscopy): pre-emptive TIPS within 72 h (Baveno VII); refractory bleeding: rescue TIPS.' },
      { phase: 'followup', step: 'Secondary prophylaxis: non-selective beta-blocker (propranolol or carvedilol) plus band ligation programme; hepatology follow-up; alcohol cessation if relevant.' },
    ],
    medications: [
      { drugName: 'Terlipressin', dose: '2 mg every 4 h until bleeding controlled, then 1 mg every 4 h', frequency: 'For 2–5 days', route: 'IV (intravenous)', indication: 'Variceal haemorrhage — vasoactive therapy (Baveno VII)', phase: 'immediate' },
      { drugName: 'Ceftriaxone', dose: '1 g', frequency: 'OD, up to 7 days', route: 'IV (intravenous)', indication: 'Antibiotic prophylaxis in cirrhosis with GI bleeding (Baveno VII)', phase: 'immediate' },
    ],
    referral: 'Emergency: endoscopy / gastroenterology / hepatology via the emergency department.',
  },

  // ── B2 Lower GI bleeding ───────────────────────────────────────────────────────────────
  {
    diseaseId: 'lower_gi_bleed',
    icd10Prefixes: ['K92.2', 'K57.11', 'K57.31', 'K57.51', 'K57.91', 'K91.84'],
    label: 'Lower GI Bleeding',
    kind: 'bleeding',
    guidelines: ['BSG 2019 acute lower gastrointestinal bleeding in adults', 'ACG 2023 management of patients with acute lower GI bleeding', 'BSG/ESGE 2021 endoscopy in patients on antiplatelet or anticoagulant therapy'],
    keyPoints: [
      'Oakland score ≤ 8 with no other indication for admission: safe for discharge and outpatient investigation (BSG 2019).',
      'Haemodynamically unstable (shock index > 1): CT angiography first to localise, then catheter angiography and embolisation (BSG 2019).',
      'A brisk bleed with a raised urea or instability may be from an upper GI source — OGD.',
    ],
    redFlags: [
      'Shock index > 1 or ongoing major haemorrhage — CT angiography and interventional radiology.',
      'Previous aortic graft / aneurysm repair with GI bleeding — aorto-enteric fistula; CT angiography and vascular surgery.',
      'Anticoagulated patient — reversal plan (see anticoagulation advice).',
    ],
    investigations: [
      { label: 'FBC, U&E (urea), coagulation, group and crossmatch', urgency: 'stat', tier: 1, category: 'bloods' },
      { label: 'Oakland score (stable) / shock index (unstable)', urgency: 'stat', tier: 1, category: 'bedside' },
      { label: 'CT angiography (CTA) if haemodynamically unstable — before endoscopy (BSG 2019)', urgency: 'stat', tier: 3, category: 'imaging-ct' },
      { label: 'Colonoscopy on the next available list for major bleeding that has settled; OGD if an upper GI source is possible', urgency: 'urgent', tier: 3, category: 'endoscopy' },
    ],
    management: [
      { phase: 'immediate', step: `Haemodynamically unstable or ongoing bleeding: ${EMERGENCY_REDIRECT}` },
      { phase: 'immediate', step: 'Resuscitation: two large-bore cannulae; restrictive red-cell transfusion — threshold Hb 70 g/L (target 70–90 g/L), or 80 g/L (target 100 g/L) with cardiovascular disease (BSG 2019).' },
      { phase: 'immediate', step: 'Unstable after resuscitation: CT angiography, then catheter angiography with embolisation by interventional radiology; emergency laparotomy only if bleeding cannot be localised or controlled.' },
      { phase: 'surgical', step: 'Stable major bleed: colonoscopy on the next available list with endoscopic haemostasis (clips, thermal or adrenaline) — including post-polypectomy bleeding.' },
      { phase: 'conservative', step: 'Minor self-terminating bleed (Oakland ≤ 8): discharge with urgent outpatient investigation (BSG 2019).' },
      { phase: 'followup', step: 'Restart anticoagulation after haemostasis with specialist advice (BSG 2019 / BSG-ESGE 2021: warfarin about 7 days after the bleed); aspirin for secondary prevention should not be stopped routinely.' },
    ],
    referral: 'Emergency department / gastroenterology; interventional radiology for unstable bleeding.',
  },

  // ── A10 Angiodysplasia ──────────────────────────────────────────────────────────────────
  {
    diseaseId: 'angiodysplasia',
    icd10Prefixes: ['K55.2', 'K31.81'],
    label: 'Angiodysplasia (GI vascular malformation) with Bleeding / Iron Deficiency',
    kind: 'bleeding',
    guidelines: ['ACG 2023 lower GI bleeding', 'BSG 2021 iron deficiency anaemia in adults', 'ESGE 2015 small-bowel bleeding'],
    keyPoints: [
      'Angiodysplasia causes intermittent bleeding and iron deficiency in older people — manage as a bleeding lesion; no therapeutic anticoagulation.',
      'Endoscopic argon plasma coagulation (APC) for bleeding lesions; iron replacement for iron deficiency.',
      'Recurrent bleeding: consider small-bowel capsule endoscopy for further lesions.',
    ],
    redFlags: [
      'Haemodynamic instability or transfusion requirement — lower GI bleeding pathway (CT angiography).',
    ],
    investigations: [
      { label: 'FBC, ferritin and iron studies, B12/folate, U&E', urgency: 'urgent', tier: 1, category: 'bloods' },
      { label: 'Colonoscopy ± OGD (identify and treat lesions)', urgency: 'urgent', tier: 3, category: 'endoscopy' },
      { label: 'Small-bowel capsule endoscopy if bidirectional endoscopy is negative and bleeding recurs', urgency: 'routine', tier: 3, category: 'endoscopy' },
    ],
    management: [
      { phase: 'immediate', step: 'Resuscitate as for lower GI bleeding if bleeding is active; restrictive transfusion (Hb threshold 70 g/L, 80 g/L with cardiovascular disease).' },
      { phase: 'surgical', step: 'Endoscopic therapy: argon plasma coagulation (APC) of bleeding angiodysplasia.' },
      { phase: 'conservative', step: 'Iron replacement: oral ferrous sulfate 200 mg once daily (BSG 2021), or IV iron if oral iron is not tolerated or ineffective.' },
      { phase: 'conservative', step: 'Review antiplatelet/anticoagulant need with the prescriber; do not escalate anticoagulation for angiodysplasia bleeding.' },
      { phase: 'followup', step: 'Recheck Hb and ferritin; capsule endoscopy / repeat APC if recurrent bleeding.' },
    ],
    medications: [
      { drugName: 'Ferrous sulfate', dose: '200 mg', frequency: 'Once daily', route: 'PO (oral)', indication: 'Iron deficiency (BSG 2021)', phase: 'conservative' },
    ],
    referral: 'Gastroenterology / endoscopy.',
  },

  // ── B3 Acute mesenteric ischaemia ─────────────────────────────────────────────────────
  {
    diseaseId: 'mesenteric_ischaemia',
    icd10Prefixes: ['K55.0'],
    label: 'Acute Mesenteric Ischaemia (arterial or venous)',
    kind: 'surgical',
    guidelines: ['ESVS 2017 management of diseases of mesenteric arteries and veins', 'WSES 2022 acute mesenteric ischaemia'],
    keyPoints: [
      'Pain out of proportion to the examination, especially with AF, recent MI or vascular disease — CT angiography (arterial and portal-venous phases) without delay.',
      'Arterial occlusion: immediate heparin and revascularisation (endovascular or open embolectomy/bypass) by vascular surgery; resection of non-viable bowel with second-look.',
      'Mesenteric venous thrombosis without peritonitis: therapeutic anticoagulation; surgery only for infarcted bowel.',
    ],
    redFlags: [
      'Peritonitis, lactate rising, shock — bowel infarction; emergency laparotomy.',
      'AF with sudden severe abdominal pain — embolic occlusion until proven otherwise.',
    ],
    investigations: [
      { label: 'CT angiography (CTA) abdomen — arterial and portal-venous phases', urgency: 'stat', tier: 3, category: 'imaging-ct' },
      { label: 'Lactate, blood gas, FBC, U&E, coagulation, group and save', urgency: 'stat', tier: 1, category: 'bloods' },
      { label: 'ECG (AF, MI)', urgency: 'stat', tier: 1, category: 'bedside' },
      { label: 'Thrombophilia screen (venous thrombosis; include antiphospholipid antibodies and JAK2)', urgency: 'routine', tier: 1, category: 'bloods', conditional: 'Mesenteric venous thrombosis' },
    ],
    management: [
      { phase: 'immediate', step: EMERGENCY_REDIRECT },
      { phase: 'immediate', step: 'Resuscitation, oxygen, IV fluids, broad-spectrum antibiotics for suspected bowel ischaemia; NG decompression.' },
      { phase: 'immediate', step: 'Arterial occlusion: immediate IV unfractionated heparin (ESVS 2017).' },
      { phase: 'surgical', step: 'Urgent vascular surgery: revascularisation — endovascular (aspiration/stent) or open embolectomy / bypass — and laparotomy to resect non-viable bowel with a planned second look (ESVS 2017).' },
      { phase: 'conservative', step: 'Mesenteric venous thrombosis: immediate therapeutic anticoagulation with unfractionated heparin or LMWH (ESVS 2017).' },
      { phase: 'conservative', step: 'Venous thrombosis provoked by oestrogen: stop the combined oral contraceptive; thrombophilia work-up.' },
      { phase: 'followup', step: 'Long-term anticoagulation (venous or embolic arterial disease); vascular follow-up; nutrition review after resection.' },
    ],
    referral: 'Emergency: vascular surgery + general surgery.',
  },

  // ── B4 Aortic dissection (AAA protocol lives in vascular.ts) ─────────────────────────────
  {
    diseaseId: 'aortic_dissection',
    icd10Prefixes: ['I71.0'],
    label: 'Acute Aortic Dissection',
    kind: 'emergency',
    guidelines: ['ESC 2014 aortic diseases', 'ESC 2024 peripheral arterial and aortic diseases'],
    keyPoints: [
      'Tearing chest, back or epigastric pain with pulse or BP differential, neurological deficit or new aortic regurgitation.',
      'CT angiography of the whole aorta is the diagnostic test.',
      'Control heart rate (< 60/min) and systolic BP (100–120 mmHg) with IV beta-blocker (ESC).',
    ],
    redFlags: [
      'Type A (ascending) — emergency cardiothoracic surgery.',
      'Malperfusion (limb, mesenteric, renal, stroke) or rupture — emergency.',
    ],
    investigations: [
      { label: 'CT angiography (CTA) of the aorta (chest, abdomen, pelvis)', urgency: 'stat', tier: 3, category: 'imaging-ct' },
      { label: 'ECG, troponin, FBC, U&E, crossmatch; bilateral arm BP', urgency: 'stat', tier: 1, category: 'bedside' },
    ],
    management: [
      { phase: 'immediate', step: EMERGENCY_REDIRECT },
      { phase: 'immediate', step: 'Analgesia (IV opioid); heart rate and blood pressure control with IV beta-blocker (labetalol or esmolol), target HR < 60/min and SBP 100–120 mmHg (ESC).' },
      { phase: 'surgical', step: 'Type A: emergency cardiothoracic surgery. Complicated type B: TEVAR by vascular surgery; uncomplicated type B: medical therapy and surveillance.' },
    ],
    referral: 'Emergency: cardiothoracic (type A) / vascular surgery (type B).',
  },

  // ── B5 Acute limb ischaemia ───────────────────────────────────────────────────────────
  {
    diseaseId: 'acute_limb_ischaemia',
    icd10Prefixes: ['I74.2', 'I74.3', 'I74.4', 'I74.5'],
    label: 'Acute Limb Ischaemia',
    kind: 'surgical',
    guidelines: ['ESVS 2020 acute limb ischaemia', 'NICE CG147 (2012, updated 2020) peripheral arterial disease'],
    keyPoints: [
      'The 6 Ps: pain, pallor, pulselessness, perishing cold, paraesthesia, paralysis — sensory or motor loss means the limb is threatened.',
      'Embolic source (AF, recent MI) vs thrombosis on chronic disease (claudicant, diabetic).',
      'Immediate IV heparin and urgent vascular surgery (ESVS 2020).',
    ],
    redFlags: [
      'Acute limb ischaemia with sensory or motor loss — immediately threatened limb; revascularisation within hours.',
      'Atrial fibrillation — embolic source; anticoagulation after revascularisation.',
    ],
    investigations: [
      { label: 'Handheld Doppler (arterial and venous signals); CT angiography (CTA) or duplex if it will not delay treatment', urgency: 'stat', tier: 2, category: 'imaging-uss' },
      { label: 'ECG (AF), FBC, U&E, CK, coagulation, group and save', urgency: 'stat', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'immediate', step: EMERGENCY_REDIRECT },
      { phase: 'immediate', step: 'Immediate IV unfractionated heparin (ESVS 2020); analgesia; keep the limb dependent and protected.' },
      { phase: 'surgical', step: 'Urgent vascular surgery: revascularisation — embolectomy, endovascular thrombectomy/thrombolysis or bypass; fasciotomy for compartment syndrome after reperfusion.' },
      { phase: 'followup', step: 'Long-term anticoagulation for an embolic (AF) source; secondary prevention.' },
    ],
    referral: 'Emergency vascular surgery.',
  },

  // ── Superficial vein thrombosis ───────────────────────────────────────────────────────
  {
    diseaseId: 'superficial_vein_thrombosis',
    icd10Prefixes: ['I80.0', 'I80.1'],
    label: 'Superficial Vein Thrombosis (thrombophlebitis)',
    kind: 'medical',
    guidelines: ['ESVS 2021 management of venous thrombosis'],
    keyPoints: [
      'Duplex both the superficial and deep veins: up to a quarter have co-existing DVT.',
      'Within 3 cm of the saphenofemoral junction: treat as DVT — therapeutic anticoagulation for 3 months (ESVS 2021).',
      'Segment ≥ 5 cm elsewhere: fondaparinux 2.5 mg daily for 45 days (ESVS 2021). Antibiotics are not indicated (sterile inflammation).',
    ],
    redFlags: [
      'Thrombus within 3 cm of the saphenofemoral junction or extending to the junction — DVT-level risk.',
    ],
    investigations: [
      { label: 'Venous duplex ultrasound (extent, distance from the junction, deep veins)', urgency: 'urgent', tier: 2, category: 'imaging-uss' },
    ],
    management: [
      { phase: 'conservative', step: 'Within 3 cm of the saphenofemoral junction: therapeutic anticoagulation (as for DVT) for 3 months (ESVS 2021).' },
      { phase: 'conservative', step: 'Segment ≥ 5 cm, > 3 cm from the junction: fondaparinux 2.5 mg SC daily for 45 days (ESVS 2021).' },
      { phase: 'conservative', step: 'Analgesia, compression and mobilisation; antibiotics are not indicated.' },
      { phase: 'followup', step: 'Repeat duplex if symptoms extend; treat underlying varicose veins electively.' },
    ],
    referral: 'Vascular surgery (junctional thrombus).',
  },

  // ── B6 Fournier's gangrene ─────────────────────────────────────────────────────────────
  {
    diseaseId: 'fournier_gangrene',
    icd10Prefixes: ['N49.3', 'N76.82'],
    label: "Fournier's Gangrene (necrotising perineal infection)",
    kind: 'surgical',
    guidelines: ['WSES/SIS-E 2018 skin and soft-tissue infections', 'MHRA 2019 SGLT2 inhibitors and Fournier\'s gangrene'],
    keyPoints: [
      'Necrotising infection of the perineum/genitalia: pain out of proportion, crepitus, skin necrosis, systemic toxicity — a surgical emergency; LRINEC must not be used to rule it out.',
      'Immediate radical surgical debridement plus broad-spectrum antibiotics including clindamycin (toxin suppression).',
      'SGLT2 inhibitors are associated with Fournier\'s gangrene — stop them (MHRA 2019).',
    ],
    redFlags: [
      'Crepitus, rapidly spreading erythema, skin necrosis or septic shock — emergency debridement now.',
      'SGLT2 inhibitor use (empagliflozin, dapagliflozin, canagliflozin) — stop; report.',
    ],
    investigations: [
      { label: 'FBC, U&E, CRP, glucose, lactate, blood cultures, CK', urgency: 'stat', tier: 1, category: 'bloods' },
      { label: 'Tissue samples for microbiology at debridement', urgency: 'stat', tier: 1, category: 'microbiology' },
      { label: 'CT (extent) only if it will not delay surgery', urgency: 'urgent', tier: 3, category: 'imaging-ct' },
    ],
    management: [
      { phase: 'immediate', step: EMERGENCY_REDIRECT },
      { phase: 'immediate', step: 'Resuscitation (sepsis pathway); broad-spectrum IV antibiotics per local policy including clindamycin (WSES/SIS-E 2018).' },
      { phase: 'surgical', step: 'Emergency radical surgical debridement in theatre, repeated every 24–48 h until clean; urology and colorectal input (faecal diversion if needed).' },
      { phase: 'immediate', step: 'Stop any SGLT2 inhibitor (MHRA 2019); tight glucose control.' },
      { phase: 'followup', step: 'Wound care / negative-pressure therapy; reconstruction by plastic surgery.' },
    ],
    referral: 'Emergency general surgery / urology.',
  },

  // ── B7 C. difficile infection ─────────────────────────────────────────────────────────
  {
    diseaseId: 'clostridioides_difficile',
    icd10Prefixes: ['A04.7'],
    label: 'Clostridioides difficile Infection',
    kind: 'medical',
    guidelines: ['NICE NG199 (2021) Clostridioides difficile infection: antimicrobial prescribing', 'ESCMID 2021 C. difficile infection'],
    keyPoints: [
      'First episode: oral vancomycin 125 mg four times daily for 10 days; fidaxomicin second line (NICE NG199).',
      'Life-threatening (fulminant) infection: oral vancomycin 500 mg four times daily ± IV metronidazole 500 mg three times daily, with urgent specialist and surgical review (NICE NG199).',
      'Stop the causative antibiotic and PPIs where possible; isolate.',
    ],
    redFlags: [
      'Hypotension, ileus, toxic megacolon, WCC > 15, rising lactate or creatinine — fulminant colitis; surgical review.',
    ],
    investigations: [
      { label: 'Stool C. difficile GDH and toxin testing', urgency: 'urgent', tier: 1, category: 'microbiology' },
      { label: 'FBC, U&E, CRP, lactate, albumin', urgency: 'urgent', tier: 1, category: 'bloods' },
      { label: 'Abdominal X-ray or CT if severe (colonic dilatation, perforation)', urgency: 'urgent', tier: 2, category: 'imaging-xr' },
    ],
    management: [
      { phase: 'immediate', step: 'Isolate (contact precautions); stop the causative antibiotic and PPIs if possible; fluids and electrolytes.' },
      { phase: 'conservative', step: 'First episode: oral vancomycin 125 mg four times daily for 10 days; fidaxomicin 200 mg twice daily for 10 days second line (NICE NG199).' },
      { phase: 'immediate', step: 'Life-threatening infection: oral vancomycin 500 mg four times daily for 10 days ± IV metronidazole 500 mg three times daily; urgent gastroenterology/microbiology and surgical review (NICE NG199).' },
      { phase: 'surgical', step: 'Fulminant colitis not responding (toxic megacolon, perforation, shock): subtotal colectomy with end ileostomy (or loop ileostomy with colonic lavage) — surgical review early.' },
      { phase: 'followup', step: 'In inflammatory bowel disease, treat C. difficile before escalating immunosuppression; review for recurrence.' },
    ],
    medications: [
      { drugName: 'Vancomycin', dose: '125 mg (500 mg if life-threatening)', frequency: 'QDS for 10 days', route: 'PO (oral)', indication: 'C. difficile infection — first line (NICE NG199)', phase: 'conservative' },
      { drugName: 'Fidaxomicin', dose: '200 mg', frequency: 'BD for 10 days', route: 'PO (oral)', indication: 'C. difficile — second line / recurrence (NICE NG199)', phase: 'conservative', alternativeTo: 'Vancomycin' },
    ],
    referral: 'Gastroenterology / microbiology; colorectal surgery for severe or fulminant disease.',
  },

  // ── Infective colitis ─────────────────────────────────────────────────────────────────
  {
    diseaseId: 'infective_colitis',
    icd10Prefixes: ['A09', 'A02.0', 'A03', 'A04.0', 'A04.1', 'A04.2', 'A04.3', 'A04.4', 'A04.5', 'A04.6', 'A04.8'],
    label: 'Acute Infective Gastroenteritis / Colitis',
    kind: 'medical',
    guidelines: ['IDSA 2017 infectious diarrhoea', 'UKHSA/PHE guidance on STEC (2018)'],
    keyPoints: [
      'Bloody diarrhoea: send stool culture including Shiga toxin-producing E. coli (STEC/O157) testing.',
      'Avoid empirical antibiotics and antimotility drugs when STEC is possible (risk of haemolytic uraemic syndrome) — IDSA 2017.',
      'Hydration first; check renal function and FBC (HUS: anaemia, thrombocytopenia, AKI).',
    ],
    redFlags: [
      'Bloody diarrhoea with falling platelets, anaemia or rising creatinine — haemolytic uraemic syndrome.',
      'Sepsis, severe dehydration, immunosuppression — admission.',
    ],
    investigations: [
      { label: 'Stool culture (MC&S) including STEC / E. coli O157 and PCR panel', urgency: 'urgent', tier: 1, category: 'microbiology' },
      { label: 'FBC, U&E, CRP; blood film if STEC suspected', urgency: 'urgent', tier: 1, category: 'bloods' },
      { label: 'C. difficile testing if recent antibiotics or healthcare exposure', urgency: 'urgent', tier: 1, category: 'microbiology' },
    ],
    management: [
      { phase: 'conservative', step: 'Oral (or IV) rehydration; no empirical antibiotics or antimotility drugs while STEC is possible (IDSA 2017).' },
      { phase: 'conservative', step: 'Antibiotics only for specific indications per culture/microbiology (e.g. severe Shigella, Campylobacter in immunosuppression).' },
      { phase: 'followup', step: 'Notify public health for notifiable organisms; exclusion advice for food handlers and carers.' },
    ],
    referral: 'Infectious diseases / gastroenterology if severe or HUS suspected.',
  },

  // ── B8 Anal cancer / atypical anal ulcer ─────────────────────────────────────────────
  {
    diseaseId: 'anal_cancer',
    icd10Prefixes: ['C21', 'K62.6'],
    label: 'Anal Cancer / Atypical Anal Ulcer',
    kind: 'surgical',
    cancer: true,
    guidelines: ['ACPGBI 2017 position statement on anal cancer', 'ESMO 2021 anal cancer', 'NICE NG12 (2015, updated 2023) suspected cancer'],
    keyPoints: [
      'An indurated, non-healing, lateral or painless anal ulcer or mass needs examination under anaesthesia (EUA) and biopsy.',
      'HIV test (and consider syphilis, herpes, TB, Crohn\'s disease) in atypical anal ulcers.',
      'Squamous cell anal cancer is treated with chemoradiotherapy (Nigro-type), not primary excision (ESMO 2021).',
    ],
    redFlags: [
      'Anal mass or ulcer with inguinal lymphadenopathy — suspected cancer pathway referral.',
    ],
    investigations: [
      { label: 'EUA (examination under anaesthesia) with biopsy of the anal lesion/ulcer margin', urgency: 'urgent', tier: 3, category: 'other' },
      { label: 'HIV test, syphilis serology; HPV-related disease review', urgency: 'urgent', tier: 1, category: 'bloods' },
      { label: 'MRI pelvis and CT chest/abdomen (staging) once histology confirms cancer', urgency: 'urgent', tier: 3, category: 'imaging-mri' },
    ],
    management: [
      { phase: 'surgical', step: 'EUA with biopsy (and inguinal node FNA/biopsy if enlarged) before any treatment.' },
      { phase: 'conservative', step: 'Confirmed squamous cell carcinoma: colorectal/oncology MDT — chemoradiotherapy (mitomycin + 5-FU/capecitabine with radiotherapy, ESMO 2021).' },
      { phase: 'surgical', step: 'Salvage abdominoperineal resection for persistent/recurrent disease after chemoradiotherapy.' },
      { phase: 'followup', step: 'Surveillance after chemoradiotherapy per oncology.' },
    ],
    referral: 'Suspected cancer pathway (2-week wait) to colorectal surgery; oncology MDT.',
  },

  // ── A24 Fistula-in-ano ─────────────────────────────────────────────────────────────────
  {
    diseaseId: 'fistula_in_ano',
    icd10Prefixes: ['K60.3', 'K60.4', 'K60.5'],
    label: 'Fistula-in-ano',
    kind: 'surgical',
    guidelines: ['ASCRS 2022 clinical practice guideline: anorectal abscess, fistula-in-ano and rectovaginal fistula', 'ACPGBI 2017 position statement on anal fistula'],
    keyPoints: [
      'Classify by relation to the sphincters (Parks): simple (low intersphincteric / low transsphincteric) vs complex (high transsphincteric, suprasphincteric, anterior in women, recurrent, Crohn\'s, previous incontinence).',
      'Simple fistula: fistulotomy (lay-open) has the highest healing rate (ASCRS 2022).',
      'Complex fistula: sphincter-sparing — draining seton first, then advancement flap, LIFT or other sphincter-preserving repair.',
    ],
    redFlags: [
      'Undrained sepsis (pain, fever, fluctuance) — drain first.',
      'Anterior fistula in a woman, previous obstetric injury or incontinence — no fistulotomy (sphincter-sparing only).',
      'Crohn\'s disease — MRI and gastroenterology co-management.',
    ],
    investigations: [
      { label: 'MRI pelvis (fistula anatomy) for complex or recurrent fistula', urgency: 'routine', tier: 3, category: 'imaging-mri' },
      { label: 'Endoanal ultrasound (sphincter integrity) where available', urgency: 'routine', tier: 2, category: 'imaging-uss' },
    ],
    management: [
      { phase: 'surgical', step: 'EUA to define the tract; drain any abscess.' },
      { phase: 'surgical', step: 'Simple (low) fistula: fistulotomy (lay-open) — ASCRS 2022.' },
      { phase: 'surgical', step: 'Complex fistula: loose draining seton, then sphincter-sparing repair — endorectal advancement flap or LIFT (ligation of intersphincteric fistula tract); no cutting of significant sphincter.' },
      { phase: 'followup', step: 'Review healing and continence; MRI if recurrence.' },
    ],
    referral: 'Colorectal surgery.',
  },

  // ── Gallstones without cholecystitis (biliary colic / asymptomatic) ──────────────────
  {
    diseaseId: 'biliary_colic',
    icd10Prefixes: ['K80.2', 'K80.8', 'K82.8', 'K82.4'],
    label: 'Gallstones — Biliary Colic / Asymptomatic Gallstones / Gallbladder Polyp',
    kind: 'surgical',
    guidelines: ['NICE CG188 (2014) gallstone disease', 'ESGAR/EAES/EFISDS/ESGE 2022 gallbladder polyps'],
    keyPoints: [
      'Asymptomatic gallstones found incidentally: reassure — cholecystectomy is not indicated (NICE CG188); advise to return if symptoms develop.',
      'Symptomatic gallstones (biliary colic): offer laparoscopic cholecystectomy (NICE CG188); antibiotics are not indicated for uncomplicated biliary colic.',
      'Gallbladder polyp ≥ 10 mm: cholecystectomy (malignancy risk); 6–9 mm with risk factors: cholecystectomy or surveillance (2022 joint guideline).',
    ],
    redFlags: [
      'Return urgently with jaundice, fever or rigors (cholangitis), persistent pain > 6 h or vomiting (cholecystitis, pancreatitis).',
      'Gallbladder polyp ≥ 10 mm or growing — gallbladder cancer risk; cholecystectomy.',
    ],
    investigations: [
      { label: 'LFTs, FBC, amylase/lipase (complications)', urgency: 'routine', tier: 1, category: 'bloods' },
      { label: 'Ultrasound abdomen (stones, wall, CBD, polyps)', urgency: 'routine', tier: 2, category: 'imaging-uss' },
      { label: 'MRCP only if LFTs are abnormal or the CBD is dilated (NICE CG188)', urgency: 'routine', tier: 3, category: 'imaging-mri', conditional: 'Abnormal LFTs or dilated CBD' },
    ],
    management: [
      { phase: 'conservative', step: 'Asymptomatic gallstones: reassure; cholecystectomy not indicated; safety-net — return if symptoms develop (NICE CG188).' },
      { phase: 'conservative', step: 'Biliary colic: simple analgesia; low-fat diet may reduce attacks; antibiotics are not indicated (no infection).' },
      { phase: 'surgical', step: 'Symptomatic gallstones: elective laparoscopic cholecystectomy (NICE CG188).' },
      { phase: 'surgical', step: 'Gallbladder polyp ≥ 10 mm: laparoscopic cholecystectomy; 6–9 mm with risk factors: cholecystectomy or ultrasound surveillance (2022 joint guideline).' },
    ],
    referral: 'General surgery — elective.',
  },

  // ── Dyspepsia / H. pylori test and treat ─────────────────────────────────────────────
  {
    diseaseId: 'dyspepsia',
    icd10Prefixes: ['K30', 'R10.13'],
    label: 'Dyspepsia (uninvestigated) / H. pylori Test-and-Treat',
    kind: 'medical',
    guidelines: ['NICE CG184 (2014, updated 2019) GORD and dyspepsia in adults', 'NICE NG12 (2015, updated 2023) suspected cancer', 'Maastricht VI/Florence consensus (2022)'],
    allergyAlternatives: {
      penicillin: 'Penicillin allergy: bismuth quadruple therapy for 14 days — PPI + bismuth + tetracycline + metronidazole (Maastricht VI 2022); or PPI + clarithromycin + metronidazole for 7 days (NICE CG184) if no recent macrolide use.',
    },
    keyPoints: [
      'No alarm features and under 55: H. pylori test-and-treat (urea breath test or stool antigen) or a 4-week full-dose PPI trial (NICE CG184).',
      'Age ≥ 55 with weight loss and upper abdominal pain, reflux or dyspepsia — suspected cancer pathway OGD within 2 weeks (NICE NG12).',
      'Stop PPI 2 weeks (antibiotics 4 weeks) before H. pylori testing.',
    ],
    redFlags: [
      'Dysphagia, GI bleeding, weight loss, persistent vomiting, iron-deficiency anaemia, age ≥ 55 with alarm features — urgent OGD.',
    ],
    investigations: [
      { label: 'H. pylori test: urea breath test or stool antigen (off PPI for 2 weeks)', urgency: 'routine', tier: 1, category: 'other' },
      { label: 'FBC (anaemia)', urgency: 'routine', tier: 1, category: 'bloods' },
      { label: 'OGD ± biopsy if alarm features, age ≥ 55 criteria, or refractory symptoms', urgency: 'routine', tier: 3, category: 'endoscopy', conditional: 'Alarm features or refractory symptoms' },
    ],
    management: [
      { phase: 'conservative', step: 'Lifestyle: weight loss, smaller meals, reduce alcohol and caffeine, stop smoking; review NSAIDs and other causative drugs.' },
      { phase: 'conservative', step: 'Test-and-treat H. pylori, or full-dose PPI (e.g. omeprazole 20 mg once daily) for 4 weeks (NICE CG184).' },
      { phase: 'conservative', step: 'H. pylori positive: PPI + amoxicillin + clarithromycin (or metronidazole) — 7 days per NICE CG184; Maastricht VI (2022) prefers 14-day bismuth quadruple therapy where clarithromycin resistance is high.' },
      { phase: 'followup', step: 'Retest after eradication only if indicated (e.g. peptic ulcer); OGD for persistent symptoms or alarm features.' },
    ],
    medications: [
      { drugName: 'Omeprazole', dose: '20 mg', frequency: 'OD for 4 weeks', route: 'PO (oral)', indication: 'Full-dose PPI trial (NICE CG184)', phase: 'conservative' },
    ],
    referral: 'Gastroenterology / endoscopy for alarm features.',
  },

  // ── Eosinophilic oesophagitis ──────────────────────────────────────────────────────────
  {
    diseaseId: 'eosinophilic_oesophagitis',
    icd10Prefixes: ['K20.0'],
    label: 'Eosinophilic Oesophagitis',
    kind: 'medical',
    guidelines: ['BSG 2022 joint guideline on eosinophilic oesophagitis in children and adults'],
    keyPoints: [
      'Young atopic adult with dysphagia or recurrent food bolus — eosinophilic oesophagitis until biopsies say otherwise.',
      'At least six oesophageal biopsies from at least two levels (proximal and distal), even if the mucosa looks normal (BSG 2022).',
      'Treatment: PPI, topical steroid (budesonide orodispersible) or dietary elimination; dilatation for strictures.',
    ],
    redFlags: ['Food bolus with inability to swallow saliva — emergency endoscopy.'],
    investigations: [
      { label: 'OGD with at least six biopsies from two levels (proximal and distal oesophagus)', urgency: 'urgent', tier: 3, category: 'endoscopy' },
    ],
    management: [
      { phase: 'conservative', step: 'First-line options (BSG 2022): high-dose PPI, topical steroid (budesonide orodispersible or swallowed fluticasone), or dietary elimination with dietitian support.' },
      { phase: 'surgical', step: 'Endoscopic dilatation for fibrostenotic strictures.' },
      { phase: 'followup', step: 'Repeat OGD with biopsies to confirm histological response; gastroenterology follow-up.' },
    ],
    referral: 'Gastroenterology.',
  },

  // ── Food bolus obstruction ─────────────────────────────────────────────────────────────
  {
    diseaseId: 'food_bolus_obstruction',
    icd10Prefixes: ['T18.1', 'T18.0'],
    label: 'Oesophageal Food Bolus Obstruction',
    kind: 'surgical',
    guidelines: ['ESGE 2016 removal of foreign bodies in the upper GI tract', 'BSG 2022 eosinophilic oesophagitis'],
    keyPoints: [
      'Complete obstruction (unable to swallow saliva, drooling) — emergency endoscopy within 6 h (ESGE 2016); otherwise within 24 h.',
      'Push the bolus gently into the stomach or retrieve it endoscopically; take biopsies (eosinophilic oesophagitis, stricture, malignancy).',
    ],
    redFlags: [
      'Unable to swallow saliva — complete obstruction; emergency endoscopy.',
      'Chest pain, fever, surgical emphysema — perforation (CT).',
    ],
    investigations: [
      { label: 'CT chest if perforation suspected; plain films do not show food boluses', urgency: 'urgent', tier: 3, category: 'imaging-ct' },
    ],
    management: [
      { phase: 'immediate', step: `Complete obstruction (drooling, cannot swallow saliva): ${EMERGENCY_REDIRECT}` },
      { phase: 'surgical', step: 'Endoscopic (OGD) removal — gentle push into the stomach or retrieval (net/basket/overtube) — within 6 h if complete obstruction (ESGE 2016).' },
      { phase: 'surgical', step: 'Biopsies at the index endoscopy (six from two levels) to find the cause.' },
      { phase: 'followup', step: 'Treat the cause (EoE, stricture); dietary advice.' },
    ],
    referral: 'Emergency endoscopy.',
  },

  // ── Pharyngeal pouch ───────────────────────────────────────────────────────────────────
  {
    diseaseId: 'pharyngeal_pouch',
    icd10Prefixes: ['K22.5'],
    label: "Pharyngeal Pouch (Zenker's Diverticulum)",
    kind: 'surgical',
    guidelines: ['NICE IPG22 (2003) endoscopic stapling of pharyngeal pouch'],
    keyPoints: [
      'Barium (contrast) swallow is the first investigation; blind endoscopy risks perforation of the pouch.',
      'Treatment for symptomatic pouches: endoscopic stapling / diverticulotomy, flexible endoscopic myotomy (Z-POEM) or open cricopharyngeal myotomy ± diverticulectomy.',
    ],
    redFlags: ['Aspiration pneumonia, weight loss, haemoptysis (rare carcinoma in the pouch).'],
    investigations: [
      { label: 'Barium / contrast swallow', urgency: 'routine', tier: 2, category: 'imaging-xr' },
    ],
    management: [
      { phase: 'conservative', step: 'Small asymptomatic pouch: observation.' },
      { phase: 'surgical', step: 'Symptomatic: endoscopic stapling (diverticulotomy) or flexible endoscopic cricopharyngeal myotomy (Z-POEM); open myotomy ± diverticulectomy for large or failed cases.' },
    ],
    referral: 'ENT / upper GI surgery.',
  },

  // ── Corrosive injury: skin/eye contact or ingestion ─────────────────────────────────────
  {
    diseaseId: 'corrosive_injury',
    icd10Prefixes: ['T54', 'T28.5', 'T28.6', 'T28.7'],
    label: 'Chemical (Corrosive) Injury — Skin/Eye Contact or Ingestion',
    kind: 'emergency',
    guidelines: ['ESGE 2020 caustic ingestion', 'ATLS 10 / BBA chemical burns first aid', 'Royal College of Ophthalmologists — chemical eye injury (2018)'],
    keyPoints: [
      'Skin/eye contact: remove contaminated clothing and irrigate copiously with water immediately (at least 20–30 min; the eye until pH is neutral). Alkali penetrates deeper than acid.',
      'Ingestion: do not induce vomiting, do not give neutralising agents, no blind NG tube; assess the airway first (stridor, drooling, hoarse voice).',
      'Deliberate ingestion: psychiatric assessment once medically safe.',
    ],
    redFlags: [
      'Stridor, hoarseness, drooling after ingestion — airway compromise; anaesthetist.',
      'Chemical eye injury — ophthalmic emergency.',
      'Chest or abdominal pain, peritonism after ingestion — perforation.',
    ],
    investigations: [
      { label: 'Eye: pH of the tear film before and after irrigation; visual acuity; ophthalmology slit-lamp review', urgency: 'stat', tier: 1, category: 'bedside' },
      { label: 'Ingestion: airway assessment by an anaesthetist/ENT (nasendoscopy / laryngoscopy)', urgency: 'stat', tier: 1, category: 'other' },
      { label: 'Ingestion: CT chest and abdomen (transmural necrosis, perforation); endoscopy within 12–48 h if no perforation (ESGE 2020)', urgency: 'urgent', tier: 3, category: 'imaging-ct' },
      { label: 'Blood gas, lactate, FBC, U&E', urgency: 'urgent', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'immediate', step: EMERGENCY_REDIRECT },
      { phase: 'immediate', step: 'Skin/eye: remove contaminated clothing; copious irrigation with running water (at least 20–30 minutes; eye irrigation until the pH is neutral).' },
      { phase: 'immediate', step: 'Ingestion: nil by mouth (NBM); do not induce vomiting and do not give neutralising agents; airway assessment first.' },
      { phase: 'surgical', step: 'Ingestion with perforation or transmural necrosis: emergency surgery.' },
      { phase: 'followup', step: 'Chemical burns: burns unit / plastic surgery discussion by the referral criteria; eye: ophthalmology; deliberate ingestion: psychiatric (mental health) assessment; stricture surveillance after ingestion.' },
    ],
    referral: 'Emergency department; burns service / ophthalmology / upper GI surgery as indicated.',
  },

  // ── Breast lump (triple assessment) ─────────────────────────────────────────────────────
  {
    diseaseId: 'breast_lump',
    icd10Prefixes: ['N63'],
    label: 'Breast Lump — Triple Assessment',
    kind: 'surgical',
    guidelines: ['NICE NG12 (2015, updated 2023) suspected cancer', 'ABS 2019 best practice diagnostic guidelines for patients presenting with breast symptoms'],
    keyPoints: [
      'Triple assessment: clinical examination + imaging (ultrasound under 40; mammography + ultrasound from 40) + core biopsy of any suspicious lesion (ABS 2019).',
      'Suspected cancer pathway (2-week wait) for breast: age ≥ 30 with an unexplained lump; ≥ 50 with unilateral nipple change (NICE NG12). Men ≥ 50 with a unilateral firm subareolar mass also.',
      'No definitive surgery before histology and MDT discussion.',
    ],
    redFlags: [
      'Suspected cancer pathway (2-week wait) referral for breast — age ≥ 30 with an unexplained breast lump (NICE NG12).',
      'Skin tethering, peau d\'orange, fixed mass, axillary nodes — urgent core biopsy.',
    ],
    investigations: [
      { label: 'Ultrasound of the breast and axilla', urgency: 'urgent', tier: 2, category: 'imaging-uss' },
      { label: 'Mammography (from age 40, or if ultrasound is suspicious)', urgency: 'urgent', tier: 2, category: 'imaging-xr' },
      { label: 'Core biopsy (image-guided) of any indeterminate or suspicious lesion', urgency: 'urgent', tier: 3, category: 'other' },
    ],
    management: [
      { phase: 'immediate', step: 'Suspected cancer pathway (2-week wait) referral to the breast clinic when NICE NG12 criteria are met.' },
      { phase: 'immediate', step: 'Pregnant or lactating: ultrasound first; mammography with shielding if needed; core biopsy is safe — a persistent lump in pregnancy must not be attributed to pregnancy changes.' },
      { phase: 'conservative', step: 'Benign concordant triple assessment (e.g. fibroadenoma under 40): reassure and discharge with breast awareness advice.' },
      { phase: 'followup', step: 'Malignant or indeterminate result: breast MDT before any definitive treatment; male breast cancer — genetics referral (BRCA2).' },
    ],
    referral: 'Breast clinic (suspected cancer pathway where criteria are met).',
  },

  // ── Nipple discharge ────────────────────────────────────────────────────────────────────
  {
    diseaseId: 'nipple_discharge',
    icd10Prefixes: ['N64.52', 'N64.53'],
    label: 'Nipple Discharge (single-duct / blood-stained)',
    kind: 'surgical',
    guidelines: ['ABS 2019 breast symptoms diagnostic guidelines', 'NICE NG12 (2015, updated 2023) suspected cancer'],
    keyPoints: [
      'Spontaneous, single-duct or blood-stained discharge needs imaging and specialist assessment: intraductal papilloma, DCIS or carcinoma.',
      'Age ≥ 50 with unilateral nipple discharge or retraction — suspected cancer pathway (2-week wait) for breast (NICE NG12).',
      'Bilateral, multi-duct, non-bloody discharge on expression is usually physiological or duct ectasia.',
    ],
    redFlags: [
      'Suspected cancer pathway (2-week wait) for breast — spontaneous single-duct or bloody discharge, age ≥ 50 (NICE NG12).',
    ],
    investigations: [
      { label: 'Mammography (from 40) and ultrasound of the breast / retroareolar region', urgency: 'urgent', tier: 2, category: 'imaging-uss' },
      { label: 'Core biopsy of any imaging abnormality; discharge cytology is of limited value', urgency: 'urgent', tier: 3, category: 'other' },
    ],
    management: [
      { phase: 'immediate', step: 'Breast clinic referral — suspected cancer pathway (2-week wait) when NICE NG12 criteria are met; offer reassurance only after imaging (and cytology or biopsy where indicated) is normal.' },
      { phase: 'surgical', step: 'Persistent single-duct blood-stained discharge with normal imaging: microdochectomy (single duct excision) for histology.' },
      { phase: 'followup', step: 'Breast MDT review of imaging and histology.' },
    ],
    referral: 'Breast clinic.',
  },

  // ── Mastalgia ───────────────────────────────────────────────────────────────────────────
  {
    diseaseId: 'mastalgia',
    icd10Prefixes: ['N64.4'],
    label: 'Breast Pain (Mastalgia)',
    kind: 'medical',
    guidelines: ['ABS 2019 breast symptoms diagnostic guidelines'],
    keyPoints: [
      'Cyclical breast pain with a normal examination does not need imaging and is not a cancer symptom (ABS 2019).',
      'Reassurance, a well-fitting bra and topical NSAID help most women.',
    ],
    redFlags: ['Pain with a lump, skin change or nipple change — triple assessment.'],
    investigations: [],
    management: [
      { phase: 'conservative', step: 'Reassurance and explanation; well-fitting supportive bra; topical NSAID gel; pain diary.' },
      { phase: 'followup', step: 'Review if pain persists beyond 3 months or a lump / skin change develops.' },
    ],
    referral: 'Breast clinic only if focal signs develop.',
  },

  // ── B12 Post-thyroidectomy hypocalcaemia ─────────────────────────────────────────────
  {
    diseaseId: 'post_thyroidectomy_hypocalcaemia',
    icd10Prefixes: ['E89.2', 'E83.51', 'E20.8'],
    label: 'Post-thyroidectomy Hypocalcaemia (hypoparathyroidism)',
    kind: 'medical',
    guidelines: ['Society for Endocrinology emergency guidance: acute hypocalcaemia (2016)', 'BAETS 2021 post-thyroidectomy hypocalcaemia guidance'],
    keyPoints: [
      'Check adjusted calcium (and PTH) after total or completion thyroidectomy; perioral tingling, cramps, carpopedal spasm, Chvostek/Trousseau signs, prolonged QT.',
      'Severe or symptomatic (or calcium < 1.9 mmol/L): IV calcium gluconate with ECG monitoring (SfE 2016).',
      'Correct magnesium; start oral calcium and active vitamin D (alfacalcidol or calcitriol).',
    ],
    redFlags: [
      'Adjusted calcium < 1.9 mmol/L, tetany, seizures, laryngospasm or arrhythmia — IV calcium now.',
    ],
    investigations: [
      { label: 'Adjusted calcium, PTH, magnesium, phosphate, U&E', urgency: 'stat', tier: 1, category: 'bloods' },
      { label: '12-lead ECG (QT) and cardiac monitoring during IV calcium', urgency: 'stat', tier: 1, category: 'bedside' },
    ],
    management: [
      { phase: 'immediate', step: 'Severe/symptomatic: calcium gluconate 10% 10–20 mL IV in 50–100 mL of 5% glucose over 10 minutes with ECG monitoring, then a calcium gluconate infusion per SfE 2016.' },
      { phase: 'immediate', step: 'Correct hypomagnesaemia (IV magnesium) — hypocalcaemia will not correct otherwise.' },
      { phase: 'conservative', step: 'Oral calcium (e.g. calcium carbonate) and active vitamin D (alfacalcidol or calcitriol), titrated to calcium.' },
      { phase: 'followup', step: 'Calcium monitoring; endocrine/thyroid surgery follow-up for persistent hypoparathyroidism.' },
    ],
    medications: [
      { drugName: 'Calcium gluconate 10%', dose: '10–20 mL in 50–100 mL 5% glucose over 10 min', frequency: 'Then infusion per SfE 2016', route: 'IV (intravenous)', indication: 'Severe / symptomatic hypocalcaemia (SfE 2016)', phase: 'immediate' },
      { drugName: 'Alfacalcidol', dose: 'Per endocrine advice', frequency: 'OD', route: 'PO (oral)', indication: 'Post-surgical hypoparathyroidism', phase: 'conservative' },
    ],
    referral: 'Endocrine / thyroid surgery.',
  },

  // ── B16 Amoebic liver abscess ───────────────────────────────────────────────────────────
  {
    diseaseId: 'amoebic_liver_abscess',
    icd10Prefixes: ['A06.4'],
    label: 'Amoebic Liver Abscess',
    kind: 'medical',
    guidelines: ['BNF — metronidazole (extra-intestinal amoebiasis) and luminal amoebicides (guideline source to be confirmed by the surgeon)'],
    keyPoints: [
      'Most amoebic abscesses resolve with metronidazole alone; aspiration/drainage only if no response in 3–5 days, imminent rupture, or left-lobe abscess.',
      'Follow with a luminal amoebicide (paromomycin or diloxanide furoate) to clear intestinal cysts.',
      'Serology (Entamoeba histolytica) confirms; travel/residence history in endemic areas.',
    ],
    redFlags: [
      'Left-lobe abscess (pericardial rupture risk), large abscess or rupture — drainage.',
      'No clinical response after 3–5 days of metronidazole — aspiration.',
    ],
    investigations: [
      { label: 'Entamoeba histolytica serology; FBC, LFTs, CRP', urgency: 'urgent', tier: 1, category: 'bloods' },
      { label: 'Ultrasound (or CT) liver', urgency: 'urgent', tier: 2, category: 'imaging-uss' },
    ],
    management: [
      { phase: 'conservative', step: 'Amoebic abscess: metronidazole (extra-intestinal amoebiasis dose per BNF, 5–10 days), then a luminal agent — paromomycin or diloxanide furoate.' },
      { phase: 'surgical', step: 'Aspiration / drainage only if no response in 3–5 days, imminent rupture or left-lobe abscess.' },
      { phase: 'followup', step: 'Clinical review; imaging resolution lags clinical recovery.' },
    ],
    medications: [
      { drugName: 'Metronidazole', dose: 'Per BNF (extra-intestinal amoebiasis)', frequency: 'TDS for 5–10 days', route: 'PO (oral)', indication: 'Amoebic liver abscess (BNF)', phase: 'conservative' },
    ],
    referral: 'Hepatobiliary surgery / infectious diseases.',
  },

  // ── G2.17 Obstructed infected kidney ─────────────────────────────────────────────────
  {
    diseaseId: 'obstructed_infected_kidney',
    icd10Prefixes: ['N13.6'],
    label: 'Obstructed Infected Kidney (pyonephrosis)',
    kind: 'surgical',
    guidelines: ['EAU 2024 urolithiasis', 'EAU 2024 urological infections'],
    keyPoints: [
      'An obstructed, infected kidney is a urological emergency: urgent decompression (percutaneous nephrostomy or retrograde ureteric stent) plus antibiotics; definitive stone treatment is delayed until the infection has resolved (EAU 2024).',
      'Do not give medical expulsive therapy or attempt definitive stone treatment while infected.',
      'Avoid NSAIDs in AKI, a solitary kidney or anuria.',
    ],
    redFlags: [
      'Fever with loin pain and an obstructing stone — obstructed infected kidney (pyonephrosis); emergency decompression.',
      'Anuria / solitary kidney — emergency decompression.',
    ],
    investigations: [
      { label: 'Blood cultures, urine culture, FBC, U&E, CRP, lactate', urgency: 'stat', tier: 1, category: 'microbiology' },
      { label: 'CT KUB (or ultrasound) to confirm obstruction', urgency: 'stat', tier: 3, category: 'imaging-ct' },
    ],
    management: [
      { phase: 'immediate', step: EMERGENCY_REDIRECT },
      { phase: 'immediate', step: 'Sepsis pathway: IV antibiotics per local policy after cultures; fluids.' },
      { phase: 'surgical', step: 'Urgent decompression by urology: percutaneous nephrostomy or retrograde ureteric (JJ) stent (EAU 2024).' },
      { phase: 'followup', step: 'Definitive stone treatment after the infection has resolved.' },
    ],
    referral: 'Emergency urology.',
  },

  // ── Pyelonephritis ─────────────────────────────────────────────────────────────────────
  {
    diseaseId: 'pyelonephritis',
    icd10Prefixes: ['N10', 'N11', 'N12', 'O23.0'],
    label: 'Acute Pyelonephritis',
    kind: 'medical',
    guidelines: ['NICE NG111 (2018) pyelonephritis (acute): antimicrobial prescribing', 'EAU 2024 urological infections'],
    keyPoints: [
      'Send a midstream urine (MSU) culture before antibiotics.',
      'Non-pregnant (NICE NG111): cefalexin, co-amoxiclav (if culture-sensitive), trimethoprim (if sensitive) or ciprofloxacin (not in pregnancy); IV options when severe.',
      'Pregnancy (NICE NG111): cefalexin orally, or IV cefuroxime if severely unwell; obstetric team involvement; avoid quinolones in pregnancy, and trimethoprim in the first trimester.',
    ],
    redFlags: [
      'Sepsis, vomiting, pregnancy with systemic features — admission.',
      'Fever persisting > 48–72 h on antibiotics, or known stone — ultrasound/CT for obstruction or abscess.',
    ],
    investigations: [
      { label: 'Midstream urine (MSU) culture and sensitivity before antibiotics', urgency: 'urgent', tier: 1, category: 'microbiology' },
      { label: 'FBC, U&E, CRP; blood cultures if systemically unwell', urgency: 'urgent', tier: 1, category: 'bloods' },
      { label: 'Renal tract ultrasound if obstruction, stone or non-response', urgency: 'urgent', tier: 2, category: 'imaging-uss' },
    ],
    management: [
      { phase: 'conservative', step: 'Non-pregnant adult (NICE NG111): cefalexin, or co-amoxiclav (only if culture-sensitive), or ciprofloxacin; severe — IV ceftriaxone, cefuroxime or gentamicin per local policy.', onlyIf: 'not-pregnant' },
      { phase: 'conservative', step: 'Pregnant (NICE NG111): cefalexin orally, or IV cefuroxime if severely unwell; obstetric team involvement and fetal wellbeing assessment.', onlyIf: 'pregnant' },
      { phase: 'immediate', step: `Sepsis or unable to take oral fluids: ${EMERGENCY_REDIRECT}` },
      { phase: 'followup', step: 'Review culture results and switch to the narrowest effective agent; recurrent infection — urology review.' },
    ],
    referral: 'Acute medicine / urology; obstetrics in pregnancy.',
  },

  // ── Iron-deficiency anaemia ────────────────────────────────────────────────────────────
  {
    diseaseId: 'iron_deficiency_anaemia',
    icd10Prefixes: ['D50'],
    label: 'Iron-deficiency Anaemia',
    kind: 'medical',
    guidelines: ['BSG 2021 guidelines for the management of iron deficiency anaemia in adults', 'NICE NG12 (2015, updated 2023) suspected cancer'],
    keyPoints: [
      'Confirmed iron-deficiency anaemia in men and post-menopausal women needs bidirectional endoscopy (OGD + colonoscopy or CT colonography) — BSG 2021.',
      'Coeliac serology and urinalysis in every patient (BSG 2021).',
      'Age ≥ 60 with iron-deficiency anaemia — suspected colorectal cancer pathway (NICE NG12).',
    ],
    redFlags: [
      'Iron-deficiency anaemia in a man or post-menopausal woman — suspected GI cancer until investigated.',
    ],
    investigations: [
      { label: 'FBC, ferritin (iron studies), B12, folate', urgency: 'urgent', tier: 1, category: 'bloods' },
      { label: 'Coeliac serology (tissue transglutaminase antibody)', urgency: 'urgent', tier: 1, category: 'bloods' },
      { label: 'Urinalysis (renal tract malignancy)', urgency: 'urgent', tier: 1, category: 'bedside' },
      { label: 'Bidirectional endoscopy: OGD + colonoscopy (or CT colonography)', urgency: 'urgent', tier: 3, category: 'endoscopy' },
    ],
    management: [
      { phase: 'immediate', step: 'Suspected cancer pathway (2-week wait) for lower GI investigation when NICE NG12 criteria are met (e.g. ≥ 60 with iron-deficiency anaemia).' },
      { phase: 'conservative', step: 'Iron replacement: oral ferrous sulfate 200 mg once daily (BSG 2021); IV iron if oral iron is not tolerated, ineffective or the deficit is severe.' },
      { phase: 'followup', step: 'Check Hb response at 2–4 weeks; continue iron for 3 months after Hb normalises; investigate the cause even if Hb corrects.' },
    ],
    medications: [
      { drugName: 'Ferrous sulfate', dose: '200 mg', frequency: 'Once daily', route: 'PO (oral)', indication: 'Iron deficiency (BSG 2021)', phase: 'conservative' },
    ],
    referral: 'Gastroenterology / lower GI suspected cancer pathway.',
  },

  // ── FIT-positive / suspected colorectal cancer ─────────────────────────────────────────
  {
    diseaseId: 'suspected_colorectal_cancer_referral',
    icd10Prefixes: ['R19.5', 'K62.5', 'R19.4'],
    label: 'Rectal Bleeding / FIT-positive / Change in Bowel Habit — Suspected Colorectal Cancer Pathway',
    kind: 'medical',
    guidelines: ['NICE DG56 (2023) FIT for suspected colorectal cancer', 'BSG/ACPGBI 2022 FIT in patients with signs or symptoms of colorectal cancer', 'NICE NG12 (2015, updated 2023) suspected cancer'],
    keyPoints: [
      'FIT ≥ 10 µg Hb/g faeces in a symptomatic patient — suspected colorectal cancer pathway (2-week wait) referral for colonoscopy (NICE DG56).',
      'Rectal bleeding with change in bowel habit, weight loss or iron-deficiency anaemia needs colonoscopy at any age; under 50, NG12 advises considering a suspected cancer referral.',
      'Do not attribute bleeding to haemorrhoids without examining the whole colon when red-flag features are present.',
    ],
    redFlags: [
      'Positive FIT (faecal immunochemical test ≥ 10 µg/g) — suspected colorectal cancer pathway.',
      'Rectal bleeding with weight loss, change in bowel habit or iron-deficiency anaemia.',
    ],
    investigations: [
      { label: 'FIT (faecal immunochemical test) if not done; FBC, ferritin', urgency: 'urgent', tier: 1, category: 'bloods' },
      { label: 'Urgent colonoscopy (or CT colonography if colonoscopy is unsuitable)', urgency: 'urgent', tier: 3, category: 'endoscopy' },
      { label: 'Digital rectal examination', urgency: 'urgent', tier: 1, category: 'bedside' },
    ],
    management: [
      { phase: 'immediate', step: 'Suspected cancer pathway (2-week wait) referral for urgent colonoscopy when NICE DG56 / NG12 criteria are met.' },
      { phase: 'immediate', step: `Heavy bleeding or haemodynamic instability: ${EMERGENCY_REDIRECT}` },
      { phase: 'followup', step: 'Histology-led management; colorectal MDT if cancer is confirmed.' },
    ],
    referral: 'Colorectal suspected cancer pathway (2-week wait).',
  },

  // ── Colorectal polyps (planned polypectomy / EMR; surveillance) ───────────────────────
  {
    diseaseId: 'colorectal_polyp',
    icd10Prefixes: ['D12', 'K63.5', 'K62.1'],
    label: 'Colorectal Polyp — Polypectomy / EMR Planning and Surveillance',
    kind: 'procedure',
    guidelines: ['BSG/ACPGBI/PHE 2020 post-polypectomy and post-colorectal cancer resection surveillance', 'BSG/ESGE 2021 endoscopy on antiplatelets/anticoagulants', 'ESGE 2017 colorectal polypectomy and EMR'],
    keyPoints: [
      'Polypectomy and EMR are high-risk endoscopic procedures for antithrombotic management (BSG/ESGE 2021).',
      'Surveillance (BSG/ACPGBI/PHE 2020): high-risk findings (≥ 2 premalignant polyps with ≥ 1 advanced, or ≥ 5 premalignant polyps) — one-off colonoscopy at 3 years; low-risk findings — no colonoscopic surveillance, return to population screening.',
      'Piecemeal EMR of a polyp ≥ 20 mm — site check at 2–6 months, then a further site check (BSG/ACPGBI/PHE 2020).',
    ],
    redFlags: [
      'Large (> 20 mm) or suspicious (non-lifting, depressed) polyp — expert EMR/ESD centre; histology before surgery.',
    ],
    investigations: [
      { label: 'Colonoscopy with polypectomy / EMR (high-risk procedure — plan antithrombotics)', urgency: 'routine', tier: 3, category: 'endoscopy' },
      { label: 'FBC, clotting only if on anticoagulants or bleeding disorder', urgency: 'routine', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'surgical', step: 'Polypectomy / EMR (ESGE 2017); tattoo large or suspicious lesions; retrieve for histology.' },
      { phase: 'followup', step: 'After piecemeal resection of a polyp ≥ 20 mm: site-check colonoscopy at 2–6 months, then at 12 months, before any routine surveillance (BSG/ACPGBI/PHE 2020). Otherwise, high-risk findings (≥ 2 premalignant polyps including ≥ 1 advanced, or ≥ 5 premalignant): one-off surveillance at three years (BSG/ACPGBI/PHE 2020).' },
      { phase: 'followup', step: 'Low-risk findings: no colonoscopic surveillance — return to routine population screening (BSG/ACPGBI/PHE 2020).' },
      { phase: 'followup', step: 'Piecemeal EMR of a polyp ≥ 20 mm: site check at 2–6 months, then a further site check at the BSG 2020 interval.' },
    ],
    referral: 'Endoscopy / colorectal.',
  },

  // ── Diabetes-related foot disease ─────────────────────────────────────────────────────
  {
    diseaseId: 'diabetic_foot',
    icd10Prefixes: ['E11.621', 'E10.621', 'E11.52', 'E10.52', 'E13.621', 'L97'],
    label: 'Diabetes-related Foot Ulcer / Infection',
    kind: 'surgical',
    guidelines: ['IWGDF/IDSA 2023 guidelines on diabetes-related foot infections', 'IWGDF 2023 offloading and PAD guidelines', 'NICE NG19 (2015, updated 2019) diabetic foot problems'],
    keyPoints: [
      'Grade infection by IWGDF/IDSA (1 uninfected, 2 mild, 3 moderate, 4 severe; "(O)" for osteomyelitis).',
      'Probe-to-bone, plain X-ray, then MRI or bone biopsy/culture for suspected osteomyelitis; deep tissue (not swab) cultures.',
      'Every diabetic foot ulcer: vascular assessment (pulses, ABPI and toe pressures — ABPI is falsely high with calcified arteries), offloading, and multidisciplinary foot care service referral within 1 working day (NICE NG19).',
    ],
    redFlags: [
      'Severe infection (systemic toxicity), abscess, wet gangrene, necrotising infection — emergency surgery (debridement/drainage/amputation).',
      'Absent pulses or toe pressure < 30 mmHg — chronic limb-threatening ischaemia; vascular surgery.',
    ],
    investigations: [
      { label: 'Plain X-ray of the foot (osteomyelitis, gas, Charcot)', urgency: 'urgent', tier: 2, category: 'imaging-xr' },
      { label: 'Deep tissue sample / bone culture (curettage or biopsy), not superficial swab', urgency: 'urgent', tier: 1, category: 'microbiology' },
      { label: 'MRI foot (or bone biopsy) if osteomyelitis is suspected and the X-ray is equivocal', urgency: 'urgent', tier: 3, category: 'imaging-mri' },
      { label: 'Vascular assessment: pulses, ABPI, toe pressures / TBI, arterial duplex', urgency: 'urgent', tier: 2, category: 'imaging-uss' },
      { label: 'FBC, CRP, U&E, HbA1c, glucose', urgency: 'urgent', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'immediate', step: 'Severe infection / wet gangrene / abscess: emergency surgical debridement and drainage, IV antibiotics, glycaemic control; vascular surgery review.' },
      { phase: 'conservative', step: 'Antibiotics only if infected (IWGDF/IDSA 2023 grade 2–4 — not for an uninfected ulcer). Mild–moderate infection: antibiotic per IWGDF/IDSA 2023 and local policy (e.g. flucloxacillin, or doxycycline/clarithromycin if penicillin-allergic; co-amoxiclav for moderate); osteomyelitis — 6 weeks (3 weeks after resection).' },
      { phase: 'conservative', step: 'Offloading: non-removable knee-high offloading device (total contact cast) for plantar ulcers (IWGDF 2023); debridement of callus and necrotic tissue.' },
      { phase: 'followup', step: 'Multidisciplinary foot care service / podiatry within 1 working day (NICE NG19); vascular surgery if ischaemic; foot protection education.' },
    ],
    referral: 'Multidisciplinary foot care service; vascular surgery if ischaemic; emergency surgery if severe.',
  },

  // ── Charcot neuro-osteoarthropathy ──────────────────────────────────────────────────
  {
    diseaseId: 'charcot_foot',
    icd10Prefixes: ['E11.610', 'E10.610', 'M14.6'],
    label: 'Active Charcot Neuro-osteoarthropathy',
    kind: 'medical',
    guidelines: ['IWGDF/ADA 2023 Charcot neuro-osteoarthropathy guideline', 'NICE NG19 (2015, updated 2019)'],
    keyPoints: [
      'A warm, swollen, red foot in a person with neuropathy is active Charcot until proven otherwise — often misdiagnosed as cellulitis or gout.',
      'MRI when the X-ray is normal; immobilise and offload immediately in a non-removable knee-high device (total contact cast) — IWGDF 2023.',
    ],
    redFlags: ['Temperature difference > 2 °C with swelling in a neuropathic foot — active Charcot; urgent foot service.'],
    investigations: [
      { label: 'Plain X-ray of the foot and ankle (weight-bearing if possible)', urgency: 'urgent', tier: 2, category: 'imaging-xr' },
      { label: 'MRI foot if X-ray normal (early Charcot)', urgency: 'urgent', tier: 3, category: 'imaging-mri' },
    ],
    management: [
      { phase: 'conservative', step: 'Immobilise and offload immediately: non-removable knee-high device (total contact cast) until remission (IWGDF 2023).' },
      { phase: 'followup', step: 'Urgent multidisciplinary foot care service referral (within 1 working day, NICE NG19); serial temperature monitoring.' },
    ],
    referral: 'Multidisciplinary foot care service (urgent).',
  },

  // ── Pre-operative assessment ────────────────────────────────────────────────────────────
  {
    diseaseId: 'preoperative_assessment',
    icd10Prefixes: ['Z01.81', 'Z01.818', 'Z01.810', 'Z01.811', 'Z01.812'],
    label: 'Pre-operative Assessment',
    kind: 'procedure',
    guidelines: ['NICE NG45 (2016) routine preoperative tests for elective surgery', 'CPOC 2021 perioperative diabetes', 'ESC/ESAIC 2022 non-cardiac surgery', 'AAGBI 2020 steroid cover; NAP6 2018'],
    keyPoints: [
      'Functional capacity (e.g. able to climb two flights of stairs, ≥ 4 METs), ASA grade and RCRI guide further cardiac assessment (ESC/ESAIC 2022).',
      'Routine tests by ASA and surgical grade (NICE NG45): no routine coagulation tests unless on anticoagulants, liver disease or a bleeding history.',
      'Medicines plan: anticoagulants, antiplatelets, SGLT2 inhibitors, other diabetes drugs, steroids — see the patient-specific lines below.',
    ],
    redFlags: [
      'Recent coronary stent or ACS, unstable cardiac symptoms, new AF — defer elective surgery and involve cardiology.',
      'Anaesthetic hazards: malignant hyperthermia history, suxamethonium apnoea, latex allergy, suspected OSA — alert the anaesthetist.',
    ],
    investigations: [
      { label: 'Tests per NICE NG45 by ASA grade × surgical grade — e.g. FBC, U&E, HbA1c if diabetic; cardiac and other tests only where NG45 indicates them for the comorbidity and grade of surgery (ASA 1 for minor or intermediate surgery: usually none)', urgency: 'routine', tier: 1, category: 'bloods' },
      { label: 'Coagulation tests only if on anticoagulants, liver disease or bleeding history (NICE NG45)', urgency: 'routine', tier: 1, category: 'bloods', conditional: 'Anticoagulants / liver disease / bleeding history' },
    ],
    management: [
      { phase: 'surgical', step: 'Confirm the indication, consent and the operation date; ASA grade and functional capacity documented.' },
      { phase: 'surgical', step: 'Fasting: 6 h for food and 2 h for clear fluids before anaesthesia (AAGBI/ESA); encourage clear fluids until 2 h.' },
      { phase: 'surgical', step: 'Dialysis patients: dialysis the day before surgery with a potassium check on the day; renal team input.' },
      { phase: 'followup', step: 'Anaesthetic pre-assessment clinic for ASA ≥ 3, poor functional capacity, OSA, or anaesthetic hazards.' },
    ],
    referral: 'Anaesthetic pre-assessment clinic.',
  },

  // ── Post-operative delirium ─────────────────────────────────────────────────────────────
  {
    diseaseId: 'delirium',
    icd10Prefixes: ['F05'],
    label: 'Delirium (including post-operative)',
    kind: 'medical',
    guidelines: ['NICE CG103 (2010, updated 2023) delirium'],
    keyPoints: [
      'Screen with the 4AT; hypoactive delirium is common and easily missed.',
      'Look for causes: infection, hypoxia, pain, urinary retention, constipation, dehydration, electrolytes, glucose, drugs (opioids, anticholinergics, benzodiazepines, cyclizine), alcohol withdrawal.',
      'Non-pharmacological measures first; antipsychotics only for severe distress or risk (NICE CG103).',
    ],
    redFlags: ['New confusion after surgery — look for sepsis, anastomotic leak, hypoxia or retention.'],
    investigations: [
      { label: '4AT; observations/NEWS2; capillary glucose', urgency: 'urgent', tier: 1, category: 'bedside' },
      { label: 'FBC, U&E, calcium, glucose, CRP, LFTs; urinalysis; bladder scan', urgency: 'urgent', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'immediate', step: 'Treat the cause; medication review — stop or reduce opioids, anticholinergics, sedatives and cyclizine where possible.' },
      { phase: 'conservative', step: 'Non-pharmacological care: reorientation, glasses and hearing aids, family involvement, sleep hygiene, hydration, early mobilisation, bowel and bladder care (NICE CG103).' },
      { phase: 'followup', step: 'Delirium risk carries forward — document and hand over; memory follow-up if cognition does not recover.' },
    ],
    referral: 'Geriatric medicine / liaison psychiatry if severe or persistent.',
  },

  // ── Early post-operative fever ─────────────────────────────────────────────────────────
  {
    diseaseId: 'postoperative_fever',
    icd10Prefixes: ['R50.82', 'T88.4'],
    label: 'Post-operative Pyrexia',
    kind: 'medical',
    guidelines: ['NICE NG125 (2019) surgical site infection; post-operative fever evaluation (clinical practice)'],
    keyPoints: [
      'Fever in the first 48 h is usually the inflammatory response or atelectasis — examine; do not start antibiotics reflexively.',
      'Day 3–7: consider pneumonia, UTI, wound infection, line infection, anastomotic leak or collection; after day 5 think of VTE and deep collections.',
    ],
    redFlags: ['Fever with tachycardia, rising CRP/lactate or peritonism after bowel surgery — anastomotic leak until proven otherwise.'],
    investigations: [
      { label: 'Examine the chest, wound, lines, calves and abdomen; urinalysis', urgency: 'urgent', tier: 1, category: 'bedside' },
      { label: 'FBC, CRP (trend), blood cultures if > 38 °C with systemic features', urgency: 'urgent', tier: 1, category: 'bloods' },
    ],
    management: [
      { phase: 'conservative', step: 'Early (≤ 48 h), well patient: chest physiotherapy, deep breathing / incentive spirometry, mobilisation, analgesia; review the wound; no broad-spectrum antibiotics without a source.' },
      { phase: 'conservative', step: 'Identified source: treat the source (targeted antibiotics, drainage).' },
    ],
    referral: 'Surgical team review.',
  },
];
