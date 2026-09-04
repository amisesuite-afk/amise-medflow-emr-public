import Foundation

// MARK: - Patient State Vector
// Unified, normalized snapshot of all patient data assembled from every input
// modality. This is the single structure consumed by every downstream engine
// (BayesianFeatureNetwork, SequentialDiagnosisEngine, DynamicBayesianNetwork,
// ValueOfInformationEngine, AutoFunctionEngine).
//
// All fields are Optional — missing data is explicit, not zero-filled,
// so downstream engines can compute Value of Information on what's missing.

// MARK: - Input source tag

enum DataSource: String, Codable {
    case typed      = "Typed"
    case voice      = "Voice"
    case camera     = "Camera"
    case pdf        = "PDF"
    case lab        = "Lab"
    case imaging    = "Imaging"
    case device     = "Device"    // wearable, monitor, glucometer
    case derived    = "Derived"   // computed from other fields
}

// MARK: - Fused measurement: a value with provenance and confidence

struct FusedValue<T> {
    let value: T
    let confidence: Double      // [0,1] posterior reliability after sensor fusion
    let source: DataSource
    let timestamp: Date
}

// MARK: - Symptom cluster (SOCRATES-keyed)

struct NormalisedSymptom {
    var site: String?
    var onset: String?
    var character: String?
    var radiation: String?
    var associations: Set<String>
    var timing: String?
    var exacerbating: Set<String>
    var relieving: Set<String>
    var severity: Int?           // 0–10 NRS
    var source: DataSource
}

// MARK: - Lab panel

struct LabPanel {
    var wbc: FusedValue<Double>?         // ×10⁹/L
    var haemoglobin: FusedValue<Double>? // g/dL
    var platelets: FusedValue<Double>?   // ×10⁹/L
    var crp: FusedValue<Double>?         // mg/L
    var esr: FusedValue<Double>?         // mm/h
    var sodium: FusedValue<Double>?      // mmol/L
    var potassium: FusedValue<Double>?   // mmol/L
    var creatinine: FusedValue<Double>?  // µmol/L
    var urea: FusedValue<Double>?        // mmol/L
    var bilirubin: FusedValue<Double>?   // µmol/L
    var alt: FusedValue<Double>?         // U/L
    var alp: FusedValue<Double>?         // U/L
    var albumin: FusedValue<Double>?     // g/dL
    var amylase: FusedValue<Double>?     // U/L
    var lipase: FusedValue<Double>?      // U/L
    var lactate: FusedValue<Double>?     // mmol/L
    var dDimer: FusedValue<Double>?      // µg/L FEU
    var troponin: FusedValue<Double>?    // ng/L
    var inr: FusedValue<Double>?
    var glucose: FusedValue<Double>?     // mmol/L
    var hba1c: FusedValue<Double>?       // %

    // Derived flags (populated by BayesianSensorFusion)
    var wbcElevated: Bool { (wbc?.value ?? 0) > 11 }
    var wbcLow: Bool      { (wbc?.value ?? 99) < 4  }
    var crpElevated: Bool { (crp?.value ?? 0) > 10  }
    var crpHigh: Bool     { (crp?.value ?? 0) > 100 }
    var lactateElevated: Bool { (lactate?.value ?? 0) >= 2.0 }
    var amylaseElevated: Bool { (amylase?.value ?? 0) > 100 }
    var bilirubinElevated: Bool { (bilirubin?.value ?? 0) > 20 }
    var dDimerElevated: Bool  { (dDimer?.value ?? 0) > 500 }
}

// MARK: - Vitals snapshot (most recent)

struct VitalsSnapshot {
    var heartRate: FusedValue<Int>?
    var systolicBP: FusedValue<Int>?
    var diastolicBP: FusedValue<Int>?
    var respiratoryRate: FusedValue<Int>?
    var temperatureCelsius: FusedValue<Double>?
    var spo2: FusedValue<Int>?
    var gcs: FusedValue<Int>?
    var news2: FusedValue<Int>?

