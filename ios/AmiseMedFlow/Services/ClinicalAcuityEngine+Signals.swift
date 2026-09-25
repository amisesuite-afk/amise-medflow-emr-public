import Foundation

// MARK: - Clinical acuity engine: vital signs, blood pressure, labs, ECG, sepsis
//
// Thresholds and their sources (each rule's comment names the guideline it follows):
//   NEWS2 bands                    RCP NEWS2 (2017): ≥7 emergency response; 5–6 or a single 3 urgent.
//   Adult single-parameter         NICE NG51 (2016, updated 2024) high-risk criteria: RR ≥25, SBP ≤90,
//                                  HR >130, new confusion / altered mental state, SpO₂ <92%.
//   Paediatric vital signs         APLS (ALSG, 6th ed.) normal ranges by age; hypotension below
//                                  70 mmHg (<1 y), 70 + 2 × age (1–10 y), 90 mmHg (>10 y);
//                                  NICE NG143 (2019, updated 2021) red/amber features.
//   Oxygen targets                 BTS 2017 emergency oxygen: 94–98%; 88–92% at risk of hypercapnia.
//   Blood pressure                 NICE NG136 (2019, updated 2023): ≥180/120; NICE NG133 (2019,
//                                  updated 2023) pregnancy: ≥140/90 hypertension, ≥160/110 severe.
//   Potassium                      UK Kidney Association 2023: ≥6.5 severe, 6.0–6.4 moderate.
//   Sodium                         European hyponatraemia guideline (Spasovski 2014).
//   Glucose / ketones              JBDS 2023 (DKA, hypoglycaemia), JBDS 2022 (HHS).
//   Calcium                        Society for Endocrinology emergency guidance (2016).
//   Lactate / sepsis               Sepsis-3 (Singer 2016) qSOFA; Surviving Sepsis Campaign 2021; NICE NG51.
//   Troponin                       ESC 2020 NSTE-ACS 0 h rule-in (hs-cTnT ≥52 ng/L); 99th centile 14 ng/L.
//   Haemoglobin                    NICE NG24 (2015) restrictive transfusion threshold 70 g/L.
//   Neutropenic sepsis             NICE CG151 (2012, updated 2020): neutrophils <0.5 × 10⁹/L with fever.
//   Creatinine                     KDIGO 2012 AKI (stage 3 includes creatinine ≥354 µmol/L).

extension ClinicalAcuityEngine {

    // MARK: Vital signs

