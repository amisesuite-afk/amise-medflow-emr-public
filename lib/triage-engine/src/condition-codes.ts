/**
 * ICD-10-CM Coded Conditions Catalog
 *
 * Comprehensive catalog for an outpatient general and endoscopic surgery
 * practice in Saint Lucia (Amise Medical Services).
 *
 * All codes follow ICD-10-CM (Clinical Modification) conventions.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ConditionCode {
  /** ICD-10-CM code */
  icd10: string;
  /** Full clinical description */
  description: string;
  /** Short display name */
  shortName: string;
  /** Body system / specialty grouping */
  category: ConditionCategory;
  /** Plain-language phrases patients use to describe symptoms */
  commonPresentations: string[];
  /** Clinically related ICD-10 codes from this catalog */
  relatedCodes: string[];
}

export type ConditionCategory =
  | 'Gastrointestinal'
  | 'Breast'
  | 'Thyroid & Endocrine'
  | 'Hepatobiliary & Pancreatic'
  | 'Anorectal'
  | 'Vascular'
  | 'Skin & Soft Tissue'
  | 'Trauma'
  | 'Comorbidities'
  | 'Screening & Prevention';

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

export const CONDITION_CODES: ConditionCode[] = [
  // =========================================================================
  // GASTROINTESTINAL (~27 codes)
  // =========================================================================
  {
    icd10: 'K35.80',
    description: 'Unspecified acute appendicitis without abscess',
    shortName: 'Acute appendicitis',
    category: 'Gastrointestinal',
    commonPresentations: [
      'stomach pain that moved to the right side',
      'pain in lower right belly',
      'nausea and loss of appetite with abdominal pain',
      'sharp pain near my hip bone on the right',
    ],
    relatedCodes: ['K35.89', 'K36'],
  },
  {
    icd10: 'K35.89',
    description: 'Other acute appendicitis without abscess',
    shortName: 'Acute appendicitis (other)',
    category: 'Gastrointestinal',
    commonPresentations: [
      'severe pain on the right side of my belly',
      'fever with right-sided stomach pain',
      'pain started around my navel then moved right',
    ],
    relatedCodes: ['K35.80', 'K36'],
  },
  {
    icd10: 'K36',
    description: 'Other appendicitis (chronic)',
    shortName: 'Chronic appendicitis',
    category: 'Gastrointestinal',
    commonPresentations: [
      'recurring pain in the right side of my belly',
      'on-and-off discomfort in lower right abdomen',
      'dull ache near my appendix area that keeps coming back',
    ],
    relatedCodes: ['K35.80', 'K35.89'],
  },
  {
    icd10: 'K81.0',
    description: 'Acute cholecystitis',
    shortName: 'Acute cholecystitis',
    category: 'Gastrointestinal',
    commonPresentations: [
      'sudden severe pain under my right rib cage',
      'pain in upper right belly after eating fatty food',
      'right-sided pain going into my shoulder',
      'nausea and vomiting with belly pain on the right',
    ],
    relatedCodes: ['K81.1', 'K80.20', 'K80.00'],
  },
  {
    icd10: 'K81.1',
    description: 'Chronic cholecystitis',
    shortName: 'Chronic cholecystitis',
    category: 'Gastrointestinal',
    commonPresentations: [
      'recurring pain under my right rib cage after meals',
      'discomfort on the right side that comes and goes',
      'bloating and nausea after eating greasy food',
    ],
    relatedCodes: ['K81.0', 'K80.20', 'K80.00'],
  },
  {
    icd10: 'K80.20',
    description: 'Calculus of gallbladder without cholecystitis, without obstruction',
    shortName: 'Gallstones',
    category: 'Gastrointestinal',
    commonPresentations: [
      'gallbladder attacks after eating',
      'sharp pain in upper right belly',
      'stones found on ultrasound',
      'biliary colic episodes',
    ],
    relatedCodes: ['K80.00', 'K81.0', 'K81.1'],
  },
  {
    icd10: 'K80.00',
    description: 'Calculus of gallbladder with acute cholecystitis, without obstruction',
    shortName: 'Gallstones with acute cholecystitis',
    category: 'Gastrointestinal',
    commonPresentations: [
      'gallbladder pain with fever',
      'gallstone attack that will not go away',
      'severe right upper belly pain with nausea and fever',
    ],
    relatedCodes: ['K80.20', 'K81.0', 'K81.1'],
  },
  {
    icd10: 'K21.0',
    description: 'Gastro-oesophageal reflux disease with oesophagitis',
    shortName: 'GORD with oesophagitis',
    category: 'Gastrointestinal',
    commonPresentations: [
      'burning in my chest especially at night',
      'acid coming up into my throat',
      'heartburn that will not go away with antacids',
      'food coming back up after eating',
    ],
    relatedCodes: ['K21.9', 'K25.9', 'K26.9'],
  },
  {
    icd10: 'K21.9',
    description: 'Gastro-oesophageal reflux disease without oesophagitis',
    shortName: 'GORD',
    category: 'Gastrointestinal',
    commonPresentations: [
      'acid reflux and heartburn',
      'burning feeling in my chest after meals',
      'sour taste in my mouth in the morning',
    ],
    relatedCodes: ['K21.0', 'K25.9', 'K26.9'],
  },
  {
    icd10: 'K25.9',
    description: 'Gastric ulcer, unspecified as acute or chronic, without haemorrhage or perforation',
    shortName: 'Gastric ulcer',
    category: 'Gastrointestinal',
    commonPresentations: [
      'gnawing pain in my stomach',
      'burning in my belly that is worse after eating',
      'stomach pain that wakes me up at night',
      'feeling full quickly and belly pain',
    ],
    relatedCodes: ['K26.9', 'K21.0', 'K29.70', 'K92.0'],
  },
  {
    icd10: 'K26.9',
    description: 'Duodenal ulcer, unspecified as acute or chronic, without haemorrhage or perforation',
    shortName: 'Duodenal ulcer',
    category: 'Gastrointestinal',
    commonPresentations: [
      'stomach pain a few hours after eating',
      'pain in upper belly that gets better when I eat',
      'burning feeling between my belly button and chest',
    ],
    relatedCodes: ['K25.9', 'K21.0', 'K29.70', 'K92.1'],
  },
  {
    icd10: 'K57.30',
    description: 'Diverticulosis of large intestine without perforation or abscess without bleeding',
    shortName: 'Diverticulosis',
    category: 'Gastrointestinal',
    commonPresentations: [
      'doctor said I have pockets in my colon',
      'diverticulosis found on colonoscopy',
      'told I have outpouchings in my bowel',
    ],
    relatedCodes: ['K57.32', 'D12.6', 'Z12.11'],
  },
  {
    icd10: 'K57.32',
    description: 'Diverticulitis of large intestine without perforation or abscess without bleeding',
    shortName: 'Diverticulitis',
    category: 'Gastrointestinal',
    commonPresentations: [
      'pain in my lower left belly',
      'left-sided stomach pain with fever',
      'cramping in the lower part of my belly',
      'bowel flare-up with pain and constipation',
    ],
    relatedCodes: ['K57.30', 'K56.60', 'K92.2'],
  },
  {
    icd10: 'K50.90',
    description: "Crohn's disease, unspecified, without complications",
    shortName: "Crohn's disease",
    category: 'Gastrointestinal',
    commonPresentations: [
      'chronic diarrhoea with belly pain',
      'weight loss and cramping in my gut',
      'blood in my stool and tiredness',
      'mouth sores and belly pain together',
    ],
    relatedCodes: ['K51.90', 'K60.2', 'K92.2'],
  },
  {
    icd10: 'K51.90',
    description: 'Ulcerative colitis, unspecified, without complications',
    shortName: 'Ulcerative colitis',
    category: 'Gastrointestinal',
    commonPresentations: [
      'bloody diarrhoea',
      'frequent loose stools with mucus',
      'cramping in my lower belly with urgency',
      'going to the toilet many times a day with blood',
    ],
    relatedCodes: ['K50.90', 'K92.2', 'K92.1'],
  },
  {
    icd10: 'D12.6',
    description: 'Benign neoplasm of colon, unspecified',
    shortName: 'Colonic polyp',
    category: 'Gastrointestinal',
    commonPresentations: [
      'polyp found during colonoscopy',
      'doctor removed a growth from my colon',
      'follow-up for polyps found in my bowel',
    ],
    relatedCodes: ['C18.9', 'Z12.11', 'K57.30'],
  },
  {
    icd10: 'C18.9',
    description: 'Malignant neoplasm of colon, unspecified',
    shortName: 'Colon cancer',
    category: 'Gastrointestinal',
    commonPresentations: [
      'diagnosed with bowel cancer',
      'change in bowel habit with blood in stool',
      'unexplained weight loss with anaemia',
      'mass found in my colon',
    ],
    relatedCodes: ['C20', 'D12.6', 'Z12.11', 'Z80.0'],
  },
  {
    icd10: 'C20',
    description: 'Malignant neoplasm of rectum',
    shortName: 'Rectal cancer',
    category: 'Gastrointestinal',
    commonPresentations: [
      'bleeding from the back passage with a mass',
      'diagnosed with rectal cancer',
      'change in bowel habit with rectal bleeding',
      'feeling of incomplete emptying with blood',
    ],
    relatedCodes: ['C18.9', 'D12.6', 'K64.9', 'Z12.11'],
  },
  {
    icd10: 'K56.60',
    description: 'Unspecified intestinal obstruction',
    shortName: 'Bowel obstruction',
    category: 'Gastrointestinal',
    commonPresentations: [
      'belly swelling and not passing gas',
      'vomiting and severe abdominal bloating',
      'belly pain with no bowel movement for days',
      'cramping waves of belly pain',
    ],
    relatedCodes: ['K56.5', 'K40.90', 'K42.9'],
  },
  {
    icd10: 'K56.5',
    description: 'Intestinal adhesions with obstruction',
    shortName: 'Adhesive bowel obstruction',
    category: 'Gastrointestinal',
    commonPresentations: [
      'belly pain and bloating after previous surgery',
      'bowel blockage from scar tissue',
      'vomiting and not passing stool after my operation',
    ],
    relatedCodes: ['K56.60', 'K43.2'],
  },
  {
    icd10: 'K40.90',
    description:
      'Unilateral inguinal hernia, without obstruction or gangrene, not specified as recurrent',
    shortName: 'Inguinal hernia',
    category: 'Gastrointestinal',
    commonPresentations: [
      'lump in my groin that comes and goes',
      'bulge near my groin when I cough or lift',
      'pain in my groin with a swelling',
      'something pushing out in my groin area',
    ],
    relatedCodes: ['K42.9', 'K43.2', 'K56.60'],
  },
  {
    icd10: 'K42.9',
    description: 'Umbilical hernia without obstruction or gangrene',
    shortName: 'Umbilical hernia',
    category: 'Gastrointestinal',
    commonPresentations: [
      'lump at my belly button',
      'bulge near my navel when I strain',
      'swelling around my belly button that pops out',
    ],
    relatedCodes: ['K40.90', 'K43.2'],
  },
  {
    icd10: 'K43.2',
    description: 'Incisional hernia without obstruction or gangrene',
    shortName: 'Incisional hernia',
    category: 'Gastrointestinal',
    commonPresentations: [
      'bulge at my old surgery scar',
      'swelling where my wound was',
      'hernia at my operation site',
    ],
    relatedCodes: ['K40.90', 'K42.9', 'K56.5'],
  },
  {
    icd10: 'K92.2',
    description: 'Gastrointestinal haemorrhage, unspecified',
    shortName: 'GI bleeding',
    category: 'Gastrointestinal',
    commonPresentations: [
      'blood in my stool',
      'passing dark or black stools',
      'vomiting blood',
      'noticed blood when I wipe',
    ],
    relatedCodes: ['K92.0', 'K92.1', 'K64.9', 'K25.9'],
  },
  {
    icd10: 'K92.0',
    description: 'Haematemesis',
    shortName: 'Vomiting blood',
    category: 'Gastrointestinal',
    commonPresentations: [
      'vomiting blood',
      'throwing up red or dark brown material',
      'blood in my vomit',
    ],
    relatedCodes: ['K92.2', 'K92.1', 'K25.9', 'K26.9'],
  },
  {
    icd10: 'K92.1',
    description: 'Melaena',
    shortName: 'Melaena',
    category: 'Gastrointestinal',
    commonPresentations: [
      'black tarry stools',
      'very dark foul-smelling stool',
      'passing pitch-black stool',
    ],
    relatedCodes: ['K92.2', 'K92.0', 'K25.9', 'K26.9'],
  },
  {
    icd10: 'K29.70',
    description: 'Gastritis, unspecified, without bleeding',
    shortName: 'Gastritis',
    category: 'Gastrointestinal',
    commonPresentations: [
      'burning pain in my stomach',
      'belly pain and nausea after eating',
      'upset stomach and indigestion',
      'feeling bloated with upper belly discomfort',
    ],
    relatedCodes: ['K25.9', 'K26.9', 'K21.0', 'K21.9'],
  },

  // =========================================================================
  // BREAST (~8 codes)
  // =========================================================================
  {
    icd10: 'C50.919',
    description: 'Malignant neoplasm of unspecified site of unspecified female breast',
    shortName: 'Breast cancer',
    category: 'Breast',
    commonPresentations: [
      'lump in my breast that is hard',
      'diagnosed with breast cancer',
      'nipple discharge with a breast mass',
      'dimpling or puckering of breast skin',
    ],
    relatedCodes: ['N63.0', 'D24.9', 'Z12.31', 'Z80.3', 'R92.8'],
  },
  {
    icd10: 'D24.9',
    description: 'Benign neoplasm of unspecified breast',
    shortName: 'Breast fibroadenoma',
    category: 'Breast',
    commonPresentations: [
      'smooth movable lump in my breast',
      'round lump that moves around in my breast',
      'breast lump that doctor says is benign',
    ],
    relatedCodes: ['N63.0', 'C50.919', 'Z12.31'],
  },
  {
    icd10: 'N60.09',
    description: 'Solitary cyst of unspecified breast',
    shortName: 'Breast cyst',
    category: 'Breast',
    commonPresentations: [
      'fluid-filled lump in my breast',
      'tender breast lump that changes with my cycle',
      'cyst found on breast ultrasound',
    ],
    relatedCodes: ['N63.0', 'D24.9', 'R92.8'],
  },
  {
    icd10: 'N61.0',
    description: 'Mastitis without abscess',
    shortName: 'Mastitis',
    category: 'Breast',
    commonPresentations: [
      'red and swollen breast',
      'painful breast with fever',
      'warm tender area on my breast',
      'breast infection while breastfeeding',
    ],
    relatedCodes: ['N63.0', 'L02.91'],
  },
  {
    icd10: 'N62',
    description: 'Hypertrophy of breast',
    shortName: 'Gynaecomastia / breast hypertrophy',
    category: 'Breast',
    commonPresentations: [
      'male breast enlargement',
      'swollen breast tissue in a man',
      'tender breast growth',
    ],
    relatedCodes: ['N63.0', 'D24.9'],
  },
  {
    icd10: 'N63.0',
    description: 'Unspecified lump in unspecified breast',
    shortName: 'Breast lump',
    category: 'Breast',
    commonPresentations: [
      'found a lump in my breast',
      'new breast lump I noticed in the shower',
      'hard spot in my breast',
      'swelling in my breast that was not there before',
    ],
    relatedCodes: ['C50.919', 'D24.9', 'N60.09', 'R92.8', 'Z12.31'],
  },
  {
    icd10: 'R92.8',
    description: 'Other abnormal and inconclusive findings on diagnostic imaging of breast',
    shortName: 'Abnormal mammogram',
    category: 'Breast',
    commonPresentations: [
      'called back after my mammogram',
      'something showed up on my breast scan',
      'abnormal mammogram result',
    ],
    relatedCodes: ['N63.0', 'C50.919', 'Z12.31', 'D24.9'],
  },
  {
    icd10: 'Z12.31',
    description: 'Encounter for screening mammogram for malignant neoplasm of breast',
    shortName: 'Screening mammogram',
    category: 'Screening & Prevention',
    commonPresentations: [
      'due for my yearly mammogram',
      'need a routine breast screening',
      'time for my regular mammogram check',
    ],
    relatedCodes: ['C50.919', 'N63.0', 'R92.8', 'Z80.3'],
  },

  // =========================================================================
  // THYROID & ENDOCRINE (~6 codes)
  // =========================================================================
  {
    icd10: 'E04.9',
    description: 'Nontoxic goitre, unspecified',
    shortName: 'Goitre',
    category: 'Thyroid & Endocrine',
    commonPresentations: [
      'swelling in the front of my neck',
      'my thyroid is enlarged',
      'lump at the base of my throat',
      'difficulty swallowing with neck fullness',
    ],
    relatedCodes: ['E04.1', 'C73', 'E05.90', 'E06.3'],
  },
  {
    icd10: 'E04.1',
    description: 'Nontoxic single thyroid nodule',
    shortName: 'Thyroid nodule',
    category: 'Thyroid & Endocrine',
    commonPresentations: [
      'nodule found on my thyroid',
      'lump on the side of my neck near my throat',
      'bump on my thyroid found on ultrasound',
    ],
    relatedCodes: ['E04.9', 'C73', 'E05.90'],
  },
  {
    icd10: 'C73',
    description: 'Malignant neoplasm of thyroid gland',
    shortName: 'Thyroid cancer',
    category: 'Thyroid & Endocrine',
    commonPresentations: [
      'diagnosed with thyroid cancer',
      'thyroid biopsy showed cancer',
      'growing lump in my neck with hoarse voice',
    ],
    relatedCodes: ['E04.1', 'E04.9'],
  },
  {
    icd10: 'E05.90',
    description: 'Thyrotoxicosis, unspecified, without thyrotoxic crisis or storm',
    shortName: 'Hyperthyroidism',
    category: 'Thyroid & Endocrine',
    commonPresentations: [
      'heart racing and weight loss',
      'feeling jittery and sweating a lot',
      'losing weight even though I am eating more',
      'trembling hands and feeling anxious',
    ],
    relatedCodes: ['E04.9', 'E04.1', 'E06.3'],
  },
  {
    icd10: 'E21.0',
    description: 'Primary hyperparathyroidism',
    shortName: 'Hyperparathyroidism',
    category: 'Thyroid & Endocrine',
    commonPresentations: [
      'high calcium on my blood test',
      'kidney stones and bone pain',
      'feeling tired with high calcium',
      'bones aching and feeling weak',
    ],
    relatedCodes: ['E04.9', 'N18.9'],
  },
  {
    icd10: 'E06.3',
    description: 'Autoimmune thyroiditis',
    shortName: "Hashimoto's thyroiditis",
    category: 'Thyroid & Endocrine',
    commonPresentations: [
      'thyroid is inflamed',
      'weight gain and tiredness with thyroid problems',
      'autoimmune thyroid condition',
    ],
    relatedCodes: ['E04.9', 'E04.1', 'E05.90'],
  },

  // =========================================================================
  // HEPATOBILIARY & PANCREATIC (~10 codes)
  // =========================================================================
  {
    icd10: 'R17',
    description: 'Unspecified jaundice',
    shortName: 'Jaundice',
    category: 'Hepatobiliary & Pancreatic',
    commonPresentations: [
      'my eyes and skin turned yellow',
      'yellowing of my skin',
      'dark urine and pale stools',
      'noticed a yellow tinge to my eyes',
    ],
    relatedCodes: ['K80.50', 'K83.09', 'C22.0', 'C25.9', 'C24.0'],
  },
  {
    icd10: 'K75.0',
    description: 'Abscess of liver',
    shortName: 'Liver abscess',
    category: 'Hepatobiliary & Pancreatic',
    commonPresentations: [
      'pain under my right ribs with fever',
      'infection in my liver',
      'high fever and right upper belly pain',
    ],
    relatedCodes: ['R17', 'C22.0', 'K85.90'],
  },
  {
    icd10: 'C22.0',
    description: 'Liver cell carcinoma',
    shortName: 'Hepatocellular carcinoma',
    category: 'Hepatobiliary & Pancreatic',
    commonPresentations: [
      'liver cancer diagnosis',
      'mass found on my liver',
      'weight loss and right upper belly pain',
      'swelling in my belly with liver problems',
    ],
    relatedCodes: ['R17', 'K75.0', 'C25.9'],
  },
  {
    icd10: 'C25.9',
    description: 'Malignant neoplasm of pancreas, unspecified',
    shortName: 'Pancreatic cancer',
    category: 'Hepatobiliary & Pancreatic',
    commonPresentations: [
      'pancreatic cancer diagnosis',
      'jaundice and weight loss',
      'back pain with yellowing of the skin',
      'painless jaundice with dark urine',
    ],
    relatedCodes: ['R17', 'K85.90', 'K86.1', 'C24.0'],
  },
  {
    icd10: 'K85.90',
    description: 'Acute pancreatitis without necrosis or infection, unspecified',
    shortName: 'Acute pancreatitis',
    category: 'Hepatobiliary & Pancreatic',
    commonPresentations: [
      'severe upper belly pain going through to my back',
      'agonising pain after heavy drinking',
      'vomiting and intense upper abdominal pain',
      'pain that is worse when lying down',
    ],
    relatedCodes: ['K86.1', 'K80.50', 'C25.9'],
  },
  {
    icd10: 'K86.1',
    description: 'Other chronic pancreatitis',
    shortName: 'Chronic pancreatitis',
    category: 'Hepatobiliary & Pancreatic',
    commonPresentations: [
      'ongoing belly pain and loose oily stools',
      'repeated attacks of pancreatitis',
      'weight loss and difficulty digesting food',
    ],
    relatedCodes: ['K85.90', 'C25.9', 'E11.9'],
  },
  {
    icd10: 'K80.50',
    description: 'Calculus of bile duct without cholangitis or cholecystitis, without obstruction',
    shortName: 'Common bile duct stone',
    category: 'Hepatobiliary & Pancreatic',
    commonPresentations: [
      'stone stuck in my bile duct',
      'jaundice after gallbladder problems',
      'yellow skin with upper belly pain',
    ],
    relatedCodes: ['K80.20', 'K83.09', 'R17', 'K85.90'],
  },
  {
    icd10: 'K83.09',
    description: 'Cholangitis, unspecified',
    shortName: 'Cholangitis',
    category: 'Hepatobiliary & Pancreatic',
    commonPresentations: [
      'jaundice with fever and chills',
      'infection in my bile duct',
      'yellow skin with shaking chills and right-sided pain',
    ],
    relatedCodes: ['K80.50', 'R17', 'C24.0'],
  },
  {
    icd10: 'C24.0',
    description: 'Malignant neoplasm of extrahepatic bile duct',
    shortName: 'Cholangiocarcinoma',
    category: 'Hepatobiliary & Pancreatic',
    commonPresentations: [
      'bile duct cancer',
      'painless jaundice with itching',
      'weight loss and yellow skin',
    ],
    relatedCodes: ['R17', 'K83.09', 'C25.9', 'C22.0'],
  },
  {
    icd10: 'K82.A1',
    description: 'Gangrene of gallbladder in cholecystitis',
    shortName: 'Gangrenous cholecystitis',
    category: 'Hepatobiliary & Pancreatic',
    commonPresentations: [
      'worsening gallbladder pain with high fever',
      'very severe right upper belly pain not improving',
      'gallbladder infection getting worse',
    ],
    relatedCodes: ['K81.0', 'K80.00', 'K80.20'],
  },

  // =========================================================================
  // ANORECTAL (~11 codes)
  // =========================================================================
  {
    icd10: 'K64.9',
    description: 'Unspecified haemorrhoids',
    shortName: 'Haemorrhoids',
    category: 'Anorectal',
    commonPresentations: [
      'piles bothering me',
      'bleeding from my back passage',
      'itching and discomfort around my bottom',
      'lump near my anus',
    ],
    relatedCodes: ['K64.0', 'K64.1', 'K64.2', 'K92.2'],
  },
  {
    icd10: 'K64.0',
    description: 'First degree haemorrhoids',
    shortName: 'Grade I haemorrhoids',
    category: 'Anorectal',
    commonPresentations: [
      'bleeding when I use the toilet but no lump',
      'bright red blood on toilet paper',
      'piles that do not come out',
    ],
    relatedCodes: ['K64.1', 'K64.2', 'K64.9'],
  },
  {
    icd10: 'K64.1',
    description: 'Second degree haemorrhoids',
    shortName: 'Grade II haemorrhoids',
    category: 'Anorectal',
    commonPresentations: [
      'piles that come out when I strain but go back in',
      'bleeding with a lump that goes back by itself',
      'haemorrhoids that prolapse but reduce on their own',
    ],
    relatedCodes: ['K64.0', 'K64.2', 'K64.9'],
  },
  {
    icd10: 'K64.2',
    description: 'Third degree haemorrhoids',
    shortName: 'Grade III haemorrhoids',
    category: 'Anorectal',
    commonPresentations: [
      'piles that I have to push back in',
      'lump from my back passage that stays out unless I push it',
      'large haemorrhoid that protrudes',
    ],
    relatedCodes: ['K64.0', 'K64.1', 'K64.9', 'K62.3'],
  },
  {
    icd10: 'K60.0',
    description: 'Acute anal fissure',
    shortName: 'Anal fissure',
    category: 'Anorectal',
    commonPresentations: [
      'sharp pain when passing stool',
      'tearing pain in my bottom during bowel movement',
      'bleeding and stinging after going to the toilet',
      'pain like a paper cut in my back passage',
    ],
    relatedCodes: ['K64.9', 'K61.0'],
  },
  {
    icd10: 'K60.2',
    description: 'Anal fistula',
    shortName: 'Anal fistula',
    category: 'Anorectal',
    commonPresentations: [
      'discharge or pus leaking near my bottom',
      'small hole near my anus that drains',
      'recurrent abscess near my back passage',
    ],
    relatedCodes: ['K61.0', 'K61.1', 'K50.90'],
  },
  {
    icd10: 'K61.0',
    description: 'Anal abscess',
    shortName: 'Perianal abscess',
    category: 'Anorectal',
    commonPresentations: [
      'painful swelling near my bottom',
      'boil near my anus',
      'throbbing pain and lump next to my back passage',
      'cannot sit down because of a swelling near my bottom',
    ],
    relatedCodes: ['K61.1', 'K60.2', 'L02.91'],
  },
  {
    icd10: 'K61.1',
    description: 'Rectal abscess',
    shortName: 'Rectal abscess',
    category: 'Anorectal',
    commonPresentations: [
      'deep pain in my rectum',
      'fever with pain inside my back passage',
      'pressure and pain deep in my bottom',
    ],
    relatedCodes: ['K61.0', 'K60.2'],
  },
  {
    icd10: 'L05.01',
    description: 'Pilonidal cyst with abscess',
    shortName: 'Pilonidal abscess',
    category: 'Anorectal',
    commonPresentations: [
      'painful lump at the top of my buttock crease',
      'infected cyst near my tailbone',
      'swelling and draining near my coccyx',
    ],
    relatedCodes: ['L05.91', 'K61.0', 'L02.91'],
  },
  {
    icd10: 'L05.91',
    description: 'Pilonidal cyst without abscess',
    shortName: 'Pilonidal cyst',
    category: 'Anorectal',
    commonPresentations: [
      'cyst at the top of my buttock crease',
      'lump near my tailbone that keeps coming back',
      'small pit or dimple near my coccyx with hair in it',
    ],
    relatedCodes: ['L05.01', 'K61.0'],
  },
  {
    icd10: 'K62.3',
    description: 'Rectal prolapse',
    shortName: 'Rectal prolapse',
    category: 'Anorectal',
    commonPresentations: [
      'something coming out of my back passage',
      'feeling of my bowel dropping out',
      'tissue sticking out from my anus after going to the toilet',
    ],
    relatedCodes: ['K64.2', 'K64.9'],
  },

  // =========================================================================
  // VASCULAR (~5 codes)
  // =========================================================================
  {
    icd10: 'I82.409',
    description:
      'Acute embolism and thrombosis of unspecified deep veins of unspecified lower extremity',
    shortName: 'DVT (lower extremity)',
    category: 'Vascular',
    commonPresentations: [
      'leg swelling on one side',
      'calf pain and swelling',
      'leg feels hot and swollen',
      'sudden pain in my calf after surgery',
    ],
    relatedCodes: ['I83.90', 'I73.9', 'I74.3'],
  },
  {
    icd10: 'I83.90',
    description: 'Asymptomatic varicose veins of unspecified lower extremity',
    shortName: 'Varicose veins',
    category: 'Vascular',
    commonPresentations: [
      'bulging veins in my legs',
      'twisted veins on my calves',
      'heavy aching legs with visible veins',
      'swollen veins in my leg',
    ],
    relatedCodes: ['I82.409', 'I73.9', 'L97.909'],
  },
  {
    icd10: 'E11.621',
    description: 'Type 2 diabetes mellitus with foot ulcer',
    shortName: 'Diabetic foot ulcer',
    category: 'Vascular',
    commonPresentations: [
      'sore on my foot that will not heal',
      'open wound on my toe from diabetes',
      'foot ulcer that keeps getting bigger',
      'diabetic wound on the bottom of my foot',
    ],
    relatedCodes: ['E11.9', 'I73.9', 'L97.909'],
  },
  {
    icd10: 'I73.9',
    description: 'Peripheral vascular disease, unspecified',
    shortName: 'Peripheral vascular disease',
    category: 'Vascular',
    commonPresentations: [
      'leg pain when walking that stops when I rest',
      'cramping in my calves when I walk',
      'cold feet with poor circulation',
      'numbness and tingling in my feet',
    ],
    relatedCodes: ['I82.409', 'I83.90', 'I74.3', 'E11.621'],
  },
  {
    icd10: 'I74.3',
    description: 'Embolism and thrombosis of arteries of the lower extremities',
    shortName: 'Arterial embolism (lower limb)',
    category: 'Vascular',
    commonPresentations: [
      'sudden cold and pale leg',
      'severe leg pain that came on suddenly',
      'leg turned white and feels numb',
    ],
    relatedCodes: ['I82.409', 'I73.9'],
  },

  // =========================================================================
  // SKIN & SOFT TISSUE (~10 codes)
  // =========================================================================
  {
    icd10: 'D17.9',
    description: 'Benign lipomatous neoplasm, unspecified',
    shortName: 'Lipoma',
    category: 'Skin & Soft Tissue',
    commonPresentations: [
      'soft movable lump under my skin',
      'fatty lump on my arm or back',
      'painless bump that has been growing slowly',
    ],
    relatedCodes: ['D48.5', 'L72.0'],
  },
  {
    icd10: 'L72.0',
    description: 'Epidermal cyst',
    shortName: 'Sebaceous cyst',
    category: 'Skin & Soft Tissue',
    commonPresentations: [
      'cyst under my skin that comes and goes',
      'round lump under my skin with a dark dot on top',
      'bump that sometimes gets infected and drains',
    ],
    relatedCodes: ['D17.9', 'L02.91', 'D48.5'],
  },
  {
    icd10: 'L02.91',
    description: 'Cutaneous abscess, unspecified',
    shortName: 'Skin abscess',
    category: 'Skin & Soft Tissue',
    commonPresentations: [
      'painful boil on my skin',
      'red swollen lump filled with pus',
      'abscess that needs draining',
      'infected bump on my body',
    ],
    relatedCodes: ['L03.90', 'L72.0', 'K61.0'],
  },
  {
    icd10: 'L03.90',
    description: 'Cellulitis, unspecified',
    shortName: 'Cellulitis',
    category: 'Skin & Soft Tissue',
    commonPresentations: [
      'red hot swollen area on my skin',
      'spreading redness on my leg',
      'skin infection getting bigger and more painful',
      'warm tender area that is spreading',
    ],
    relatedCodes: ['L02.91', 'L08.9', 'T81.41XA'],
  },
  {
    icd10: 'T81.41XA',
    description:
      'Infection following a procedure, superficial incisional surgical site, initial encounter',
    shortName: 'Superficial surgical site infection',
    category: 'Skin & Soft Tissue',
    commonPresentations: [
      'my wound is red and oozing after surgery',
      'infection at my operation site',
      'pus coming from my surgical incision',
      'wound from surgery looks infected',
    ],
    relatedCodes: ['T81.42XA', 'L03.90', 'L02.91'],
  },
  {
    icd10: 'T81.42XA',
    description:
      'Infection following a procedure, deep incisional surgical site, initial encounter',
    shortName: 'Deep surgical site infection',
    category: 'Skin & Soft Tissue',
    commonPresentations: [
      'deep infection at my surgery site',
      'wound opened up and is draining',
      'fever and pain at my incision weeks after surgery',
    ],
    relatedCodes: ['T81.41XA', 'L03.90', 'K43.2'],
  },
  {
    icd10: 'L97.909',
    description:
      'Non-pressure chronic ulcer of unspecified part of unspecified lower leg, unspecified severity',
    shortName: 'Chronic leg ulcer',
    category: 'Skin & Soft Tissue',
    commonPresentations: [
      'sore on my leg that will not heal',
      'open wound on my shin for months',
      'leg ulcer that keeps coming back',
    ],
    relatedCodes: ['I83.90', 'E11.621', 'I73.9'],
  },
  {
    icd10: 'D48.5',
    description: 'Neoplasm of uncertain behaviour of skin',
    shortName: 'Uncertain skin growth',
    category: 'Skin & Soft Tissue',
    commonPresentations: [
      'skin growth that might be cancer',
      'changing mole or lesion',
      'growth on my skin that the doctor wants to remove and test',
    ],
    relatedCodes: ['C44.99', 'D17.9', 'L72.0'],
  },
  {
    icd10: 'C44.99',
    description: 'Other malignant neoplasm of skin, unspecified',
    shortName: 'Skin cancer',
    category: 'Skin & Soft Tissue',
    commonPresentations: [
      'skin cancer needs removing',
      'sore on my skin that will not heal',
      'changing spot on my skin diagnosed as cancer',
    ],
    relatedCodes: ['D48.5', 'D17.9'],
  },
  {
    icd10: 'L08.9',
    description: 'Local infection of the skin and subcutaneous tissue, unspecified',
    shortName: 'Skin infection',
    category: 'Skin & Soft Tissue',
    commonPresentations: [
      'infected area on my skin',
      'sore on my skin with redness and swelling',
      'skin around a wound looks infected',
    ],
    relatedCodes: ['L02.91', 'L03.90', 'T81.41XA'],
  },

  // =========================================================================
  // TRAUMA (~5 codes)
  // =========================================================================
  {
    icd10: 'S36.90XA',
    description: 'Unspecified injury of unspecified intra-abdominal organ, initial encounter',
    shortName: 'Abdominal organ injury',
    category: 'Trauma',
    commonPresentations: [
      'belly pain after an accident',
      'hit in the stomach and it hurts badly',
      'abdominal pain after a fall or blow',
    ],
    relatedCodes: ['S31.000A', 'T79.9XXA', 'S27.899A'],
  },
  {
    icd10: 'S27.899A',
    description: 'Other injury of other specified intrathoracic organs, initial encounter',
    shortName: 'Chest organ injury',
    category: 'Trauma',
    commonPresentations: [
      'chest pain after an accident',
      'hurt my chest in a collision',
      'trouble breathing after a blow to my chest',
    ],
    relatedCodes: ['S36.90XA', 'T79.9XXA'],
  },
  {
    icd10: 'T14.8',
    description: 'Other injury of unspecified body region',
    shortName: 'Laceration / wound',
    category: 'Trauma',
    commonPresentations: [
      'cut that needs stitches',
      'deep wound from an accident',
      'laceration that will not stop bleeding',
    ],
    relatedCodes: ['S31.000A', 'T79.9XXA', 'L03.90'],
  },
  {
    icd10: 'S31.000A',
    description:
      'Unspecified open wound of lower back and pelvis without penetration into retroperitoneum, initial encounter',
    shortName: 'Open wound (lower back/pelvis)',
    category: 'Trauma',
    commonPresentations: [
      'deep cut on my lower back',
      'wound on my back from an injury',
      'stabbing injury to my lower back',
    ],
    relatedCodes: ['S36.90XA', 'T14.8', 'T79.9XXA'],
  },
  {
    icd10: 'T79.9XXA',
    description: 'Unspecified early complication of trauma, initial encounter',
    shortName: 'Trauma complication',
    category: 'Trauma',
    commonPresentations: [
      'getting worse after an injury',
      'complications from my accident',
      'not healing well after being hurt',
    ],
    relatedCodes: ['S36.90XA', 'S27.899A', 'T14.8'],
  },

  // =========================================================================
  // COMORBIDITIES (~15 codes)
  // =========================================================================
  {
    icd10: 'E11.9',
    description: 'Type 2 diabetes mellitus without complications',
    shortName: 'Type 2 diabetes',
    category: 'Comorbidities',
    commonPresentations: [
      'sugar diabetes',
      'high blood sugar',
      'diabetes runs in my family and I was diagnosed',
      'taking tablets for my sugar',
    ],
    relatedCodes: ['E10.9', 'E11.621', 'E66.01', 'I10'],
  },
  {
    icd10: 'E10.9',
    description: 'Type 1 diabetes mellitus without complications',
    shortName: 'Type 1 diabetes',
    category: 'Comorbidities',
    commonPresentations: [
      'insulin-dependent diabetes since childhood',
      'type 1 diabetes on insulin',
      'diagnosed with diabetes as a child',
    ],
    relatedCodes: ['E11.9', 'E11.621'],
  },
  {
    icd10: 'I10',
    description: 'Essential (primary) hypertension',
    shortName: 'Hypertension',
    category: 'Comorbidities',
    commonPresentations: [
      'high blood pressure',
      'pressure running high',
      'taking tablets for my blood pressure',
      'doctor says my pressure is too high',
    ],
    relatedCodes: ['I25.10', 'I48.91', 'E11.9', 'N18.9'],
  },
  {
    icd10: 'I25.10',
    description:
      'Atherosclerotic heart disease of native coronary artery without angina pectoris',
    shortName: 'Ischaemic heart disease',
    category: 'Comorbidities',
    commonPresentations: [
      'heart disease',
      'blocked arteries in my heart',
      'had a stent put in',
      'coronary artery disease',
    ],
    relatedCodes: ['I10', 'I48.91', 'E78.5', 'I73.9'],
  },
  {
    icd10: 'J44.1',
    description: 'Chronic obstructive pulmonary disease with acute exacerbation',
    shortName: 'COPD exacerbation',
    category: 'Comorbidities',
    commonPresentations: [
      'breathing got much worse',
      'COPD flare-up',
      'more short of breath than usual with coughing',
    ],
    relatedCodes: ['J44.9', 'F17.210', 'J45.909'],
  },
  {
    icd10: 'J44.9',
    description: 'Chronic obstructive pulmonary disease, unspecified',
    shortName: 'COPD',
    category: 'Comorbidities',
    commonPresentations: [
      'short of breath from my lung disease',
      'chronic lung condition from smoking',
      'emphysema or chronic bronchitis',
      'always coughing and out of breath',
    ],
    relatedCodes: ['J44.1', 'F17.210', 'J45.909', 'G47.33'],
  },
  {
    icd10: 'N18.9',
    description: 'Chronic kidney disease, unspecified',
    shortName: 'Chronic kidney disease',
    category: 'Comorbidities',
    commonPresentations: [
      'my kidneys are not working well',
      'kidney function is low on blood tests',
      'chronic kidney problems',
    ],
    relatedCodes: ['I10', 'E11.9', 'E21.0'],
  },
  {
    icd10: 'E66.9',
    description: 'Obesity, unspecified',
    shortName: 'Obesity',
    category: 'Comorbidities',
    commonPresentations: [
      'overweight and trying to lose weight',
      'doctor says I am obese',
      'weight is affecting my health',
    ],
    relatedCodes: ['E66.01', 'E11.9', 'I10', 'G47.33'],
  },
  {
    icd10: 'E66.01',
    description: 'Morbid (severe) obesity due to excess calories',
    shortName: 'Morbid obesity',
    category: 'Comorbidities',
    commonPresentations: [
      'severely overweight',
      'BMI over 40',
      'obesity affecting my daily life',
      'considering weight loss surgery',
    ],
    relatedCodes: ['E66.9', 'E11.9', 'I10', 'G47.33', 'K21.0'],
  },
  {
    icd10: 'F17.210',
    description: 'Nicotine dependence, cigarettes, uncomplicated',
    shortName: 'Smoking (current)',
    category: 'Comorbidities',
    commonPresentations: [
      'I smoke cigarettes',
      'current smoker',
      'trying to quit smoking',
      'smoking about a pack a day',
    ],
    relatedCodes: ['Z87.891', 'J44.9', 'J44.1', 'I25.10'],
  },
  {
    icd10: 'Z87.891',
    description: 'Personal history of nicotine dependence',
    shortName: 'Ex-smoker',
    category: 'Comorbidities',
    commonPresentations: [
      'used to smoke but I quit',
      'former smoker',
      'stopped smoking years ago',
    ],
    relatedCodes: ['F17.210', 'J44.9'],
  },
  {
    icd10: 'E78.5',
    description: 'Dyslipidaemia, unspecified',
    shortName: 'High cholesterol',
    category: 'Comorbidities',
    commonPresentations: [
      'cholesterol is too high',
      'taking a statin for my cholesterol',
      'bad fats in my blood',
    ],
    relatedCodes: ['I25.10', 'I10', 'E11.9', 'E66.9'],
  },
  {
    icd10: 'I48.91',
    description: 'Unspecified atrial fibrillation',
    shortName: 'Atrial fibrillation',
    category: 'Comorbidities',
    commonPresentations: [
      'irregular heartbeat',
      'heart keeps skipping beats',
      'fluttering in my chest',
      'on blood thinners for my heart rhythm',
    ],
    relatedCodes: ['I25.10', 'I10', 'I82.409'],
  },
  {
    icd10: 'J45.909',
    description: 'Unspecified asthma, uncomplicated',
    shortName: 'Asthma',
    category: 'Comorbidities',
    commonPresentations: [
      'asthma since childhood',
      'wheezing and using an inhaler',
      'chest tightness and shortness of breath',
    ],
    relatedCodes: ['J44.9', 'J44.1', 'G47.33'],
  },
  {
    icd10: 'G47.33',
    description: 'Obstructive sleep apnoea',
    shortName: 'Sleep apnoea',
    category: 'Comorbidities',
    commonPresentations: [
      'snoring heavily and stopping breathing at night',
      'using a CPAP machine at night',
      'waking up choking or gasping',
      'always tired because I stop breathing in my sleep',
    ],
    relatedCodes: ['E66.01', 'E66.9', 'I10', 'J44.9'],
  },

  // =========================================================================
  // SCREENING & PREVENTION (~4 codes, Z12.31 already listed above)
  // =========================================================================
  {
    icd10: 'Z12.11',
    description: 'Encounter for screening for malignant neoplasm of colon',
    shortName: 'Colon cancer screening',
    category: 'Screening & Prevention',
    commonPresentations: [
      'due for a colonoscopy',
      'need a routine bowel screening',
      'time for my colon cancer check',
      'doctor recommended a screening colonoscopy',
    ],
    relatedCodes: ['C18.9', 'C20', 'D12.6', 'Z80.0'],
  },
  {
    icd10: 'Z80.0',
    description: 'Family history of malignant neoplasm of digestive organs',
    shortName: 'Family history of GI cancer',
    category: 'Screening & Prevention',
    commonPresentations: [
      'my parent had colon cancer',
      'bowel cancer runs in my family',
      'family member had stomach or colon cancer',
    ],
    relatedCodes: ['Z12.11', 'C18.9', 'C20', 'D12.6'],
  },
  {
    icd10: 'Z80.3',
    description: 'Family history of malignant neoplasm of breast',
    shortName: 'Family history of breast cancer',
    category: 'Screening & Prevention',
    commonPresentations: [
      'my mother had breast cancer',
      'breast cancer runs in my family',
      'several women in my family had breast cancer',
    ],
    relatedCodes: ['Z12.31', 'C50.919', 'N63.0'],
  },
  {
    icd10: 'Z87.19',
    description: 'Personal history of other diseases of the digestive system',
    shortName: 'History of GI disease',
    category: 'Screening & Prevention',
    commonPresentations: [
      'had surgery on my bowel before',
      'previous stomach or gut problems',
      'history of ulcers or diverticulitis',
    ],
    relatedCodes: ['Z12.11', 'Z80.0', 'K25.9', 'K57.32'],
  },

  // =========================================================================
  // ADDITIONAL CONDITIONS (to reach 110-115 total)
  // =========================================================================

  // -- Gastrointestinal (additional) --
  {
    icd10: 'K44.9',
    description: 'Diaphragmatic hernia without obstruction or gangrene',
    shortName: 'Hiatus hernia',
    category: 'Gastrointestinal',
    commonPresentations: [
      'acid reflux and a hernia in my chest',
      'heartburn from a hiatal hernia',
      'stomach pushing up through my diaphragm',
      'chest pain after large meals',
    ],
    relatedCodes: ['K21.0', 'K21.9', 'K40.90'],
  },
  {
    icd10: 'K59.00',
    description: 'Constipation, unspecified',
    shortName: 'Constipation',
    category: 'Gastrointestinal',
    commonPresentations: [
      'not able to pass stool for days',
      'hard stools and straining',
      'belly bloating and difficulty going to the toilet',
    ],
    relatedCodes: ['K56.60', 'K64.9', 'K57.30'],
  },
  {
    icd10: 'K63.5',
    description: 'Polyp of colon',
    shortName: 'Colon polyp (unspecified)',
    category: 'Gastrointestinal',
    commonPresentations: [
      'polyps found during my colonoscopy',
      'need follow-up for colon polyps',
      'growth in my large bowel',
    ],
    relatedCodes: ['D12.6', 'C18.9', 'Z12.11'],
  },

  // -- Hepatobiliary & Pancreatic (additional) --
  {
    icd10: 'K74.60',
    description: 'Unspecified cirrhosis of liver',
    shortName: 'Liver cirrhosis',
    category: 'Hepatobiliary & Pancreatic',
    commonPresentations: [
      'scarring of my liver',
      'liver disease with a swollen belly',
      'fluid building up in my abdomen from liver problems',
      'doctor says my liver is damaged',
    ],
    relatedCodes: ['C22.0', 'R17', 'K75.0'],
  },

  // -- Anorectal (additional) --
  {
    icd10: 'K64.8',
    description: 'Other haemorrhoids',
    shortName: 'Thrombosed haemorrhoid',
    category: 'Anorectal',
    commonPresentations: [
      'painful hard lump at my anus',
      'swollen haemorrhoid that is very sore',
      'blue lump at my back passage',
    ],
    relatedCodes: ['K64.9', 'K64.2', 'K60.0'],
  },

  // -- Skin & Soft Tissue (additional) --
  {
    icd10: 'M72.6',
    description: 'Necrotising fasciitis',
    shortName: 'Necrotising fasciitis',
    category: 'Skin & Soft Tissue',
    commonPresentations: [
      'rapidly spreading painful skin infection',
      'skin turning dark with severe pain and fever',
      'flesh-eating infection',
    ],
    relatedCodes: ['L03.90', 'L02.91', 'T81.42XA'],
  },
  {
    icd10: 'L72.1',
    description: 'Trichilemmal cyst',
    shortName: 'Pilar cyst',
    category: 'Skin & Soft Tissue',
    commonPresentations: [
      'hard lump on my scalp',
      'cyst on my head that keeps growing',
      'smooth bump under the skin of my scalp',
    ],
    relatedCodes: ['L72.0', 'D17.9'],
  },

  // -- Vascular (additional) --
  {
    icd10: 'I80.10',
    description: 'Phlebitis and thrombophlebitis of unspecified femoral vein',
    shortName: 'Superficial thrombophlebitis',
    category: 'Vascular',
    commonPresentations: [
      'red painful vein in my leg',
      'hard tender cord along a vein',
      'swollen vein that is warm and sore',
    ],
    relatedCodes: ['I82.409', 'I83.90'],
  },

  // -- Comorbidities (additional) --
  {
    icd10: 'D64.9',
    description: 'Anaemia, unspecified',
    shortName: 'Anaemia',
    category: 'Comorbidities',
    commonPresentations: [
      'low blood count',
      'feeling tired and pale',
      'iron is low on my blood test',
      'dizzy and short of breath from low haemoglobin',
    ],
    relatedCodes: ['K92.2', 'K92.1', 'C18.9'],
  },
  {
    icd10: 'D50.9',
    description: 'Iron deficiency anaemia, unspecified',
    shortName: 'Iron deficiency anaemia',
    category: 'Comorbidities',
    commonPresentations: [
      'iron levels are very low',
      'anaemia from bleeding',
      'need iron infusions for my blood count',
    ],
    relatedCodes: ['D64.9', 'K92.2', 'K92.1', 'C18.9'],
  },

  // -- Screening & Prevention (additional) --
  {
    icd10: 'Z86.010',
    description: 'Personal history of colonic polyps',
    shortName: 'History of colonic polyps',
    category: 'Screening & Prevention',
    commonPresentations: [
      'had polyps removed before',
      'need a repeat colonoscopy for previous polyps',
      'follow-up for polyps found years ago',
    ],
    relatedCodes: ['Z12.11', 'D12.6', 'K63.5', 'C18.9'],
  },
  {
    icd10: 'Z85.038',
    description: 'Personal history of other malignant neoplasm of large intestine',
    shortName: 'History of colon cancer',
    category: 'Screening & Prevention',
    commonPresentations: [
      'had colon cancer treated before',
      'cancer surveillance after bowel cancer',
      'follow-up after colorectal cancer surgery',
    ],
    relatedCodes: ['Z12.11', 'C18.9', 'C20', 'Z80.0'],
  },
];

