// ManagementEngine.swift
// Deterministic evidence-based management pathways for surgical conditions.
// No AI, no network calls — HIPAA-safe.
// Sources: NICE, WSES, EAST, Tokyo 2018, BSG, ACS TQIP, SIGN, Uptodate guidelines.

import Foundation

// MARK: - Output types

struct ManagementPlan: Identifiable {
    let id = UUID()
    let diagnosis: String
    let icdCode: String
    let urgency: Urgency
    let immediateActions: [String]      // Do NOW
    let investigations: [String]        // Order
    let medicalManagement: [String]     // Non-surgical treatment
    let surgicalIndications: [String]   // When to operate
    let surgicalProcedure: String?      // What operation
    let disposition: String             // Admit / HDU / Theatre / Discharge
    let followUp: String?
    let keyPitfalls: [String]           // Common errors / don't-miss points
    let redFlags: [String]              // Escalation triggers
    let guidelines: String?             // Source
}

enum Urgency: String, Comparable {
    case immediate   = "Immediate (now)"      // Theatre / ICU NOW
    case urgent      = "Urgent (<4 hours)"    // Theatre / HDU today
    case semiUrgent  = "Semi-urgent (<24 h)"  // Admit + plan
    case elective    = "Elective"             // Outpatient / planned

    static func < (lhs: Urgency, rhs: Urgency) -> Bool {
        let order: [Urgency] = [.immediate, .urgent, .semiUrgent, .elective]
        return (order.firstIndex(of: lhs) ?? 3) < (order.firstIndex(of: rhs) ?? 3)
    }

    var colorHex: String {
        switch self {
        case .immediate:  return "#DC2626"
        case .urgent:     return "#F97316"
        case .semiUrgent: return "#EAB308"
        case .elective:   return "#22C55E"
        }
    }
}

// MARK: - ManagementEngine

enum ManagementEngine {

    // MARK: - Lookup by diagnosis keyword / ICD prefix

    /// Returns management plan(s) matching the diagnosis name or ICD prefix.
    /// Case-insensitive. Returns top 1–3 most relevant plans.
    static func plans(forDiagnosis name: String) -> [ManagementPlan] {
        let query = name.lowercased()
        return allPlans.filter { plan in
            plan.diagnosis.lowercased().contains(query) ||
            plan.icdCode.lowercased().hasPrefix(query) ||
            query.contains(plan.icdCode.lowercased())
        }
    }

    static func plan(forICD icd: String) -> ManagementPlan? {
        allPlans.first { $0.icdCode == icd }
    }

    // MARK: - All plans

    static let allPlans: [ManagementPlan] = [
        acuteAppendicitis,
        perforatedAppendicitis,
        acuteCholecystitis,
        cholangitisObstructiveJaundice,
        acutePancreatitis,
        severePancreatitis,
        smallBowelObstruction,
        incarceratedHernia,
        ugib,
        lowerGIBleeding,
        separateDiverticulitis,
        perforatedViscus,
        sepsisAbdominal,
        mesentericIschaemia,
        aaa,
        necrotizingFasciitis,
        dvt,
        pulmonaryEmbolism,
        acuteLimbIschaemia,
    ]

    // MARK: - Individual plans

    // MARK: Acute Appendicitis

    static let acuteAppendicitis = ManagementPlan(
        diagnosis: "Acute Appendicitis",
        icdCode: "K37",
        urgency: .urgent,
        immediateActions: [
            "IV access — 16G or larger",
            "Analgesia: morphine 2.5–5 mg IV (DO NOT withhold — does not mask diagnosis)",
            "Anti-emetic: ondansetron 4 mg IV",
            "IV fluid: 0.9% NaCl or Hartmann's 1 L over 2–4 h",
            "Nil by mouth",
            "Bladder: ensure patient has voided (exclude pregnancy in women of childbearing age)",
            "Pregnancy test (urine β-hCG) in all females 12–55 years",
        ],
        investigations: [
            "FBC, CRP, U&E, LFT, coagulation",
            "Blood group and save",
            "Urinalysis + urine M&C",
            "USS abdomen (first-line imaging; sensitivity ~75–85%)",
            "CT abdomen/pelvis with contrast if USS equivocal (sensitivity 94%, specificity 95%)",
            "MRI if CT avoided (pregnancy, radiation-sensitive)",
        ],
        medicalManagement: [
            "Antibiotics: co-amoxiclav 1.2 g IV TDS (or cefuroxime 1.5 g TDS + metronidazole 500 mg TDS if penicillin allergy)",
            "Antibiotics alone acceptable in uncomplicated appendicitis in selected patients — high recurrence rate (≈30% at 5 years)",
        ],
        surgicalIndications: [
            "All cases of confirmed appendicitis unless patient declines surgery",
            "Peritonitis / perforation — emergency theatre",
            "Failed non-operative management or worsening",
            "Appendiceal mass: initial conservative; delayed interval appendicectomy at 6–8 weeks",
        ],
        surgicalProcedure: "Laparoscopic appendicectomy (or open in extremis)",
        disposition: "Admit surgical ward; theatre within 4–8 h of diagnosis",
        followUp: "Routine 2-week outpatient review; histology to exclude carcinoid / adenocarcinoma",
        keyPitfalls: [
            "Do not delay analgesia pending imaging — evidence clear that morphine does not mask examination",
            "Normal USS does not exclude appendicitis — CT if clinical suspicion remains",
            "Always histology on specimen — carcinoid / adenocarcinoma in 1–2%",
            "Consider gynaecological pathology in women — ovarian cyst, ectopic, PID can mimic",
            "Perforated appendicitis: may have pain-free window after rupture — do not be falsely reassured",
        ],
        redFlags: [
            "Peritonism, guarding or rigidity → perforated appendicitis, emergency theatre",
            "Haemodynamically unstable → aggressive resuscitation and immediate theatre",
            "Pregnancy → MRI preferred; appendicitis in pregnancy has high fetal mortality if delayed",
        ],
        guidelines: "WSES Jerusalem Guidelines 2020; NICE CG92"
    )