    var hasFever: Bool      { (temperatureCelsius?.value ?? 37.0) >= 38.0 }
    var hasHypotension: Bool{ (systolicBP?.value ?? 120) < 100 }
    var hasTachycardia: Bool{ (heartRate?.value ?? 75) > 100 }
    var hasTachypnoea: Bool { (respiratoryRate?.value ?? 15) > 20 }
    var hasHypoxia: Bool    { (spo2?.value ?? 98) < 94 }
    var news2Score: Int     { news2?.value ?? 0 }
}

// MARK: - Exam findings (structured flags from free text)

struct ExamFindings {
    // Abdomen
    var abdominalTenderness: Bool = false
    var rigidity: Bool            = false
    var guarding: Bool            = false
    var reboundTenderness: Bool   = false
    var murphysSign: Bool         = false
    var rovsingsSign: Bool        = false
    var distension: Bool          = false
    var palpableMass: Bool        = false
    var bowelSoundsAbsent: Bool   = false
    var bowelSoundsIncreased: Bool = false
    var herniaPresent: Bool       = false
    var herniaTender: Bool        = false
    var herniaIrreducible: Bool   = false

    // General / systemic
    var jaundice: Bool            = false
    var pallor: Bool              = false
    var cyanosis: Bool            = false
    var oedema: Bool              = false
    var lymphadenopathy: Bool     = false

    // Vascular / limb
    var limbPulsesAbsent: Bool    = false
    var limbCold: Bool            = false
    var limbPallor: Bool          = false
    var limbMottled: Bool         = false
    var crepitus: Bool            = false   // subcutaneous gas (NF)
    var skinBullae: Bool          = false
    var skinNecrosis: Bool        = false

    // Chest / respiratory
    var reducedAirEntry: Bool     = false
    var pleuralRub: Bool          = false
    var wheeze: Bool              = false
}

// MARK: - PMH flags (structured from pmhNotes text)

struct PMHFlags {
    var previousAbdominalSurgery: Bool = false
    var heartDisease: Bool             = false
    var atrialFibrillation: Bool       = false
    var diabetes: Bool                 = false
    var hypertension: Bool             = false
    var chronicKidneyDisease: Bool     = false
    var pepticUlcer: Bool              = false
    var ibd: Bool                      = false
    var malignancy: Bool               = false
    var dvtOrPE: Bool                  = false
    var thrombophilia: Bool            = false
    var immunocompromised: Bool        = false
    var chronicLiverDisease: Bool      = false
    var copd: Bool                     = false
    var anticoagulant: Bool            = false   // on warfarin, DOAC, or heparin
}

// MARK: - The state vector

struct PatientStateVector {
    // Identity
    var patientID: UUID?
    var ageYears: Int
    var sex: Sex
    var bmi: Double?
    var asaClass: Int?

    // Chief complaint and SOCRATES
    var chiefComplaint: String?
    var symptoms: [NormalisedSymptom] = []

    // Clinical findings
    var vitals: VitalsSnapshot = VitalsSnapshot()
    var vitalsTrend: [VitalsEntry] = []     // full time-series for DBN/CUSUM
    var exam: ExamFindings = ExamFindings()

    // History
    var pmh: PMHFlags = PMHFlags()
    var pmhRaw: String?
    var medicationsRaw: String?
    var allergiesRaw: String?

    // Investigations
    var labs: LabPanel = LabPanel()
    var imagingFindings: [String] = []           // normalised strings from reports
    var investigationEntries: [InvestigationEntry] = []

    // SOCRATES feature dictionary (canonical keys for BayesianDiagnosisEngine)
    var socratesSelections: [String: Set<String>] = [:]

    // Raw text fields (for exam narrative, HPI)
    var hpiText: String?
    var examAbdoText: String?
    var examGeneralText: String?

    // Output from prior engine runs (cached for AUTOFUNCTION)
    var hypotheses: [DiagnosisHypothesis] = []
    var clinicalScores: [ClinicalScore] = []
    var decisions: [ClinicalDecision] = []
    var trajectories: [DiseaseTrajectory] = []
    var changePointAlerts: [ChangePointAlert] = []