    static func vitalSigns(_ b: AcuityBuilder) {
        guard let v = b.inputs.vitals else { return }
        let copd = b.pmh.containsAny(["copd", "chronic obstructive", "emphysema", "hypercapni", "type 2 respiratory failure"])
        let hypoxiaAction = copd || v.useSpO2Scale2
            ? "Controlled oxygen to a target of 88–92% (known COPD / hypercapnic risk) and a blood gas (BTS 2017); find the cause."
            : "Oxygen to a target of 94–98% (88–92% if at risk of hypercapnic respiratory failure) — BTS 2017; blood gas; find the cause."

        if b.inputs.isChild {
            paediatricVitalSigns(b, v, hypoxiaAction: hypoxiaAction)
            return
        }

        // NEWS2 (RCP 2017) from the shared chart.
        let news = v.news2
        if news.total >= 7 {
            b.raise(.emergency, "vitals", "NEWS2 \(news.total) (high) — emergency response")
        } else if news.total >= 5 {
            b.raise(.urgent, "vitals", "NEWS2 \(news.total) (medium) — urgent response")
        } else if news.hasSingleParameterScore3 {
            b.raise(.urgent, "vitals", "NEWS2 \(news.total) with a single parameter scoring 3 — urgent response")
        }

        // NICE NG51 high-risk single parameters.
        if let sbp = v.systolic, sbp <= 90 {
            b.alert(.emergency, .medical, "Hypotension / shock — systolic BP \(sbp) mmHg",
                    "Haemodynamic compromise (systolic ≤90 mmHg).",
                    "ABCDE; two large-bore IV cannulae; find and treat the cause (bleeding, sepsis, cardiac, anaphylaxis); senior review.",
                    source: "vitals")
        }
        if let hr = v.heartRate, hr > 130 {
            b.raise(.emergency, "vitals", "Heart rate \(hr)/min (>130)")
        }
        if let hr = v.heartRate, hr <= 40 {
            b.alert(.emergency, .medical, "Bradycardia — heart rate \(hr)/min",
                    "Severe bradycardia: consider complete heart block.",
                    "12-lead ECG and continuous monitoring; atropine / pacing if adverse features (Resus Council UK 2021 bradycardia algorithm).",
                    redirect: true, source: "vitals")
        }
        if let rr = v.respiratoryRate, rr >= 25 {
            b.raise(.emergency, "vitals", "Respiratory rate \(rr)/min (≥25)")
        }
        if v.avpu != .alert {
            b.raise(.emergency, "vitals", "New confusion or reduced consciousness (ACVPU \(v.avpu.rawValue))")
        }
        if let sp = v.spo2 {
            let severeLimit = (copd || v.useSpO2Scale2) ? 88 : 92
            if sp < severeLimit {
                b.alert(.emergency, .medical, "Hypoxaemia — SpO₂ \(sp)%\(v.onSupplementalO2 ? " on oxygen" : " on air")",
                        "Low oxygen saturation.", hypoxiaAction, source: "vitals")
            } else if sp < 94 && !(copd || v.useSpO2Scale2) {
                b.alert(.urgent, .medical, "Low SpO₂ \(sp)%\(v.onSupplementalO2 ? " on oxygen" : " on air")",
                        "Oxygen saturation below the 94–98% target.", hypoxiaAction, source: "vitals")
            }
        }
    }

    /// APLS normal ranges (upper and lower limits) for heart rate and respiratory rate by age.
    static func aplsRanges(ageYears: Int) -> (hrLow: Int, hrHigh: Int, rrHigh: Int) {
        switch ageYears {
        case ..<1:  return (110, 160, 40)
        case 1:     return (100, 150, 35)
        case 2...4: return (95, 140, 30)
        case 5...11: return (80, 120, 25)
        default:    return (60, 100, 20)
        }
    }

    /// APLS hypotension limit for a child.
    static func paediatricHypotensionLimit(ageYears: Int) -> Int {
        if ageYears < 1 { return 70 }
        if ageYears <= 10 { return 70 + 2 * ageYears }
        return 90
    }