    // MARK: Perforated Appendicitis

    static let perforatedAppendicitis = ManagementPlan(
        diagnosis: "Perforated Appendicitis",
        icdCode: "K35.20",
        urgency: .immediate,
        immediateActions: [
            "Two large-bore IV access (14–16G)",
            "Aggressive IV crystalloid resuscitation (30 mL/kg over 30 min if haemodynamically unstable)",
            "IV morphine + anti-emetic",
            "IV broad-spectrum antibiotics IMMEDIATELY: piperacillin-tazobactam 4.5 g TDS or meropenem 1 g TDS",
            "Nil by mouth",
            "IDC for hourly urine output monitoring (target >0.5 mL/kg/h)",
            "Urgent anaesthetic review and consent for emergency laparoscopy/laparotomy",
        ],
        investigations: [
            "FBC, CRP, U&E, LFT, coagulation, blood cultures × 2",
            "Blood group and cross-match 2 units",
            "CT abdomen/pelvis (if time permits and patient stable — confirms perforation + complications)",
            "Arterial blood gas if septic",
        ],
        medicalManagement: [
            "IV antibiotics for 3–5 days post-operatively then oral completion",
            "Ensure adequate resuscitation before induction of anaesthesia",
        ],
        surgicalIndications: [
            "All cases — emergency surgery",
            "Laparoscopic washout and appendicectomy or Hartmann's procedure if massive contamination",
        ],
        surgicalProcedure: "Emergency laparoscopic or open appendicectomy + peritoneal washout",
        disposition: "Emergency theatre — target door-to-theatre <4 h",
        followUp: "Review wound, histology at 2 weeks; CT at 4–6 weeks if localised collection",
        keyPitfalls: [
            "Do not delay theatre for imaging if peritonitis clinically evident",
            "Broad-spectrum antibiotics must cover Gram-negatives and anaerobes",
            "Ensure adequate resuscitation before GA — volume-deplete patients have high anaesthetic risk",
        ],
        redFlags: [
            "Septic shock → ICU post-operatively; involve intensive care pre-operatively",
            "Free gas on imaging → emergency laparotomy without further imaging",
        ],
        guidelines: "WSES Jerusalem Guidelines 2020"
    )

    // MARK: Acute Cholecystitis

    static let acuteCholecystitis = ManagementPlan(
        diagnosis: "Acute Cholecystitis",
        icdCode: "K81.0",
        urgency: .urgent,
        immediateActions: [
            "IV access + IV fluids (Hartmann's 1 L over 4 h)",
            "Analgesia: diclofenac 75 mg IM or morphine 2.5 mg IV",
            "Anti-emetic: metoclopramide or ondansetron IV",
            "Nil by mouth if surgical management planned",
            "Temperature, HR, BP monitoring",
        ],
        investigations: [
            "FBC, CRP, U&E, LFT, amylase / lipase (exclude pancreatitis)",
            "Blood group and save",
            "USS abdomen (confirm gallstones, wall thickening >4 mm, pericholecystic fluid, Murphy's sign USS)",
            "MRCP / USS bile duct if LFTs suggest biliary obstruction",
            "Blood cultures × 2 if fever ≥38.5°C or Tokyo Grade II/III",
        ],
        medicalManagement: [
            "IV antibiotics: co-amoxiclav 1.2 g TDS (or cefuroxime 1.5 g TDS + metronidazole 500 mg TDS)",
            "Convert to oral antibiotics when afebrile and tolerating diet",
            "Duration: 5–7 days total",
        ],
        surgicalIndications: [
            "Tokyo Grade I: early laparoscopic cholecystectomy within 72 h (preferred over delayed)",
            "Tokyo Grade II: early cholecystectomy within 72 h if surgically fit; cholecystostomy if high-risk",
            "Tokyo Grade III: emergency cholecystostomy or cholecystectomy after resuscitation",
            "Gangrenous / emphysematous cholecystitis: emergency theatre",
        ],
        surgicalProcedure: "Laparoscopic cholecystectomy (IOC recommended to delineate ductal anatomy)",
        disposition: "Admit surgical ward; Grade II/III → HDU",
        followUp: "Histology review; check for unsuspected gallbladder cancer (1–2%)",
        keyPitfalls: [
            "Early cholecystectomy (within 72 h) superior to delayed — less morbidity, shorter hospital stay",
            "Acalculous cholecystitis: occurs in ICU patients — high mortality; early cholecystostomy preferred",
            "Mirizzi syndrome: CBD obstruction from impacted cystic duct stone — can cause diagnostic confusion",
            "Always perform IOC or MRCP if LFTs abnormal — CBD stones in 15% of cases",
        ],
        redFlags: [
            "Fever >39°C or haemodynamic instability → Tokyo Grade II/III; escalate antibiotics",
            "Rigidity / peritonism → perforation; emergency theatre",
            "Jaundice → cholangitis until proven otherwise",
        ],
        guidelines: "Tokyo Guidelines 2018 (TG18); NICE CG188"
    )

