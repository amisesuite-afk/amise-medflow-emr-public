import SwiftUI
import SwiftData

// MARK: - Patient model

@Model
final class Patient {
    var id: UUID
    @Attribute(.unique) var remoteId: String?
    var syncCode: String = ""  // stable offline peer-sync ID, set in init()
    var fullName: String
    var dateOfBirth: Date?
    var sex: Sex
    var phone: String?
    var email: String?
    var address: String?
    var setting: ClinicalSetting
    var location: ClinicalLocation
    var acuity: Acuity
    var chiefComplaint: String?
    var associatedSymptoms: String?     // Comma-separated selected associated symptoms (CC tab)
    var referralSource: ReferralSource?
    var referringDoctor: String?
    var referringPractice: String?
    var appointmentType: String?
    var notes: String?
    var ward: String?
    var bedNumber: String?
    var admittedAt: Date?
    var expectedDischarge: Date?
    var operationDate: Date?
    var createdAt: Date
    var updatedAt: Date
    var syncedAt: Date?
    var pendingSync: Bool

    // MARK: - Relationships
    @Relationship(deleteRule: .cascade, inverse: \ClinicalNote.patient)
    var clinicalNotes: [ClinicalNote] = []

    @Relationship(deleteRule: .cascade, inverse: \VitalsEntry.patient)
    var vitalsEntries: [VitalsEntry] = []

    @Relationship(deleteRule: .cascade, inverse: \Prescription.patient)
    var prescriptions: [Prescription] = []

    @Relationship(deleteRule: .cascade, inverse: \PatientDocument.patient)
    var documents: [PatientDocument] = []

    @Relationship(deleteRule: .cascade, inverse: \OperativePlan.patient)
    var operativePlans: [OperativePlan] = []

    @Relationship(deleteRule: .cascade, inverse: \BillingLineItem.patient)
    var billingItems: [BillingLineItem] = []

    @Relationship(deleteRule: .cascade, inverse: \Encounter.patient)
    var encounters: [Encounter] = []

    @Relationship(deleteRule: .cascade, inverse: \ScoreHistoryEntry.patient)
    var scoreHistory: [ScoreHistoryEntry] = []

