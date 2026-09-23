// ManagementEngine+Bowel.swift
// Bowel/GI emergency plans: SBO, Hernia, GI Bleed, Diverticulitis, Perforated Viscus.

import Foundation

extension ManagementEngine {

    // MARK: Small Bowel Obstruction

    static let smallBowelObstruction = ManagementPlan(
        diagnosis: "Small Bowel Obstruction",
        icdCode: "K56.60",
        urgency: .urgent,
        immediateActions: [
            "IV access + Hartmann's 1–2 L over 2–4 h (bowel obstruction causes significant third-space loss)",
            "Analgesia: morphine IV (reassess regularly)",
            "Anti-emetic: metoclopramide or ondansetron IV",
            "NG tube (nasogastric decompression): wide-bore, free drainage + aspirate every hour",
            "IDC for urine output monitoring",
            "Nil by mouth",
        ],
        investigations: [
            "FBC, U&E, CRP, LFT, lactate, blood cultures if febrile",
            "AXR (supine + erect): dilated small bowel loops (>3 cm), air-fluid levels, no gas in colon",
            "CT abdomen/pelvis with contrast (defines level, cause, strangulation — sensitivity 94%)",
            "Blood group and save",
        ],
        medicalManagement: [
            "Trial of non-operative management (drip and suck) for 24–48 h in adhesional SBO without strangulation",
            "Water-soluble contrast follow-through (Gastrografin): if no resolution at 24–48 h — therapeutic and diagnostic",
            "Broad-spectrum antibiotics if strangulation suspected or peritonism: co-amoxiclav + metronidazole",
        ],
        surgicalIndications: [
            "Signs of strangulation: peritonism, fever, tachycardia, rising lactate, CT enhancement loss",
            "Complete obstruction not resolving with 24–48 h conservative management",
            "Incarcerated hernia causing SBO (see hernia plan)",
            "Malignant obstruction",
            "Failure of Gastrografin to reach colon at 24 h",
        ],
        surgicalProcedure: "Laparoscopic or open adhesiolysis; bowel resection if ischaemic segment",
        disposition: "Admit surgical ward; HDU if systemically unwell / lactate elevated",
        followUp: "Outpatient review 2–4 weeks; advise on future adhesion risk",
        keyPitfalls: [
            "Strangulated SBO is a surgical emergency — do not delay for conservative trial",
            "Closed-loop obstruction (CT finding) → emergency theatre regardless of peritonism",
            "Previous malignancy → consider recurrence or extrinsic compression",
            "Hernia orifices must always be examined — missed incarcerated hernia is never acceptable",
        ],
        redFlags: [
            "Peritonism → strangulation / perforation — emergency theatre",
            "Lactate ≥2 mmol/L → concern for ischaemia; proceed to theatre",
            "Free intraperitoneal gas → perforation; emergency laparotomy",
        ],
        guidelines: "WSES SBO Guidelines 2017; EAST Practice Management Guidelines 2012"
    )

    // MARK: Incarcerated / Strangulated Hernia