    // MARK: Cholangitis / Obstructive Jaundice

    static let cholangitisObstructiveJaundice = ManagementPlan(
        diagnosis: "Acute Cholangitis",
        icdCode: "K83.0",
        urgency: .urgent,
        immediateActions: [
            "IV access × 2",
            "IV broad-spectrum antibiotics WITHIN 1 HOUR: piperacillin-tazobactam 4.5 g TDS",
            "Blood cultures × 2 BEFORE antibiotics",
            "IV fluids: Hartmann's 1 L stat then titrate to urine output",
            "IDC for hourly urine monitoring",
            "Analgesia + anti-emetic IV",
            "Urgent hepatobiliary surgical and gastroenterology review",
        ],
        investigations: [
            "FBC, CRP, U&E, LFT, coagulation, blood cultures × 2",
            "Blood group and save",
            "USS abdomen (CBD dilation, stones)",
            "MRCP if USS inconclusive (MRI superior to USS for choledocholithiasis)",
            "CT abdomen if malignant cause suspected or complex anatomy",
            "ERCP (diagnostic + therapeutic — planned urgently)",
        ],
        medicalManagement: [
            "Tokyo Grade I: IV antibiotics; elective ERCP within 72 h",
            "Tokyo Grade II: IV antibiotics + urgent ERCP within 24–48 h",
            "Tokyo Grade III: ICU resuscitation + emergency ERCP within 12–24 h",
            "Antibiotics: piperacillin-tazobactam 4.5 g TDS or meropenem 1 g TDS + fluconazole if immunocompromised",
            "Duration: 5–7 days IV then oral completion",
        ],
        surgicalIndications: [
            "Failed or unavailable ERCP → percutaneous transhepatic cholangiopgraphy (PTC) drainage",
            "Underlying malignancy requiring resection (after cholangitis resolution)",
            "Laparoscopic cholecystectomy after stones cleared and acute episode resolved",
        ],
        surgicalProcedure: "ERCP + sphincterotomy + stone extraction ± biliary stent",
        disposition: "Admit; Grade III → ICU; Grade II → HDU",
        followUp: "Interval cholecystectomy 6–8 weeks after ERCP (reduced recurrence)",
        keyPitfalls: [
            "Charcot's triad (fever + jaundice + RUQ pain) only present in 70% — high suspicion needed",
            "Reynolds' pentad (+ shock + confusion) = acute suppurative cholangitis — emergency",
            "Antibiotics NOT a substitute for biliary drainage in Grade II/III",
            "Blood cultures before antibiotics — bacteraemia in 50% of cases",
            "Coagulopathy from obstructive jaundice: Vitamin K 10 mg IV before invasive procedures",
        ],
        redFlags: [
            "Septic shock → Grade III; emergency ERCP within 12 h or PTC drainage",
            "Altered consciousness → Reynolds' pentad; ITU + emergency biliary drainage",
        ],
        guidelines: "Tokyo Guidelines 2018 (TG18); BSG 2022"
    )

    // MARK: Acute Pancreatitis

