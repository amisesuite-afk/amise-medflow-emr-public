// PathwayData.swift
// Stored data for the consultation-pathway forms: burns assessment, wellness screening, the
// ward-review checklist and the bowel-prep plan. Persisted as JSON in Patient.pathwayDataJson.
//
// Every type decodes missing keys to defaults, so fields can be added later without old
// records failing to decode (a failed decode would silently blank the form).

import Foundation

// MARK: - Container

struct PathwayData: Codable {
    var burns = BurnsAssessment()
    var wellness = WellnessScreening()
    var ward = WardReview()
    /// Bowel-prep plan for colonoscopy / flexible sigmoidoscopy (BowelPrepProtocols.swift).
    var bowelPrep = BowelPrepPlan()

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        burns    = (try? c.decodeIfPresent(BurnsAssessment.self, forKey: .burns)) ?? BurnsAssessment()
        wellness = (try? c.decodeIfPresent(WellnessScreening.self, forKey: .wellness)) ?? WellnessScreening()
        ward     = (try? c.decodeIfPresent(WardReview.self, forKey: .ward)) ?? WardReview()
        bowelPrep = (try? c.decodeIfPresent(BowelPrepPlan.self, forKey: .bowelPrep)) ?? BowelPrepPlan()
    }
}

extension Patient {
    var pathwayData: PathwayData {
        get {
            guard let json = pathwayDataJson, let data = json.data(using: .utf8) else { return PathwayData() }
            let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
            return (try? decoder.decode(PathwayData.self, from: data)) ?? PathwayData()
        }
        set {
            let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
            pathwayDataJson = (try? String(data: encoder.encode(newValue), encoding: .utf8)) ?? nil
            updatedAt = .now
        }
    }
}

// MARK: - Visit summary (frozen into Encounter.pathwaySummary on Save Visit)

extension Patient {
    /// Readable summary of the pathway forms used in this visit, or nil if none were filled.
    var pathwaySummaryForVisit: String? {
        let data = pathwayData
        let age: Int? = dateOfBirth == nil ? nil : ageYears
        var parts: [String] = []

        let b = data.burns
        if b.tbsa(ageYears: age) > 0 || !b.mechanism.isEmpty {
            parts.append(b.summary(ageYears: age))
        }

        let w = data.ward
        if let r = w.reviewedAt, Calendar.current.isDateInToday(r), !w.marks.isEmpty {
            let lines = WardReview.items.compactMap { item -> String? in
                guard let m = w.marks[item] else { return nil }
                let note = (w.notes[item] ?? "").isEmpty ? "" : " — \(w.notes[item]!)"
                return "\(item): \(m == .ok ? "OK" : "CONCERN")\(m == .concern ? note : "")"
            }
            parts.append("Ward round checklist:\n" + lines.joined(separator: "\n"))
        }

        let s = data.wellness
        if !s.statuses.isEmpty {
            let items = ScreeningEngine.items(age: age, sex: sex, bmi: latestBMI(), w: s, clinicBP: ScreeningEngine.latestBP(self))
            let lines = items.compactMap { item -> String? in
                s.statuses[item.id].map { "\(item.title): \($0.rawValue)" }
            }
            if !lines.isEmpty { parts.append("Screening:\n" + lines.joined(separator: "\n")) }
        }
        return parts.isEmpty ? nil : parts.joined(separator: "\n\n")
    }
}

// MARK: - Burns