// ---------------------------------------------------------------------------
// Indexes (built once at module load)
// ---------------------------------------------------------------------------

const _icd10Index: Map<string, ConditionCode> = new Map();
const _categoryIndex: Map<string, ConditionCode[]> = new Map();

for (const cc of CONDITION_CODES) {
  _icd10Index.set(cc.icd10, cc);

  let bucket = _categoryIndex.get(cc.category);
  if (!bucket) {
    bucket = [];
    _categoryIndex.set(cc.category, bucket);
  }
  bucket.push(cc);
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Search conditions by free-text query.
 *
 * Matches against ICD-10 code, description, short name, category, and
 * common presentations. Returns all conditions where any field contains
 * the query string (case-insensitive). Results are ordered by relevance:
 * ICD-10 exact matches first, then description/shortName, then
 * presentations.
 */
export function searchConditions(query: string): ConditionCode[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const exactCode: ConditionCode[] = [];
  const nameMatch: ConditionCode[] = [];
  const presentationMatch: ConditionCode[] = [];

  for (const cc of CONDITION_CODES) {
    // Exact ICD-10 match (case-insensitive, allows partial prefix)
    if (cc.icd10.toLowerCase().startsWith(q) || q === cc.icd10.toLowerCase()) {
      exactCode.push(cc);
      continue;
    }

    // Description, shortName, or category match
    if (
      cc.description.toLowerCase().includes(q) ||
      cc.shortName.toLowerCase().includes(q) ||
      cc.category.toLowerCase().includes(q)
    ) {
      nameMatch.push(cc);
      continue;
    }

    // Common presentations match
    if (cc.commonPresentations.some((p) => p.toLowerCase().includes(q))) {
      presentationMatch.push(cc);
    }
  }

  return [...exactCode, ...nameMatch, ...presentationMatch];
}

/**
 * Look up a single condition by its ICD-10-CM code.
 *
 * The match is exact and case-insensitive.
 */
export function getByICD10(code: string): ConditionCode | undefined {
  // Try exact first (most codes are uppercase in the catalog)
  return _icd10Index.get(code) ?? _icd10Index.get(code.toUpperCase());
}

/**
 * Return all conditions belonging to the given category.
 *
 * Category names are matched case-insensitively.
 */
export function getConditionsByCategory(category: string): ConditionCode[] {
  // Try exact match first
  const exact = _categoryIndex.get(category);
  if (exact) return exact;

  // Fall back to case-insensitive match
  const lower = category.toLowerCase();
  for (const [key, codes] of _categoryIndex) {
    if (key.toLowerCase() === lower) return codes;
  }

  return [];
}