    static let acutePancreatitis = ManagementPlan(
        diagnosis: "Acute Pancreatitis",
        icdCode: "K85.9",
        urgency: .urgent,
        immediateActions: [
            "IV access + aggressive IV fluid resuscitation: Hartmann's or 0.9% NaCl 250–500 mL/h × 4–6 h",
            "Analgesia: morphine IV (superior to pethidine — ignore old advice)",
            "Anti-emetic: ondansetron 4 mg IV",
            "Nil by mouth initially (clear fluids once pain improves — within 24–48 h in mild cases)",
            "Oxygen if SpO₂ <95% or respiratory compromise",
            "IDC if haemodynamically unstable (target urine output >0.5 mL/kg/h)",
        ],
        investigations: [
            "FBC, U&E, LFT, amylase/lipase, LDH, calcium, glucose, CRP",
            "ABG (if respiratory compromise or severe — PaO₂ key in Ranson/Glasgow scoring)",
            "Blood group and save",
            "USS abdomen (gallstones — aetiology; CBD dilation)",
            "MRCP within 24–48 h if biliary aetiology (gallstones + elevated LFTs)",
            "CT abdomen with contrast at 48–72 h ONLY if: diagnosis uncertain, or severe / not improving (CTSI for necrosis)",
            "IgG4 level if autoimmune pancreatitis suspected (middle-aged, obstructive jaundice, mass)",
        ],
        medicalManagement: [
            "IV fluids: target 3–4 L/day crystalloid (Hartmann's preferred); re-assess every 4–6 h",
            "Analgesia: morphine IV or epidural for severe pain",
            "Nutrition: early enteral feeding (nasojejunal or nasogastric) within 48 h if unable to eat",
            "TPN only if enteral route not possible",
            "Antibiotics: NOT routinely — only if infected necrosis confirmed (imipenem or meropenem)",
            "Cholecystectomy (if gallstone aetiology): during same admission for mild; delayed 6 weeks for severe",
        ],
        surgicalIndications: [
            "Infected pancreatic necrosis (confirmed by FNA or clinical deterioration despite antibiotics)",
            "Abdominal compartment syndrome",
            "Bleeding: angioembolisation or surgery",
            "Bowel ischaemia / perforation",
        ],
        surgicalProcedure: "Minimally invasive necrosectomy (video-assisted retroperitoneal debridement — VARD) or open necrosectomy; delay ≥3–4 weeks",
        disposition: "Ward if mild (Ranson <3, Glasgow <3); HDU if moderate-severe; ICU if Glasgow ≥5 or organ failure",
        followUp: "MRCP or USS at 6–8 weeks to clear biliary stones; CT if peripancreatic fluid collection (pseudocyst surveillance)",
        keyPitfalls: [
            "Aggressive early fluid resuscitation is the single most important intervention",
            "Do NOT delay cholecystectomy in gallstone pancreatitis — if delayed, 25–30% re-admission risk",
            "Prophylactic antibiotics do NOT reduce mortality in sterile necrosis — Cochrane evidence clear",
            "CT at admission is not indicated — necrosis maximal at 48–72 h",
            "Pancreatitis pain can be subtle in elderly — do not miss",
        ],
        redFlags: [
            "Ranson ≥3 or Glasgow ≥3 → severe pancreatitis; ICU review",
            "Oxygen requirements → ARDS; ICU",
            "Deterioration at 48–72 h despite treatment → CT + consider infected necrosis",
        ],
        guidelines: "IAP/APA 2013; WSES 2019; BSG 2005"
    )

    // MARK: Severe Pancreatitis

    static let severePancreatitis = ManagementPlan(
        diagnosis: "Severe Acute Pancreatitis",
        icdCode: "K85.90",
        urgency: .immediate,
        immediateActions: [
            "ICU admission",
            "Invasive monitoring: arterial line, central venous line",
            "Aggressive fluid resuscitation with goal-directed therapy (CVP 8–12, MAP ≥65)",
            "Vasopressors (noradrenaline) if MAP <65 despite resuscitation",
            "Mechanical ventilation if ARDS (PaO₂/FiO₂ <300)",
            "Nasojejunal feeding within 24–48 h",
            "Broad-spectrum antibiotics only if confirmed infected necrosis",
        ],
        investigations: [
            "Repeat FBC, U&E, LFT, calcium, glucose, CRP every 12 h",
            "ABG every 4–6 h",
            "Serum lactate",
            "CT abdomen with contrast at 72 h (CTSI — modified CT severity index)",
            "CT-guided FNA of necrotic collections if infection suspected (fever + rising WBC at >7 d)",
        ],
        medicalManagement: [
            "IV antibiotics (only if infected necrosis): imipenem 500 mg TDS or meropenem 1 g TDS",
            "Antifungal (fluconazole) if prolonged antibiotics or immunocompromised",
            "Nasojejunal feeding: peptide-based feed 25 mL/h initially, titrate",
            "Insulin infusion for glucose >10 mmol/L",
            "Renal replacement therapy for AKI",
        ],
        surgicalIndications: [
            "Infected pancreatic necrosis confirmed (FNA positive or gas in collection on CT)",
            "Delay surgery ≥3–4 weeks for walled-off necrosis (superior outcomes)",
            "Abdominal compartment syndrome (IAP >20 mmHg with new organ failure)",
        ],
        surgicalProcedure: "Step-up approach: percutaneous drain → VARD (video-assisted retroperitoneal debridement) → open necrosectomy if fails",
        disposition: "ICU — planned admission",
        followUp: "MRCP at 6–8 weeks; CT for pseudocyst / walled-off necrosis resolution",
        keyPitfalls: [
            "Do not take to theatre early (first 2 weeks) — mortality much higher than delayed surgery",
            "Infected necrosis must be confirmed (FNA / CT gas) before antibiotics",
        ],
        redFlags: [
            "Abdominal compartment syndrome: check bladder pressure if abdominal distension — treat if >20 mmHg",
            "Colonic necrosis: fist of ischaemic colitis — may present with rectal bleeding in severe pancreatitis",
        ],
        guidelines: "IAP/APA 2013; WSES Pancreatitis 2019"
    )

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

    // MARK: Abdominal Sepsis