struct BurnsAssessment: Codable {
    var timeOfBurn: Date?
    var weightKg: Double?
    var mechanism: String = ""
    var depth: String = ""
    /// Fraction (0…1) of each body region that is burned. Erythema only is excluded.
    var regionFractions: [String: Double] = [:]
    var fullThicknessPct: Double = 0
    var specialAreas: [String] = []
    var inhalation = false
    var circumferential = false
    var nonAccidentalConcern = false
    var comorbidityOrPregnancy = false
    var notes: String = ""

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        timeOfBurn          = (try? c.decodeIfPresent(Date.self, forKey: .timeOfBurn)) ?? nil
        weightKg            = (try? c.decodeIfPresent(Double.self, forKey: .weightKg)) ?? nil
        mechanism           = (try? c.decodeIfPresent(String.self, forKey: .mechanism)) ?? ""
        depth               = (try? c.decodeIfPresent(String.self, forKey: .depth)) ?? ""
        regionFractions     = (try? c.decodeIfPresent([String: Double].self, forKey: .regionFractions)) ?? [:]
        fullThicknessPct    = (try? c.decodeIfPresent(Double.self, forKey: .fullThicknessPct)) ?? 0
        specialAreas        = (try? c.decodeIfPresent([String].self, forKey: .specialAreas)) ?? []
        inhalation          = (try? c.decodeIfPresent(Bool.self, forKey: .inhalation)) ?? false
        circumferential     = (try? c.decodeIfPresent(Bool.self, forKey: .circumferential)) ?? false
        nonAccidentalConcern = (try? c.decodeIfPresent(Bool.self, forKey: .nonAccidentalConcern)) ?? false
        comorbidityOrPregnancy = (try? c.decodeIfPresent(Bool.self, forKey: .comorbidityOrPregnancy)) ?? false
        notes               = (try? c.decodeIfPresent(String.self, forKey: .notes)) ?? ""
    }

    static let mechanisms = ["Scald", "Flame", "Contact", "Flash", "Chemical",
                             "Electrical (low voltage)", "Electrical (high voltage)", "Friction", "Radiation / sun"]
    static let depths = ["Superficial partial thickness", "Deep partial thickness", "Full thickness", "Mixed depth"]
    static let specialAreaOptions = ["Face", "Hands", "Feet", "Genitalia / perineum", "Major joints"]
    static let regions = ["Head & neck", "Anterior trunk", "Posterior trunk", "Right arm", "Left arm",
                          "Right leg", "Left leg", "Perineum"]

    /// Percentage of total body surface for each region (rule of nines, paediatric-adjusted).
    /// Children: head 18% and each leg 14% at age ≤1; for each year over 1, head −1% and each
    /// leg +0.5% until adult proportions (head 9%, leg 18%) at about age 10.
    static func regionPercent(_ region: String, ageYears: Int?) -> Double {
        let years = Double(max(1, min(ageYears ?? 30, 10)))
        let head = ageYears.map { $0 < 10 } == true ? 18 - (years - 1) : 9
        let leg  = ageYears.map { $0 < 10 } == true ? 14 + 0.5 * (years - 1) : 18
        switch region {
        case "Head & neck":                   return head
        case "Anterior trunk", "Posterior trunk": return 18
        case "Right arm", "Left arm":         return 9
        case "Right leg", "Left leg":         return leg
        case "Perineum":                      return 1
        default:                              return 0
        }
    }

    func tbsa(ageYears: Int?) -> Double {
        let total = Self.regions.reduce(0) { $0 + Self.regionPercent($1, ageYears: ageYears) }
        let burned = Self.regions.reduce(0) { sum, r in
            sum + (regionFractions[r] ?? 0) * Self.regionPercent(r, ageYears: ageYears)
        }
        // Normalise: the paediatric rule of nines sums to ~101%.
        return total > 0 ? burned / total * 100 : 0
    }

    /// Modified Parkland estimate: 4 mL × kg × %TBSA over 24 h from the time of burn.
    func parkland24h(ageYears: Int?) -> Double? {
        guard let kg = weightKg, kg > 0 else { return nil }
        let t = tbsa(ageYears: ageYears)
        return t > 0 ? 4 * kg * t : nil
    }

    /// Formal fluid resuscitation threshold: >15% TBSA adults, >10% children (<16 y).
    func needsFluidResuscitation(ageYears: Int?) -> Bool {
        let child = (ageYears ?? 30) < 16
        return tbsa(ageYears: ageYears) > (child ? 10 : 15)
    }

    /// Burns-unit referral criteria met (ANZBA / British Burn Association style).
    func referralCriteria(ageYears: Int?) -> [String] {
        var met: [String] = []
        let child = (ageYears ?? 30) < 16
        let t = tbsa(ageYears: ageYears)
        if child && t > 5 { met.append(String(format: "Child with TBSA %.0f%% (>5%%)", t)) }
        if !child && t > 10 { met.append(String(format: "Adult with TBSA %.0f%% (>10%%)", t)) }
        if fullThicknessPct > 5 { met.append(String(format: "Full thickness %.0f%% (>5%%)", fullThicknessPct)) }
        if !specialAreas.isEmpty { met.append("Special area: \(specialAreas.joined(separator: ", "))") }
        if circumferential { met.append("Circumferential burn") }
        if inhalation { met.append("Inhalation injury") }
        if mechanism.hasPrefix("Electrical") { met.append("Electrical burn") }
        if mechanism == "Chemical" { met.append("Chemical burn") }
        if nonAccidentalConcern { met.append("Non-accidental injury suspected") }
        if comorbidityOrPregnancy { met.append("Significant comorbidity or pregnancy") }
        return met
    }

    func summary(ageYears: Int?) -> String {
        var lines: [String] = []
        let t = tbsa(ageYears: ageYears)
        lines.append(String(format: "Burns assessment: TBSA %.1f%%", t)
                     + (fullThicknessPct > 0 ? String(format: " (full thickness %.0f%%)", fullThicknessPct) : ""))
        if !mechanism.isEmpty { lines.append("Mechanism: \(mechanism)") }
        if !depth.isEmpty { lines.append("Depth: \(depth)") }
        if let tob = timeOfBurn {
            lines.append("Time of burn: \(tob.formatted(date: .abbreviated, time: .shortened))")
        }
        let burned = Self.regions.filter { (regionFractions[$0] ?? 0) > 0 }
            .map { "\($0) \(Int((regionFractions[$0] ?? 0) * 100))%" }
        if !burned.isEmpty { lines.append("Regions: \(burned.joined(separator: ", "))") }
        if inhalation { lines.append("Inhalation injury suspected") }
        if let p = parkland24h(ageYears: ageYears), needsFluidResuscitation(ageYears: ageYears) {
            lines.append(String(format: "Parkland estimate %.0f mL/24 h (half in first 8 h from time of burn) — clinician to verify and titrate to urine output", p))
        }
        let criteria = referralCriteria(ageYears: ageYears)
        if !criteria.isEmpty { lines.append("Burns unit referral criteria met: \(criteria.joined(separator: "; "))") }
        if !notes.isEmpty { lines.append(notes) }
        return lines.joined(separator: "\n")
    }
}

