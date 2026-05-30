export interface IcdCode {
  code: string;
  description: string;
  category: string;
}

export const ICD_CODES: IcdCode[] = [
  // Biliary
  { code: 'K80.2', description: 'Gallstones with acute cholecystitis', category: 'Biliary' },
  { code: 'K80.3', description: 'Gallstones with cholangitis', category: 'Biliary' },
  { code: 'K80.5', description: 'Gallstones without cholecystitis', category: 'Biliary' },
  { code: 'K81.0', description: 'Acute cholecystitis', category: 'Biliary' },
  { code: 'K81.1', description: 'Chronic cholecystitis', category: 'Biliary' },
  { code: 'K83.0', description: 'Cholangitis', category: 'Biliary' },
  { code: 'K83.1', description: 'Obstruction of bile duct', category: 'Biliary' },
  { code: 'K85.0', description: 'Idiopathic acute pancreatitis', category: 'Biliary' },
  { code: 'K86.1', description: 'Other chronic pancreatitis', category: 'Biliary' },

  // Colorectal
  { code: 'K57.3', description: 'Diverticulosis', category: 'Colorectal' },
  { code: 'K57.2', description: 'Diverticulitis', category: 'Colorectal' },
  { code: 'K62.5', description: 'Haemorrhoids (internal)', category: 'Colorectal' },
  { code: 'K62.6', description: 'Anal fissure', category: 'Colorectal' },
  { code: 'K63.1', description: 'Perforation of intestine', category: 'Colorectal' },
  { code: 'K92.1', description: 'Melaena', category: 'Colorectal' },
  { code: 'K92.0', description: 'Haematemesis', category: 'Colorectal' },
  { code: 'K92.2', description: 'Gastrointestinal haemorrhage unspecified', category: 'Colorectal' },

  // Upper GI
  { code: 'K21.0', description: 'GORD with oesophagitis', category: 'Upper GI' },
  { code: 'K25.0', description: 'Gastric ulcer acute with haemorrhage', category: 'Upper GI' },
  { code: 'K26.0', description: 'Duodenal ulcer acute', category: 'Upper GI' },
  { code: 'K31.89', description: 'Other diseases of stomach', category: 'Upper GI' },

  // Appendix
  { code: 'K35.2', description: 'Acute appendicitis with peritonitis', category: 'Appendix' },
  { code: 'K35.3', description: 'Acute appendicitis without abscess', category: 'Appendix' },
  { code: 'K37', description: 'Unspecified appendicitis', category: 'Appendix' },

  // Hernia
  { code: 'K40.0', description: 'Bilateral inguinal hernia', category: 'Hernia' },
  { code: 'K40.3', description: 'Unilateral inguinal hernia obstructed', category: 'Hernia' },
  { code: 'K40.9', description: 'Unilateral inguinal hernia', category: 'Hernia' },
  { code: 'K41.9', description: 'Femoral hernia', category: 'Hernia' },
  { code: 'K43.0', description: 'Incisional hernia', category: 'Hernia' },
  { code: 'K44.0', description: 'Diaphragmatic hernia', category: 'Hernia' },
  { code: 'K46.0', description: 'Hernia NOS obstructed', category: 'Hernia' },

  // Bowel obstruction
  { code: 'K56.0', description: 'Paralytic ileus', category: 'Bowel obstruction' },
  { code: 'K56.2', description: 'Volvulus', category: 'Bowel obstruction' },
  { code: 'K56.5', description: 'Intestinal adhesions with obstruction', category: 'Bowel obstruction' },
  { code: 'K56.7', description: 'Bowel obstruction NOS', category: 'Bowel obstruction' },

  // Liver
  { code: 'K72.0', description: 'Acute hepatic failure', category: 'Liver' },
  { code: 'K74.3', description: 'Primary biliary cirrhosis', category: 'Liver' },
  { code: 'K76.0', description: 'Fatty liver', category: 'Liver' },
  { code: 'K77', description: 'Liver disorders in diseases classified elsewhere', category: 'Liver' },

  // Breast
  { code: 'C50.9', description: 'Breast carcinoma unspecified', category: 'Breast' },
  { code: 'C50.1', description: 'Central breast carcinoma', category: 'Breast' },
  { code: 'D24', description: 'Benign neoplasm of breast', category: 'Breast' },
  { code: 'D05', description: 'Carcinoma in situ of breast', category: 'Breast' },
  { code: 'N60.1', description: 'Diffuse cystic mastopathy', category: 'Breast' },
  { code: 'N61', description: 'Mastitis', category: 'Breast' },
  { code: 'N63', description: 'Unspecified lump in breast', category: 'Breast' },
  { code: 'N64.5', description: 'Nipple discharge', category: 'Breast' },

  // Colorectal cancer
  { code: 'C18.0', description: 'Ca caecum', category: 'Colorectal cancer' },
  { code: 'C18.2', description: 'Ca ascending colon', category: 'Colorectal cancer' },
  { code: 'C18.7', description: 'Ca sigmoid', category: 'Colorectal cancer' },
  { code: 'C19', description: 'Ca rectosigmoid', category: 'Colorectal cancer' },
  { code: 'C20', description: 'Ca rectum', category: 'Colorectal cancer' },

  // Other GI cancers
  { code: 'C15.9', description: 'Oesophageal carcinoma', category: 'Other GI cancers' },
  { code: 'C16.9', description: 'Gastric carcinoma', category: 'Other GI cancers' },
  { code: 'C22.0', description: 'Hepatocellular carcinoma', category: 'Other GI cancers' },
  { code: 'C25.0', description: 'Head of pancreas carcinoma', category: 'Other GI cancers' },
  { code: 'C25.9', description: 'Pancreatic carcinoma', category: 'Other GI cancers' },

  // Surgical complications
  { code: 'T81.3', description: 'Disruption of wound', category: 'Surgical complications' },
  { code: 'T81.4', description: 'Infection following procedure', category: 'Surgical complications' },
  { code: 'T81.89', description: 'Other complications of procedures', category: 'Surgical complications' },

  // Diabetic foot
  { code: 'E11.621', description: 'Diabetic foot ulcer', category: 'Diabetic foot' },
  { code: 'L89.9', description: 'Pressure ulcer unspecified', category: 'Diabetic foot' },
  { code: 'M86.1', description: 'Chronic osteomyelitis', category: 'Diabetic foot' },

  // Vascular
  { code: 'I70.2', description: 'Atherosclerosis of arteries of extremities', category: 'Vascular' },
  { code: 'I73.9', description: 'Peripheral vascular disease', category: 'Vascular' },
  { code: 'I83.0', description: 'Varicose veins with ulcer', category: 'Vascular' },

  // Symptoms
  { code: 'R10.0', description: 'Acute abdomen', category: 'Symptoms' },
  { code: 'R10.2', description: 'Pelvic pain', category: 'Symptoms' },
  { code: 'R10.4', description: 'Other abdominal pain', category: 'Symptoms' },
  { code: 'R11', description: 'Nausea and vomiting', category: 'Symptoms' },
  { code: 'R13', description: 'Dysphagia', category: 'Symptoms' },
  { code: 'R17', description: 'Jaundice', category: 'Symptoms' },
  { code: 'R19.7', description: 'Diarrhoea', category: 'Symptoms' },
  { code: 'R50.9', description: 'Fever unspecified', category: 'Symptoms' },
];