    static let sepsisAbdominal = ManagementPlan(
        diagnosis: "Abdominal Sepsis / Septic Shock",
        icdCode: "A41.9",
        urgency: .immediate,
        immediateActions: [
            "SEPSIS-1-HOUR BUNDLE:",
            "1. Blood cultures × 2 before antibiotics",
            "2. Lactate measurement",
            "3. Broad-spectrum IV antibiotics within 1 hour: meropenem 1 g TDS + metronidazole 500 mg TDS",
            "4. IV crystalloid 30 mL/kg if lactate ≥4 or MAP <65",
            "5. Re-measure lactate if initial ≥2 mmol/L",
            "IDC for urine output monitoring (target >0.5 mL/kg/h)",
            "Vasopressors (noradrenaline) if MAP <65 despite 30 mL/kg fluid: titrate to MAP ≥65",
            "ICU referral EARLY — do not wait for organ failure",
        ],
        investigations: [
            "FBC, U&E, LFT, CRP, coagulation, blood cultures × 2, lactate, arterial blood gas",
            "Blood group and cross-match",
            "CT abdomen/pelvis (identify source: appendicitis, cholangitis, perforation, diverticulitis, ischaemia)",
            "CXR (exclude pneumonia)",
            "Urine culture",
        ],
        medicalManagement: [
            "Antibiotics: meropenem 1 g TDS covers most Gram-negative + anaerobic pathogens",
            "Add vancomycin if MRSA suspected; add fluconazole if Candida risk",
            "Hydrocortisone 200 mg/d IV if septic shock not responding to vasopressors",
            "Blood glucose control: target 6–10 mmol/L",
        ],
        surgicalIndications: [
            "Source control is mandatory — identify and treat the intra-abdominal source",
            "Delay of >12 h in source control increases mortality by 30%",
            "Emergent: perforation, strangulated hernia, ischaemia, cholangitis (ERCP)",
            "Urgent: appendicitis, cholecystitis, abscess drainage",
        ],
        surgicalProcedure: "Depends on source (see individual diagnoses); damage control surgery in extremis",
        disposition: "ICU",
        followUp: "Regular reassessment: lactate clearance, organ function, antibiotic de-escalation based on cultures",
        keyPitfalls: [
            "Antibiotic without source control = inadequate treatment — identify the source",
            "Lactate ≥4 = septic shock regardless of BP — aggressive resuscitation required",
            "Do not give broad-spectrum antibiotics without cultures first",
            "Antibiotic de-escalation: narrow based on culture/sensitivity results at 24–48 h",
        ],
        redFlags: [
            "Lactate ≥4 + MAP <65 → septic shock; ICU + vasopressors immediately",
            "Organ failure (creatinine ↑, bilirubin ↑, platelets ↓, confused) → Sepsis-3 with SOFA ≥2",
        ],
        guidelines: "Surviving Sepsis Campaign 2021; NICE NG51"
    )

    // MARK: Acute Mesenteric Ischaemia

    static let mesentericIschaemia = ManagementPlan(
        diagnosis: "Acute Mesenteric Ischaemia",
        icdCode: "K55.0",
        urgency: .immediate,
        immediateActions: [
            "LIFE-THREATENING EMERGENCY — mortality 60–80% without prompt recognition",
            "Two large-bore IV access + aggressive resuscitation",
            "IV morphine analgesia",
            "IV unfractionated heparin (UFH) 5,000 units stat if embolic cause suspected (unless GI bleed)",
            "IV broad-spectrum antibiotics: meropenem 1 g TDS (translocation risk)",
            "IDC + urine output monitoring",
            "Urgent vascular/general surgery review",
            "ICU referral",
        ],
        investigations: [
            "FBC, U&E, CRP, lactate (elevated >2 = ischaemia; sensitivity poor but supports diagnosis)",
            "Blood cultures × 2",
            "Blood group and cross-match 4 units",
            "CT angiography (CT-A): diagnostic test of choice; identifies arterial / venous occlusion + bowel changes",
            "ABG (metabolic acidosis — late sign, poor prognosis)",
            "ECG + troponin (AF is embolic cause in 50%)",
        ],
        medicalManagement: [
            "Anticoagulation with UFH if SMA embolus — bridge to surgery or thrombolysis",
            "Papaverine infusion via catheter if catheter-directed therapy available",
            "Antibiotics covering bowel flora",
            "Optimise cardiac output (AF rate control, inotropes if cardiogenic source)",
        ],
        surgicalIndications: [
            "All cases with viable bowel on CT: revascularisation",
            "SMA embolus: surgical embolectomy or catheter-directed thrombolysis",
            "SMA thrombosis: surgical bypass or endovascular stenting",
            "Established bowel necrosis: emergency laparotomy + resection",
            "Second-look laparotomy at 24–48 h if bowel viability uncertain",
        ],
        surgicalProcedure: "Laparotomy + SMA embolectomy / bypass + bowel resection of necrotic segments; second-look planned",
        disposition: "ICU post-operatively",
        followUp: "Long-term anticoagulation; screen for underlying cardiac cause (AF)",
        keyPitfalls: [
            "Classic presentation: pain out of proportion to examination findings — cardinal sign",
            "Normal WBC and lactate early does NOT exclude — diagnosis often delayed",
            "CT-A is essential — do not delay for plain films or ultrasound",
            "Second-look laparotomy is planned, not optional — bowel viability not reliably assessed at first laparotomy",
        ],
        redFlags: [
            "Pain out of proportion to examination + AF + age >60 → mesenteric ischaemia until proven otherwise",
            "Peritonism → bowel necrosis; emergency laparotomy without delay",
            "Rising lactate + metabolic acidosis → established necrosis; theatre immediately",
        ],
        guidelines: "ESVS 2017; WSES 2017"
    )