// MARK: - Wellness screening

struct WellnessScreening: Codable {
    enum Smoking: String, Codable, CaseIterable { case never = "Never", former = "Former", current = "Current" }
    enum Status: String, Codable, CaseIterable {
        case upToDate = "Up to date", suggested = "Added", declined = "Declined"
    }

    var smoking: Smoking = .never
    var packYears: Double = 0
    var yearsSinceQuit: Int = 0
    var familyHxColorectal = false
    var priorPolyps = false
    var familyHxBreastOvarian = false
    var familyHxProstate = false
    var africanCaribbean = false
    var familyHxDiabetes = false
    var hypertension = false
    // Parity with the web preventive-screening module (lib/triage-engine/src/screening/preventive.ts,
    // docs/clinical-validation/changes/fix-web-screening.md) — added 2026-09.
    /// First-degree relative with colorectal cancer / advanced adenoma under 60, or ≥2 FDRs (ACG 2021).
    var familyHxColorectalHighRisk = false
    var lynchCarrier = false
    var familyHxLynchFeatures = false
    var brcaCarrier = false
    var totalHysterectomy = false
    var cervicalHighGradeHistory = false
    var priorGestationalDiabetes = false
    var familyHxGastricCancer = false
    var lastNormalColonoscopyYearsAgo: Int? = nil
    // Polyp findings for the US MSTF 2020 interval (nil / false = not recorded).
    var polypCount: Int? = nil
    var largestPolypMm: Int? = nil
    /// Villous histology, high-grade dysplasia or traditional serrated adenoma.
    var polypAdvancedHistology = false
    /// Piecemeal EMR of a lesion ≥20 mm.
    var piecemealEMR20mm = false
    var statuses: [String: Status] = [:]

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        smoking               = (try? c.decodeIfPresent(Smoking.self, forKey: .smoking)) ?? .never
        packYears             = (try? c.decodeIfPresent(Double.self, forKey: .packYears)) ?? 0
        yearsSinceQuit        = (try? c.decodeIfPresent(Int.self, forKey: .yearsSinceQuit)) ?? 0
        familyHxColorectal    = (try? c.decodeIfPresent(Bool.self, forKey: .familyHxColorectal)) ?? false
        priorPolyps           = (try? c.decodeIfPresent(Bool.self, forKey: .priorPolyps)) ?? false
        familyHxBreastOvarian = (try? c.decodeIfPresent(Bool.self, forKey: .familyHxBreastOvarian)) ?? false
        familyHxProstate      = (try? c.decodeIfPresent(Bool.self, forKey: .familyHxProstate)) ?? false
        africanCaribbean      = (try? c.decodeIfPresent(Bool.self, forKey: .africanCaribbean)) ?? false
        familyHxDiabetes      = (try? c.decodeIfPresent(Bool.self, forKey: .familyHxDiabetes)) ?? false
        hypertension          = (try? c.decodeIfPresent(Bool.self, forKey: .hypertension)) ?? false
        familyHxColorectalHighRisk = (try? c.decodeIfPresent(Bool.self, forKey: .familyHxColorectalHighRisk)) ?? false
        lynchCarrier          = (try? c.decodeIfPresent(Bool.self, forKey: .lynchCarrier)) ?? false
        familyHxLynchFeatures = (try? c.decodeIfPresent(Bool.self, forKey: .familyHxLynchFeatures)) ?? false
        brcaCarrier           = (try? c.decodeIfPresent(Bool.self, forKey: .brcaCarrier)) ?? false
        totalHysterectomy     = (try? c.decodeIfPresent(Bool.self, forKey: .totalHysterectomy)) ?? false
        cervicalHighGradeHistory = (try? c.decodeIfPresent(Bool.self, forKey: .cervicalHighGradeHistory)) ?? false
        priorGestationalDiabetes = (try? c.decodeIfPresent(Bool.self, forKey: .priorGestationalDiabetes)) ?? false
        familyHxGastricCancer = (try? c.decodeIfPresent(Bool.self, forKey: .familyHxGastricCancer)) ?? false
        lastNormalColonoscopyYearsAgo = (try? c.decodeIfPresent(Int.self, forKey: .lastNormalColonoscopyYearsAgo)) ?? nil
        polypCount            = (try? c.decodeIfPresent(Int.self, forKey: .polypCount)) ?? nil
        largestPolypMm        = (try? c.decodeIfPresent(Int.self, forKey: .largestPolypMm)) ?? nil
        polypAdvancedHistology = (try? c.decodeIfPresent(Bool.self, forKey: .polypAdvancedHistology)) ?? false
        piecemealEMR20mm      = (try? c.decodeIfPresent(Bool.self, forKey: .piecemealEMR20mm)) ?? false
        statuses              = (try? c.decodeIfPresent([String: Status].self, forKey: .statuses)) ?? [:]
    }
}

