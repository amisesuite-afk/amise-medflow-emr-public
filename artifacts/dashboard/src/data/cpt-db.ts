export interface CptCode {
  code: string;
  description: string;
  category: string;
}

export const CPT_CODES: CptCode[] = [
  // Endoscopy — OGD
  { code: '43235', description: 'Upper GI endoscopy (OGD), diagnostic', category: 'Endoscopy — OGD' },
  { code: '43239', description: 'OGD with biopsy, single or multiple', category: 'Endoscopy — OGD' },
  { code: '43250', description: 'OGD, removal of polyp (hot biopsy forceps)', category: 'Endoscopy — OGD' },
  { code: '43251', description: 'OGD, removal of polyp (snare technique)', category: 'Endoscopy — OGD' },
  { code: '43255', description: 'OGD with control of bleeding', category: 'Endoscopy — OGD' },
  { code: '43257', description: 'OGD with dilation of oesophageal stricture', category: 'Endoscopy — OGD' },
  { code: '43259', description: 'OGD with endoscopic ultrasound (EUS)', category: 'Endoscopy — OGD' },

  // Endoscopy — Colonoscopy
  { code: '45378', description: 'Colonoscopy, diagnostic', category: 'Endoscopy — Colonoscopy' },
  { code: '45380', description: 'Colonoscopy with biopsy', category: 'Endoscopy — Colonoscopy' },
  { code: '45384', description: 'Colonoscopy with removal of polyp (hot biopsy)', category: 'Endoscopy — Colonoscopy' },
  { code: '45385', description: 'Colonoscopy with polypectomy (snare technique)', category: 'Endoscopy — Colonoscopy' },
  { code: '45388', description: 'Colonoscopy with ablation of lesion(s)', category: 'Endoscopy — Colonoscopy' },
  { code: '45390', description: 'Colonoscopy with endoscopic mucosal resection (EMR)', category: 'Endoscopy — Colonoscopy' },
  { code: '45392', description: 'Colonoscopy with control of bleeding', category: 'Endoscopy — Colonoscopy' },
  { code: '45393', description: 'Colonoscopy with decompression (sigmoid volvulus)', category: 'Endoscopy — Colonoscopy' },

  // ERCP
  { code: '43260', description: 'ERCP, diagnostic with sphincterotomy', category: 'ERCP' },
  { code: '43261', description: 'ERCP with biopsy or cytology brushings', category: 'ERCP' },
  { code: '43264', description: 'ERCP with removal of CBD stone(s)', category: 'ERCP' },
  { code: '43265', description: 'ERCP with lithotripsy of CBD stone(s)', category: 'ERCP' },
  { code: '43274', description: 'ERCP with stent placement (biliary)', category: 'ERCP' },
  { code: '43275', description: 'ERCP with stent removal (biliary)', category: 'ERCP' },
  { code: '43276', description: 'ERCP with stent exchange (biliary)', category: 'ERCP' },
  { code: '43277', description: 'ERCP with dilation of biliary stricture(s)', category: 'ERCP' },

  // Biliary / Gallbladder
  { code: '47562', description: 'Laparoscopic cholecystectomy', category: 'Biliary' },
  { code: '47563', description: 'Laparoscopic cholecystectomy with intraoperative cholangiography', category: 'Biliary' },
  { code: '47600', description: 'Cholecystectomy, open', category: 'Biliary' },
  { code: '47605', description: 'Cholecystectomy, open with intraoperative cholangiography', category: 'Biliary' },
  { code: '47400', description: 'Hepaticotomy or hepatostomy (open)', category: 'Biliary' },

  // Appendix
  { code: '44950', description: 'Appendectomy, open', category: 'Appendix' },
  { code: '44960', description: 'Appendectomy, ruptured, with abscess or generalised peritonitis', category: 'Appendix' },
  { code: '44970', description: 'Laparoscopic appendectomy', category: 'Appendix' },

  // Hernia
  { code: '49505', description: 'Inguinal hernia repair, initial, open (age ≥5)', category: 'Hernia' },
  { code: '49507', description: 'Inguinal hernia repair with hydrocelectomy', category: 'Hernia' },
  { code: '49520', description: 'Recurrent inguinal hernia repair, open', category: 'Hernia' },
  { code: '49560', description: 'Incisional hernia repair, open', category: 'Hernia' },
  { code: '49650', description: 'Laparoscopic inguinal hernia repair (TAPP/TEP)', category: 'Hernia' },
  { code: '49652', description: 'Laparoscopic incisional/ventral hernia repair', category: 'Hernia' },
  { code: '49655', description: 'Laparoscopic incisional hernia repair, recurrent', category: 'Hernia' },
  { code: '49659', description: 'Laparoscopic hernia repair, other (umbilical/epigastric)', category: 'Hernia' },

  // Colorectal
  { code: '44140', description: 'Colectomy, partial, with anastomosis', category: 'Colorectal' },
  { code: '44145', description: 'Low anterior resection (LAR) with coloproctostomy', category: 'Colorectal' },
  { code: '44160', description: "Colectomy, partial, with end colostomy (Hartmann's)", category: 'Colorectal' },
  { code: '44204', description: 'Laparoscopic colectomy, partial with anastomosis', category: 'Colorectal' },
  { code: '44207', description: 'Laparoscopic LAR with coloproctostomy', category: 'Colorectal' },
  { code: '45110', description: 'Abdominoperineal resection (APR)', category: 'Colorectal' },
  { code: '45160', description: 'Resection of tumour of rectum', category: 'Colorectal' },
  { code: '44300', description: 'Enterostomy / colostomy formation', category: 'Colorectal' },

  // Anorectal
  { code: '46221', description: 'Haemorrhoid banding (rubber band ligation)', category: 'Anorectal' },
  { code: '46250', description: 'Haemorrhoidectomy, external', category: 'Anorectal' },
  { code: '46255', description: 'Haemorrhoidectomy, internal and external', category: 'Anorectal' },
  { code: '46257', description: 'Haemorrhoidectomy with fissurectomy', category: 'Anorectal' },
  { code: '46080', description: 'Sphincterotomy, internal (anal fissure)', category: 'Anorectal' },
  { code: '46270', description: 'Anal fistulotomy, intersphincteric or submucosal', category: 'Anorectal' },
  { code: '46060', description: 'Ischiorectal abscess drainage', category: 'Anorectal' },
  { code: '46050', description: 'Perianal incision and drainage', category: 'Anorectal' },

  // Upper GI Surgery
  { code: '43280', description: 'Laparoscopic fundoplication (Nissen / Toupet)', category: 'Upper GI Surgery' },
  { code: '43281', description: 'Laparoscopic fundoplication with paraesophageal hernia repair', category: 'Upper GI Surgery' },
  { code: '43620', description: 'Gastrectomy, total', category: 'Upper GI Surgery' },
  { code: '43621', description: 'Gastrectomy, total, with Roux-en-Y reconstruction', category: 'Upper GI Surgery' },
  { code: '43633', description: 'Gastrectomy, partial distal, Billroth II (gastrojejunostomy)', category: 'Upper GI Surgery' },
  { code: '43644', description: 'Laparoscopic Roux-en-Y gastric bypass', category: 'Upper GI Surgery' },

  // Breast Surgery
  { code: '19120', description: 'Excision of fibroadenoma or other benign breast lesion', category: 'Breast Surgery' },
  { code: '19110', description: 'Nipple exploration / major duct excision', category: 'Breast Surgery' },
  { code: '19301', description: 'Mastectomy, partial (lumpectomy / wide excision)', category: 'Breast Surgery' },
  { code: '19303', description: 'Mastectomy, simple (total)', category: 'Breast Surgery' },
  { code: '19307', description: 'Mastectomy, modified radical (MRM)', category: 'Breast Surgery' },
  { code: '38500', description: 'Sentinel lymph node biopsy (axillary)', category: 'Breast Surgery' },
  { code: '38745', description: 'Axillary lymph node dissection (full clearance)', category: 'Breast Surgery' },

  // Hepatopancreatic
  { code: '47100', description: 'Liver biopsy, percutaneous needle', category: 'Hepatopancreatic' },
  { code: '47001', description: 'Liver biopsy, wedge (at open surgery)', category: 'Hepatopancreatic' },
  { code: '47379', description: 'Laparoscopic hepatic procedure (specify)', category: 'Hepatopancreatic' },
  { code: '48100', description: 'Biopsy of pancreas', category: 'Hepatopancreatic' },
  { code: '48150', description: 'Pancreatectomy, distal', category: 'Hepatopancreatic' },
  { code: '48153', description: 'Pancreatectomy, distal, laparoscopic', category: 'Hepatopancreatic' },

  // Wound & Skin / Minor Surgery
  { code: '10060', description: 'Incision and drainage of abscess, simple', category: 'Wound & Skin' },
  { code: '10061', description: 'Incision and drainage of abscess, complicated', category: 'Wound & Skin' },
  { code: '11040', description: 'Debridement, skin (partial thickness)', category: 'Wound & Skin' },
  { code: '11042', description: 'Debridement, subcutaneous tissue', category: 'Wound & Skin' },
  { code: '11043', description: 'Debridement, muscle and/or fascia', category: 'Wound & Skin' },
  { code: '11044', description: 'Debridement, bone', category: 'Wound & Skin' },
  { code: '97597', description: 'Debridement, open wound, first 20 sq cm or less', category: 'Wound & Skin' },
  { code: '11600', description: 'Excision of malignant skin lesion', category: 'Wound & Skin' },
  { code: '11400', description: 'Excision of benign lesion (trunk/extremity)', category: 'Wound & Skin' },

  // Vascular / Other
  { code: '35301', description: 'Carotid endarterectomy', category: 'Vascular' },
  { code: '37220', description: 'Iliac angioplasty ± stent', category: 'Vascular' },
  { code: '37228', description: 'Tibial angioplasty ± stent', category: 'Vascular' },
];