    private static func paediatricVitalSigns(_ b: AcuityBuilder, _ v: VitalsSnapshot, hypoxiaAction: String) {
        let age = b.inputs.ageYears ?? 0
        let ranges = aplsRanges(ageYears: age)
        if v.avpu != .alert {
            b.raise(.emergency, "vitals", "Child with reduced consciousness (ACVPU \(v.avpu.rawValue))")
        }
        if let sp = v.spo2 {
            if sp < 92 {
                b.alert(.emergency, .paediatric, "Hypoxaemia — SpO₂ \(sp)% (child)", "Low oxygen saturation in a child.",
                        hypoxiaAction, redirect: true, source: "vitals")
            } else if sp <= 95 {
                // NICE NG143 amber: SpO₂ ≤95% in air.
                b.alert(.urgent, .paediatric, "Low SpO₂ \(sp)% (child)", "NICE NG143 amber feature.",
                        "Paediatric assessment the same day.", source: "vitals")
            }
        }
        if let sbp = v.systolic, sbp < paediatricHypotensionLimit(ageYears: age) {
            b.alert(.emergency, .paediatric, "Hypotension / shock — systolic BP \(sbp) mmHg (child)",
                    "Below the APLS hypotension limit for age \(age).",
                    "ABCDE; IV/IO access; fluid bolus by weight (APLS; weight-based dosing — calculate per BNFc); paediatric emergency team.",
                    redirect: true, source: "vitals")
        }
        if let rr = v.respiratoryRate {
            if rr > 60 {
                b.raise(.emergency, "vitals", "Respiratory rate \(rr)/min in a child (>60, NICE NG143 red)")
            } else if rr > ranges.rrHigh {
                b.raise(.urgent, "vitals", "Respiratory rate \(rr)/min above the APLS range for age \(age)")
            }
        }
        if let hr = v.heartRate {
            if hr < 60 {
                b.raise(.emergency, "vitals", "Heart rate \(hr)/min in a child (<60)")
            } else if hr > ranges.hrHigh {
                b.raise(.urgent, "vitals", "Heart rate \(hr)/min above the APLS range for age \(age)")
            }
        }
        if let t = v.temperatureCelsius {
            let months = b.inputs.ageMonths ?? age * 12
            if months < 3 && t >= 38.0 {
                // NICE NG143 red: any infant under 3 months with a temperature ≥38 °C.
                b.alert(.emergency, .paediatric, "Febrile infant under 3 months — temperature \(String(format: "%.1f", t)) °C",
                        "NICE NG143 high-risk (red) feature.",
                        "Same-day paediatric assessment; do not manage in the clinic.", redirect: true, source: "vitals")
            } else if months < 6 && t >= 39.0 {
                b.raise(.urgent, "vitals", "Infant 3–6 months with temperature ≥39 °C (NICE NG143 amber)")
            }
        }
    }

    // MARK: Blood pressure

    static func bloodPressure(_ b: AcuityBuilder) {
        guard let v = b.inputs.vitals, let sbp = v.systolic else { return }
        let dbp = v.diastolic ?? 0
        let bp = v.diastolic.map { "\(sbp)/\($0)" } ?? "\(sbp) systolic"
        if b.inputs.pregnancy.isPregnant {
            // NICE NG133: severe hypertension in pregnancy ≥160/110.
            if sbp >= 160 || dbp >= 110 {
                b.alert(.emergency, .obstetric, "Severe hypertension in pregnancy — BP \(bp)",
                        "Pre-eclampsia / HELLP syndrome until proven otherwise (NICE NG133 threshold ≥160/110).",
                        "Obstetric emergency: same-day obstetric admission; antihypertensive treatment and magnesium sulfate by the obstetric team (NICE NG133); urine protein, FBC, LFT, creatinine.",
                        redirect: true, source: "blood pressure")
            } else if sbp >= 140 || dbp >= 90 {
                b.alert(.urgent, .obstetric, "Hypertension in pregnancy — BP \(bp)",
                        "Assess for pre-eclampsia (NICE NG133 threshold ≥140/90).",
                        "Same-day obstetric assessment: urine protein, symptoms (headache, visual disturbance, epigastric pain), bloods.",
                        source: "blood pressure")
            }
            return
        }
        guard !b.inputs.isChild, sbp >= 180 || dbp >= 120 else { return }
        // NICE NG136: ≥180/120 with signs of acute target-organ damage → same-day specialist care.
        let organDamage = b.all.containsAny(["papilloedema", "papilledema", "retinal haemorrhage", "encephalopathy",
                                              "confusion", "confused", "seizure", "visual disturbance", "blurred vision",
                                              "chest pain", "pulmonary oedema", "breathless", "drowsy"])
        if organDamage {
            b.alert(.emergency, .medical, "Hypertensive emergency — BP \(bp)",
                    "Severe hypertension with signs of acute target-organ damage (NICE NG136).",
                    "Same-day specialist admission for controlled BP lowering; do not give rapid oral BP reduction in the clinic.",
                    redirect: true, source: "blood pressure")
        } else {
            b.alert(.priority, .medical, "Severe hypertension — BP \(bp)",
                    "BP ≥180/120 without documented acute target-organ damage (NICE NG136).",
                    "Look for target-organ damage now (fundoscopy, ECG, urine, creatinine); if none, repeat and treat — defer elective surgery until controlled.",
                    source: "blood pressure")
        }
    }