    // MARK: - Clinical intelligence fields
    var workingDiagnosis: String?
    var workingDiagnosisICD: String?
    // CC that was active when workingDiagnosis was last confirmed — used to detect staleness
    var workingDiagnosisCC: String?
    var assessmentText: String?
    // Most recently computed Alvarado score (0–10); nil if not yet scored
    var alvaradoScore: Int?
    // Glasgow Pancreatitis score (0–8); ≥3 = severe
    var glasgowPancreatitisScore: Int?
    // Ranson score (0–11); ≥3 = severe
    var ransonScore: Int?
    // Tokyo Grade for acute cholecystitis (1–3); nil if not scored
    var tokyoCholecystitisGrade: Int?
    // Tokyo Grade for acute cholangitis (1–3); nil if not scored
    var tokyoCholangitisGrade: Int?
    // Rockall score (0–11); ≥5 = high rebleed risk
    var rockallScore: Int?
    // Blatchford score (0–23); ≥6 = high-risk UGI bleed
    var blatchfordScore: Int?
    // Wells DVT score (continuous); ≤0 low, 1–2 moderate, ≥3 high
    var wellsDVTScore: Double?
    // Wells PE score (continuous); ≤4 low, 5–6 moderate, ≥7 high
    var wellsPEScore: Double?
    // ABCD² score (0–7); ≥4 = higher 2-day stroke risk after TIA
    var abcd2Score: Int?
    // LRINEC score (0–13); ≥6 = moderate risk necrotising fasciitis
    var lrinecScore: Int?
    // qSOFA score (0–3); ≥2 with suspected infection = sepsis
    var qsofaScore: Int?
    // PSI/PORT Class (1–5) for community-acquired pneumonia severity
    var psiScore: Int?
    // Caprini VTE Risk Score (0–n); ≥5 = very high risk
    var capriniScore: Int?
    // BISAP Score (0–5) for acute pancreatitis severity; ≥3 = severe
    var bisapScore: Int?
    // AIMS65 Score (0–5) for upper GI bleed in-hospital mortality
    var aims65Score: Int?
    // SOFA Score (0–24); ≥2 with suspected infection = sepsis (Sepsis-3)
    var sofaScore: Int?
    // FIB-4 Index (continuous); <1.30=low, 1.30-2.67=indeterminate, >2.67=high fibrosis risk
    var fib4Score: Double?
    // CURB-65 Score (0–5) for community-acquired pneumonia; ≥3 = hospital admission
    var curb65Score: Int?
    // Padua Prediction Score (0–20) for VTE risk in medical inpatients; ≥4 = high risk
    var paduaScore: Int?
    // APACHE II Score (0–71) for ICU/critical illness severity; ≥25 = predicted mortality >55%
    var apacheIIScore: Int?
    // P-POSSUM predicted mortality (× 10 for Int storage, e.g. 85 = 8.5%); Portsmouth surgical risk
    var ppossumMortPct10: Int?
    // Mannheim Peritonitis Index (0–47); ≥30 = predicted mortality >60%
    var mpiScore: Int?
    // CT Severity Index / Balthazar (0–10); ≥7 = severe pancreatitis
    var ctsiScore: Int?
    // NRS-2002 nutritional risk screen (0–7); ≥3 = at nutritional risk
    var nrs2002Score: Int?
    // Forrest Classification grade (1–6); 1=Ia spurting, 2=Ib oozing, 3=IIa visible vessel, 4=IIb clot, 5=IIc flat spot, 6=III clean
    var forrestGrade: Int?
    // HEART Score (0–10); ≤3=low MACE risk, 4–6=moderate, ≥7=high; chest pain triage
    var heartScore: Int?
    // Mallampati class (1–4) + additional predictors; stored as composite Int for display
    var mallampatiScore: Int?
    // Clinical Frailty Scale (1–9); ≥5=mild frailty increases perioperative risk
    var cfsScore: Int?
    // TIMI Risk Score for UA/NSTEMI (0–7); ≥3=intermediate, ≥5=high 14-day MACE risk
    var timiScore: Int?
    // Waterlow Pressure Ulcer Risk (0–64); 10–14=at risk, 15–19=high, ≥20=very high
    var waterlowScore: Int?
    // Surgical Apgar Score (0–10); ≤2=very high risk, 3–4=high, 5–6=moderate, 7–8=low, 9–10=very low
    var surgicalApgarScore: Int?
    // GRACE Score (0–372); <109=low in-hospital mortality, 109-140=moderate, >140=high
    var graceScore: Int?
    // DASI (0–58, rounded); <34=poor functional capacity (<4 METs), 34-46=moderate (4-6 METs), >46=good (>6 METs)
    var dasiScore: Int?
    // Barthel Index (0–100); 0-20=severe dependency, 21-60=moderate, 61-90=mild, 91-100=independent
    var barthelScore: Int?
    // EuroSCORE II predicted operative mortality (×10 as Int, e.g. 3.5% stored as 35)
    var euroScoreII: Int?
    // NIHSS (NIH Stroke Scale) total 0–42; 0=no deficit, 1-4=minor, 5-15=moderate, 16-20=moderate-severe, 21-42=severe
    var nihssScore: Int?
    // modified Rankin Scale 0–6; 0=no symptoms, 3=moderate disability, 5=severe dependency, 6=dead
    var mrsScore: Int?
    // MUST malnutrition risk 0–6; 0=low, 1=medium, ≥2=high
    var mustScore: Int?
    // Clavien-Dindo complication grade 0–7 (0=none, 1=I…7=V)
    var clavienDindoScore: Int?
    // Modified Aldrete PACU recovery score 0–10; ≥9 = fit for discharge
    var aldreteScore: Int?
    // 4T Score (HIT probability) 0–8; 0–3=low, 4–5=intermediate, 6–8=high
    var fourTScore: Int?
    // Oakland Score (lower GI bleed) 0–29; ≤8=safe discharge, ≥15=high risk
    var oaklandScore: Int?
    // King's College Criteria met (1) or not met (0) for acute liver failure transplant referral
    var kingsCriteriaScore: Int?
    // Child-Pugh score 5–15 (class A=5-6, B=7-9, C=10-15); surrogate for hepatic reserve
    var childPughScore: Int?
    // MELD score 6–40 (Model for End-stage Liver Disease); also encoded as MELD×10 for precision
    var meldScore: Int?
    // ASA Physical Status 1–5
    var asaScore: Int?
    // ECOG/WHO Performance Status 0–4
    var ecogScore: Int?
    // Revised Trauma Score 0–7.84 (stored ×100 as Int for precision, e.g. 784 = 7.84)
    var rtsScore: Int?
    // KDIGO AKI Stage 0–3
    var kdigoStage: Int?
    // Baux Score (age + TBSA [+ 17 if inhalation injury])
    var bauxScore: Int?
    // ISS — Injury Severity Score 0–75
    var issScore: Int?
    // NUTRIC Score 0–9 (without IL-6)
    var nutricScore: Int?
    // sPESI — Simplified Pulmonary Embolism Severity Index 0–6
    var spesiScore: Int?
    // DECAF Score 0–6 (COPD Exacerbation)
    var decafScore: Int?
    // Hinchey Grade 1–4 (Perforated Diverticulitis)
    var hincheyGrade: Int?
    // AIR Score 0–12 (Appendicitis Inflammatory Response)
    var airScore: Int?
    // PERC violations 0–8 (PE Rule-out Criteria); 0 = PERC met
    var percViolations: Int?
    // Shock Index × 100 (e.g., 90 = SI of 0.90)
    var shockIndex: Int?
    // Parkland total 24 h volume (mL); computed from weight × TBSA
    var parklandVolume: Int?
    // Paediatric Appendicitis Score 0–10
    var pasScore: Int?
    // Revised Geneva Score 0–22
    var revisedGenevaScore: Int?
    var cciScore: Int?            // Charlson Comorbidity Index (age-adjusted)
    var mfi5Score: Int?           // Modified Frailty Index-5 (0–5)
    var hapsScore: Int?           // Harmless Acute Pancreatitis Score (0–3)
    var glasgowImrieScore: Int?   // Glasgow-Imrie Pancreatitis Score (0–8)
    var albiScore: Double?        // ALBI Score (continuous; Grade 1 ≤-2.60, Grade 2 -2.60–-1.39, Grade 3 >-1.39)
    var auditCScore: Int?         // AUDIT-C Alcohol Screening (0–12)
    var phq9Score: Int?           // PHQ-9 Depression Score (0–27)
    var sapsIIScore: Int?         // SAPS II ICU Severity Score (0–163)
    var stoneScore: Int?          // STONE Score for nephrolithiasis (0–5)
    var losAngelesGrade: Int?     // LA Classification for GERD/oesophagitis (0–4; 0=none, 4=Grade D)
    var meld3Score: Double?       // MELD 3.0 liver severity score (continuous; ≥15 = transplant threshold)
    var bradenScore: Int?         // Braden Scale pressure injury risk (6–23; ≤18 = at risk)

