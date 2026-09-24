/**
 * Drug-term vocabulary for the interaction checker (`drug-interactions.ts`) — hazard log H-07.
 *
 * Interaction rules are written against TERMS: either a class ("nsaid", "opioid", "ssri") or a
 * specific drug ("warfarin"). A class name never appears in a real prescription string, so
 * before this map "warfarin" + "diclofenac 50 mg tds" raised NO alert (the rule said
 * "warfarin" + "nsaid"). Every term used by any rule MUST have an entry here; a lint-style
 * test (`__tests__/drug-interactions.test.ts`) fails the build when a rule names a term that
 * is not mapped, or a class that has no members.
 *
 * Member syntax: `'generic|synonym|Brand|Brand'`. The first name is the canonical generic
 * (used to tell two different drugs of the same class apart); the rest are older/other INN
 * spellings (frusemide, indomethacin, meperidine, acetaminophen) and common Caribbean / UK /
 * US brand names. Members are matched case-insensitively as WHOLE WORDS, so a short brand
 * cannot fire inside an unrelated word (e.g. "ASA" never matches "nasal"), and a name directly
 * after "<digit>-" is not a word start ("5-ASA" is mesalazine, not aspirin). The raw term is
 * substring-matched only for terms the original 36 rules use; newer terms ("arb") match as
 * whole words only. Both rules match the iOS port (`ios/AmiseMedFlow/Services/DrugClasses.swift`).
 *
 * Class membership follows the BNF (British National Formulary, BNF online — drug monographs
 * and "Interactions" appendix) and Stockley's Drug Interactions; brand names from the
 * product SmPCs (UK eMC) / US labels. QT-prolonging membership follows CredibleMeds
 * "Known Risk of TdP" (AZCERT), cross-checked with the BNF. Each class records its source.
 *
 * Decision support only. This list is partial by design; absence of an alert does not mean
 * absence of an interaction.
 */

export interface DrugTermDef {
  /** 'class' = pharmacological class; 'drug' = a single drug (members = its synonyms/brands). */
  kind: 'class' | 'drug';
  /** Display label shown when an alert fires through class membership (e.g. "NSAID"). */
  label: string;
  /** Standard the membership is taken from — required for every clinical term. */
  source: string;
  /** 'generic|synonym|Brand…' strings. A class must have ≥1 member. */
  members: string[];
}

const BNF = 'BNF (drug monographs and Interactions appendix); Stockley\'s Drug Interactions';

// ── Reusable member lists ───────────────────────────────────────────────────────

const WARFARIN = 'warfarin|coumadin|marevan|jantoven';
const HEPARINS = [
  'heparin|heparin sodium|unfractionated heparin',
  'enoxaparin|clexane|lovenox|inhixa',
  'dalteparin|fragmin',
  'tinzaparin|innohep',
];
const ASPIRIN = 'aspirin|acetylsalicylic acid|asa|ecotrin|disprin|nu-seals|aspro';
const CIPROFLOXACIN = 'ciprofloxacin|cipro|ciproxin';
const FLUCONAZOLE = 'fluconazole|diflucan';
const AMIODARONE = 'amiodarone|cordarone|pacerone';
const CITALOPRAM = 'citalopram|cipramil|celexa';
const ESCITALOPRAM = 'escitalopram|cipralex|lexapro';
const ERYTHROMYCIN = 'erythromycin|erythrocin|erymax|e-mycin';
const CLARITHROMYCIN = 'clarithromycin|klaricid|biaxin';
const AZITHROMYCIN = 'azithromycin|zithromax';
const SOTALOL = 'sotalol|sotacor|beta-cardone|betapace';
const SPIRONOLACTONE = 'spironolactone|aldactone';
const EPLERENONE = 'eplerenone|inspra';
const AMILORIDE = 'amiloride|midamor|moduretic|co-amilofruse|co-amilozide';
const TRIAMTERENE = 'triamterene|dyazide|dytac|maxzide';

