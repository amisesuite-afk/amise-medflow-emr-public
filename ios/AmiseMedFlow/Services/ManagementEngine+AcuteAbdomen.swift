// ManagementEngine+AcuteAbdomen.swift
// Acute abdomen plans: Appendicitis, Cholecystitis, Cholangitis, Pancreatitis.

import Foundation

extension ManagementEngine {

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


}