    // MARK: - Visit type (structured)
    var visitType: VisitType?

    // MARK: - Consultation form fields
    var hpi: String?
    var surgicalHistory: String?
    var allergiesJson: String?      // JSON: [AllergyEntry]
    var examGeneral: String?
    var examCVS: String?
    var examResp: String?
    var examAbdo: String?
    var examNeuro: String?
    var examMSK: String?
    var examSkin: String?
    var examOther: String?
    var managementPlan: String?

    // MARK: - Extended demographics (synced to Supabase)
    var mrn: String?
    var nokName: String?
    var nokRelation: String?
    var nokPhone: String?
    var pmhNotes: String?
    var familyHistoryNotes: String?
    var socialHistory: String?
    var insuranceProvider: String?
    var policyNumber: String?
    var investigationsJson: String?  // JSON: [InvestigationEntry]
    var heightCm: Double?
    var aiClinicalReasoning: String?   // Persisted AI reasoning summary

    // MARK: - Procedure / specialty form data (JSON-encoded)
    var traumaDataJson: String?           // TraumaData
    var ogdDataJson: String?              // OGDData
    var colonoscopyDataJson: String?      // ColonoscopyData
    var surgeryDataJson: String?          // SurgeryNoteData
    var ercpDataJson: String?             // ERCPData
    var dischargeSummaryDataJson: String? // DischargeSummaryData
    var postOpReviewDataJson: String?     // PostOpReviewData
    var referralLetterDataJson: String?   // ReferralLetterData
    var consentFormDataJson: String?      // ConsentFormData
    var preOpChecklistDataJson: String?   // PreOpChecklistData
    var patientInstructionsDataJson: String? // PatientInstructionsData

    // MARK: - Encounter status (front desk → doctor handoff)
    var checkInTime: Date?
    var encounterStatus: EncounterStatus

    // MARK: - Perioperative checklist
    var asaClass: Int?                       // ASA physical status 1–5
    var consentSent: Bool = false            // Consent form given to patient
    var preOpInstructionsSent: Bool = false  // Pre-op instructions sent to patient