struct ScreeningItem: Identifiable {
    let id: String
    let title: String
    let detail: String
    /// Investigation to add when the clinician taps "Add to Ix" (nil = advice/vaccine/score).
    let ixName: String?
    let ixCategory: InvestigationEntry.InvCategory
    let highRisk: Bool
}

enum ScreeningEngine {
    /// Screening due for this patient's age, sex and risk parameters.
    /// Based on USPSTF recommendations adapted to common Caribbean practice. Suggestions only.
    static func items(age: Int?, sex: Sex, bmi: Double?, w: WellnessScreening,
                      clinicBP: (systolic: Int, diastolic: Int)? = nil) -> [ScreeningItem] {
        guard let age else {
            return [ScreeningItem(id: "dob", title: "Record date of birth",
                                  detail: "Screening recommendations depend on age.",
                                  ixName: nil, ixCategory: .other, highRisk: false)]
        }
        let female = sex == .female, male = sex == .male
        var out: [ScreeningItem] = []
        func add(_ id: String, _ title: String, _ detail: String,
                 ix: String? = nil, _ cat: InvestigationEntry.InvCategory = .blood, high: Bool = false) {
            out.append(ScreeningItem(id: id, title: title, detail: detail, ixName: ix, ixCategory: cat, highRisk: high))
        }

        if age >= 18 {
            // NICE NG136: clinic BP 140–179 / 90–119 without known hypertension → confirm out of clinic.
            let raised = clinicBP.map { ($0.systolic >= 140 && $0.systolic < 180) || ($0.diastolic >= 90 && $0.diastolic < 120) } ?? false
            add("bp", "Blood pressure", raised && !w.hypertension
                ? "Clinic BP raised: confirm with ABPM (or HBPM); urine ACR, U&E, HbA1c, lipids, ECG, fundi (NICE NG136)."
                : "Check at every visit; yearly if normal.", high: raised && !w.hypertension)
            add("bmi", "Weight, BMI and waist", bmi.map { String(format: "Current BMI %.1f.", $0) } ?? "Record height and weight.")
        }

        // Diabetes: high prevalence in the Caribbean — screen from 35; earlier when overweight AND
        // a risk factor is present, or after gestational diabetes (ADA 2024; USPSTF 2021).
        let dmRisk = ((bmi ?? 0) >= 25 && (w.familyHxDiabetes || w.hypertension)) || w.priorGestationalDiabetes
        if age >= 35 || (age >= 18 && dmRisk) {
            add("dm", "Diabetes screen", "HbA1c or fasting glucose; repeat every 3 years if normal"
                + (dmRisk ? " (risk factors present)." : "."), ix: "HbA1c", high: dmRisk && age < 35)
        }
        if (40...75).contains(age) || (age >= 20 && w.hypertension) {
            add("lipids", "Lipid profile", "Lipid profile and 10-year cardiovascular risk (Pooled Cohort Equations); statin "
                + "discussion if ≥10% with a risk factor (USPSTF 2022).", ix: "Lipid profile")
        }

        // Colorectal cancer (USPSTF 2021; ACG 2021; US MSTF 2017/2020; BSG/ACPGBI/UKCGG 2019)
        if w.lynchCarrier {
            add("crc-lynch", "Lynch syndrome — colonoscopy every 2 years",
                "Colonoscopy every 2 years from 25 (MLH1/MSH2/EPCAM) or 35 (MSH6/PMS2); discuss aspirin; gynaecology "
                + "review (women); genetics / cascade testing (BSG/ACPGBI/UKCGG 2019; NCCN 2024).",
                ix: "Colonoscopy", .endoscopy, high: true)
        } else if w.priorPolyps {
            let plan = polypSurveillanceInterval(w)
            add("crc-polyps", "Surveillance colonoscopy", "Previous polyps: \(plan) (US MSTF 2020).",
                ix: "Colonoscopy", .endoscopy, high: true)
        } else if w.familyHxColorectal && age >= 40 {
            if w.familyHxColorectalHighRisk {
                add("crc-fh", "Colonoscopy (family history)", "First-degree relative with colorectal cancer or advanced adenoma "
                    + "under 60, or ≥2 first-degree relatives: colonoscopy from 40 (or 10 years before the youngest case), "
                    + "then every 5 years (ACG 2021; US MSTF 2017).", ix: "Colonoscopy", .endoscopy, high: true)
            } else {
                add("crc-fh", "Colorectal screening (family history)", "One first-degree relative diagnosed at 60 or over: start "
                    + "at 40 with average-risk options — FIT every year or colonoscopy every 10 years (ACG 2021).",
                    ix: "FIT (faecal immunochemical test)", .pathology)
            }
        } else if (45...75).contains(age) {
            if let years = w.lastNormalColonoscopyYearsAgo, years < 10 {
                add("crc", "Colorectal cancer screening", "Up to date — next colonoscopy 10 years after the last normal one "
                    + "(\(10 - years) years from now).")
            } else {
                add("crc", "Colorectal cancer screening", "FIT every year, or colonoscopy every 10 years (USPSTF 2021).",
                    ix: "FIT (faecal immunochemical test)", .pathology)
            }
        } else if (76...85).contains(age) {
            add("crc-76-85", "Colorectal screening 76–85 — individualised",
                "Individualised decision (health, life expectancy, prior screening) — USPSTF 2021 grade C.")
        }
        if w.familyHxLynchFeatures && !w.lynchCarrier {
            add("crc-lynch-fh", "Possible Lynch syndrome in the family",
                "Request the relative's tumour MMR/MSI result; clinical genetics referral (NCCN 2024; revised Bethesda).", high: true)
        }

        if female {
            if w.brcaCarrier && age >= 25 {
                add("breast-brca", "BRCA carrier — high-risk breast surveillance",
                    "Annual breast MRI from 25, annual mammography from 30; discuss risk-reducing mastectomy and RRSO; "
                    + "high-risk / genetics service (NCCN 2024; ACR 2023).", ix: "MRI breast", .imaging, high: true)
            } else {
                if w.familyHxBreastOvarian && age >= 30 {
                    add("breast-fh", "Breast cancer family history",
                        "Familial risk tool; genetic counselling if positive; MRI + mammography from 30 only if lifetime "
                        + "risk ≥20% (USPSTF 2019; ACR 2023).", high: true)
                }
                if (40...74).contains(age) {
                    add("breast", "Mammogram", "Every 2 years, 40–74 (USPSTF 2024).", ix: "Mammogram", .imaging)
                }
            }
            if (21...65).contains(age) && !(w.totalHysterectomy && !w.cervicalHighGradeHistory) {
                add("cervix", "Cervical screening", age >= 30 ? "HPV test every 5 years (or cytology every 3)." : "Cytology every 3 years.",
                    ix: age >= 30 ? "HPV test" : "Cervical cytology", .pathology)
            }
            if age >= 65 {
                add("dexa", "Bone density (DEXA)", "Osteoporosis screening.", ix: "DEXA scan", .imaging)
            }
        }

        if male {
            // USPSTF 2018: shared decision 55–69; earlier (45) with a family history — whether
            // African-Caribbean ancestry alone keeps the start at 45 is listed for sign-off.
            let early = w.africanCaribbean || w.familyHxProstate
            if (early ? 45 : 55)...69 ~= age {
                add("psa", "Prostate (PSA) — shared decision", "Discuss benefits and harms before testing"
                    + (early ? "; higher risk (African-Caribbean descent or family history)." : "."),
                    ix: "PSA", high: early)
            }
            if (65...75).contains(age) && w.smoking != .never {
                add("aaa", "Abdominal aortic aneurysm ultrasound", "Once, for men 65–75 who have ever smoked.",
                    ix: "US abdominal aorta", .imaging)
            }
        }

        if (50...80).contains(age) && w.packYears >= 20
            && (w.smoking == .current || (w.smoking == .former && w.yearsSinceQuit <= 15)) {
            add("lung", "Low-dose CT chest", "Yearly: ≥20 pack-years, current smoker or quit within 15 years.",
                ix: "Low-dose CT chest", .imaging, high: true)
        }
        if (18...79).contains(age) { add("hcv", "Hepatitis C", "Once in adulthood.", ix: "Hepatitis C antibody") }
        if age >= 18 {
            add("hbv", "Hepatitis B", "Hepatitis B triple panel (HBsAg, anti-HBs, anti-HBc) once — CDC 2023.",
                ix: "Hepatitis B surface antigen")
        }
        if w.familyHxGastricCancer && age >= 18 {
            add("hpylori", "H. pylori test-and-treat (family history of gastric cancer)",
                "Stool antigen or urea breath test off PPI for 2 weeks; eradicate and confirm (Maastricht VI 2022).",
                ix: "H. pylori stool antigen", .pathology)
        }
        if (15...65).contains(age) { add("hiv", "HIV", "At least once; more often if at risk.", ix: "HIV 1/2 Ag/Ab") }

        if age >= 18 {
            add("audit", "Alcohol (AUDIT-C)", "Use the AUDIT-C score in Clinical Scores.")
            add("phq", "Depression (PHQ-9)", "Use the PHQ-9 score in Clinical Scores.")
        }
        if w.smoking == .current { add("quit", "Smoking cessation", "Advise, offer support and pharmacotherapy.", high: true) }
        add("flu", "Influenza vaccine", "Yearly.")
        add("tetanus", "Tetanus booster", "If last dose over 10 years ago.")
        if age >= 65 { add("pneumo", "Pneumococcal vaccine", "Adults 65 and over.") }
        return out
    }

