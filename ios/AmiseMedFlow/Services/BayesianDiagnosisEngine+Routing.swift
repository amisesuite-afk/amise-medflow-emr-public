// BayesianDiagnosisEngine+Routing.swift
// Complaint text for pool routing, and the demographic applicability of a candidate.
//
// Routing (clinical validation 2026-09): the pool is chosen from the chief complaint only, and
// every keyword is matched through NegationMatcher at a word start, so "no vomiting" does not
// add the vomiting pool, "ear" does not match "heart" and "sti" does not match "investigation".
// Keywords keep their prefix meaning ("abdom" finds "abdominal", "appendic" finds
// "appendicitis").
//
// Applicability: DiagnosticDatabase.json candidates may carry
//   "applicability": { "sex": "female", "minAgeYears": 10, "maxAgeYears": 55, "pregnancy": "required" }
// and a candidate that does not apply to the patient is removed before scoring. An unknown age
// (ageYears 0: no date of birth) or an unspecified sex never removes anything.

import Foundation

extension BayesianDiagnosisEngine {

    /// Negation-aware, word-start keyword matching over routing text. `contains` and `==` keep
    /// the call shape of the plain-string checks the routing switch was written with.
    struct RouteText {
        let source: NegationMatcher.Source
        /// Lowercased, trimmed text (for whole-complaint equality such as `ccL == "pe"`).
        let trimmed: String

        init(_ text: String) {
            source = NegationMatcher.Source(text)
            trimmed = text.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        }

        /// True when `term` starts at a word boundary and is not negated.
        func contains(_ term: String) -> Bool {
            source.contains(term, wordStart: true)
        }

        var isEmpty: Bool { trimmed.isEmpty }

        /// Lowercased text.
        var text: String { source.lower }

        static func == (lhs: RouteText, rhs: String) -> Bool { lhs.trimmed == rhs }
    }

    // MARK: - Age-appropriate vital-sign limits

    /// Limits used to turn measured vital signs into the "tachycardia", "bradycardia",
    /// "tachypnoea" and "hypotension" evidence chips. Children use the upper / lower ends of the
    /// APLS 7th edition (ALSG 2023) normal ranges for their age band; from 16 the adult limits
    /// the engine always used (HR >100 or <50, RR >20, systolic <100). ageYears 0 (an infant, or
    /// no date of birth recorded) uses the infant band: an adult without a date of birth then
    /// gets fewer chips, never more.
    struct VitalLimits: Equatable {
        let maxHeartRate: Int
        let minHeartRate: Int
        let maxRespiratoryRate: Int
        let minSystolic: Int

        static func forAge(_ ageYears: Int) -> VitalLimits {
            switch ageYears {
            case ..<1:  return VitalLimits(maxHeartRate: 160, minHeartRate: 100, maxRespiratoryRate: 40, minSystolic: 70)
            case 1..<2: return VitalLimits(maxHeartRate: 150, minHeartRate: 90, maxRespiratoryRate: 35, minSystolic: 80)
            case 2..<5: return VitalLimits(maxHeartRate: 140, minHeartRate: 80, maxRespiratoryRate: 30, minSystolic: 80)
            case 5..<12: return VitalLimits(maxHeartRate: 120, minHeartRate: 70, maxRespiratoryRate: 25, minSystolic: 90)
            case 12..<16: return VitalLimits(maxHeartRate: 100, minHeartRate: 60, maxRespiratoryRate: 20, minSystolic: 90)
            default:    return VitalLimits(maxHeartRate: 100, minHeartRate: 50, maxRespiratoryRate: 20, minSystolic: 100)
            }
        }
    }

    // MARK: - Numeric laboratory chips