export const DRUG_TERMS: Record<string, DrugTermDef> = {
  // ═════════════════════════════ CLASSES ═════════════════════════════

  nsaid: {
    kind: 'class', label: 'NSAID',
    source: `${BNF} — non-steroidal anti-inflammatory drugs. Aspirin is deliberately NOT included: the BNF lists it under antiplatelet drugs and handles its interactions separately (e.g. low-dose aspirin + lithium is not the NSAID interaction).`,
    members: [
      'diclofenac|voltaren|voltarol|cataflam|arthrotec|dyloject',
      'ibuprofen|advil|motrin|nurofen|brufen',
      'naproxen|naprosyn|aleve|anaprox|naprogesic|vimovo',
      'ketorolac|toradol',
      'celecoxib|celebrex',
      'etoricoxib|arcoxia',
      'parecoxib|dynastat',
      'meloxicam|mobic',
      'indometacin|indomethacin|indocin|indocid',
      'mefenamic acid|ponstan',
      'piroxicam|feldene',
      'ketoprofen|oruvail',
      'dexketoprofen|keral',
      'aceclofenac|preservex',
      'etodolac|lodine',
      'nabumetone|relifex',
      'flurbiprofen',
      'sulindac',
      'tenoxicam|mobiflex',
      'lornoxicam',
      'diflunisal',
      'tolfenamic acid',
    ],
  },

  opioid: {
    kind: 'class', label: 'opioid',
    source: `${BNF} — opioid analgesics (incl. combination products containing codeine/dihydrocodeine/tramadol/oxycodone).`,
    members: [
      'morphine|mst continus|ms contin|oramorph|sevredol|zomorph',
      'diamorphine',
      'codeine|codeine phosphate|co-codamol|tylenol with codeine|tylenol #3|solpadeine|kapake|zapain',
      'dihydrocodeine|df118|dhc continus|co-dydramol',
      'oxycodone|oxycontin|oxynorm|percocet|endone|targinact',
      'hydromorphone|palladone|dilaudid',
      'fentanyl|durogesic|actiq|abstral|sublimaze',
      'alfentanil',
      'remifentanil|ultiva',
      'sufentanil',
      'tramadol|ultram|zydol|zamadol|tramacet|ultracet',
      'tapentadol|palexia|nucynta',
      'pethidine|meperidine|demerol',
      'methadone|physeptone',
      'buprenorphine|subutex|suboxone|temgesic|butrans|transtec',
      'hydrocodone|vicodin|norco',
      'nalbuphine|nubain',
      'pentazocine',
      'meptazinol',
    ],
  },

  benzodiazepine: {
    kind: 'class', label: 'benzodiazepine',
    source: `${BNF} — benzodiazepines (MHRA Drug Safety Update, March 2020: opioids + benzodiazepines, risk of profound sedation, respiratory depression, coma and death).`,
    members: [
      'diazepam|valium|stesolid',
      'lorazepam|ativan',
      'midazolam|hypnovel|versed|buccolam|epistatus',
      'alprazolam|xanax',
      'clonazepam|klonopin|rivotril',
      'temazepam',
      'chlordiazepoxide|librium',
      'nitrazepam|mogadon',
      'oxazepam',
      'bromazepam|lexotan',
      'clobazam|frisium',
      'lormetazepam',
      'flurazepam',
      'clorazepate|tranxene',
      'remimazolam|byfavo',
    ],
  },

  ssri: {
    kind: 'class', label: 'SSRI',
    source: `${BNF} — selective serotonin re-uptake inhibitors.`,
    members: [
      'sertraline|zoloft|lustral',
      'fluoxetine|prozac|sarafem',
      CITALOPRAM,
      ESCITALOPRAM,
      'paroxetine|seroxat|paxil',
      'fluvoxamine|faverin|luvox',
    ],
  },

  snri: {
    kind: 'class', label: 'SNRI',
    source: `${BNF} — serotonin and noradrenaline re-uptake inhibitors.`,
    members: [
      'venlafaxine|effexor|efexor',
      'desvenlafaxine|pristiq',
      'duloxetine|cymbalta|yentreve',
      'milnacipran|savella',
      'levomilnacipran|fetzima',
    ],
  },

  maoi: {
    kind: 'class', label: 'MAOI',
    source: `${BNF} — monoamine-oxidase inhibitors, irreversible and reversible (moclobemide), MAO-B inhibitors (selegiline, rasagiline, safinamide: SmPCs contraindicate pethidine and warn on tramadol/SSRIs). Linezolid is a reversible non-selective MAOI (BNF; Zyvox SmPC). Methylthioninium chloride (methylene blue) is a potent MAO-A inhibitor — MHRA/Proveblue SmPC: serotonin syndrome with serotonergic drugs; relevant to parathyroid/sentinel-node surgery.`,
    members: [
      'phenelzine|nardil',
      'tranylcypromine|parnate',
      'isocarboxazid|marplan',
      'moclobemide|manerix|aurorix',
      'selegiline|eldepryl|zelapar|emsam',
      'rasagiline|azilect',
      'safinamide|xadago',
      'linezolid|zyvox',
      'methylthioninium chloride|methylene blue|methylthioninium|proveblue',
    ],
  },

  steroid: {
    kind: 'class', label: 'systemic corticosteroid',
    source: `${BNF} — systemic corticosteroids (hyperglycaemia; GI bleeding with NSAIDs). Inhaled/topical-only agents (beclometasone, fluticasone, mometasone) are deliberately not listed.`,
    members: [
      'prednisolone',
      'prednisone|deltasone',
      'hydrocortisone|solu-cortef|efcortesol',
      'methylprednisolone|solu-medrol|medrol|depo-medrone',
      'dexamethasone|decadron',
      'deflazacort',
    ],
  },

  'ace inhibitor': {
    kind: 'class', label: 'ACE inhibitor',
    source: `${BNF} — angiotensin-converting enzyme inhibitors.`,
    members: [
      'lisinopril|zestril|prinivil|zestoretic|carace',
      'enalapril|vasotec|innovace|renitec',
      'ramipril|tritace|altace',
      'perindopril|coversyl|aceon',
      'captopril|capoten',
      'quinapril|accupro|accupril',
      'fosinopril',
      'trandolapril|gopten|mavik',
      'benazepril|lotensin',
      'cilazapril',
      'imidapril',
      'moexipril',
    ],
  },

  arb: {
    kind: 'class', label: 'angiotensin-II receptor blocker',
    source: `${BNF} — angiotensin-II receptor antagonists (incl. sacubitril/valsartan).`,
    members: [
      'losartan|cozaar|hyzaar',
      'valsartan|diovan|entresto|exforge',
      'irbesartan|aprovel|avapro',
      'candesartan|atacand|amias',
      'telmisartan|micardis',
      'olmesartan|benicar|olmetec',
      'azilsartan|edarbi',
      'eprosartan',
    ],
  },

  diuretic: {
    kind: 'class', label: 'diuretic',
    source: `${BNF} — loop, thiazide/thiazide-like and potassium-sparing diuretics (lithium: BNF — diuretics reduce lithium excretion).`,
    members: [
      'furosemide|frusemide|lasix',
      'bumetanide|burinex|bumex',
      'torasemide|torsemide|demadex',
      'bendroflumethiazide|bendrofluazide|aprinox',
      'hydrochlorothiazide|hctz',
      'chlortalidone|chlorthalidone|hygroton',
      'indapamide|natrilix|natrixam',
      'metolazone|zaroxolyn',
      SPIRONOLACTONE,
      EPLERENONE,
      AMILORIDE,
      TRIAMTERENE,
    ],
  },

  'potassium-sparing diuretic': {
    kind: 'class', label: 'potassium-sparing diuretic / aldosterone antagonist',
    source: `${BNF} — potassium-sparing diuretics and aldosterone antagonists (hyperkalaemia with ACE inhibitors / ARBs / potassium).`,
    members: [SPIRONOLACTONE, EPLERENONE, AMILORIDE, TRIAMTERENE],
  },

  potassium: {
    kind: 'class', label: 'potassium supplement',
    source: `${BNF} — potassium salts (oral/IV potassium chloride products).`,
    members: ['potassium chloride|slow-k|sando-k|kay-cee-l|klor-con|k-dur'],
  },

  'beta blocker': {
    kind: 'class', label: 'beta-blocker',
    source: `${BNF} — beta-adrenoceptor blocking drugs.`,
    members: [
      'atenolol|tenormin|tenoretic|co-tenidone',
      'bisoprolol|cardicor|concor|emcor',
      'metoprolol|lopressor|betaloc|toprol',
      'propranolol|inderal',
      'carvedilol|coreg|eucardic',
      'labetalol|trandate',
      'nebivolol|nebilet|bystolic',
      SOTALOL,
      'esmolol|brevibloc',
      'nadolol|corgard',
      'acebutolol|sectral',
      'celiprolol',
    ],
  },

  antacid: {
    kind: 'class', label: 'antacid',
    source: `${BNF} — antacids containing aluminium, magnesium or calcium (chelate quinolones; separate doses). Ciprofloxacin SmPC.`,
    members: [
      'aluminium hydroxide|aluminum hydroxide',
      'magnesium hydroxide|milk of magnesia',
      'magnesium trisilicate',
      'calcium carbonate|tums|rennie',
      'gaviscon',
      'maalox',
      'mylanta',
    ],
  },

  'neuromuscular blocking': {
    kind: 'class', label: 'neuromuscular blocker',
    source: `${BNF} — neuromuscular blocking drugs (clindamycin enhances blockade; clindamycin SmPC).`,
    members: [
      'rocuronium|esmeron|zemuron',
      'vecuronium',
      'atracurium|tracrium',
      'cisatracurium|nimbex',
      'suxamethonium|succinylcholine|anectine',
      'pancuronium',
      'mivacurium',
    ],
  },

  contrast: {
    kind: 'class', label: 'iodinated contrast',
    source: 'RCR "Guidance on the use of iodinated contrast media" and metformin SmPC; BNF metformin monograph. Gadolinium (MRI) agents are not iodinated and not listed.',
    members: [
      'iodinated contrast|iv contrast|ct contrast',
      'iohexol|omnipaque',
      'iopamidol|isovue|niopam',
      'iodixanol|visipaque',
      'ioversol|optiray',
      'iopromide|ultravist',
      'iomeprol|iomeron',
    ],
  },

  insulin: {
    kind: 'class', label: 'insulin',
    source: `${BNF} — insulins (analogue and human).`,
    members: [
      'insulin glargine|lantus|toujeo|abasaglar|basaglar|semglee',
      'insulin detemir|levemir',
      'insulin degludec|tresiba',
      'insulin aspart|novorapid|novolog|fiasp',
      'insulin lispro|humalog|admelog|lyumjev',
      'insulin glulisine|apidra',
      'human insulin|actrapid|humulin|insulatard|novolin|mixtard',
      'biphasic insulin aspart|novomix',
    ],
  },

  heparin: {
    kind: 'class', label: 'heparin / LMWH',
    source: `${BNF} — heparins: unfractionated and low-molecular-weight (NSAIDs increase bleeding risk).`,
    members: HEPARINS,
  },

  anticoagulant: {
    kind: 'class', label: 'anticoagulant',
    source: `${BNF} — coumarins/phenindione, direct oral anticoagulants (DOACs), heparins, fondaparinux, parenteral direct thrombin inhibitors.`,
    members: [
      WARFARIN,
      'acenocoumarol|sinthrome|sintrom',
      'phenindione',
      'rivaroxaban|xarelto',
      'apixaban|eliquis',
      'dabigatran|pradaxa',
      'edoxaban|lixiana|savaysa',
      ...HEPARINS,
      'fondaparinux|arixtra',
      'argatroban',
      'bivalirudin|angiomax',
    ],
  },

  antiplatelet: {
    kind: 'class', label: 'antiplatelet',
    source: `${BNF} — antiplatelet drugs.`,
    members: [
      ASPIRIN,
      'clopidogrel|plavix',
      'prasugrel|effient',
      'ticagrelor|brilinta|brilique',
      'dipyridamole|persantin|asasantin|aggrenox',
      'cilostazol|pletal',
      'ticlopidine',
    ],
  },

  'qt prolonging': {
    kind: 'class', label: 'QT-prolonging drug',
    source: 'CredibleMeds (AZCERT) "Known Risk of TdP" list, cross-checked with BNF. Intra-operative anaesthetic agents on that list (propofol, sevoflurane) are deliberately not included: they are given under continuous ECG monitoring by the anaesthetist and would fire on every theatre case.',
    members: [
      AMIODARONE,
      'dronedarone|multaq',
      SOTALOL,
      'flecainide|tambocor',
      'disopyramide|rythmodan',
      'quinidine',
      'dofetilide|tikosyn',
      'haloperidol|haldol|serenace',
      'droperidol|xomolix',
      'chlorpromazine|largactil|thorazine',
      'pimozide|orap',
      'thioridazine',
      'sulpiride|dolmatil',
      CITALOPRAM,
      ESCITALOPRAM,
      'ondansetron|zofran',
      'domperidone|motilium',
      'methadone|physeptone',
      ERYTHROMYCIN,
      CLARITHROMYCIN,
      AZITHROMYCIN,
      'levofloxacin|levaquin|tavanic',
      'moxifloxacin|avelox',
      CIPROFLOXACIN,
      FLUCONAZOLE,
      'hydroxychloroquine|plaquenil',
      'chloroquine|avloclor',
      'donepezil|aricept',
      'pentamidine',
    ],
  },

  macrolide: {
    kind: 'class', label: 'macrolide',
    source: `${BNF} — macrolides (increase the anticoagulant effect of warfarin).`,
    members: [ERYTHROMYCIN, CLARITHROMYCIN, AZITHROMYCIN, 'roxithromycin'],
  },

  'azole antifungal': {
    kind: 'class', label: 'azole antifungal',
    source: `${BNF} — triazole and imidazole antifungals (CYP2C9/3A4 inhibition). MHRA Drug Safety Update (June 2016): miconazole oral gel + warfarin — serious bleeding.`,
    members: [
      FLUCONAZOLE,
      'itraconazole|sporanox',
      'ketoconazole|nizoral',
      'voriconazole|vfend',
      'posaconazole|noxafil',
      'isavuconazole|cresemba',
      'miconazole|daktarin',
    ],
  },

  gabapentinoid: {
    kind: 'class', label: 'gabapentinoid',
    source: `${BNF}; MHRA Drug Safety Update (Oct 2017 gabapentin, Feb 2021 pregabalin): respiratory depression with opioids.`,
    members: ['gabapentin|neurontin', 'pregabalin|lyrica'],
  },

  // ═════════════════════════════ SPECIFIC DRUGS ═════════════════════════════
  // members = the drug's own synonyms and brands (and, where the legacy substring already
  // matched a close relative, that relative — e.g. "omeprazole" ⊂ "esomeprazole").

  warfarin:      { kind: 'drug', label: 'warfarin',      source: BNF, members: [WARFARIN] },
  aspirin:       { kind: 'drug', label: 'aspirin',       source: BNF, members: [ASPIRIN] },
  ibuprofen:     { kind: 'drug', label: 'ibuprofen',     source: BNF, members: ['ibuprofen|advil|motrin|nurofen|brufen'] },
  metronidazole: { kind: 'drug', label: 'metronidazole', source: BNF, members: ['metronidazole|flagyl|metrogyl'] },
  ciprofloxacin: { kind: 'drug', label: 'ciprofloxacin', source: BNF, members: [CIPROFLOXACIN] },
  fluconazole:   { kind: 'drug', label: 'fluconazole',   source: BNF, members: [FLUCONAZOLE] },
  amiodarone:    { kind: 'drug', label: 'amiodarone',    source: BNF, members: [AMIODARONE] },
  rivaroxaban:   { kind: 'drug', label: 'rivaroxaban',   source: BNF, members: ['rivaroxaban|xarelto'] },
  apixaban:      { kind: 'drug', label: 'apixaban',      source: BNF, members: ['apixaban|eliquis'] },
  clopidogrel:   { kind: 'drug', label: 'clopidogrel',   source: BNF, members: ['clopidogrel|plavix'] },
  omeprazole: {
    kind: 'drug', label: 'omeprazole / esomeprazole',
    source: `${BNF}; MHRA Drug Safety Update (April 2010): avoid omeprazole and esomeprazole with clopidogrel.`,
    members: ['omeprazole|losec|prilosec', 'esomeprazole|nexium'],
  },
  alcohol:       { kind: 'drug', label: 'alcohol',       source: BNF, members: ['alcohol|ethanol'] },
  theophylline: {
    kind: 'drug', label: 'theophylline / aminophylline',
    source: `${BNF} — aminophylline is theophylline ethylenediamine and shares its interactions.`,
    members: ['theophylline|uniphyllin|nuelin|theo-dur', 'aminophylline|phyllocontin'],
  },
  gentamicin:    { kind: 'drug', label: 'gentamicin',    source: BNF, members: ['gentamicin|cidomycin|genticin|garamycin'] },
  furosemide:    { kind: 'drug', label: 'furosemide',    source: BNF, members: ['furosemide|frusemide|lasix'] },
  clindamycin:   { kind: 'drug', label: 'clindamycin',   source: BNF, members: ['clindamycin|dalacin|cleocin'] },
  metformin: {
    kind: 'drug', label: 'metformin', source: `${BNF}; combination-product SmPCs.`,
    members: ['metformin|glucophage|janumet|jentadueto|synjardy|xigduo|eucreas|vokanamet|invokamet|kombiglyze|komboglyze'],
  },
  digoxin:       { kind: 'drug', label: 'digoxin',       source: BNF, members: ['digoxin|lanoxin'] },
  lisinopril:    { kind: 'drug', label: 'lisinopril',    source: BNF, members: ['lisinopril|zestril|prinivil|zestoretic|carace'] },
  amlodipine:    { kind: 'drug', label: 'amlodipine',    source: BNF, members: ['amlodipine|norvasc|istin|exforge|caduet'] },
  simvastatin:   { kind: 'drug', label: 'simvastatin',   source: BNF, members: ['simvastatin|zocor|inegy|vytorin'] },
  tramadol:      { kind: 'drug', label: 'tramadol',      source: BNF, members: ['tramadol|ultram|zydol|zamadol|tramacet|ultracet'] },
  sertraline:    { kind: 'drug', label: 'sertraline',    source: BNF, members: ['sertraline|zoloft|lustral'] },
  fluoxetine:    { kind: 'drug', label: 'fluoxetine',    source: BNF, members: ['fluoxetine|prozac|sarafem'] },
  morphine:      { kind: 'drug', label: 'morphine',      source: BNF, members: ['morphine|mst continus|ms contin|oramorph|sevredol|zomorph'] },
  midazolam:     { kind: 'drug', label: 'midazolam',     source: BNF, members: ['midazolam|hypnovel|versed|buccolam|epistatus'] },
  paracetamol: {
    kind: 'drug', label: 'paracetamol', source: `${BNF}; combination-product SmPCs.`,
    members: ['paracetamol|acetaminophen|panadol|tylenol|calpol|co-codamol|co-dydramol|tramacet|ultracet|percocet|solpadeine'],
  },
  lithium:       { kind: 'drug', label: 'lithium',       source: BNF, members: ['lithium|priadel|camcolit|liskonum'] },
  pethidine:     { kind: 'drug', label: 'pethidine',     source: BNF, members: ['pethidine|meperidine|demerol'] },
  methotrexate:  { kind: 'drug', label: 'methotrexate',  source: BNF, members: ['methotrexate|maxtrex|metoject|trexall|otrexup'] },
  clarithromycin:{ kind: 'drug', label: 'clarithromycin',source: BNF, members: [CLARITHROMYCIN] },
  erythromycin:  { kind: 'drug', label: 'erythromycin',  source: BNF, members: [ERYTHROMYCIN] },
};