    // MARK: Critical labs

    static func labs(_ b: AcuityBuilder) {
        let redirect = true

        if let k = b.lab(["potassium"]) {
            if k >= 6.5 {
                b.alert(.emergency, .medical, "Severe hyperkalaemia — potassium \(fmt(k)) mmol/L",
                        "Potassium ≥6.5 mmol/L (UK Kidney Association 2023).",
                        "12-lead ECG and cardiac monitoring; IV calcium gluconate 10% \(b.dose("30 mL")) (UKKA 2023); insulin–glucose \(b.dose("(10 units soluble insulin with 25 g glucose)")); stop potassium-raising drugs.",
                        redirect: redirect, source: "labs")
            } else if k >= 6.0 {
                b.alert(.urgent, .medical, "Hyperkalaemia — potassium \(fmt(k)) mmol/L",
                        "Moderate hyperkalaemia (UKKA 2023).",
                        "Repeat urgently and 12-lead ECG; treat as severe if ECG changes; review potassium-raising drugs.",
                        source: "labs")
            } else if k <= 2.5 {
                b.alert(.emergency, .medical, "Severe hypokalaemia — potassium \(fmt(k)) mmol/L",
                        "Risk of arrhythmia.",
                        "Cardiac monitoring; IV potassium replacement per local protocol; check magnesium.",
                        redirect: redirect, source: "labs")
            }
        }

        if let na = b.lab(["sodium"]) {
            let severeSymptoms = b.all.containsAny(["seizure", "fitting", "convuls", "reduced consciousness", "drowsy",
                                                     "somnolent", "confus", "vomiting", "cardiorespiratory distress"])
            if na < 125 && severeSymptoms {
                b.alert(.emergency, .medical, "Hyponatraemia with severe symptoms — sodium \(fmt(na)) mmol/L",
                        "Profound hyponatraemia with neurological or severe symptoms (European guideline 2014).",
                        "Hypertonic 3% saline \(b.dose("150 mL IV over 20 minutes")), recheck sodium; assess volume status; stop thiazides and other causative drugs.",
                        redirect: redirect, source: "labs")
            } else if na < 125 {
                b.alert(.urgent, .medical, "Profound hyponatraemia — sodium \(fmt(na)) mmol/L",
                        "Sodium <125 mmol/L (European guideline 2014).",
                        "Assess volume status first; stop thiazides and other causative drugs; paired serum/urine osmolality and urine sodium; avoid correction >10 mmol/L in 24 h.",
                        source: "labs")
            } else if na < 130 {
                b.alert(.priority, .medical, "Hyponatraemia — sodium \(fmt(na)) mmol/L",
                        "Moderate hyponatraemia.",
                        "Assess volume status and drugs (thiazides, SSRIs); osmolality and urine sodium.",
                        source: "labs")
            }
        }

        let glucose = b.lab(["glucose"])
        let ketones = b.lab(["ketone", "ketones", "beta-hydroxybutyrate"])
        let ph = b.lab(["ph"])
        let bicarbonate = b.lab(["bicarbonate", "hco3"])
        let diabetic = b.pmh.contains("diabet") || b.all.contains("diabet")
            || ["insulin", "metformin", "gliflozin", "gliclazide", "glipizide", "sitagliptin"].contains { b.medsLower.contains($0) }
        let onSGLT2 = b.medsLower.contains("gliflozin")

        if let g = glucose, g < 3.0 {
            b.alert(.emergency, .medical, "Hypoglycaemia — glucose \(fmt(g)) mmol/L",
                    "Glucose <3.0 mmol/L (JBDS 2023).",
                    "If able to swallow: \(b.dose("15–20 g quick-acting carbohydrate")); if not: IV glucose \(b.dose("(150–200 mL of 10%)")) or IM glucagon; recheck in 10–15 minutes (JBDS 2023).",
                    redirect: redirect, source: "labs")
        } else if let g = glucose, g < 4.0 {
            b.alert(.urgent, .medical, "Hypoglycaemia — glucose \(fmt(g)) mmol/L",
                    "Glucose <4.0 mmol/L (JBDS 2023).",
                    "Treat with \(b.dose("15–20 g quick-acting carbohydrate")) and recheck in 15 minutes.", source: "labs")
        }

        // JBDS 2023 DKA: ketonaemia ≥3.0 mmol/L (or ketonuria ≥2+), glucose >11 or known diabetes,
        // bicarbonate <15 and/or venous pH <7.3. Euglycaemic DKA (SGLT2 inhibitors) needs no high glucose.
        let acidosis = (ph.map { $0 < 7.3 } ?? false) || (bicarbonate.map { $0 < 15 } ?? false)
        let dka = (ketones.map { $0 >= 3.0 } ?? false)
            || (acidosis && (ketones.map { $0 >= 1.5 } ?? false))
            || (acidosis && ketones == nil && diabetic && (glucose.map { $0 > 11 } ?? false))
            || b.all.containsAny(["ketoacidosis", "euglycaemic dka", "euglycemic dka"])
        if dka {
            let ketoneText = ketones.map { " — ketones \(fmt($0)) mmol/L" } ?? ""
            b.alert(.emergency, .medical, "Diabetic ketoacidosis (DKA)\(ketoneText)",
                    "Ketoacidosis\(onSGLT2 ? " on an SGLT2 inhibitor (euglycaemic DKA possible — glucose may be normal)" : "") (JBDS 2023).",
                    b.inputs.isChild
                        ? "Paediatric DKA (BSPED guideline): fluids and insulin by weight — calculate per BNFc/BSPED; do not manage in the clinic."
                        : "IV 0.9% sodium chloride; fixed-rate IV insulin 0.1 units/kg/h; potassium replacement guided by level; hourly ketones and glucose (JBDS 2023)\(onSGLT2 ? "; stop the SGLT2 inhibitor" : "").",
                    redirect: redirect, source: "labs")
        } else if let k = ketones, k >= 1.5 {
            b.alert(.urgent, .medical, "Ketonaemia — ketones \(fmt(k)) mmol/L",
                    "Ketones 1.5–2.9 mmol/L: at risk of DKA (JBDS 2023).",
                    "Venous gas (pH, bicarbonate); repeat ketones in 1–2 h\(onSGLT2 ? "; stop the SGLT2 inhibitor" : "").",
                    source: "labs")
        }
        if let g = glucose, g >= 30, !dka {
            let osm = b.lab(["osmolality"])
            b.alert(.emergency, .medical, "Hyperglycaemia — possible hyperosmolar hyperglycaemic state (HHS), glucose \(fmt(g)) mmol/L",
                    "Glucose ≥30 mmol/L\(osm.map { ", osmolality \(fmt($0)) mOsm/kg" } ?? "") (JBDS 2022 HHS).",
                    b.inputs.isChild
                        ? "Paediatric hyperglycaemic emergency — calculate fluids and insulin per BNFc/BSPED; do not manage in the clinic."
                        : "Measure osmolality; IV 0.9% sodium chloride first; insulin only at a low fixed rate (0.05 units/kg/h) when glucose stops falling with fluids (JBDS 2022).",
                    redirect: redirect, source: "labs")
        }

        if let ca = b.lab(["calcium"], excludingNamesContaining: ["ionised", "urine"]) {
            if ca >= 3.5 {
                b.alert(.emergency, .medical, "Severe hypercalcaemia — adjusted calcium \(fmt(ca)) mmol/L",
                        "Calcium ≥3.5 mmol/L (Society for Endocrinology 2016).",
                        "IV 0.9% sodium chloride rehydration; ECG; bisphosphonate after rehydration; find the cause (malignancy, hyperparathyroidism).",
                        redirect: redirect, source: "labs")
            } else if ca >= 3.0 {
                b.alert(.urgent, .medical, "Hypercalcaemia — adjusted calcium \(fmt(ca)) mmol/L",
                        "Calcium 3.0–3.4 mmol/L (Society for Endocrinology 2016).",
                        "IV rehydration if symptomatic; ECG; PTH, find the cause.", source: "labs")
            } else if ca < 1.9 {
                b.alert(.emergency, .medical, "Severe hypocalcaemia — adjusted calcium \(fmt(ca)) mmol/L",
                        "Calcium <1.9 mmol/L (Society for Endocrinology 2016).",
                        "ECG; IV calcium gluconate 10% \(b.dose("10–20 mL in 50–100 mL 5% glucose over 10 minutes")) (SfE 2016); check magnesium.",
                        redirect: redirect, source: "labs")
            }
        }

        if let lactate = b.lab(["lactate"]) {
            if lactate >= 4 {
                b.raise(.emergency, "labs", "Lactate \(fmt(lactate)) mmol/L (≥4)")
            } else if lactate >= 2 {
                b.raise(.urgent, "labs", "Lactate \(fmt(lactate)) mmol/L (≥2)")
            }
        }

        if let tropRaw = b.lab(["troponin"]) {
            let text = b.reportText(["troponin"]).lowercased()
            let ngL = (text.contains("µg/l") || text.contains("ug/l") || text.contains("ng/ml")) ? tropRaw * 1000 : tropRaw
            if ngL >= 52 {
                b.alert(.emergency, .medical, "Raised troponin — \(fmt(ngL)) ng/L",
                        "Acute myocardial infarction / acute coronary syndrome until proven otherwise (ESC 2020 rule-in).",
                        "12-lead ECG now; aspirin \(b.dose("300 mg")) unless contraindicated (NICE NG185); cardiology.",
                        redirect: redirect, source: "labs")
            } else if ngL > 14 {
                b.alert(.urgent, .medical, "Troponin above the 99th centile — \(fmt(ngL)) ng/L",
                        "Myocardial injury possible.", "Repeat troponin and 12-lead ECG (ESC 2020 0 h/1 h pathway).",
                        source: "labs")
            }
        }

        if let hb = b.lab(["haemoglobin", "hemoglobin", "hb"]) {
            let gL = hb < 25 ? hb * 10 : hb
            if gL < 70 {
                b.alert(.urgent, .medical, "Severe anaemia — haemoglobin \(fmt(gL)) g/L",
                        "Below the restrictive transfusion threshold of 70 g/L (NICE NG24).",
                        "Find the source (bleeding?); group and save; transfusion decision by the clinician.", source: "labs")
            }
        }

        if let n = b.lab(["neutrophils", "neutrophil"], excludingNamesContaining: ["%", "percent", "ratio"]), n < 0.5,
           b.hasFever || b.infectionContext {
            b.alert(.emergency, .medical, "Neutropenic sepsis suspected — neutrophils \(fmt(n)) × 10⁹/L",
                    "Neutrophils <0.5 × 10⁹/L with fever or infection (NICE CG151).",
                    "IV piperacillin–tazobactam within 1 hour of presentation (NICE CG151); blood cultures; Sepsis Six.",
                    redirect: redirect, source: "labs")
        }

        if let cRaw = b.lab(["creatinine"]) {
            let umol = cRaw < 20 ? cRaw * 88.4 : cRaw
            if umol >= 354 {
                b.alert(.urgent, .medical, "Acute kidney injury? Creatinine \(fmt(umol)) µmol/L",
                        "Creatinine ≥354 µmol/L (KDIGO 2012 stage 3 criterion) — compare with baseline.",
                        "Urine output; renal and bladder ultrasound for obstruction; stop nephrotoxic drugs (NSAIDs, ACE inhibitors, metformin); potassium.",
                        source: "labs")
            } else if umol > 150 {
                b.alert(nil, .medical, "Raised creatinine — \(fmt(umol)) µmol/L",
                        "Check against the baseline for acute kidney injury (AKI, KDIGO 2012).",
                        "Compare with previous results; review nephrotoxic drugs and contrast.", source: "labs")
            }
        }
    }