    /// Evidence chips from numeric results (SI units, as LabPanel stores them). A value in the
    /// other common unit system is recognised by its size where the ranges do not overlap
    /// (calcium mg/dL ≥5, glucose mg/dL ≥100, haemoglobin g/L ≥25); otherwise an unexpected
    /// unit can only fail to add a chip, never add a wrong one.
    /// Thresholds: WBC >11 or <4 ×10⁹/L; CRP >10 mg/L; lactate ≥2 mmol/L (Sepsis-3); bilirubin
    /// >21 µmol/L; ALT/AST >40 U/L, ≥1000 U/L "markedly raised"; ALP >130 U/L; lipase >180 U/L
    /// and amylase >300 U/L (>3× upper limit, revised Atlanta 2012); hs-troponin >14 ng/L (99th
    /// centile, ESC 2023); D-dimer >500 µg/L; creatinine >130 µmol/L; potassium ≥6.0 mmol/L
    /// (UK Kidney Association 2023); sodium <130 mmol/L (European hyponatraemia guideline
    /// 2014); adjusted calcium >2.6 mmol/L; glucose <4.0 (JBDS 2023), >11 and ≥30 mmol/L
    /// (JBDS HHS 2022); haemoglobin <10 g/dL; INR >1.5; platelets <100 ×10⁹/L.
    static func numericLabChips(_ lab: LabPanel) -> Set<String> {
        var chips = Set<String>()
        if let v = lab.wbc?.value { if v > 11 { chips.insert("raised wbc") }; if v < 4 { chips.insert("leukopenia") } }
        if let v = lab.crp?.value, v > 10 { chips.insert("elevated crp") }
        if let v = lab.lactate?.value, v >= 2 { chips.insert("elevated lactate") }
        if let v = lab.bilirubin?.value, v > 21 { chips.insert("raised bilirubin") }
        let transaminase = max(lab.alt?.value ?? 0, lab.ast?.value ?? 0)
        if transaminase > 40 { chips.insert("elevated liver enzymes") }
        if transaminase >= 1000 { chips.insert("markedly raised transaminases") }
        if let v = lab.alp?.value, v > 130 { chips.insert("raised alp"); chips.insert("elevated liver enzymes") }
        if let v = lab.lipase?.value, v > 180 { chips.insert("elevated lipase") }
        if let v = lab.amylase?.value, v > 300 { chips.insert("elevated amylase") }
        if let v = lab.troponin?.value, v > 14 { chips.insert("elevated troponin") }
        if let v = lab.dDimer?.value, v > 500 { chips.insert("elevated d-dimer") }
        if let v = lab.creatinine?.value, v > 130 { chips.insert("renal impairment") }
        if let v = lab.potassium?.value, v >= 6.0, v < 12 { chips.insert("hyperkalaemia") }
        if let v = lab.sodium?.value, v < 130, v > 90 { chips.insert("hyponatraemia") }
        if let v = lab.calcium?.value {
            if (v < 5 && v > 2.6) || (v >= 5 && v > 10.5) { chips.insert("hypercalcaemia") }
        }
        if let v = lab.glucose?.value {
            let mmol = v < 100 ? v : v / 18
            if mmol < 4.0 { chips.insert("hypoglycaemia") }
            if mmol > 11 { chips.insert("elevated glucose") }
            if mmol >= 30 { chips.insert("severe hyperglycaemia") }
        }
        if let v = lab.haemoglobin?.value {
            let gdl = v >= 25 ? v / 10 : v
            if gdl < 10 { chips.insert("Anaemia symptoms") }
        }
        if let v = lab.inr?.value, v > 1.5 { chips.insert("raised inr") }
        if let v = lab.platelets?.value, v < 100 { chips.insert("thrombocytopenia") }
        return chips
    }

    // MARK: - Presentation safety nets (DiagnosticDatabase.json "presentations")

    /// Complaint keywords → names of curated candidates in the "coreConditions" pool.
    struct PresentationSpec: Decodable {
        let id: String
        let keywords: [String]
        let candidates: [String]
    }

    private struct PresentationFile: Decodable {
        let presentations: [PresentationSpec]?
    }

    static let corePoolName = "coreConditions"

    /// Read once, separately from `externalDatabase`, so an unexpected shape here can never stop
    /// the candidate pools from loading. Empty when absent or unreadable.
    static let presentations: [PresentationSpec] = {
        guard let url = Bundle.main.url(forResource: "DiagnosticDatabase", withExtension: "json"),
              let data = try? Data(contentsOf: url),
              let file = try? JSONDecoder().decode(PresentationFile.self, from: data) else { return [] }
        return file.presentations ?? []
    }()