// ── Parsing / matching ──────────────────────────────────────────────────────────

export interface ParsedMember {
  /** Canonical generic (first name). */
  generic: string;
  /** All names, lowercased, including the generic. */
  names: string[];
}

export function parseMember(member: string): ParsedMember {
  const names = member.split('|').map(s => s.trim().toLowerCase()).filter(Boolean);
  return { generic: names[0] ?? '', names };
}

/** ASCII a–z or 0–9 (entries are lowercased before matching). */
const isWordChar = (ch: string | undefined) => ch !== undefined && /[a-z0-9]/.test(ch);

/**
 * Case-sensitive (callers lowercase first) whole-word test: `name` must not be embedded in a
 * longer alphanumeric word. Same boundary rule as the regex `(^|[^a-z0-9])name(?=$|[^a-z0-9])`
 * (any non-ASCII character counts as a boundary), plus one exception ported from iOS
 * (`DrugClasses.swift`): a name directly after "<digit>-" is part of a chemical abbreviation,
 * not a new word, so "5-ASA" (mesalazine, e.g. "Mesalazine (5-ASA, Pentasa)") is not read as
 * "ASA" (aspirin). Written without regex lookbehind so it runs on older Safari/iPadOS.
 */
export function containsWholeWord(name: string, text: string): boolean {
  if (!name) return false;
  let from = 0;
  for (;;) {
    const start = text.indexOf(name, from);
    if (start < 0) return false;
    const end = start + name.length;
    const followsDigitHyphen = start >= 2 && text[start - 1] === '-' && /[0-9]/.test(text[start - 2]);
    const boundaryBefore = start === 0 || (!isWordChar(text[start - 1]) && !followsDigitHyphen);
    const boundaryAfter = end === text.length || !isWordChar(text[end]);
    if (boundaryBefore && boundaryAfter) return true;
    from = start + 1;
  }
}