    // Metadata
    var assembledAt: Date = .now
    var inputSources: Set<DataSource> = []
}

// MARK: - Builder

extension PatientStateVector {

    // Convenience: assemble directly from a Patient SwiftData model
    static func from(patient: Patient) -> PatientStateVector {
        var psv = PatientStateVector(ageYears: patient.ageYears, sex: patient.sex)
        psv.patientID   = patient.id
        psv.bmi         = patient.latestBMI()
        psv.asaClass    = patient.asaClass
        psv.chiefComplaint = patient.chiefComplaint
        psv.hpiText     = patient.hpi
        psv.examAbdoText = patient.examAbdo
        psv.examGeneralText = patient.examGeneral
        psv.pmhRaw      = patient.pmhNotes
        psv.medicationsRaw = patient.managementPlan
        psv.allergiesRaw = patient.allergiesJson

        // PMH flags from raw text
        psv.pmh = PMHFlags.parse(from: patient.pmhNotes ?? "")

        // Latest vitals snapshot
        if let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first {
            psv.vitals = VitalsSnapshot.from(entry: v)
        }
        psv.vitalsTrend = patient.vitalsEntries

        // Investigations
        psv.investigationEntries = patient.investigations

        // P7: Parse resulted investigation values into LabPanel numeric fields.
        // Matches by test name keyword; takes the most recent resulted entry per field.
        psv.labs = LabPanel.parse(from: patient.investigations)

        // Exam flags from free text
        psv.exam = ExamFindings.parse(from: [patient.examAbdo, patient.examGeneral].compactMap { $0 }.joined(separator: " "))

        psv.inputSources = [.typed]
        psv.assembledAt = .now
        return psv
    }
}

// MARK: - Parsers (deterministic NLP over clinical free text)

extension PMHFlags {
    static func parse(from text: String) -> PMHFlags {
        let t = text.lowercased()
        return PMHFlags(
            previousAbdominalSurgery: t.contains("laparotomy") || t.contains("appendicect") || t.contains("cholecystect") || t.contains("abdominal surgery"),
            heartDisease:    t.contains("ihd") || t.contains("ischaemic heart") || t.contains("mi ") || t.contains("heart failure") || t.contains("cad") || t.contains("coronary"),
            atrialFibrillation: t.contains("atrial fibrillation") || t.contains(" af ") || t.contains("af,"),
            diabetes:        t.contains("diabetes") || t.contains("diabetic") || t.contains("dm type") || t.contains("t2dm") || t.contains("t1dm"),
            hypertension:    t.contains("hypertension") || t.contains("htn") || t.contains("high blood pressure"),
            chronicKidneyDisease: t.contains("ckd") || t.contains("chronic kidney") || t.contains("renal failure") || t.contains("dialysis"),
            pepticUlcer:     t.contains("peptic ulcer") || t.contains("pud") || t.contains("gastric ulcer") || t.contains("duodenal ulcer"),
            ibd:             t.contains("crohn") || t.contains("ulcerative colitis") || t.contains("ibd") || t.contains("inflammatory bowel"),
            malignancy:      t.contains("cancer") || t.contains("carcinoma") || t.contains("lymphoma") || t.contains("malignancy") || t.contains("tumour"),
            dvtOrPE:         t.contains("dvt") || t.contains("deep vein") || t.contains("pulmonary embol") || t.contains("pe "),
            thrombophilia:   t.contains("thrombophilia") || t.contains("factor v leiden") || t.contains("antiphospholipid") || t.contains("protein c") || t.contains("protein s"),
            immunocompromised: t.contains("immunosupp") || t.contains("transplant") || t.contains("hiv") || t.contains("steroid") || t.contains("chemotherapy"),
            chronicLiverDisease: t.contains("cirrhosis") || t.contains("hepatitis") || t.contains("liver disease") || t.contains("child-pugh"),
            copd:            t.contains("copd") || t.contains("emphysema") || t.contains("chronic obstructive"),
            anticoagulant:   t.contains("warfarin") || t.contains("rivaroxaban") || t.contains("apixaban") || t.contains("dabigatran") || t.contains("doac") || t.contains("heparin") || t.contains("anticoagul")
        )
    }
}