    /// Curated replacement for a candidate name: the coreConditions candidate of that name, or
    /// the one that lists it under "supersedes" (e.g. "Urosepsis" → "Sepsis").
    static let curatedReplacements: [String: CandidateSpec] = {
        guard let core = externalDatabase?.pools[corePoolName] else { return [:] }
        var map: [String: CandidateSpec] = [:]
        for spec in core.candidates where map[spec.name] == nil { map[spec.name] = spec }
        for spec in core.candidates {
            for legacy in spec.supersedes ?? [] where map[legacy] == nil { map[legacy] = spec }
        }
        return map
    }()

    /// The curated candidates of every presentation whose keywords occur (affirmed, at a word
    /// start) in the complaint, in presentation order without repeats, and the legacy candidate
    /// names they supersede (near-duplicates such as "Urosepsis" under "Sepsis").
    static func presentationCandidates(for complaint: RouteText) -> (candidates: [Candidate], supersedes: Set<String>) {
        guard let core = externalDatabase?.pools[corePoolName], !complaint.isEmpty else { return ([], []) }
        var byName: [String: CandidateSpec] = [:]
        for spec in core.candidates where byName[spec.name] == nil { byName[spec.name] = spec }
        var seen = Set<String>()
        var out: [Candidate] = []
        var supersedes = Set<String>()
        for presentation in presentations
        where presentation.keywords.contains(where: { complaint.contains($0.lowercased()) }) {
            for name in presentation.candidates where seen.insert(name).inserted {
                guard let spec = byName[name] else { continue }
                out.append(spec.toCandidate())
                supersedes.formUnion(spec.supersedes ?? [])
            }
        }
        return (out, supersedes)
    }

    /// Pregnancy as far as the record shows it. The Patient model has no pregnancy field, so it
    /// is read (negation-aware) from the complaint, PMH, examination and investigation text.
    enum PregnancyStatus: Equatable {
        /// Pregnancy or the puerperium is recorded ("in pregnancy", "32 weeks pregnant",
        /// "postpartum day 5", "pregnancy test positive").
        case pregnant
        /// Pregnancy is mentioned only as negative ("not pregnant", "pregnancy test negative",
        /// "β-hCG negative"), or a hysterectomy is recorded.
        case notPregnant
        case unknown

        static let pregnancyTerms = [
            "pregnant", "pregnancy", "gestation", "antenatal", "postpartum", "post-partum",
            "postnatal", "post-natal", "puerper", "trimester", "gravid",
        ]

        static func from(texts: [String], surgicalHistory: String) -> PregnancyStatus {
            let source = NegationMatcher.Source(NegationMatcher.joinClauses(texts))
            if pregnancyTerms.contains(where: { source.contains($0, wordStart: true) }) { return .pregnant }
            if NegationMatcher.containsAffirmed(surgicalHistory, "hysterectom", wordStart: true) { return .notPregnant }
            // An hCG value without the word "negative" is not interpreted here.
            if source.contains("hcg", wordStart: true) { return .unknown }
            let mentioned = (pregnancyTerms + ["hcg"]).contains {
                !source.occurrences(of: $0, wordStart: true).isEmpty
            }
            return mentioned ? .notPregnant : .unknown
        }
    }

    /// Who a candidate diagnosis can apply to. Decoded from DiagnosticDatabase.json.
    struct Applicability: Codable, Equatable {
        /// "female" or "male"; nil = either.
        let sex: String?
        let minAgeYears: Int?
        let maxAgeYears: Int?
        /// "required": only when pregnancy or the puerperium is recorded (pre-eclampsia, HELLP);
        /// "possible": females, unless pregnancy is recorded as excluded (ectopic pregnancy);
        /// "excluded": not during pregnancy. nil = no pregnancy condition.
        let pregnancy: String?

        func applies(ageYears: Int, sex patientSex: Sex, pregnancy status: PregnancyStatus) -> Bool {
            if sex == "female" && patientSex == .male { return false }
            if sex == "male" && patientSex == .female { return false }
            if ageYears > 0 {
                if let lo = minAgeYears, ageYears < lo { return false }
                if let hi = maxAgeYears, ageYears > hi { return false }
            }
            if pregnancy == "required" { return status == .pregnant }
            if pregnancy == "possible" { return patientSex != .male && status != .notPregnant }
            if pregnancy == "excluded" { return status != .pregnant }
            return true
        }
    }
}