    /// The latest recorded systolic/diastolic pair (for the NICE NG136 confirmation prompt).
    static func latestBP(_ p: Patient) -> (systolic: Int, diastolic: Int)? {
        guard let v = p.vitalsEntries.filter({ $0.bpSystolic != nil && $0.bpDiastolic != nil })
                .sorted(by: { $0.recordedAt > $1.recordedAt }).first,
              let s = v.bpSystolic, let d = v.bpDiastolic else { return nil }
        return (s, d)
    }

    /// US MSTF 2020 (Gupta et al.) post-polypectomy interval from the recorded findings; mirrors
    /// `polypSurveillanceInterval` in lib/triage-engine/src/screening/preventive.ts.
    static func polypSurveillanceInterval(_ w: WellnessScreening) -> String {
        if w.piecemealEMR20mm {
            return "site-check colonoscopy at 6 months, then 1 year after that, then 3 years later"
        }
        let n = w.polypCount
        let size = w.largestPolypMm
        if w.polypAdvancedHistology || (size ?? 0) >= 10 { return "next colonoscopy in 3 years" }
        if let n, n > 10 { return "next colonoscopy in 1 year; genetics referral" }
        if let n, n >= 5 { return "next colonoscopy in 3 years" }
        if let n, n >= 3 { return "next colonoscopy in 3–5 years" }
        if let n, n >= 1, size != nil { return "next colonoscopy in 7–10 years" }
        return "interval per the colonoscopy / histology report (US MSTF 2020 table)"
    }
}