interface CompiledTerm {
  def: DrugTermDef;
  members: { generic: string; names: string[] }[];
}

const compiled = new Map<string, CompiledTerm>();

function compile(term: string): CompiledTerm | undefined {
  const cached = compiled.get(term);
  if (cached) return cached;
  const def = DRUG_TERMS[term];
  if (!def) return undefined;
  const c: CompiledTerm = { def, members: def.members.map(parseMember) };
  compiled.set(term, c);
  return c;
}

export interface TermMatch {
  /** Canonical drug identity (generic name, or the raw term for a literal term match). */
  canonical: string;
  /** True when the match came from the legacy raw-substring rule (pre-H-07 behaviour). */
  legacy: boolean;
  /** Class label when matched through class membership (e.g. "NSAID"), else undefined. */
  viaClass?: string;
}

/**
 * Does the (lowercased) medication entry match a rule term?
 *  1. Any member name of the term (generic, synonym, brand), as a whole word (H-07).
 *  2. The term itself:
 *     - `substringFallback` true (terms named by the ORIGINAL 36 rules — `LEGACY_TERMS` in
 *       `drug-interactions.ts`): the pre-H-07 raw substring test, kept unchanged so no existing
 *       alert can disappear ("nsaid" in "nsaid prn", "warfarin" in "warfarin 5mg").
 *     - otherwise (terms only the H-07 class rules use): as a whole word only. A raw substring
 *       made the new term "arb" fire inside "carbamazepine", "carboplatin", "sodium
 *       bicarbonate", "ferric carboxymaltose" and "calcium carbonate" (false alerts found by the
 *       iOS port). The literal class name ("ARB", "SNRI prn") still matches as a word.
 */
export function matchTerm(term: string, entryLc: string, substringFallback = false): TermMatch | null {
  const substringHit = substringFallback && entryLc.includes(term);
  const c = compile(term);
  for (const m of c?.members ?? []) {
    if (m.names.some(name => containsWholeWord(name, entryLc))) {
      return {
        canonical: m.generic,
        legacy: substringHit,
        viaClass: c!.def.kind === 'class' ? c!.def.label : undefined,
      };
    }
  }
  if (substringHit) return { canonical: term, legacy: true };
  if (!substringFallback && containsWholeWord(term, entryLc)) return { canonical: term, legacy: false };
  return null;
}