    static let incarceratedHernia = ManagementPlan(
        diagnosis: "Incarcerated / Strangulated Hernia",
        icdCode: "K46.0",
        urgency: .immediate,
        immediateActions: [
            "IV access + aggressive fluid resuscitation (30 mL/kg if haemodynamically unstable)",
            "IV analgesia + anti-emetic",
            "NG tube if obstructed (bilious vomiting, distension)",
            "Nil by mouth",
            "Attempted manual reduction (taxis) ONLY if: <6 h duration, no peritonism, no systemic compromise — gentle sustained pressure with sedation/analgesia",
            "Do NOT attempt taxis if peritonism, systemic sepsis or suspected ischaemia",
            "Urgent surgical consent for emergency hernia repair",
        ],
        investigations: [
            "FBC, U&E, CRP, lactate, blood cultures if febrile",
            "CT abdomen/pelvis: confirms hernia, assesses bowel viability, excludes complications",
            "AXR if CT unavailable",
            "Blood group and cross-match 2 units",
        ],
        medicalManagement: [
            "IV broad-spectrum antibiotics if systemic compromise / suspected ischaemia: co-amoxiclav 1.2 g TDS or piperacillin-tazobactam",
            "Analgesia — do not withhold",
        ],
        surgicalIndications: [
            "Failed manual reduction",
            "Any sign of strangulation: peritonism, fever, rising WBC/CRP/lactate",
            "Irreducible hernia > 4–6 h",
            "All femoral hernias (high ischaemia risk due to tight neck)",
        ],
        surgicalProcedure: "Emergency hernia repair (open or laparoscopic) + bowel resection if ischaemic; mesh contraindicated if bowel resected",
        disposition: "Emergency theatre — target within 2–4 h of decision",
        followUp: "Wound review 1–2 weeks; histology if bowel resected",
        keyPitfalls: [
            "Femoral hernias are easily missed — always examine the femoral canal in women with SBO",
            "Richter's hernia: partial bowel wall incarceration — no obstruction, easy to miss, high ischaemia risk",
            "Mesh contamination: if bowel resection performed, avoid prosthetic mesh — use biological or delayed repair",
            "Reduction en masse: successful-seeming reduction but hernia reduced with contained strangulation — still needs theatre",
        ],
        redFlags: [
            "Peritonism → emergency theatre immediately",
            "Systemic sepsis + hernia → strangulation until proven otherwise",
        ],
        guidelines: "EuraHS / HerniaSurge 2018; WSES 2016"
    )

    // MARK: Upper GI Bleed

    static let ugib = ManagementPlan(
        diagnosis: "Upper GI Bleeding",
        icdCode: "K92.2",
        urgency: .urgent,
        immediateActions: [
            "Assess: airway / breathing / circulation — call code if haemodynamically unstable",
            "Two large-bore peripheral IV access (14–16G)",
            "IV fluid resuscitation: 0.9% NaCl or Hartmann's 1 L stat if haemodynamically compromised",
            "Transfuse to Hb ≥70 g/L (or 90 g/L if ACS / IHD — TRIGGER trial targets)",
            "Reverse anticoagulation: Vitamin K + FFP for warfarin; andexanet or idarucizumab for DOACs",
            "IV PPI: omeprazole 80 mg IV bolus then 8 mg/h infusion (if peptic ulcer likely)",
            "IDC for urine output (target >0.5 mL/kg/h)",
            "Urgent GI / surgical review",
        ],
        investigations: [
            "FBC, U&E, LFT, coagulation, blood group and CROSS-MATCH 4–6 units",
            "Blood cultures if febrile (exclude melaena from systemic infection)",
            "Chest X-ray (aspiration / free gas)",
            "ECG (troponin in elderly — UGIB triggers MI)",
            "Upper GI endoscopy (OGD): within 24 h (12 h if active haemodynamic compromise)",
        ],
        medicalManagement: [
            "IV PPI infusion reduces rebleeding in high-risk ulcers (NICE endorsed)",
            "Terlipressin 2 mg IV stat if variceal bleed suspected (reduces portal pressure)",
            "Octreotide if terlipressin unavailable",
            "IV ceftriaxone 1 g OD × 5 d in cirrhotic patients (prophylaxis against SBP)",
            "H. pylori test and eradicate (CLO test or histology at OGD); reduces recurrence",
        ],
        surgicalIndications: [
            "Failed endoscopic haemostasis × 2 attempts",
            "Rebleed after initial endoscopic control",
            "Haemodynamic instability not responding to resuscitation",
            "Perforation",
        ],
        surgicalProcedure: "IR angioembolisation first-line if available; else emergency under/oversew of vessel + vagotomy (duodenal ulcer) or gastrectomy (gastric ulcer)",
        disposition: "HDU; ICU if massive haemorrhage / variceal bleed",
        followUp: "Repeat OGD at 6–8 weeks (confirm healing + H. pylori eradication); PPI long-term if NSAIDs unavoidable",
        keyPitfalls: [
            "Blood transfusion trigger: DO NOT transfuse to Hb >90 in most — liberal transfusion worsens variceal outcomes",
            "OGD within 12 h for haemodynamically unstable; 24 h acceptable if stable",
            "NSAIDs and aspirin: withhold NSAIDs; discuss aspirin with cardiologist (do not automatically stop cardiac aspirin)",
            "Proton pump inhibitors before endoscopy do not reduce mortality but reduce high-risk stigmata on OGD",
        ],
        redFlags: [
            "Fresh haematemesis with shock → massive UGIB; call theatre team now",
            "Cirrhosis + UGIB → variceal bleed; terlipressin + urgent OGD within 12 h",
            "Rockall ≥6 → high mortality risk; ICU and IR team involvement",
        ],
        guidelines: "BSG Guidelines 2015; NICE CG141; UK National UGIB Audit"
    )