extension VitalsSnapshot {
    static func from(entry: VitalsEntry) -> VitalsSnapshot {
        var s = VitalsSnapshot()
        s.heartRate = entry.heartRate.map { FusedValue(value: $0, confidence: 0.98, source: .device, timestamp: entry.recordedAt) }
        s.systolicBP = entry.bpSystolic.map { FusedValue(value: $0, confidence: 0.97, source: .device, timestamp: entry.recordedAt) }
        s.respiratoryRate = entry.respiratoryRate.map { FusedValue(value: $0, confidence: 0.90, source: .device, timestamp: entry.recordedAt) }
        s.temperatureCelsius = entry.temperatureCelsius.map { FusedValue(value: $0, confidence: 0.97, source: .device, timestamp: entry.recordedAt) }
        s.spo2 = entry.spo2.map { FusedValue(value: $0, confidence: 0.95, source: .device, timestamp: entry.recordedAt) }
        s.news2 = FusedValue(value: entry.news2Score, confidence: 0.99, source: .derived, timestamp: entry.recordedAt)
        return s
    }
}

// MARK: - P7: LabPanel population from InvestigationEntry results
// Matches resulted investigations by test-name keyword and parses the numeric
// result string. Uses the most recent resulted entry per field.
// Confidence 0.85 reflects that the value is manually typed, not device-fed.

extension LabPanel {
    static func parse(from entries: [InvestigationEntry]) -> LabPanel {
        var lab = LabPanel()
        let resulted = entries
            .filter { $0.status == .resulted && !$0.result.isEmpty }
            .sorted { ($0.resultedAt ?? $0.orderedAt) > ($1.resultedAt ?? $1.orderedAt) }

        func fv(_ raw: String, at date: Date) -> FusedValue<Double>? {
            // Extract first numeric token (handles "12.3 ×10⁹/L", ">500", "< 3" etc.)
            let digits = raw.components(separatedBy: .whitespaces).first {
                $0.replacingOccurrences(of: ".", with: "")
                  .replacingOccurrences(of: "<", with: "")
                  .replacingOccurrences(of: ">", with: "")
                  .replacingOccurrences(of: ",", with: ".")
                  .allSatisfy { $0.isNumber || $0 == "." }
            }
            guard let s = digits, let v = Double(s
                .replacingOccurrences(of: "<", with: "")
                .replacingOccurrences(of: ">", with: "")
                .replacingOccurrences(of: ",", with: "."))
            else { return nil }
            return FusedValue(value: v, confidence: 0.85, source: .lab, timestamp: date)
        }

        for entry in resulted {
            let n = entry.name.lowercased()
            let date = entry.resultedAt ?? entry.orderedAt
            guard let val = fv(entry.result, at: date) else { continue }

            if n.contains("wbc") || n.contains("white cell") || n.contains("white blood")                     { if lab.wbc == nil { lab.wbc = val } }
            else if n.contains("haemoglobin") || n.contains("hemoglobin") || n == "hb"                        { if lab.haemoglobin == nil { lab.haemoglobin = val } }
            else if n.contains("platelet")                                                                     { if lab.platelets == nil { lab.platelets = val } }
            else if n.contains("crp") || n.contains("c-reactive")                                             { if lab.crp == nil { lab.crp = val } }
            else if n.contains("esr")                                                                          { if lab.esr == nil { lab.esr = val } }
            else if n.contains("sodium") || n == "na"                                                          { if lab.sodium == nil { lab.sodium = val } }
            else if n.contains("potassium") || n == "k"                                                        { if lab.potassium == nil { lab.potassium = val } }
            else if n.contains("creatinine") && !n.contains("egfr")                                           { if lab.creatinine == nil { lab.creatinine = val } }
            else if n.contains("urea") || n.contains("bun")                                                   { if lab.urea == nil { lab.urea = val } }
            else if n.contains("bilirubin")                                                                    { if lab.bilirubin == nil { lab.bilirubin = val } }
            else if n.contains("alt") || n.contains("alanine")                                                 { if lab.alt == nil { lab.alt = val } }
            else if n.contains("alp") || n.contains("alkaline phosphatase")                                    { if lab.alp == nil { lab.alp = val } }
            else if n.contains("albumin")                                                                      { if lab.albumin == nil { lab.albumin = val } }
            else if n.contains("amylase") && !n.contains("lipase")                                             { if lab.amylase == nil { lab.amylase = val } }
            else if n.contains("lipase")                                                                       { if lab.lipase == nil { lab.lipase = val } }
            else if n.contains("lactate")                                                                      { if lab.lactate == nil { lab.lactate = val } }
            else if n.contains("d-dimer") || n.contains("ddimer") || n.contains("d dimer")                    { if lab.dDimer == nil { lab.dDimer = val } }
            else if n.contains("troponin")                                                                     { if lab.troponin == nil { lab.troponin = val } }
            else if n.contains("inr")                                                                          { if lab.inr == nil { lab.inr = val } }
            else if n.contains("glucose") && !n.contains("hba1c")                                             { if lab.glucose == nil { lab.glucose = val } }
            else if n.contains("hba1c") || n.contains("haemoglobin a1c")                                      { if lab.hba1c == nil { lab.hba1c = val } }
        }
        return lab
    }
}