    // MARK: ECG

    static func ecg(_ b: AcuityBuilder) {
        let report = b.reportText(["ecg", "electrocardiogram", "ekg"])
        let clinical = b.all
        guard !report.isEmpty || clinical.containsAny(["atrial fibrillation", "fast af", "irregularly irregular"]) else { return }
        let r = NegationMatcher.Source(report)
        if r.containsAny(["st elevation", "st-elevation", "st segment elevation", "stemi"]) {
            b.alert(.emergency, .medical, "STEMI — ST elevation on the ECG",
                    "Acute ST-elevation myocardial infarction until proven otherwise.",
                    "Aspirin \(b.dose("300 mg")) unless contraindicated (NICE NG185); primary PCI pathway — do not delay transfer.",
                    redirect: true, source: "ECG")
        }
        if r.containsAny(["complete heart block", "third-degree", "third degree", "3rd degree"]) {
            b.alert(.emergency, .medical, "Complete heart block on the ECG",
                    "Risk of asystole.",
                    "Continuous monitoring; atropine / external pacing per Resus Council UK 2021 bradycardia algorithm.",
                    redirect: true, source: "ECG")
        }
        if r.containsAny(["ventricular tachycardia", "ventricular fibrillation", "polymorphic vt", "torsades"])
            || r.contains("vt", wholeWord: true) {
            b.alert(.emergency, .medical, "Ventricular arrhythmia on the ECG",
                    "Life-threatening arrhythmia.",
                    "Resus Council UK 2021 tachycardia / ALS algorithm; defibrillator available.",
                    redirect: true, source: "ECG")
        }
        if r.containsAny(["st depression", "t wave inversion", "t-wave inversion", "new lbbb", "new left bundle",
                          "peaked t", "tall tented t"]) {
            b.alert(.urgent, .medical, "Ischaemic or electrolyte ECG changes",
                    "Possible acute coronary syndrome or hyperkalaemia.",
                    "Serial troponin; potassium; repeat ECG; cardiology advice.", source: "ECG")
        }

        // AF: fast ventricular rate, and unstable AF (Resus Council UK 2021 tachycardia algorithm).
        let af = r.containsAny(["atrial fibrillation", "fast af", "af with"]) || r.contains("af", wholeWord: true)
            || clinical.containsAny(["atrial fibrillation", "fast af", "irregularly irregular"])
        guard af, let hr = b.inputs.vitals?.heartRate, hr > 110 else { return }
        let sbp = b.inputs.vitals?.systolic ?? 120
        let adverse = sbp < 90 || clinical.containsAny(["syncope", "collapse", "chest pain", "pulmonary oedema",
                                                         "heart failure", "reduced consciousness"])
        if adverse {
            b.alert(.emergency, .medical, "Unstable atrial fibrillation — heart rate \(hr)/min",
                    "AF with adverse features (shock, syncope, ischaemia or heart failure).",
                    "Synchronised DC cardioversion per Resus Council UK 2021 tachycardia algorithm; anticoagulation decision.",
                    redirect: true, source: "ECG")
        } else {
            b.alert(.urgent, .medical, "Atrial fibrillation with fast ventricular rate — \(hr)/min",
                    "New or uncontrolled AF.",
                    "12-lead ECG; rate control, look for a cause (sepsis, bleeding, thyrotoxicosis); CHA₂DS₂-VASc / anticoagulation decision.",
                    source: "ECG")
        }
    }