    // MARK: Lower GI Bleeding

    static let lowerGIBleeding = ManagementPlan(
        diagnosis: "Acute Lower GI Bleeding",
        icdCode: "K92.1",
        urgency: .urgent,
        immediateActions: [
            "IV access + resuscitation if haemodynamically unstable",
            "Transfuse to Hb ≥70 g/L (≥90 if cardiac disease)",
            "Digital rectal examination (exclude anorectal source)",
            "Rigid or flexible sigmoidoscopy to exclude anorectal source",
            "OGD if any haemodynamic instability (exclude upper GI source — 10–15% of apparent LGIB)",
        ],
        investigations: [
            "FBC, U&E, coagulation, blood group + cross-match",
            "CT angiography (CT-A): if active bleeding — identifies site in 75–80%; sensitivity requires bleeding rate >0.5 mL/min",
            "Colonoscopy within 24 h: diagnostic + therapeutic (timing vs CT-A depends on haemodynamic stability)",
            "Nuclear medicine scan (tagged RBC): if CT-A negative but bleeding continues — localises site for IR",
        ],
        medicalManagement: [
            "Correct coagulopathy: FFP / platelets / Vitamin K as appropriate",
            "Most (85–90%) LGIB stops spontaneously",
        ],
        surgicalIndications: [
            "Ongoing bleeding with haemodynamic instability not responding to resuscitation",
            "Failed endoscopic or IR angioembolisation",
            "Identified colonic source (diverticular bleed, angiodysplasia) not amenable to endoscopic control",
        ],
        surgicalProcedure: "Segmental colectomy (based on identified bleeding site); total colectomy only if site unknown and life-threatening",
        disposition: "HDU if haemodynamically compromised; ward if stable",
        followUp: "Elective colonoscopy if emergency colonoscopy not completed; polyp surveillance",
        keyPitfalls: [
            "Always exclude upper GI source — OGD early if any doubt",
            "Diverticular bleeding is the most common cause in patients >50 — usually self-limiting",
            "Angiodysplasia: consider in patients on anticoagulation / cardiac disease",
            "Do not attempt colonoscopy in unprepared bowel in massive LGIB — CT-A first",
        ],
        redFlags: [
            "Haemodynamic shock + PR bleeding → massive LGIB or upper GI source; emergency OGD + CT-A",
            "Fresh blood per rectum in young patient → consider Meckel's diverticulum",
        ],
        guidelines: "BSG Guidelines 2019; ACG LGIB Guidelines 2016"
    )

    // MARK: Acute Diverticulitis