    // MARK: AAA (Ruptured)

    static let aaa = ManagementPlan(
        diagnosis: "Abdominal Aortic Aneurysm (Ruptured)",
        icdCode: "I71.3",
        urgency: .immediate,
        immediateActions: [
            "CALL VASCULAR SURGEON IMMEDIATELY",
            "Two large-bore IV access (14G) + cross-match 6 units URGENT",
            "Permissive hypotension: target SBP 70–90 mmHg until aortic control achieved (DO NOT over-resuscitate — blows clot)",
            "If haemodynamically unstable → theatre immediately (no CT)",
            "If haemodynamically stable → CT angiography to plan EVAR vs open",
            "O-negative blood if haemodynamically compromised and cross-match not yet available",
        ],
        investigations: [
            "FBC, U&E, coagulation, blood group + URGENT cross-match 6 units + 4 FFP",
            "CT aorta angiography (if stable): determines aneurysm anatomy, EVAR feasibility",
            "Bedside USS if CT not rapidly available (confirms aneurysm, but cannot confirm rupture)",
            "ABG, ECG",
        ],
        medicalManagement: [
            "Permissive hypotension until aortic control — avoid raising SBP above 90",
            "Massive transfusion protocol (1:1:1 ratio: pRBC : FFP : platelets)",
            "Tranexamic acid 1 g IV over 10 min (anti-fibrinolytic)",
        ],
        surgicalIndications: [
            "All ruptured AAA — emergency surgery",
        ],
        surgicalProcedure: "EVAR (preferred if anatomy suitable) or open repair (aortobifemoral graft) — EVAR has lower 30-day mortality if anatomy allows",
        disposition: "Theatre → ICU",
        followUp: "Regular EVAR surveillance USS at 1, 12 months then annually",
        keyPitfalls: [
            "Classic triad (pulsatile mass + hypotension + back/flank pain) present in <50%",
            "Do NOT over-resuscitate: target SBP 70–80 — avoid systolic >90 pre-operatively",
            "Missed diagnosis commonest in: women (less common), obese patients, atypical pain (flank, hip, back)",
            "Immediate theatre if haemodynamically unstable — CT is for stable patients only",
        ],
        redFlags: [
            "Hypotensive + pulsatile abdominal mass → emergency theatre immediately; no delay for imaging",
            "Cardiac arrest from AAA → theatre (resuscitative endovascular balloon occlusion of the aorta if trained)",
        ],
        guidelines: "ESVS 2019; NICE NG45 (AAA surveillance); SVS 2018"
    )

    // MARK: Necrotising Fasciitis

    static let necrotizingFasciitis = ManagementPlan(
        diagnosis: "Necrotising Fasciitis",
        icdCode: "M72.6",
        urgency: .immediate,
        immediateActions: [
            "NECROTISING FASCIITIS IS A SURGICAL EMERGENCY — every hour of delay increases mortality by ~10%",
            "IV access × 2 + aggressive fluid resuscitation",
            "IV broad-spectrum antibiotics IMMEDIATELY: meropenem 1 g TDS + clindamycin 600 mg TDS (anti-toxin effect) + fluconazole 400 mg OD",
            "IDC for urine output",
            "ICU referral simultaneously",
            "Theatre team activation — do NOT wait for confirmation",
            "Inform patient and next of kin — mortality 20–40%",
        ],
        investigations: [
            "FBC, CRP, U&E, LFT, coagulation, lactate, blood cultures × 2",
            "LRINEC score (laboratory risk indicator)",
            "MRI soft tissue (most sensitive — if time permits and patient stable)",
            "CT soft tissue (may show gas tracking along fascial planes — pathognomonic)",
            "Wound swab for MC&S",
            "Finger test: surgical incision + probe to fascial plane — necrotic fascia (no bleeding, 'dishwater' fluid, tissue planes separate easily) = positive",
        ],
        medicalManagement: [
            "IV antibiotics: meropenem 1 g TDS + clindamycin 600 mg TDS (anti-streptococcal toxin suppression) + fluconazole",
            "IVIG 2 g/kg IV (single dose) in Group A streptococcal NF — reduces mortality",
            "Hyperbaric oxygen: adjunct where available",
        ],
        surgicalIndications: [
            "All cases — immediate wide surgical debridement",
            "Do NOT biopsy, aspirate or wait for MRI if clinical suspicion high",
        ],
        surgicalProcedure: "Wide excision of all necrotic tissue until reaching healthy bleeding fascia; second-look surgery at 24–48 h; wound left open; split-thickness skin graft and reconstruction after clean wound",
        disposition: "ICU post-operatively",
        followUp: "Multiple returns to theatre (2–3 expected); plastic surgery for reconstruction; stoma if perineal involvement (Fournier's)",
        keyPitfalls: [
            "Normal skin appearance early does NOT exclude deep fascial necrosis",
            "Pain out of proportion to external appearances is the clinical hallmark",
            "LRINEC ≥8: PPV ~92% but use clinically — do not delay theatre for score calculation if clinical picture clear",
            "Type I (polymicrobial) commonest — diabetes, immunocompromised, abdominal wall; Type II (Group A Strep) more fulminant",
            "Fournier's gangrene = NF of perineum / scrotum — diverting colostomy often required",
        ],
        redFlags: [
            "Gas in soft tissue on CT → NF confirmed; immediate theatre",
            "Septic shock → life-threatening; ICU + theatre simultaneously",
            "Any delay in surgical debridement directly correlates with mortality",
        ],
        guidelines: "WSES 2018 NF Guidelines; IDSA 2014 SSTI Guidelines"
    )