    // MARK: - Structured clinical history (JSON-encoded)
    var pmhEntriesJson: String?    // JSON: [PMHEntry]
    var pshxEntriesJson: String?   // JSON: [PSHxEntry]

    init(
        fullName: String,
        sex: Sex = .unspecified,
        setting: ClinicalSetting = .outpatient,
        location: ClinicalLocation = .rodney_bay,
        acuity: Acuity = .routine
    ) {
        self.id = UUID()
        self.syncCode = UUID().uuidString
        self.fullName = fullName
        self.sex = sex
        self.setting = setting
        self.location = location
        self.acuity = acuity
        self.encounterStatus = .notCheckedIn
        self.createdAt = .now
        self.updatedAt = .now
        self.pendingSync = true
        self.mrn = MRNGenerator.next()
    }

    // MARK: - Longitudinal context from closed encounters

    var longitudinalContext: BayesianDiagnosisEngine.LongitudinalContext {
        let closed = encounters.filter(\.isComplete).sorted { $0.encounterDate < $1.encounterDate }
        let confirmedDx = closed.compactMap(\.workingDiagnosis).filter { !$0.isEmpty }
        let allInvestigations = closed.flatMap { $0.decodedInvestigations }
        let pmhAccumulated = closed.compactMap(\.pmhNotes).joined(separator: " ")
        let pshxAccumulated = closed.compactMap(\.surgicalHistory).joined(separator: " ")

        let daysSinceLast: Int? = closed.last.flatMap {
            Calendar.current.dateComponents([.day], from: $0.encounterDate, to: .now).day
        }

        return BayesianDiagnosisEngine.LongitudinalContext(
            confirmedDiagnoses: confirmedDx,
            cumulativeInvestigations: allInvestigations,
            accumulatedPMH: pmhAccumulated,
            accumulatedPSHx: pshxAccumulated,
            encounterCount: closed.count,
            lastVisitType: closed.last?.visitType,
            daysSinceLastEncounter: daysSinceLast
        )
    }

    var initials: String {
        let parts = fullName.split(separator: " ")
        let letters = parts.prefix(2).compactMap { $0.first }
        return letters.isEmpty ? "?" : String(letters).uppercased()
    }

    var ageYears: Int {
        guard let dob = dateOfBirth else { return 0 }
        return Calendar.current.dateComponents([.year], from: dob, to: .now).year ?? 0
    }

    // nil when DOB is missing or implausible; use this in all UI labels
    var ageDisplay: String? {
        guard let dob = dateOfBirth else { return nil }
        let years = Calendar.current.dateComponents([.year], from: dob, to: .now).year ?? 0
        guard years >= 0, years < 150 else { return nil }
        return "\(years)y"
    }

    var postOpDays: Int? {
        guard let op = operationDate, op < .now else { return nil }
        return Calendar.current.dateComponents([.day], from: op, to: .now).day
    }

    func latestBMI() -> Double? {
        guard let h = heightCm, h > 0,
              let w = vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt })
                                   .first(where: { $0.weightKg != nil })?.weightKg
        else { return nil }
        let hm = h / 100.0
        return w / (hm * hm)
    }

    var bmiCategory: String? {
        guard let bmi = latestBMI() else { return nil }
        switch bmi {
        case ..<18.5: return "Underweight"
        case 18.5..<25: return "Normal"
        case 25..<30: return "Overweight"
        default: return "Obese"
        }
    }
}

// MARK: - Enums

enum Sex: String, Codable, CaseIterable {
    case male = "Male"
    case female = "Female"
    case unspecified = "Unspecified"

    // Supabase stores lowercase; "unspecified" is not in the CHECK constraint
    // so we map it to "unknown" (which IS allowed) and back.
    var supabaseValue: String {
        self == .unspecified ? "unknown" : rawValue.lowercased()
    }

    static func fromSupabase(_ value: String?) -> Sex {
        switch value?.lowercased() {
        case "male":             return .male
        case "female":           return .female
        case "unknown", "other": return .unspecified
        default:                 return .unspecified
        }
    }
}

enum ClinicalSetting: String, Codable, CaseIterable {
    case outpatient = "Outpatient"
    case inpatient  = "Inpatient"
    case theatre    = "Theatre"
    case endoscopy  = "Endoscopy"
    case emergency  = "Emergency"

    var icon: String {
        switch self {
        case .outpatient: return "person.crop.circle"
        case .inpatient:  return "bed.double"
        case .theatre:    return "scissors"
        case .endoscopy:  return "circle.dotted"
        case .emergency:  return "bolt.heart"
        }
    }