    // MARK: Sepsis (with or without fever)

    static func sepsis(_ b: AcuityBuilder) {
        let wbc = b.lab(["wbc", "white cell count", "white blood cell", "leucocyte", "leukocyte"])
        let wbcAbnormal = wbc.map { $0 > 12 || $0 < 4 } ?? false
        guard b.hasFever || b.infectionContext || (wbcAbnormal && b.hasInflammatoryStory) else { return }
        let lactate = b.lab(["lactate"])

        if b.inputs.isChild {
            // Children: the paediatric vital-sign rules above set the level; name sepsis when an
            // infection meets an emergency sign (NICE NG51 paediatric high-risk criteria).
            if b.level == .emergency, b.reasons.contains(where: { $0.source == "vitals" && $0.level == .emergency }) {
                b.alert(.emergency, .paediatric, "Possible sepsis (child)",
                        "Infection with a high-risk sign (NICE NG51).",
                        "Paediatric sepsis bundle; IV antibiotics within 1 hour (weight-based dosing — calculate per BNFc).", redirect: true, source: "sepsis")
            }
            return
        }
        guard let v = b.inputs.vitals else {
            if let l = lactate, l >= 2 {
                b.alert(l >= 4 ? Acuity.emergency : Acuity.urgent, .medical, "Possible sepsis — lactate \(fmt(l)) mmol/L",
                        "Infection with raised lactate.", sepsisAction, source: "sepsis")
            }
            return
        }
        // Sepsis-3 qSOFA (RR ≥22, SBP ≤100, altered mentation) — no fever needed.
        let qsofa = [(v.respiratoryRate ?? 0) >= 22, (v.systolic ?? 999) <= 100, v.avpu != .alert].filter { $0 }.count
        let news = v.news2.total
        let lactateText = lactate.map { ", lactate \(fmt($0)) mmol/L" } ?? ""
        let feverText = b.hasFever ? "" : " (no fever — afebrile sepsis is common in the elderly and on steroids)"
        if (v.systolic ?? 999) <= 90 || (lactate ?? 0) >= 4 || news >= 7 || qsofa >= 2 || ((lactate ?? 0) >= 2 && qsofa >= 1) {
            b.alert(.emergency, .medical, "Possible sepsis — qSOFA \(qsofa), NEWS2 \(news)\(lactateText)",
                    "Infection with high-risk features (Sepsis-3; NICE NG51)\(feverText).", sepsisAction, source: "sepsis")
        } else if news >= 5 || (lactate ?? 0) >= 2 {
            b.alert(.urgent, .medical, "Possible sepsis — NEWS2 \(news)\(lactateText)",
                    "Infection with moderate-risk features (NICE NG51)\(feverText).", sepsisAction, source: "sepsis")
        }
    }