    // MARK: Deep Vein Thrombosis

    static let dvt = ManagementPlan(
        diagnosis: "Deep Vein Thrombosis",
        icdCode: "I82.409",
        urgency: .semiUrgent,
        immediateActions: [
            "Clinical assessment: Wells DVT score",
            "D-dimer if Wells ≤1 (low probability): if negative, DVT excluded without USS",
            "Compression duplex USS urgently if Wells ≥2",
            "If high clinical suspicion + delay to imaging: commence LMWH empirically",
        ],
        investigations: [
            "Compression duplex USS (whole leg): diagnostic test of choice",
            "D-dimer: high sensitivity (~96%), low specificity — use to rule out only",
            "FBC, U&E, LFT, coagulation (baseline before anticoagulation)",
            "Thrombophilia screen (if provoked, first episode, unusual site, family Hx): defer until 3 months after stopping anticoagulation",
            "Malignancy screen if unprovoked: CXR, urinalysis, FBC, PSA (male), CT chest/abdomen/pelvis if indicated",
        ],
        medicalManagement: [
            "Anticoagulation: DOAC first-line (apixaban 10 mg BD × 7 d, then 5 mg BD; or rivaroxaban 15 mg BD × 21 d, then 20 mg OD)",
            "LMWH: enoxaparin 1 mg/kg BD SC if DOAC contraindicated (renal impairment, pregnancy, cancer-related — use LMWH in cancer-VTE: dalteparin 200 IU/kg OD × 30 d then 150 IU/kg OD)",
            "Duration: provoked DVT 3 months; unprovoked proximal DVT ≥3–6 months; recurrent/unprovoked: consider lifelong",
            "Compression stockings: reduce post-thrombotic syndrome (Grade 2B — SOCTRATES trial)",
        ],
        surgicalIndications: [
            "Catheter-directed thrombolysis for massive iliofemoral DVT + limb-threatening symptoms",
            "IVC filter: recurrent PE on anticoagulation, anticoagulation contraindicated",
        ],
        surgicalProcedure: "Catheter-directed thrombolysis or thrombectomy for massive proximal DVT only",
        disposition: "Outpatient anticoagulation for most; admit if severe symptoms, PE concern, anticoagulation risk",
        followUp: "Review 3 months; consider indefinite anticoagulation for unprovoked; thrombophilia screen at 3 months",
        keyPitfalls: [
            "Always consider PE — DVT and PE are the same disease",
            "Cancer-associated DVT: DOAC (edoxaban or rivaroxaban) now preferred over LMWH in most",
            "Below-knee DVT: controversial — treat if symptomatic or extension risk",
            "Delay to anticoagulation increases PE risk and post-thrombotic syndrome",
        ],
        redFlags: [
            "Haemodynamic instability + DVT → suspect massive PE; CTPA urgently",
            "Phlegmasia cerulea dolens (massive DVT + limb ischaemia) → emergency thrombectomy",
        ],
        guidelines: "NICE NG158; BTS PE 2003 updated; ASH 2020"
    )

    // MARK: Pulmonary Embolism