    var accentHex: String {
        switch self {
        case .outpatient: return "#0D9488"
        case .inpatient:  return "#2563EB"
        case .theatre:    return "#7C3AED"
        case .endoscopy:  return "#0891B2"
        case .emergency:  return "#DC2626"
        }
    }
}

enum ClinicalLocation: String, Codable, CaseIterable {
    case rodney_bay = "Rodney Bay"
    case tapion     = "Tapion"
    case okeu       = "OKEU"
    case victoria   = "Victoria"
    case other      = "Other"

    var shortName: String {
        switch self {
        case .rodney_bay: return "RB"
        case .tapion:     return "TAP"
        case .okeu:       return "OKEU"
        case .victoria:   return "VIC"
        case .other:      return "OTH"
        }
    }
}

enum Acuity: Int, Codable, CaseIterable, Comparable {
    case emergency = 0
    case urgent    = 1
    case priority  = 2
    case routine   = 3

    static func < (lhs: Acuity, rhs: Acuity) -> Bool { lhs.rawValue < rhs.rawValue }

    var label: String {
        switch self {
        case .emergency: return "Emergency"
        case .urgent:    return "Urgent"
        case .priority:  return "Priority"
        case .routine:   return "Routine"
        }
    }

    var color: String {
        switch self {
        case .emergency: return "#DC2626"
        case .urgent:    return "#F97316"
        case .priority:  return "#EAB308"
        case .routine:   return "#22C55E"
        }
    }
}

enum VisitType: String, Codable, CaseIterable {
    case newConsult    = "New Consult"
    case followUp      = "Follow-up"
    case postOp        = "Post-op Review"
    case dayOfSurgery  = "Day of Surgery"
    case ercp          = "ERCP"
    case ogd           = "OGD / Gastroscopy"
    case colonoscopy   = "Colonoscopy"
    case urgentReview  = "Urgent Review"
    case telephone     = "Telephone"
    case trauma        = "Trauma / Burns"
    case surgeryElective  = "Elective Surgery"
    case surgeryEmergency = "Emergency Surgery"

    var icon: String {
        switch self {
        case .newConsult:       return "person.fill.questionmark"
        case .followUp:         return "arrow.clockwise"
        case .postOp:           return "bandage"
        case .dayOfSurgery:     return "scissors"
        case .ercp:             return "circle.dotted"
        case .ogd:              return "circle.dotted"
        case .colonoscopy:      return "circle.dotted"
        case .urgentReview:     return "exclamationmark.circle"
        case .telephone:        return "phone"
        case .trauma:           return "cross.case.fill"
        case .surgeryElective:  return "scissors"
        case .surgeryEmergency: return "bolt.heart.fill"
        }
    }

    var shortLabel: String {
        switch self {
        case .newConsult:       return "1st Visit"
        case .followUp:         return "Follow-up"
        case .postOp:           return "Post-op"
        case .dayOfSurgery:     return "Day of Sx"
        case .ercp:             return "ERCP"
        case .ogd:              return "OGD"
        case .colonoscopy:      return "Scope"
        case .urgentReview:     return "Urgent"
        case .telephone:        return "Tel"
        case .trauma:           return "Trauma"
        case .surgeryElective:  return "Elective Sx"
        case .surgeryEmergency: return "Emerg Sx"
        }
    }

    var accentHex: String {
        switch self {
        case .newConsult:       return "#0D9488"
        case .followUp:         return "#2563EB"
        case .postOp:           return "#7C3AED"
        case .dayOfSurgery:     return "#7C3AED"
        case .ercp:             return "#0891B2"
        case .ogd:              return "#0891B2"
        case .colonoscopy:      return "#0891B2"
        case .urgentReview:     return "#F97316"
        case .telephone:        return "#6B7280"
        case .trauma:           return "#DC2626"
        case .surgeryElective:  return "#7C3AED"
        case .surgeryEmergency: return "#DC2626"
        }
    }
}

enum ReferralSource: String, Codable, CaseIterable {
    case selfReferral = "Self"
    case gp           = "GP"
    case specialist   = "Specialist"
    case emergency    = "Emergency"
    case other        = "Other"
}

enum EncounterStatus: String, Codable {
    case notCheckedIn = "not_checked_in"
    case waiting      = "waiting"
    case withDoctor   = "with_doctor"
    case complete     = "complete"

    var label: String {
        switch self {
        case .notCheckedIn: return "Not checked in"
        case .waiting:      return "Waiting"
        case .withDoctor:   return "With doctor"
        case .complete:     return "Complete"
        }
    }
}

