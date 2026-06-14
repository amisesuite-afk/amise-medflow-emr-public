/**
 * Frequent surgical pathologies for Dr Kabiye's general & endoscopic surgery
 * practice, grouped into clinical subsets with ICD-10 and CPT codes.
 *
 * Used by `adaptiveTriage()` to flag patients whose reason-for-visit /
 * free-text matches a known surgical pathology as early as booking /
 * check-in ("magnet first step") — see `matchSurgicalPathologies` and
 * `isPrimarilySurgical`. Also a reference dictionary for assessment/plan
 * code suggestions.
 */

import { Severity } from './rules';

export type SurgicalCategory =
  | 'Hernia & Abdominal Wall'
  | 'Hepatobiliary & Gallbladder'
  | 'Appendix & Acute Abdomen'
  | 'Colorectal & Lower GI'
  | 'Anorectal'
  | 'Upper GI & Endoscopy'
  | 'Breast'
  | 'Thyroid & Neck'
  | 'Skin & Soft Tissue'
  | 'Vascular & Diabetic Foot'
  | 'ERCP & Pancreatobiliary';

export interface CodePair {
  code: string;
  description: string;
}

export interface SurgicalPathology {
  id: string;
  label: string;
  category: SurgicalCategory;
  icd10: CodePair[];
  cpt: CodePair[];
  /** Matched against the patient's combined free-text / symptom string. */
  keywords: RegExp;
  /** How urgently a "surgical first step" flag should route this patient. */
  surgicalPriority: Severity | 'routine';
}