    static let sepsisAction = "Sepsis Six within 1 hour: oxygen, blood cultures, IV antibiotics, IV fluids, lactate, urine output (Surviving Sepsis Campaign 2021; NICE NG51); find and control the source."

    static func fmt(_ v: Double) -> String {
        v.rounded() == v ? String(Int(v)) : String(format: "%.1f", v)
    }
}

// MARK: - Shared infection context

extension AcuityBuilder {
    /// Words that place an infection in the current story or examination (negation-aware).
    var infectionContext: Bool {
        all.containsAny(["sepsis", "septic", "infection", "infected", "pneumonia", "cellulitis", "abscess", "purulent",
                         "pus ", "cholangitis", "peritonitis", "pyelonephritis", "urinary tract infection", "urosepsis",
                         "gangrene", "necrotising", "productive cough", "consolidation", "collection", "empyema",
                         "meningitis", "nitrite positive", "cloudy urine", "foul-smelling", "rigors", "splenectomy",
                         "asplenia", "neutropeni", "perforat", "pneumoperitoneum", "free gas", "free air", "anastomotic leak"])
            || all.contains("uti", wholeWord: true)
    }

    /// A current illness story (so an isolated abnormal white count in a well patient is not sepsis).
    var hasInflammatoryStory: Bool {
        all.containsAny(["pain", "unwell", "vomit", "confus", "drowsy", "breathless", "cough"])
    }
}
