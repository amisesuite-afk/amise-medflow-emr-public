/**
 * ConsultContextBanner
 *
 * Algorithm-derived hints for the current consultation section, pulled
 * from the active CC matrix and a condition-specific supplement table.
 * Appears between the workflow progress bar and the section content to
 * give the clinician section-specific focus points without a separate
 * reference lookup.
 */

import { useAppContext, type Section } from '@/context/AppContext';
import { getMatrix, type CCTemplate } from '@/lib/cc-matrices';

// ── Per-section, per-condition clinical prompts ───────────────────────────────
// Supplements the CC matrix (which covers labs/imaging/DDx/pearl) with
// condition-specific focuses for history-taking sections.

interface SectionHints {
  pmh?: string[];
  surgical?: string[];
  medications?: string[];
  allergies?: string[];
  family_hx?: string[];
  ros?: string[];
}

const CC_SECTION_HINTS: Record<string, SectionHints> = {
  acute_abdominal_pain: {
    pmh: ['Previous similar episodes', 'IBD / Crohn\'s', 'Diabetes', 'Peptic ulcer disease', 'Malignancy', 'Pregnancy / LMP'],
    surgical: ['Previous abdominal surgery (adhesions)', 'Prior hernia repair', 'Appendicectomy'],
    medications: ['NSAIDs / steroids (ulcer risk)', 'Anticoagulants', 'Opioids (constipation)', 'OCPs (ectopic / thrombosis)'],
    allergies: ['Penicillin / cephalosporins', 'Metronidazole', 'Contrast media'],
    ros: ['Anorexia / nausea / vomiting', 'Fever / rigors', 'Jaundice / dark urine', 'PR bleeding / altered stool', 'Urinary symptoms', 'Last menstrual period'],
  },

  acute_appendicitis: {
    pmh: ['Previous similar episodes', 'IBD / Crohn\'s', 'Immunosuppression', 'Malignancy (caecal tumour)'],
    surgical: ['Previous appendicectomy', 'Previous abdominal surgery'],
    medications: ['Immunosuppressants (atypical presentation)', 'NSAIDs', 'Antibiotics (may mask)'],
    allergies: ['Penicillin / cephalosporins', 'Metronidazole'],
    family_hx: ['Colorectal cancer', 'IBD'],
    ros: ['Anorexia (classic — present > 90%)', 'Nausea / vomiting', 'Low-grade fever', 'Urinary symptoms (retrocaecal)', 'Diarrhoea (pelvic appendix)'],
  },

  acute_cholecystitis: {
    pmh: ['Diabetes', 'Haemolytic anaemia (pigment stones)', 'Crohn\'s disease (bile salt malabsorption)', 'Rapid weight loss', 'TPN use', 'Previous biliary episodes', 'Hypercholesterolaemia'],
    surgical: ['Previous cholecystectomy (bile leak / retained stone)', 'Previous ERCP', 'Prior upper abdominal surgery'],
    medications: ['Oral contraceptives (gallstone risk)', 'Fibrates', 'Ceftriaxone', 'Statins', 'Octreotide'],
    allergies: ['Penicillin / co-amoxiclav', 'Metronidazole', 'Contrast media (for CT/MRCP)'],
    family_hx: ['Gallstone disease'],
    ros: ['Fever / rigors', 'Nausea / vomiting', 'Anorexia', 'Jaundice / dark urine / pale stools (Charcot\'s triad)', 'Previous biliary colic', 'Dietary fat trigger'],
  },

  biliary_colic: {
    pmh: ['Previous similar episodes', 'Diabetes', 'Haemolytic anaemia', 'Previous cholecystitis', 'Hypercholesterolaemia'],
    medications: ['OCP', 'Fibrates', 'Statins'],
    family_hx: ['Gallstone disease'],
    ros: ['Postprandial onset (fatty meal)', 'Nausea / vomiting', 'No fever (distinguishes from cholecystitis)', 'Self-resolving within hours'],
  },

  acute_cholangitis: {
    pmh: ['Known gallstones / previous cholecystitis', 'Previous ERCP / biliary stent', 'PSC / PBC', 'Biliary malignancy', 'Diabetes', 'Immunosuppression'],
    surgical: ['Previous cholecystectomy', 'Previous biliary surgery', 'Biliary reconstruction (Roux-en-Y)'],
    medications: ['Anticoagulants (bleeding risk for ERCP)', 'Antibiotics (ongoing)', 'Immunosuppressants'],
    allergies: ['Penicillin / piperacillin-tazobactam', 'Contrast media', 'Latex (endoscopy)'],
    ros: ['Charcot\'s triad: fever / RUQ pain / jaundice', 'Reynold\'s pentad (+ confusion + hypotension = severe)', 'Dark urine / pale stools', 'Rigors'],
  },

  obstructive_jaundice: {
    pmh: ['Known gallstones', 'Previous malignancy', 'PSC / PBC / autoimmune hepatitis', 'Hepatitis B/C', 'Cirrhosis', 'Alcohol use', 'Weight loss'],
    surgical: ['Previous cholecystectomy', 'Previous biliary surgery', 'Pancreatic surgery'],
    medications: ['Hepatotoxic drugs (isoniazid, methotrexate, statins)', 'Anticoagulants', 'OCPs'],
    family_hx: ['Cholangiocarcinoma', 'Pancreatic cancer', 'Hereditary pancreatitis'],
    ros: ['Weight loss / anorexia (malignancy)', 'Pruritus (cholestasis)', 'Dark urine / pale stools', 'Steatorrhoea', 'Abdominal pain', 'Fever (cholangitis)'],
  },

  acute_pancreatitis: {
    pmh: ['Gallstones', 'Alcohol use (units/week, duration)', 'Hypertriglyceridaemia', 'Hypercalcaemia', 'Previous pancreatitis', 'Pancreatic divisum', 'Autoimmune pancreatitis'],
    surgical: ['Previous ERCP', 'Previous pancreatic surgery', 'Previous cholecystectomy'],
    medications: ['Azathioprine / 6-MP', 'Thiazides / furosemide', 'Tetracyclines', 'Valproate', 'ACE inhibitors (rare)', 'Steroids'],
    allergies: ['Contrast media (CT)', 'Piperacillin-tazobactam'],
    family_hx: ['Hereditary pancreatitis (PRSS1 mutation)', 'Pancreatic cancer', 'Hypertriglyceridaemia'],
    ros: ['Nausea / vomiting', 'Fever', 'Steatorrhoea (chronic)', 'Diabetes (exocrine insufficiency)', 'Alcohol consumption', 'Recent biliary symptoms'],
  },

  bowel_obstruction: {
    pmh: ['Previous abdominal surgery (adhesions — #1 cause)', 'Known malignancy', 'IBD / Crohn\'s', 'Hernias', 'Diverticular disease', 'Volvulus history'],
    surgical: ['Previous abdominal surgery (adhesions)', 'Previous hernia repair', 'Stoma formation', 'Bowel resection'],
    medications: ['Opioids (ileus risk)', 'Anticholinergics', 'Tricyclics', 'Antipsychotics (constipation)'],
    allergies: ['Contrast media (Gastrografin / CT)', 'Latex'],
    ros: ['Absolute constipation / no flatus (complete SBO)', 'Bilious vomiting (SBO) / faeculent vomiting (late)', 'Abdominal distension', 'Colicky pain', 'Previous similar episodes'],
  },

  strangulated_hernia: {
    pmh: ['Previous hernia (repair or known)', 'COPD / chronic cough', 'Prostatism / BPH', 'Constipation', 'Ascites', 'Obesity', 'Connective tissue disorder'],
    surgical: ['Previous hernia repair (recurrence)', 'Previous abdominal surgery'],
    medications: ['Anticoagulants (surgical planning)', 'Steroids (wound healing)'],
    ros: ['Irreducible swelling', 'Pain at hernia site', 'Nausea / vomiting', 'Absolute constipation (complete obstruction)', 'Skin changes over hernia (necrosis)'],
  },

  inguinal_hernia: {
    pmh: ['COPD / chronic cough', 'Prostatism / BPH', 'Constipation', 'Previous hernia (bilateral / recurrence)', 'Connective tissue disorder', 'Ascites'],
    surgical: ['Previous inguinal hernia repair (mesh — TAPP vs Lichtenstein)', 'Previous scrotal surgery', 'Prostatectomy'],
    medications: ['Anticoagulants (peri-operative management)', 'Steroids (healing risk)'],
    ros: ['Groin swelling on standing / coughing', 'Reducibility (disappears lying flat)', 'Pain / discomfort', 'Urinary symptoms (BPH)', 'Testicular symptoms (if scrotal extension)'],
  },

  incisional_hernia: {
    pmh: ['Previous abdominal surgery (wound infection, dehiscence)', 'Obesity', 'Diabetes', 'Malnutrition', 'Connective tissue disorder', 'Steroid use', 'COPD'],
    surgical: ['Previous repair (recurrence)', 'Prior abdominal procedures — type, incision, complications'],
    medications: ['Anticoagulants', 'Steroids', 'Immunosuppressants'],
    ros: ['Swelling at scar site', 'Increase on standing / Valsalva', 'Pain / discomfort', 'Bowel symptoms (content type)', 'Previous complications'],
  },

  umbilical_hernia: {
    pmh: ['Cirrhosis / ascites', 'Obesity', 'Multiparity', 'COPD / straining', 'Congenital (paediatric)'],
    surgical: ['Previous umbilical hernia repair'],
    medications: ['Anticoagulants', 'Diuretics (if ascites)'],
    ros: ['Periumbilical swelling', 'Reducibility', 'Pain', 'Skin breakdown over hernia', 'Ascites symptoms'],
  },

  gi_bleed_upper: {
    pmh: ['Peptic ulcer disease', 'GORD', 'Alcohol use / cirrhosis (varices)', 'Previous GI bleed', 'Malignancy', 'Aortic aneurysm graft (aorto-enteric fistula)', 'Coagulopathy'],
    surgical: ['Previous GI surgery', 'Previous variceal banding / sclerotherapy'],
    medications: ['NSAIDs / aspirin / anticoagulants / steroids — cause & duration', 'H pylori treatment', 'PPIs (ongoing)'],
    allergies: ['Latex (endoscopy)', 'Contrast media'],
    ros: ['Haematemesis (bright red vs coffee grounds)', 'Melaena / haematochezia', 'Syncope / presyncope', 'Epigastric pain', 'Alcohol intake', 'NSAID / aspirin use'],
  },

  perforated_viscus: {
    pmh: ['Peptic ulcer disease', 'NSAIDs / steroid use', 'Previous PUD treatment', 'IBD', 'Malignancy', 'Diverticular disease', 'H pylori positive'],
    surgical: ['Previous abdominal surgery', 'Previous GI procedure (colonoscopy / endoscopy — instrumental perforation)'],
    medications: ['NSAIDs / aspirin / steroids (perforation risk)', 'Anticoagulants', 'Immunosuppressants'],
    allergies: ['Penicillin / metronidazole', 'Contrast media'],
    ros: ['Sudden-onset severe epigastric pain ("like a knife")', 'Generalised peritonism', 'Shoulder-tip pain (diaphragmatic irritation)', 'No fever initially (fever develops later)', 'Previous dyspepsia / ulcer symptoms'],
  },

  pancreatic_mass: {
    pmh: ['Diabetes (new onset — flag for pancreatic cancer)', 'Chronic pancreatitis', 'Smoking', 'Obesity', 'Hereditary pancreatitis', 'Lynch syndrome', 'Previous abdominal malignancy'],
    surgical: ['Previous GI surgery', 'Previous ERCP / biliary intervention'],
    medications: ['Diabetic medications (new requirement)', 'Exocrine supplements', 'Pancreatic enzyme replacement'],
    family_hx: ['Pancreatic cancer', 'Hereditary pancreatitis (PRSS1)', 'BRCA2 / PALB2 mutation', 'Lynch syndrome'],
    ros: ['Weight loss / anorexia (constitutional)', 'Painless jaundice (head of pancreas)', 'New-onset or worsening diabetes', 'Steatorrhoea', 'Migratory thrombophlebitis (Trousseau)', 'Back pain (body/tail invasion)'],
  },

  colorectal_cancer: {
    pmh: ['Previous colorectal polyps', 'IBD (UC > Crohn\'s)', 'Lynch syndrome / FAP', 'Previous CRC', 'Pelvic radiation', 'Diabetes / obesity (metabolic risk)'],
    surgical: ['Previous bowel surgery / resection', 'Previous stoma', 'Previous colonoscopy and findings'],
    medications: ['Aspirin / NSAIDs (protective if regular use)', 'HRT', 'Immunosuppressants (IBD)'],
    allergies: ['Chemotherapy agents (oxaliplatin, 5-FU — if prior treatment)'],
    family_hx: ['CRC < 60 years in 1st-degree relative', 'Polyps', 'Lynch syndrome (CRC + endometrial + ovarian)', 'FAP / AFAP', 'MYH-associated polyposis'],
    ros: ['PR bleeding / melaena / altered stool', 'Weight loss / anorexia (constitutional)', 'Abdominal mass / bloating', 'Tenesmus / incomplete evacuation (rectal)', 'Iron deficiency anaemia (anaemia symptoms)', 'Change in bowel habit (duration, direction)'],
  },

  rectal_bleeding: {
    pmh: ['Haemorrhoids', 'Anal fissure', 'IBD', 'Colorectal cancer', 'Diverticular disease', 'Coagulopathy', 'Previous GI procedures'],
    surgical: ['Previous haemorrhoidectomy', 'Previous anorectal surgery'],
    medications: ['Anticoagulants / antiplatelets', 'NSAIDs', 'Iron supplements (black stool confusion)'],
    family_hx: ['CRC', 'Polyps', 'IBD'],
    ros: ['Blood mixed with stool vs separate / on paper', 'Bright red vs dark', 'Associated pain (fissure)', 'Mucous discharge', 'Change in bowel habit', 'Weight loss / anaemia symptoms (red flags)'],
  },

  diverticular_disease: {
    pmh: ['Previous diverticular attacks', 'IBD', 'Constipation (chronic)', 'Obesity', 'Low-fibre diet', 'Connective tissue disorder'],
    surgical: ['Previous bowel resection for diverticular disease', 'Previous abscess drainage'],
    medications: ['NSAIDs (diverticulitis trigger)', 'Steroids / immunosuppressants (mask infection)', 'Mesalazine (protective)'],
    family_hx: ['Colorectal cancer (exclude)', 'Diverticular disease'],
    ros: ['LIF pain (or RIF in Asian patients)', 'Altered bowel habit', 'Fever / rigors', 'Rectal bleeding', 'Dysuria (colovesical fistula)', 'Pneumaturia'],
  },

  breast_lump: {
    pmh: ['Previous breast cancer', 'Previous breast biopsy / core biopsy result', 'BRCA1/2 mutation known', 'Atypical hyperplasia on previous biopsy', 'Previous radiation to chest', 'Diabetes / obesity (reconstruction risk)'],
    surgical: ['Previous breast surgery (lumpectomy / mastectomy)', 'Previous axillary clearance', 'Breast implants'],
    medications: ['HRT type and duration', 'Oral contraceptives', 'Selective oestrogen modulators (tamoxifen)'],
    allergies: ['Contrast media (mammogram / MRI)'],
    family_hx: ['Breast cancer (1st/2nd degree — age at diagnosis)', 'Ovarian cancer', 'Male breast cancer', 'BRCA1/2 tested family members', 'Pancreatic cancer (BRCA2)'],
    ros: ['Lump characteristics — onset, growth, pain, cyclical variation', 'Nipple discharge (character)', 'Skin changes / peau d\'orange / dimpling', 'Axillary swelling', 'Bone pain / cough (metastases)', 'Weight loss'],
  },

  thyroid_nodule: {
    pmh: ['Previous thyroid disease / goitre', 'Neck radiation (childhood)', 'Iodine deficiency (endemic goitre)', 'MEN2 syndrome', 'Cowden syndrome', 'Family history thyroid cancer'],
    medications: ['Amiodarone (thyroid dysfunction)', 'Lithium (hypothyroidism)', 'Levothyroxine (current dose)'],
    family_hx: ['Thyroid cancer (especially medullary — MEN2)', 'MEN2A / MEN2B', 'Cowden syndrome'],
    ros: ['Obstructive symptoms (dysphagia / dysphonia / stridor)', 'Hyperthyroid symptoms (palpitations, tremor, heat intolerance, weight loss)', 'Hypothyroid symptoms (fatigue, weight gain, constipation)', 'Rapid growth (alarming)', 'Pain (thyroiditis)', 'Constitutional symptoms'],
  },

  neck_lump: {
    pmh: ['Previous malignancy (head/neck, lymphoma, thyroid)', 'Tuberculosis / HIV / immunosuppression', 'Previous neck surgery or radiation', 'Dental problems (submandibular)'],
    medications: ['Phenytoin (lymphadenopathy)', 'Immunosuppressants', 'Antibiotics (ongoing)'],
    family_hx: ['Head and neck cancer', 'Lymphoma', 'Thyroid cancer'],
    ros: ['Constitutional: weight loss, night sweats, fever (lymphoma)', 'Upper aerodigestive symptoms: dysphagia, odynophagia, hoarseness, otalgia', 'Smoking / alcohol / betel nut use', 'Duration and growth rate', 'Tenderness (reactive vs neoplastic)'],
  },

  dysphagia: {
    pmh: ['GORD / Barrett\'s oesophagus', 'Achalasia / motility disorder', 'Previous peptic stricture', 'Oesophageal cancer', 'Head and neck cancer', 'Neurological disease (Parkinson\'s, stroke)', 'Previous radiation', 'Systemic sclerosis'],
    surgical: ['Previous oesophageal / fundoplication surgery', 'Previous head/neck surgery'],
    medications: ['Bisphosphonates (pill oesophagitis)', 'NSAIDs', 'Potassium / tetracyclines (pill oesophagitis)'],
    family_hx: ['Oesophageal cancer', 'Gastric cancer', 'Tylosis (RHBDF2 — oesophageal SCC)'],
    ros: ['Solid vs liquid vs both (structural vs motility)', 'Progressive vs intermittent', 'Odynophagia (pain on swallowing)', 'Regurgitation / aspiration / cough', 'Weight loss / anorexia', 'Heartburn / acid reflux history', 'Voice change / hoarseness', 'Cervical lymphadenopathy'],
  },

  haemorrhoids: {
    pmh: ['Constipation (chronic)', 'Pregnancy / parity', 'Portal hypertension / cirrhosis', 'Obesity', 'Low-fibre diet', 'Previous haemorrhoidectomy / banding'],
    surgical: ['Previous anorectal surgery', 'Previous haemorrhoidectomy'],
    medications: ['Anticoagulants / antiplatelets (bleeding risk for intervention)', 'Calcium channel blockers (constipation)', 'Opioids'],
    ros: ['Rectal bleeding (bright red, separate from stool)', 'Prolapse (grades I–IV)', 'Perianal pruritus / soiling', 'Pain (usually grade IV or thrombosed)', 'Mucous discharge', 'Obstructed defaecation'],
  },

  anal_fissure: {
    pmh: ['Constipation (chronic, hard stools)', 'IBD (Crohn\'s — atypical location)', 'HIV / STIs', 'Previous anorectal surgery', 'Childbirth trauma'],
    medications: ['Constipating agents (opioids, iron)', 'Calcium channel blockers (topical GTN vs diltiazem cream)'],
    ros: ['Sharp anal pain during and after defaecation', 'Bright rectal bleeding (on paper)', 'Location: posterior midline (> 90%) vs lateral (Crohn\'s / STI / HIV)', 'Duration (acute < 6 weeks / chronic)', 'Skin tag / sentinel pile'],
  },

  perianal_abscess: {
    pmh: ['Crohn\'s disease (fistula track)', 'Diabetes (impaired healing)', 'Immunosuppression (HIV, steroids)', 'Previous anorectal surgery / abscess', 'Hidradenitis suppurativa'],
    surgical: ['Previous drainage / fistulotomy', 'Previous anorectal surgery'],
    medications: ['Immunosuppressants', 'Anticoagulants (drainage planning)'],
    ros: ['Severe perianal pain', 'Swelling / erythema', 'Fever / systemic sepsis', 'Purulent discharge', 'Difficulty sitting / defaecating', 'Previous recurrent abscesses (fistula-in-ano)'],
  },

  postop_followup: {
    pmh: ['Original diagnosis and procedure performed', 'Pre-existing comorbidities', 'Wound healing history'],
    medications: ['Post-operative medications (analgesia, antibiotics, DVT prophylaxis)', 'Regular medications restarted (date)', 'Anticoagulants (when restarted)'],
    ros: ['Wound healing / infection', 'Return of bowel function', 'Pain (NRS)', 'Drain output / removal', 'Oral intake / diet progression', 'Mobility', 'Fatigue', 'Urinary function', 'VTE symptoms (DVT / PE)'],
  },

  diabetic_foot: {
    pmh: ['Diabetes type and duration', 'HbA1c (most recent)', 'Peripheral vascular disease', 'Peripheral neuropathy', 'Previous foot ulcer / amputation', 'Renal impairment / dialysis', 'Retinopathy'],
    medications: ['Diabetic medications (insulin, metformin)', 'Anticoagulants', 'Antiplatelet agents', 'Previous antibiotic courses for foot infections'],
    family_hx: ['Diabetes', 'Peripheral arterial disease'],
    ros: ['Wound / ulcer characteristics (location, depth, grade)', 'Pain vs painless (neuropathy)', 'Claudication / rest pain (vascular)', 'Discharge / odour / crepitus (gas gangrene)', 'Footwear', 'Previous podiatry input', 'Blood glucose control'],
  },

  varicose_veins: {
    pmh: ['Previous DVT / thrombophlebitis', 'Pregnancy (number)', 'Occupational standing', 'Previous varicose vein treatment', 'Obesity', 'Family history'],
    surgical: ['Previous stripping / foam sclerotherapy / EVLA / TIPP', 'Previous DVT-related interventions'],
    medications: ['Anticoagulants (prior DVT)', 'OCPs / HRT'],
    family_hx: ['Varicose veins', 'DVT / thrombophilia'],
    ros: ['Cosmetic concern vs symptoms', 'Aching / heaviness / itching', 'Skin changes (lipodermatosclerosis, eczema, haemosiderosis)', 'Venous ulcer (CEAP classification)', 'Ankle swelling', 'Previous thrombophlebitis episodes'],
  },

  weight_loss: {
    pmh: ['Diabetes / thyroid disease (exclude endocrine)', 'Previous malignancy', 'Depression / anxiety', 'IBD / malabsorption', 'HIV / TB', 'Substance use', 'Eating disorders'],
    medications: ['Chemotherapy', 'Diuretics', 'Stimulants', 'GLP-1 agonists (intentional)'],
    family_hx: ['GI malignancy', 'Endocrine disorders'],
    ros: ['Quantify loss (kg, timeframe)', 'Intentional vs unintentional', 'Appetite (preserved vs reduced)', 'Dysphagia / odynophagia', 'PR bleeding / altered stool', 'Night sweats / fever (lymphoma / TB)', 'Fatigue / anaemia symptoms', 'Organ-specific symptoms by site'],
  },

  skin_lesion: {
    pmh: ['Previous skin cancer / melanoma', 'Previous excision / biopsy results', 'Immunosuppression (transplant recipient)', 'Phototype / sun exposure history', 'Genetic syndromes (Gorlin, xeroderma pigmentosum)'],
    medications: ['Immunosuppressants (azathioprine, tacrolimus)', 'Targeted therapy / immunotherapy (if previous melanoma)', 'Photosensitising drugs'],
    family_hx: ['Melanoma (CDKN2A)', 'Multiple dysplastic naevi syndrome', 'Xeroderma pigmentosum'],
    ros: ['ABCDE changes: Asymmetry, Border, Colour, Diameter, Evolution', 'Bleeding / ulceration / crusting', 'Itch / pain', 'Regional lymphadenopathy', 'Duration and rate of change', 'Sun / UV exposure (occupational / recreational)', 'Previous sunburns'],
  },
};