    static let pulmonaryEmbolism = ManagementPlan(
        diagnosis: "Pulmonary Embolism",
        icdCode: "I26.99",
        urgency: .urgent,
        immediateActions: [
            "Oxygen: high-flow if SpO₂ <92% — target SpO₂ 94–98%",
            "IV access + baseline obs",
            "Assess haemodynamic status: if SBP <90 or HR >100 → massive PE",
            "If massive PE: emergency thrombolysis (alteplase 100 mg IV over 2 h) or surgical embolectomy",
            "If sub-massive: anticoagulate and monitor closely",
            "Analgesia for pleuritic pain",
        ],
        investigations: [
            "ABG, FBC, U&E, D-dimer (if Wells PE ≤4 and stable)",
            "ECG (S1Q3T3, RBBB, sinus tachycardia — S1Q3T3 present in only 20%)",
            "CXR (Westermark / Hampton's hump — insensitive; useful to exclude alternative diagnosis)",
            "Troponin + BNP (risk stratification: elevated = right heart strain = worse prognosis)",
            "CTPA (definitive): if Wells PE >4, or D-dimer positive",
            "ECHO bedside (if massive PE — RV strain; can guide thrombolysis decision)",
        ],
        medicalManagement: [
            "Anticoagulation: DOAC first-line (rivaroxaban 15 mg BD × 21 d, then 20 mg OD; or apixaban 10 mg BD × 7 d, then 5 mg BD)",
            "LMWH: enoxaparin 1 mg/kg BD if DOAC contraindicated",
            "Massive PE: IV alteplase 100 mg over 2 h (systemic thrombolysis) if haemodynamically unstable",
            "Sub-massive PE + RV strain: consider reduced-dose thrombolysis or catheter-directed therapy",
            "Duration: provoked 3 months; unprovoked 6 months+",
        ],
        surgicalIndications: [
            "Surgical embolectomy: massive PE + contraindication to thrombolysis or failed thrombolysis",
            "Catheter-directed thrombolysis: sub-massive PE with RV strain",
        ],
        surgicalProcedure: "Surgical pulmonary embolectomy (CPB); or catheter-directed thrombolysis / AngioJet thrombectomy",
        disposition: "Massive PE → ICU; sub-massive → HDU / monitored ward; low-risk → outpatient DOAC (PESI score <2)",
        followUp: "CTPA or V/Q scan at 3–6 months (chronic thromboembolic disease); echocardiogram if RV strain; thrombophilia screen at 3 months",
        keyPitfalls: [
            "S1Q3T3 is present in only 20% — do not rely on ECG to exclude PE",
            "D-dimer: negative rules out PE only in low-to-moderate probability (Wells ≤4)",
            "Massive PE: do NOT delay thrombolysis awaiting CTPA if arrest imminent",
            "Post-PE syndrome: chronic dyspnoea — screen for CTEPH at 3–6 months",
        ],
        redFlags: [
            "Cardiac arrest / pulseless electrical activity in context of PE → thrombolysis during CPR (alteplase 50 mg stat)",
            "Haemodynamic compromise + RV strain on ECHO → massive PE; thrombolysis or embolectomy",
        ],
        guidelines: "ESC PE Guidelines 2019; BTS 2003 (updated); NICE NG158"
    )

    // MARK: Acute Limb Ischaemia

    static let acuteLimbIschaemia = ManagementPlan(
        diagnosis: "Acute Limb Ischaemia",
        icdCode: "I74.3",
        urgency: .immediate,
        immediateActions: [
            "SURGICAL EMERGENCY — window for limb salvage 4–6 hours from onset",
            "IV access + analgesia (morphine IV)",
            "IV unfractionated heparin 5,000 units stat (to prevent propagation)",
            "Start heparin infusion 1,000 units/hour (target APTT 60–90 s)",
            "Nil by mouth",
            "Urgent vascular surgery review — target revascularisation within 4–6 h",
        ],
        investigations: [
            "FBC, U&E, coagulation, creatine kinase, blood cultures, cross-match",
            "ECG (AF in 40% — embolic cause)",
            "Ankle-brachial pressure index (ABPI) if Doppler available",
            "CT angiography (if time permits and stable — maps occlusion for operative planning)",
            "ECHO (cardiac source of embolus?)",
        ],
        medicalManagement: [
            "UFH anticoagulation throughout",
            "Thrombolysis (catheter-directed): selected cases of acute-on-chronic thrombosis with viable limb",
        ],
        surgicalIndications: [
            "All cases of acute limb ischaemia — revascularise urgently",
            "Embolus: Fogarty embolectomy (under LA if possible)",
            "Thrombosis on background PAD: bypass or angioplasty",
            "Irreversible ischaemia (6 Ps + fixed mottling + rigor): primary amputation",
        ],
        surgicalProcedure: "Fogarty embolectomy / thrombectomy; bypass grafting; on-table angiography; fasciotomy if >6 h ischaemia or compartment syndrome risk",
        disposition: "Theatre → ICU / HDU",
        followUp: "Investigate embolus source (AF, cardiac thrombus); anticoagulation long-term; wound review",
        keyPitfalls: [
            "6 Ps: Pain, Pallor, Pulselessness, Paraesthesia, Paralysis, Perishingly cold (Poikilothermia)",
            "Paralysis/paraesthesia = neural ischaemia = LATE sign — urgent revascularisation without delay",
            "Reperfusion injury: potassium release + myoglobinuria after revascularisation — aggressive IV fluids + monitor K⁺",
            "Fasciotomy: mandatory if ischaemia >4–6 h, compartment pressure >30 mmHg or clinical compartment syndrome",
        ],
        redFlags: [
            "Paralysis or paraesthesia → irreversible ischaemia developing; revascularise within 1–2 h or amputate",
            "Fixed mottling + muscle rigidity = irreversible → primary amputation",
        ],
        guidelines: "ESVS 2020; SVS 2012"
    )
}