// MARK: - Ward review

struct WardReview: Codable {
    enum Mark: String, Codable { case ok = "OK", concern = "Concern" }

    var marks: [String: Mark] = [:]
    var notes: [String: String] = [:]
    var reviewedAt: Date?

    init() {}

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        marks      = (try? c.decodeIfPresent([String: Mark].self, forKey: .marks)) ?? [:]
        notes      = (try? c.decodeIfPresent([String: String].self, forKey: .notes)) ?? [:]
        reviewedAt = (try? c.decodeIfPresent(Date.self, forKey: .reviewedAt)) ?? nil
    }

    static let items = [
        "Pain controlled", "Nausea / vomiting", "Eating & drinking", "Bowels / flatus",
        "Urine output", "Mobilising", "Wound", "Drains / lines / catheter",
        "VTE prophylaxis", "Antibiotics (day / stop date)", "Bloods reviewed", "Discharge plan"
    ]

    /// Items that must be OK before discharge is suggested.
    static let dischargeItems = [
        "Pain controlled", "Eating & drinking", "Bowels / flatus", "Urine output",
        "Mobilising", "Wound", "Discharge plan"
    ]

    /// Discharge readiness from today's checklist and the latest NEWS2 (nil = no recent obs).
    /// Returns the items still outstanding; empty means criteria met. A prompt, not a decision.
    func dischargeOutstanding(latestNEWS2: Int?, obsHoursOld: Int?) -> [String] {
        var out = Self.dischargeItems.filter { marks[$0] != .ok }
        if let n = latestNEWS2, let h = obsHoursOld, h < 12 {
            if n > 2 { out.append("NEWS2 \(n) (needs ≤2)") }
        } else {
            out.append("Observations within 12 h")
        }
        if Self.items.contains(where: { marks[$0] == .concern }) { out.append("Open concerns") }
        return out
    }
}