// ── Banner hint builder ───────────────────────────────────────────────────────

interface SectionHint {
  icon: string;
  label: string;
  items: string[];
  prose?: boolean;
}

function buildHint(matrix: CCTemplate, section: Section, ccKey: string): SectionHint | null {
  const supp = CC_SECTION_HINTS[ccKey];

  switch (section) {
    case 'hpi':
      if (!matrix.prompts.length) return null;
      return {
        icon: '📝',
        label: 'SOCRATES prompts',
        items: matrix.prompts.slice(0, 6).map(p => p.label),
      };

    case 'pmh': {
      const items = supp?.pmh ?? [];
      if (!items.length) return null;
      return { icon: '📋', label: 'Ask about', items };
    }

    case 'surgical': {
      const items = supp?.surgical ?? [];
      if (!items.length) return null;
      return { icon: '🔪', label: 'Relevant prior ops', items };
    }

    case 'medications': {
      const items = supp?.medications ?? [];
      if (!items.length) return null;
      return { icon: '💊', label: 'Key drug classes', items };
    }

    case 'allergies': {
      const items = supp?.allergies ?? [];
      if (!items.length) return null;
      return { icon: '⚠️', label: 'Ask specifically', items };
    }

    case 'family_hx': {
      const items = supp?.family_hx ?? [];
      if (!items.length) return null;
      return { icon: '🧬', label: 'Family history focus', items };
    }

    case 'ros': {
      const items = supp?.ros ?? [];
      if (!items.length) return null;
      return { icon: '🔍', label: 'Review of systems', items };
    }

    case 'examination': {
      const items: string[] = [];
      const signPrompt = matrix.prompts.find(p =>
        ['signs', 'exam', 'murphy', 'mass', 'hernia', 'wound', 'bowel', 'tenderness'].some(k =>
          p.key.toLowerCase().includes(k)
        )
      );
      if (signPrompt?.hint) {
        const chips = signPrompt.hint
          .split(/\s*·\s*|\s*→\s*/)
          .slice(0, 5)
          .map(s => s.replace(/\s*\([^)]*\)/g, '').trim())
          .filter(Boolean);
        items.push(...chips);
      }
      if (!items.length && matrix.ddx.length) {
        items.push(...matrix.ddx.slice(0, 3));
        return { icon: '🩺', label: 'Differentiate', items };
      }
      return items.length ? { icon: '🩺', label: 'Elicit', items } : null;
    }

    case 'investigations':
      if (!matrix.labs.length) return null;
      return { icon: '🧪', label: 'Bloods', items: matrix.labs.slice(0, 6) };

    case 'radiology':
      if (!matrix.imaging.length) return null;
      return { icon: '📡', label: 'Imaging', items: matrix.imaging.slice(0, 3) };

    case 'assessment': {
      const items: string[] = [];
      if (matrix.icd10Hint) items.push(matrix.icd10Hint);
      items.push(...matrix.ddx.slice(0, 4).map((d, i) => `${i + 1}. ${d}`));
      return items.length ? { icon: '🎯', label: 'DDx', items } : null;
    }

    case 'plan':
      if (!matrix.pearl) return null;
      return { icon: '💡', label: 'Pearl', items: [matrix.pearl], prose: true };

    default:
      return null;
  }
}