// MARK: - Clinical handover summary

extension Patient {
    var handoverText: String {
        let today = Date.now.formatted(date: .abbreviated, time: .shortened)
        var lines: [String] = []

        lines.append("CLINICAL HANDOVER — \(today)")
        lines.append("Generated by Amise MedFlow EMR · Dr Dawit Daniel Kabiye MD DM")
        lines.append(String(repeating: "─", count: 48))
        lines.append("")

        // Patient identity
        var idLine = "\(fullName) · \(sex.rawValue) · \(ageYears > 0 ? "\(ageYears)y" : "age unknown")"
        if let m = mrn { idLine += " · MRN: \(m)" }
        lines.append(idLine)

        var locationLine = "\(setting.rawValue) — \(location.rawValue)"
        if let w = ward { locationLine += " · Ward: \(w)" }
        if let b = bedNumber { locationLine += " · Bed: \(b)" }
        lines.append(locationLine)
        lines.append("Acuity: \(acuity.label.uppercased())")
        lines.append("")

        // Diagnosis / complaint
        if let dx = workingDiagnosis {
            let icd = workingDiagnosisICD.map { " [\($0)]" } ?? ""
            lines.append("DIAGNOSIS: \(dx)\(icd)")
        }
        if let cc = chiefComplaint {
            lines.append("Chief complaint: \(cc)")
        }
        if let hpi = hpi, !hpi.isEmpty {
            lines.append("HPI: \(hpi.prefix(200))\(hpi.count > 200 ? "…" : "")")
        }
        lines.append("")

        // Anthropometrics
        if let h = heightCm {
            var anthropLine = String(format: "Height: %.0f cm", h)
            if let bmi = latestBMI(), let cat = bmiCategory {
                anthropLine += String(format: "  BMI: %.1f (%@)", bmi, cat)
            }
            lines.append(anthropLine)
        }

        // Vitals
        if let v = vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first, v.hasAnyValue {
            lines.append("LATEST VITALS (\(v.recordedAt.formatted(date: .omitted, time: .shortened)))")
            var vParts = ["NEWS2 \(v.news2Score) (\(v.news2Risk))"]
            if let bp = v.bpString { vParts.append("BP \(bp) mmHg") }
            if let hr = v.heartRate { vParts.append("HR \(hr) bpm") }
            if let rr = v.respiratoryRate { vParts.append("RR \(rr)/min") }
            if let temp = v.temperatureCelsius { vParts.append(String(format: "Temp %.1f°C", temp)) }
            if let spo = v.spo2 { vParts.append("SpO₂ \(spo)%") }
            lines.append(vParts.joined(separator: " · "))
            lines.append("")
        }

        // Allergies
        let allergyList = allergies
        if allergyList.isEmpty {
            lines.append("ALLERGIES: NKDA")
        } else {
            lines.append("ALLERGIES: " + allergyList.map { "\($0.name) (\($0.reaction), \($0.severity))" }.joined(separator: "; "))
        }

        // Medications
        if !prescriptions.isEmpty {
            lines.append("")
            lines.append("MEDICATIONS:")
            prescriptions.forEach { lines.append("  • \($0.displayLine)") }
        }

        // Investigations
        let pending = investigations.filter { $0.status == .ordered || $0.status == .pending }
        let resulted = investigations.filter { $0.status == .resulted }
        if !pending.isEmpty || !resulted.isEmpty {
            lines.append("")
            lines.append("INVESTIGATIONS:")
            pending.forEach { lines.append("  ⏳ \($0.name) (awaiting)") }
            resulted.forEach { lines.append("  ✓ \($0.name)\($0.result.isEmpty ? "" : ": \($0.result)")") }
        }

        // Management plan
        if let plan = managementPlan, !plan.isEmpty {
            lines.append("")
            lines.append("MANAGEMENT PLAN:")
            lines.append(plan)
        }

        // Admission dates
        if let admitted = admittedAt {
            lines.append("")
            lines.append("Admitted: \(admitted.formatted(date: .abbreviated, time: .omitted))")
            if let exp = expectedDischarge {
                lines.append("Expected discharge: \(exp.formatted(date: .abbreviated, time: .omitted))")
            }
        }

        lines.append("")
        lines.append(String(repeating: "─", count: 48))
        lines.append("This handover is a summary. Verify all details in the full record.")
        return lines.joined(separator: "\n")
    }
}