extension ExamFindings {
    static func parse(from text: String) -> ExamFindings {
        let t = text.lowercased()
        return ExamFindings(
            abdominalTenderness: t.contains("tender"),
            rigidity:            t.contains("rigid") || t.contains("board"),
            guarding:            t.contains("guard"),
            reboundTenderness:   t.contains("rebound") || t.contains("blumberg"),
            murphysSign:         t.contains("murphy"),
            rovsingsSign:        t.contains("rovsing"),
            distension:          t.contains("disten"),
            palpableMass:        t.contains("mass") || t.contains("lump") || t.contains("palpable"),
            bowelSoundsAbsent:   t.contains("absent") && t.contains("bowel sound"),
            bowelSoundsIncreased: (t.contains("high-pitched") || t.contains("tinkling") || t.contains("hyperactive")) && t.contains("bowel"),
            herniaPresent:       t.contains("hernia"),
            herniaTender:        t.contains("hernia") && t.contains("tender"),
            herniaIrreducible:   t.contains("irreducible") || t.contains("incarcerat") || t.contains("strangulat"),
            jaundice:            t.contains("jaundice") || t.contains("icteric"),
            pallor:              t.contains("pallor") || t.contains("pale"),
            cyanosis:            t.contains("cyanosis") || t.contains("cyanotic"),
            oedema:              t.contains("oedema") || t.contains("edema") || t.contains("swelling"),
            lymphadenopathy:     t.contains("lymph") || t.contains("node"),
            limbPulsesAbsent:    t.contains("absent") && (t.contains("pulse") || t.contains("femoral") || t.contains("popliteal")),
            limbCold:            t.contains("cold") && t.contains("limb") || t.contains("cold leg") || t.contains("cold foot"),
            limbPallor:          t.contains("pale") && t.contains("limb") || t.contains("pale leg"),
            limbMottled:         t.contains("mottled") || t.contains("mottling"),
            crepitus:            t.contains("crepitus") || t.contains("crackling") || t.contains("surgical emphysema"),
            skinBullae:          t.contains("bullae") || t.contains("blister"),
            skinNecrosis:        t.contains("necrosis") || t.contains("necrotic") || t.contains("black") && t.contains("skin"),
            reducedAirEntry:     t.contains("reduced") && t.contains("air entry") || t.contains("dull") && t.contains("base"),
            pleuralRub:          t.contains("pleural rub") || t.contains("friction rub"),
            wheeze:              t.contains("wheeze") || t.contains("wheez")
        )
    }
}