    static let separateDiverticulitis = ManagementPlan(
        diagnosis: "Acute Diverticulitis",
        icdCode: "K57.32",
        urgency: .semiUrgent,
        immediateActions: [
            "Analgesia: paracetamol 1 g IV or morphine if severe",
            "IV access if unable to tolerate oral",
            "Fluid resuscitation if dehydrated",
            "Nil by mouth initially if vomiting or surgery anticipated",
        ],
        investigations: [
            "FBC, CRP, U&E",
            "CT abdomen/pelvis with contrast (Hinchey classification — guides management; sensitivity 97%)",
            "Urinalysis (colovesical fistula — faecaluria / pneumaturia)",
        ],
        medicalManagement: [
            "Uncomplicated (Hinchey 0/Ia): oral antibiotics (co-amoxiclav 625 mg TDS × 7 d) or no antibiotics in selected mild cases",
            "Complicated (Hinchey Ib/II): IV antibiotics (cefuroxime + metronidazole or co-amoxiclav)",
            "Hinchey Ib (pericolic abscess <3 cm): IV antibiotics alone",
            "Hinchey II (distant abscess >3–4 cm): CT-guided percutaneous drainage + IV antibiotics",
            "Hinchey III/IV: emergency surgery",
        ],
        surgicalIndications: [
            "Hinchey III (purulent peritonitis) or IV (faecal peritonitis): emergency laparotomy",
            "Septic shock",
            "Failure of percutaneous drainage of abscess",
            "Recurrent diverticulitis in fit patients: elective sigmoid colectomy",
            "Immunocompromised patient: lower threshold for surgery",
        ],
        surgicalProcedure: "Laparoscopic peritoneal lavage (Hinchey III — controversial) or Hartmann's procedure; primary anastomosis in selected cases",
        disposition: "Mild (Hinchey 0): discharge with oral antibiotics; Hinchey Ia/Ib: admit; Hinchey III/IV: emergency theatre",
        followUp: "Colonoscopy at 6–8 weeks (exclude carcinoma), elective sigmoid colectomy discussion",
        keyPitfalls: [
            "CT is essential — exclude colon cancer mimicking diverticulitis",
            "Free perforation (Hinchey III/IV): emergency theatre — do not delay for further imaging",
            "Hinchey III: laparoscopic lavage vs Hartmann's — discuss with patient if time permits",
        ],
        redFlags: [
            "Free gas on CT → Hinchey IV; emergency theatre",
            "Septic shock → emergency surgery + ICU",
        ],
        guidelines: "ASCRS 2020; WSES 2020; ESCP 2020"
    )

    // MARK: Perforated Viscus

    static let perforatedViscus = ManagementPlan(
        diagnosis: "Perforated Viscus",
        icdCode: "K63.1",
        urgency: .immediate,
        immediateActions: [
            "Two large-bore IV access + aggressive fluid resuscitation",
            "IV broad-spectrum antibiotics IMMEDIATELY: meropenem 1 g TDS or piperacillin-tazobactam 4.5 g TDS",
            "IV analgesia + anti-emetic",
            "NG tube (gastric decompression)",
            "IDC + urine output monitoring",
            "Urgent anaesthetic review + consent for emergency laparotomy",
            "Mark for stoma (if sigmoid / colonic pathology)",
        ],
        investigations: [
            "FBC, U&E, coagulation, blood cultures × 2, lactate",
            "Blood group and cross-match",
            "CXR erect (free air under diaphragm — present in 75%; absence does NOT exclude)",
            "CT abdomen/pelvis (if not in extremis — confirms site, guides surgical plan)",
        ],
        medicalManagement: [
            "Resuscitation: target MAP ≥65, urine output ≥0.5 mL/kg/h",
            "Antibiotics covering Gram-negatives, anaerobes, enterococcus",
            "Correct coagulopathy before theatre",
        ],
        surgicalIndications: [
            "All cases — no role for non-operative management in free perforation",
        ],
        surgicalProcedure: "Emergency exploratory laparotomy; definitive repair depends on site — oversew/omental patch (gastric/duodenal), resection ± stoma (colonic), appendicectomy (appendiceal)",
        disposition: "Emergency theatre; ICU post-operatively",
        followUp: "ITU/HDU; wound review; stoma nurse referral if stoma formed",
        keyPitfalls: [
            "Erect CXR may be normal — do not exclude perforation on this finding alone",
            "Peptic ulcer perforation: conservative (Taylor's) management only in selected patients (>24 h, sealed, haemodynamically stable)",
            "Delay to theatre is the primary determinant of mortality — avoid unnecessary investigations in extremis",
        ],
        redFlags: [
            "Septic shock → immediate theatre + ICU; every hour of delay increases mortality",
        ],
        guidelines: "WSES 2018; NICE"
    )


}