export const SURGICAL_PATHOLOGIES: SurgicalPathology[] = [
  // ── Hernia & Abdominal Wall ──────────────────────────────────────────────
  {
    id: 'hernia_inguinal',
    label: 'Inguinal hernia',
    category: 'Hernia & Abdominal Wall',
    icd10: [{ code: 'K40.90', description: 'Unilateral inguinal hernia, without obstruction or gangrene' }],
    cpt: [{ code: '49505', description: 'Repair initial inguinal hernia, age 5+, reducible' }],
    keywords: /\b(inguinal hernia|groin (lump|swelling|bulge))\b/i,
    surgicalPriority: 'routine',
  },
  {
    id: 'hernia_inguinal_strangulated',
    label: 'Strangulated / irreducible inguinal hernia',
    category: 'Hernia & Abdominal Wall',
    icd10: [{ code: 'K40.30', description: 'Unilateral inguinal hernia, with obstruction, without gangrene' }],
    cpt: [{ code: '49507', description: 'Repair initial inguinal hernia, incarcerated or strangulated' }],
    keywords: /\b(strangulated hernia|irreducible hernia|hernia.{0,15}(can'?t|cannot|won'?t) (push|reduce)|hernia.{0,15}(vomiting|obstruct))\b/i,
    surgicalPriority: 'urgent',
  },
  {
    id: 'hernia_umbilical',
    label: 'Umbilical hernia',
    category: 'Hernia & Abdominal Wall',
    icd10: [{ code: 'K42.9', description: 'Umbilical hernia, without obstruction or gangrene' }],
    cpt: [
      { code: '49585', description: 'Repair umbilical hernia, age 5+, reducible' },
      { code: '49587', description: 'Repair umbilical hernia, incarcerated or strangulated' },
    ],
    keywords: /\b(umbilical hernia|belly button (lump|swelling|bulge))\b/i,
    surgicalPriority: 'routine',
  },
  {
    id: 'hernia_incisional',
    label: 'Incisional / ventral hernia',
    category: 'Hernia & Abdominal Wall',
    icd10: [{ code: 'K43.9', description: 'Ventral hernia, without obstruction or gangrene' }],
    cpt: [
      { code: '49560', description: 'Repair initial incisional or ventral hernia, reducible' },
      { code: '49566', description: 'Repair recurrent incisional or ventral hernia' },
    ],
    keywords: /\b(incisional hernia|ventral hernia|bulge (at|near|along) (the )?(scar|incision|surgical site))\b/i,
    surgicalPriority: 'routine',
  },
  {
    id: 'hernia_femoral',
    label: 'Femoral hernia',
    category: 'Hernia & Abdominal Wall',
    icd10: [{ code: 'K41.90', description: 'Unilateral femoral hernia, without obstruction or gangrene' }],
    cpt: [
      { code: '49550', description: 'Repair initial femoral hernia, reducible' },
      { code: '49553', description: 'Repair initial femoral hernia, incarcerated or strangulated' },
    ],
    keywords: /\b(femoral hernia)\b/i,
    surgicalPriority: 'routine',
  },
  {
    id: 'hernia_hiatal',
    label: 'Hiatal hernia / GORD requiring repair',
    category: 'Hernia & Abdominal Wall',
    icd10: [{ code: 'K44.9', description: 'Diaphragmatic hernia without obstruction or gangrene' }],
    cpt: [{ code: '43280', description: 'Laparoscopic fundoplication for hiatal hernia / GORD' }],
    keywords: /\b(hiatal hernia|hiatus hernia|paraesophageal hernia)\b/i,
    surgicalPriority: 'routine',
  },

  // ── Hepatobiliary & Gallbladder ──────────────────────────────────────────
  {
    id: 'cholecystitis_acute',
    label: 'Acute cholecystitis with cholelithiasis',
    category: 'Hepatobiliary & Gallbladder',
    icd10: [{ code: 'K80.00', description: 'Calculus of gallbladder with acute cholecystitis, without obstruction' }],
    cpt: [{ code: '47562', description: 'Laparoscopic cholecystectomy' }],
    keywords: /\b(gallstone|gall stone|gallbladder (pain|attack|inflammation)|acute cholecystitis|biliary colic)\b/i,
    surgicalPriority: 'priority',
  },
  {
    id: 'cholelithiasis_chronic',
    label: 'Chronic cholecystitis / symptomatic gallstones',
    category: 'Hepatobiliary & Gallbladder',
    icd10: [{ code: 'K80.10', description: 'Calculus of gallbladder with chronic cholecystitis, without obstruction' }],
    cpt: [{ code: '47562', description: 'Laparoscopic cholecystectomy' }],
    keywords: /\b(chronic gallstones|recurrent (ruq|right upper quadrant) pain|gallbladder polyp)\b/i,
    surgicalPriority: 'routine',
  },
  {
    id: 'choledocholithiasis',
    label: 'Choledocholithiasis with cholangitis',
    category: 'Hepatobiliary & Gallbladder',
    icd10: [{ code: 'K80.31', description: 'Calculus of bile duct with cholangitis, with obstruction' }],
    cpt: [
      { code: '47564', description: 'Laparoscopic cholecystectomy with exploration of common duct' },
      { code: '43264', description: 'ERCP with removal of bile duct stone(s)' },
    ],
    keywords: /\b(common bile duct stone|choledocholithiasis|bile duct stone)\b/i,
    surgicalPriority: 'urgent',
  },
  {
    id: 'cholangitis_acute',
    label: 'Acute cholangitis',
    category: 'Hepatobiliary & Gallbladder',
    icd10: [{ code: 'K83.0', description: 'Cholangitis' }],
    cpt: [
      { code: '43260', description: 'ERCP, diagnostic' },
      { code: '43268', description: 'ERCP with endoscopic stent placement (biliary)' },
    ],
    keywords: /\b(cholangitis|fever.{0,15}jaundice|jaundice.{0,15}fever)\b/i,
    surgicalPriority: 'urgent',
  },
  {
    id: 'liver_abscess',
    label: 'Liver abscess',
    category: 'Hepatobiliary & Gallbladder',
    icd10: [{ code: 'K75.0', description: 'Abscess of liver' }],
    cpt: [{ code: '47011', description: 'Percutaneous image-guided drainage of liver abscess' }],
    keywords: /\b(liver abscess)\b/i,
    surgicalPriority: 'urgent',
  },

  // ── Appendix & Acute Abdomen ─────────────────────────────────────────────
  {
    id: 'appendicitis_acute',
    label: 'Acute appendicitis, uncomplicated',
    category: 'Appendix & Acute Abdomen',
    icd10: [{ code: 'K35.80', description: 'Unspecified acute appendicitis' }],
    cpt: [{ code: '44970', description: 'Laparoscopic appendectomy' }],
    keywords: /\b(appendicitis|appendix (pain|inflamed))\b/i,
    surgicalPriority: 'urgent',
  },
  {
    id: 'appendicitis_perforated',
    label: 'Acute appendicitis with generalised peritonitis',
    category: 'Appendix & Acute Abdomen',
    icd10: [{ code: 'K35.20', description: 'Acute appendicitis with generalized peritonitis' }],
    cpt: [{ code: '44960', description: 'Appendectomy for ruptured appendix with abscess or peritonitis' }],
    keywords: /\b(ruptured appendix|perforated appendix|peritonitis)\b/i,
    surgicalPriority: 'urgent',
  },
  {
    id: 'bowel_obstruction',
    label: 'Intestinal obstruction',
    category: 'Appendix & Acute Abdomen',
    icd10: [{ code: 'K56.609', description: 'Unspecified intestinal obstruction, unspecified as to partial versus complete' }],
    cpt: [{ code: '44005', description: 'Enterolysis (lysis of intestinal adhesions)' }],
    keywords: /\b(bowel obstruction|intestinal obstruction|not (passing|opening) (gas|stool|bowels)|obstructed)\b/i,
    surgicalPriority: 'urgent',
  },
  {
    id: 'perforated_viscus',
    label: 'Perforated viscus / peritonitis',
    category: 'Appendix & Acute Abdomen',
    icd10: [{ code: 'K65.0', description: 'Generalized (acute) peritonitis' }],
    cpt: [{ code: '49000', description: 'Exploratory laparotomy' }],
    keywords: /\b(perforation|perforated (ulcer|bowel|viscus)|board.?like (abdomen|rigid))\b/i,
    surgicalPriority: 'urgent',
  },

  // ── Colorectal & Lower GI ────────────────────────────────────────────────
  {
    id: 'diverticulitis',
    label: 'Diverticulitis of colon',
    category: 'Colorectal & Lower GI',
    icd10: [{ code: 'K57.92', description: 'Diverticulitis of intestine, part unspecified, without perforation, abscess or bleeding' }],
    cpt: [{ code: '44140', description: 'Partial colectomy with anastomosis' }],
    keywords: /\b(diverticulitis|diverticular disease)\b/i,
    surgicalPriority: 'priority',
  },
  {
    id: 'colon_cancer',
    label: 'Colon cancer',
    category: 'Colorectal & Lower GI',
    icd10: [{ code: 'C18.9', description: 'Malignant neoplasm of colon, unspecified' }],
    cpt: [{ code: '44140', description: 'Partial colectomy with anastomosis' }],
    keywords: /\b(colon cancer|colorectal cancer|bowel cancer)\b/i,
    surgicalPriority: 'priority',
  },
  {
    id: 'rectal_cancer',
    label: 'Rectal cancer',
    category: 'Colorectal & Lower GI',
    icd10: [{ code: 'C20', description: 'Malignant neoplasm of rectum' }],
    cpt: [{ code: '45111', description: 'Partial proctectomy, abdominal approach' }],
    keywords: /\b(rectal (cancer|mass|tumou?r))\b/i,
    surgicalPriority: 'priority',
  },
  {
    id: 'colonic_polyp',
    label: 'Colonic polyp',
    category: 'Colorectal & Lower GI',
    icd10: [{ code: 'K63.5', description: 'Polyp of colon' }],
    cpt: [{ code: '45385', description: 'Colonoscopy with removal of tumour/polyp by snare technique' }],
    keywords: /\b(colon polyp|colonic polyp|bowel polyp)\b/i,
    surgicalPriority: 'routine',
  },
  {
    id: 'rectal_prolapse',
    label: 'Rectal prolapse',
    category: 'Colorectal & Lower GI',
    icd10: [{ code: 'K62.3', description: 'Rectal prolapse' }],
    cpt: [{ code: '45550', description: 'Proctopexy for rectal prolapse' }],
    keywords: /\b(rectal prolapse|rectum (coming out|protruding))\b/i,
    surgicalPriority: 'routine',
  },
  {
    id: 'change_bowel_habit',
    label: 'Change in bowel habit / lower GI bleed — investigation',
    category: 'Colorectal & Lower GI',
    icd10: [{ code: 'K92.2', description: 'Gastrointestinal haemorrhage, unspecified' }],
    cpt: [{ code: '45378', description: 'Colonoscopy, diagnostic' }],
    keywords: /\b(change in bowel habit|blood in (my )?stool|rectal bleed|pr bleed)\b/i,
    surgicalPriority: 'priority',
  },

  // ── Anorectal ─────────────────────────────────────────────────────────────
  {
    id: 'haemorrhoids',
    label: 'Haemorrhoids (internal/external)',
    category: 'Anorectal',
    icd10: [{ code: 'K64.8', description: 'Other haemorrhoids' }],
    cpt: [{ code: '46260', description: 'Haemorrhoidectomy, internal and external' }],
    keywords: /\b(h(a)?emorrhoids?|piles)\b/i,
    surgicalPriority: 'routine',
  },
  {
    id: 'anal_fissure',
    label: 'Anal fissure',
    category: 'Anorectal',
    icd10: [{ code: 'K60.2', description: 'Anal fissure, unspecified' }],
    cpt: [{ code: '46080', description: 'Internal sphincterotomy for anal fissure' }],
    keywords: /\b(anal fissure|tear (near|around) (the )?anus|painful (bowel movement|defecation))\b/i,
    surgicalPriority: 'routine',
  },
  {
    id: 'perianal_abscess',
    label: 'Perianal abscess',
    category: 'Anorectal',
    icd10: [{ code: 'K61.0', description: 'Anal abscess' }],
    cpt: [{ code: '46050', description: 'Incision and drainage of perianal abscess' }],
    keywords: /\b(perianal abscess|anal abscess|abscess (near|around) (the )?(anus|bottom))\b/i,
    surgicalPriority: 'urgent',
  },
  {
    id: 'anal_fistula',
    label: 'Anal fistula',
    category: 'Anorectal',
    icd10: [{ code: 'K60.3', description: 'Anal fistula' }],
    cpt: [{ code: '46270', description: 'Fistulectomy / fistulotomy, subcutaneous' }],
    keywords: /\b(anal fistula|fistula.{0,10}(anus|rectum))\b/i,
    surgicalPriority: 'routine',
  },
  {
    id: 'pilonidal_disease',
    label: 'Pilonidal cyst / sinus with abscess',
    category: 'Anorectal',
    icd10: [{ code: 'L05.01', description: 'Pilonidal cyst with abscess' }],
    cpt: [{ code: '11770', description: 'Excision of pilonidal cyst or sinus, simple' }],
    keywords: /\b(pilonidal (cyst|sinus|abscess))\b/i,
    surgicalPriority: 'priority',
  },

  // ── Upper GI & Endoscopy ─────────────────────────────────────────────────
  {
    id: 'gord_oesophagitis',
    label: 'GORD with oesophagitis',
    category: 'Upper GI & Endoscopy',
    icd10: [{ code: 'K21.0', description: 'Gastro-oesophageal reflux disease with oesophagitis' }],
    cpt: [{ code: '43235', description: 'Upper GI endoscopy (EGD), diagnostic' }],
    keywords: /\b(heartburn|reflux|gord|gerd|acid reflux)\b/i,
    surgicalPriority: 'routine',
  },
  {
    id: 'peptic_ulcer_bleed',
    label: 'Peptic ulcer with haemorrhage',
    category: 'Upper GI & Endoscopy',
    icd10: [{ code: 'K27.4', description: 'Peptic ulcer, unspecified, chronic or unspecified with haemorrhage' }],
    cpt: [{ code: '43255', description: 'EGD with control of bleeding, any method' }],
    keywords: /\b(peptic ulcer|stomach ulcer|duodenal ulcer|vomiting blood|haematemesis|hematemesis|black (tarry )?stool|melaena|melena)\b/i,
    surgicalPriority: 'urgent',
  },
  {
    id: 'dysphagia_stricture',
    label: 'Dysphagia / oesophageal stricture',
    category: 'Upper GI & Endoscopy',
    icd10: [{ code: 'K22.2', description: 'Oesophageal obstruction' }],
    cpt: [{ code: '43249', description: 'EGD with transendoscopic balloon dilation of oesophagus' }],
    keywords: /\b(dysphagia|trouble swallowing|food (sticking|getting stuck)|difficulty swallowing)\b/i,
    surgicalPriority: 'priority',
  },
  {
    id: 'achalasia',
    label: 'Achalasia',
    category: 'Upper GI & Endoscopy',
    icd10: [{ code: 'K22.0', description: 'Achalasia of cardia' }],
    cpt: [{ code: '43279', description: 'Laparoscopic Heller myotomy' }],
    keywords: /\b(achalasia)\b/i,
    surgicalPriority: 'routine',
  },
  {
    id: 'gastric_cancer',
    label: 'Gastric cancer',
    category: 'Upper GI & Endoscopy',
    icd10: [{ code: 'C16.9', description: 'Malignant neoplasm of stomach, unspecified' }],
    cpt: [{ code: '43622', description: 'Gastrectomy, total, with reconstruction' }],
    keywords: /\b(gastric cancer|stomach cancer)\b/i,
    surgicalPriority: 'priority',
  },
  {
    id: 'weight_loss_screen',
    label: 'Unexplained weight loss / GI alarm symptoms — endoscopy workup',
    category: 'Upper GI & Endoscopy',
    icd10: [{ code: 'R63.4', description: 'Abnormal weight loss' }],
    cpt: [{ code: '43235', description: 'Upper GI endoscopy (EGD), diagnostic' }],
    keywords: /\b(unexplained weight loss|losing weight|weight loss)\b/i,
    surgicalPriority: 'priority',
  },

  // ── Breast ────────────────────────────────────────────────────────────────
  {
    id: 'breast_lump',
    label: 'Breast lump / mass',
    category: 'Breast',
    icd10: [{ code: 'N63.0', description: 'Unspecified lump in unspecified breast' }],
    cpt: [{ code: '19120', description: 'Excision of breast lesion (cyst, fibroadenoma or other benign/malignant tumour)' }],
    keywords: /\b(breast lump|breast mass|lump in (my |the )?breast|new lump)\b/i,
    surgicalPriority: 'priority',
  },
  {
    id: 'fibroadenoma',
    label: 'Fibroadenoma of breast',
    category: 'Breast',
    icd10: [{ code: 'D24.9', description: 'Benign neoplasm of unspecified breast' }],
    cpt: [{ code: '19120', description: 'Excision of breast lesion' }],
    keywords: /\b(fibroadenoma)\b/i,
    surgicalPriority: 'routine',
  },
  {
    id: 'breast_abscess',
    label: 'Breast abscess / mastitis',
    category: 'Breast',
    icd10: [{ code: 'N61', description: 'Inflammatory disorders of breast' }],
    cpt: [{ code: '19020', description: 'Mastotomy with exploration or drainage of abscess' }],
    keywords: /\b(breast abscess|mastitis|breast (infection|infected))\b/i,
    surgicalPriority: 'priority',
  },
  {
    id: 'breast_cancer',
    label: 'Breast cancer',
    category: 'Breast',
    icd10: [{ code: 'C50.911', description: 'Malignant neoplasm of unspecified site of right female breast' }],
    cpt: [
      { code: '19301', description: 'Partial mastectomy (lumpectomy)' },
      { code: '19303', description: 'Mastectomy, simple, complete' },
    ],
    keywords: /\b(breast cancer)\b/i,
    surgicalPriority: 'priority',
  },
  {
    id: 'nipple_discharge',
    label: 'Nipple discharge',
    category: 'Breast',
    icd10: [{ code: 'N64.52', description: 'Nipple discharge' }],
    cpt: [{ code: '19110', description: 'Excision of lactiferous duct fistula' }],
    keywords: /\b(nipple discharge|bloody nipple|discharge from (my |the )?nipple)\b/i,
    surgicalPriority: 'priority',
  },
  {
    id: 'breast_cyst',
    label: 'Breast cyst',
    category: 'Breast',
    icd10: [{ code: 'N60.0', description: 'Solitary cyst of breast' }],
    cpt: [{ code: '19000', description: 'Puncture aspiration of cyst of breast' }],
    keywords: /\b(breast cyst)\b/i,
    surgicalPriority: 'routine',
  },

  // ── Thyroid & Neck ───────────────────────────────────────────────────────
  {
    id: 'thyroid_nodule',
    label: 'Thyroid nodule',
    category: 'Thyroid & Neck',
    icd10: [{ code: 'E04.1', description: 'Nontoxic single thyroid nodule' }],
    cpt: [
      { code: '10005', description: 'Fine needle aspiration biopsy, thyroid, with imaging guidance' },
      { code: '60220', description: 'Total thyroid lobectomy, unilateral' },
    ],
    keywords: /\b(thyroid nodule|lump in (my |the )?(neck|throat)|neck swelling)\b/i,
    surgicalPriority: 'routine',
  },
  {
    id: 'multinodular_goitre',
    label: 'Multinodular goitre',
    category: 'Thyroid & Neck',
    icd10: [{ code: 'E04.2', description: 'Nontoxic multinodular goitre' }],
    cpt: [{ code: '60240', description: 'Total thyroidectomy' }],
    keywords: /\b(goitre|goiter|enlarged thyroid)\b/i,
    surgicalPriority: 'routine',
  },
  {
    id: 'thyroid_carcinoma',
    label: 'Thyroid carcinoma',
    category: 'Thyroid & Neck',
    icd10: [{ code: 'C73', description: 'Malignant neoplasm of thyroid gland' }],
    cpt: [{ code: '60240', description: 'Total thyroidectomy' }],
    keywords: /\b(thyroid cancer|thyroid carcinoma)\b/i,
    surgicalPriority: 'priority',
  },
  {
    id: 'cervical_lymphadenopathy',
    label: 'Cervical lymphadenopathy for biopsy',
    category: 'Thyroid & Neck',
    icd10: [{ code: 'R59.0', description: 'Localized enlarged lymph nodes' }],
    cpt: [{ code: '38510', description: 'Excisional biopsy of cervical lymph node, deep' }],
    keywords: /\b(swollen (lymph node|gland)s? in (my |the )?neck|enlarged (lymph )?node)\b/i,
    surgicalPriority: 'priority',
  },

  // ── Skin & Soft Tissue ───────────────────────────────────────────────────
  {
    id: 'sebaceous_cyst',
    label: 'Sebaceous / epidermoid cyst',
    category: 'Skin & Soft Tissue',
    icd10: [{ code: 'L72.3', description: 'Sebaceous cyst' }],
    cpt: [{ code: '11402', description: 'Excision, benign lesion, 1.1-2.0 cm' }],
    keywords: /\b(sebaceous cyst|epidermoid cyst|skin cyst)\b/i,
    surgicalPriority: 'routine',
  },
  {
    id: 'lipoma',
    label: 'Lipoma',
    category: 'Skin & Soft Tissue',
    icd10: [{ code: 'D17.9', description: 'Benign lipomatous neoplasm, unspecified' }],
    cpt: [{ code: '21931', description: 'Excision of subcutaneous soft tissue tumour, back/flank' }],
    keywords: /\b(lipoma|fatty lump)\b/i,
    surgicalPriority: 'routine',
  },
  {
    id: 'skin_abscess',
    label: 'Skin / soft tissue abscess',
    category: 'Skin & Soft Tissue',
    icd10: [{ code: 'L02.91', description: 'Cutaneous abscess, unspecified' }],
    cpt: [{ code: '10060', description: 'Incision and drainage of abscess, simple' }],
    keywords: /\b(abscess|boil|skin infection (with )?pus)\b/i,
    surgicalPriority: 'priority',
  },
  {
    id: 'ingrown_toenail',
    label: 'Ingrown toenail',
    category: 'Skin & Soft Tissue',
    icd10: [{ code: 'L60.0', description: 'Ingrowing nail' }],
    cpt: [{ code: '11750', description: 'Excision of nail and nail matrix, partial or complete' }],
    keywords: /\b(ingrown (toe)?nail|infected (toe)?nail)\b/i,
    surgicalPriority: 'routine',
  },
  {
    id: 'skin_malignancy',
    label: 'Suspicious skin lesion / possible skin cancer',
    category: 'Skin & Soft Tissue',
    icd10: [{ code: 'C44.91', description: 'Squamous cell carcinoma of skin, unspecified' }],
    cpt: [{ code: '11604', description: 'Excision, malignant lesion, 2.1-3.0 cm' }],
    keywords: /\b(suspicious (mole|lesion|skin spot)|changing mole|skin cancer|non.?healing (wound|sore|ulcer))\b/i,
    surgicalPriority: 'priority',
  },
  {
    id: 'wound_concern',
    label: 'Wound concern (post-traumatic or surgical)',
    category: 'Skin & Soft Tissue',
    icd10: [{ code: 'T81.4', description: 'Infection following a procedure' }],
    cpt: [{ code: '12001', description: 'Simple repair of superficial wounds' }],
    keywords: /\b(wound (concern|infection|not healing|opened|leaking|red|swollen)|stitches (problem|opened))\b/i,
    surgicalPriority: 'priority',
  },

  // ── Vascular & Diabetic Foot ─────────────────────────────────────────────
  {
    id: 'diabetic_foot_ulcer',
    label: 'Diabetic foot ulcer',
    category: 'Vascular & Diabetic Foot',
    icd10: [
      { code: 'E11.621', description: 'Type 2 diabetes mellitus with foot ulcer' },
      { code: 'L97.5', description: 'Non-pressure chronic ulcer of other part of foot' },
    ],
    cpt: [{ code: '11042', description: 'Debridement, subcutaneous tissue, first 20 sq cm' }],
    keywords: /\b(diabetic foot|foot ulcer|foot wound (not healing)?)\b/i,
    surgicalPriority: 'urgent',
  },
  {
    id: 'foot_gangrene',
    label: 'Foot gangrene / critical limb ischaemia',
    category: 'Vascular & Diabetic Foot',
    icd10: [{ code: 'I96', description: 'Gangrene, not elsewhere classified' }],
    cpt: [{ code: '28805', description: 'Amputation, foot; transmetatarsal' }],
    keywords: /\b(gangrene|black toe|dead tissue (on|in) (the )?(foot|toe))\b/i,
    surgicalPriority: 'urgent',
  },
  {
    id: 'varicose_veins',
    label: 'Varicose veins with ulceration',
    category: 'Vascular & Diabetic Foot',
    icd10: [{ code: 'I83.0', description: 'Varicose veins of lower extremities with ulcer' }],
    cpt: [{ code: '36475', description: 'Endovenous ablation, radiofrequency, incompetent vein' }],
    keywords: /\b(varicose veins?|leg ulcer|venous ulcer)\b/i,
    surgicalPriority: 'routine',
  },
  {
    id: 'peripheral_vascular_disease',
    label: 'Peripheral arterial / vascular disease',
    category: 'Vascular & Diabetic Foot',
    icd10: [{ code: 'I73.9', description: 'Peripheral vascular disease, unspecified' }],
    cpt: [{ code: '93922', description: 'Non-invasive physiologic study of extremity arteries, limited' }],
    keywords: /\b(claudication|leg pain (on|when) walking|cold (foot|feet|leg)|poor circulation)\b/i,
    surgicalPriority: 'priority',
  },
  {
    id: 'leg_swelling_dvt',
    label: 'Leg swelling — possible DVT',
    category: 'Vascular & Diabetic Foot',
    icd10: [{ code: 'I82.409', description: 'Acute embolism and thrombosis of unspecified deep veins of lower extremity' }],
    cpt: [{ code: '93971', description: 'Duplex scan of extremity veins, complete bilateral study' }],
    keywords: /\b(leg swelling|swollen leg|calf swelling|dvt|deep vein thrombosis)\b/i,
    surgicalPriority: 'urgent',
  },

  // ── ERCP & Pancreatobiliary ──────────────────────────────────────────────
  {
    id: 'pancreatitis_acute',
    label: 'Acute biliary pancreatitis',
    category: 'ERCP & Pancreatobiliary',
    icd10: [{ code: 'K85.10', description: 'Biliary acute pancreatitis without necrosis or infection' }],
    cpt: [{ code: '43262', description: 'ERCP with sphincterotomy/papillotomy' }],
    keywords: /\b(pancreatitis|severe epigastric pain (radiating|going) (to|through) (the )?back)\b/i,
    surgicalPriority: 'urgent',
  },
  {
    id: 'pancreatic_pseudocyst',
    label: 'Pancreatic pseudocyst',
    category: 'ERCP & Pancreatobiliary',
    icd10: [{ code: 'K86.3', description: 'Pseudocyst of pancreas' }],
    cpt: [{ code: '43240', description: 'EUS-guided transmural drainage of pseudocyst' }],
    keywords: /\b(pancreatic (pseudo)?cyst)\b/i,
    surgicalPriority: 'priority',
  },
  {
    id: 'chronic_pancreatitis',
    label: 'Chronic pancreatitis',
    category: 'ERCP & Pancreatobiliary',
    icd10: [{ code: 'K86.1', description: 'Other chronic pancreatitis' }],
    cpt: [{ code: '43266', description: 'ERCP with stent placement, pancreatic/biliary duct' }],
    keywords: /\b(chronic pancreatitis)\b/i,
    surgicalPriority: 'routine',
  },
  {
    id: 'bile_duct_stricture',
    label: 'Bile duct stricture',
    category: 'ERCP & Pancreatobiliary',
    icd10: [{ code: 'K83.1', description: 'Obstruction of bile duct' }],
    cpt: [{ code: '43273', description: 'ERCP with removal and exchange of biliary stent(s)' }],
    keywords: /\b(bile duct (stricture|narrowing|blockage))\b/i,
    surgicalPriority: 'priority',
  },
  {
    id: 'pancreatic_cancer',
    label: 'Pancreatic / ampullary tumour',
    category: 'ERCP & Pancreatobiliary',
    icd10: [{ code: 'C25.9', description: 'Malignant neoplasm of pancreas, unspecified' }],
    cpt: [{ code: '43275', description: 'ERCP with ampullectomy' }],
    keywords: /\b(pancreatic (cancer|mass|tumou?r)|ampullary (tumou?r|mass))\b/i,
    surgicalPriority: 'priority',
  },
];

/** Maps surgicalPriority to a sort weight — higher routes earlier ("magnet"). */
const PRIORITY_WEIGHT: Record<SurgicalPathology['surgicalPriority'], number> = {
  urgent: 3,
  priority: 2,
  review: 1,
  routine: 0,
};

/**
 * Returns all surgical pathologies whose keyword pattern matches the given
 * text, sorted with the most urgent matches first. Used by `adaptiveTriage()`
 * to surface a "primarily surgical" flag and suggested ICD-10/CPT codes at
 * the earliest possible step (booking reason, chief complaint, free text).
 */
export function matchSurgicalPathologies(text: string): SurgicalPathology[] {
  if (!text.trim()) return [];
  return SURGICAL_PATHOLOGIES
    .filter(p => p.keywords.test(text))
    .sort((a, b) => PRIORITY_WEIGHT[b.surgicalPriority] - PRIORITY_WEIGHT[a.surgicalPriority]);
}

/** True if the text matches at least one known surgical pathology. */
export function isPrimarilySurgical(text: string): boolean {
  return matchSurgicalPathologies(text).length > 0;
}