export default function ConsultContextBanner() {
  const { activeCcKey, activeSection } = useAppContext();
  if (!activeCcKey) return null;

  const matrix = getMatrix(activeCcKey);
  if (!matrix) return null;

  const hint = buildHint(matrix, activeSection as Section, activeCcKey);
  if (!hint) return null;

  return (
    <div style={{
      margin: '0 0 8px',
      padding: '7px 12px 8px',
      background: 'var(--surface, #1e293b)',
      border: '1px solid var(--line, #334155)',
      borderRadius: 8,
      display: 'flex',
      gap: 10,
      alignItems: 'flex-start',
    }}>
      <span style={{ fontSize: 13, flexShrink: 0, lineHeight: 1.8 }}>{hint.icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '0.07em', color: '#64748b', marginRight: 8,
          lineHeight: 1.8,
        }}>
          {hint.label}
        </span>
        {hint.prose ? (
          <span style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>
            {hint.items[0]}
          </span>
        ) : (
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, verticalAlign: 'middle' }}>
            {hint.items.map((item, i) => (
              <span key={i} style={{
                fontSize: 11, padding: '2px 8px', borderRadius: 20,
                background: '#0f172a', color: '#94a3b8',
                border: '1px solid #1e293b',
                whiteSpace: 'nowrap',
                lineHeight: 1.5,
              }}>
                {item}
              </span>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
