// ConsultationView+DiagnosisTab.swift
// Pre-encounter parsers, Bayesian engine refresh, diagnosis tab.

import SwiftUI
import SwiftData

extension ConsultationView {

    // MARK: - Pre-encounter questionnaire SOCRATES parser
    // Reads the structured KEY: value lines written by EncounterAnswers.hpiText
    // and converts them to the socratesSelections dictionary format so the
    // Bayesian engine and SOCRATES chips are pre-populated from front-desk data.
    // This is a one-time seed on .onAppear — the doctor can override chips freely.

    func parseSocratesFromHPI(_ hpi: String) -> [String: Set<String>] {
        var result: [String: Set<String>] = [:]
        for line in hpi.components(separatedBy: "\n") {
            let parts = line.split(separator: ":", maxSplits: 1).map { $0.trimmingCharacters(in: .whitespaces) }
            guard parts.count == 2 else { continue }
            let key = parts[0].lowercased()
            let val = parts[1]
            switch key {
            case "site":
                result["site"] = [val]
            case "onset":
                result["onset"] = [val]
            case "character":
                result["character"] = [val]
            case "radiation":
                if !val.lowercased().contains("none") { result["radiation"] = [val] }
            case "severity":
                result["severity"] = [val]
            case "timing":
                result["timing"] = [val]
            case "worse":
                result["exacerbating"] = Set(val.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) })
            case "better":
                result["relieving"] = Set(val.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) })
            case "associated":
                result["associations"] = Set(val.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) })
            default:
                break
            }
        }
        return result
    }

    // MARK: - PMH notes → chip pre-population
    // Maps structured CONDITIONS: line written by EncounterAnswers.pmhxText to the
    // pmhChips display labels so the PMH section is pre-selected on first open.
    // Handles label mismatches between PMHxCondition.rawValue and pmhChips (e.g.
    // "Diabetes mellitus" → both "T2DM" and "T1DM"; "Cancer (any)" → "Malignancy").

    func parsePMHChipsFromNotes(_ notes: String) -> Set<String> {
        var matched = Set<String>()
        // Extract conditions from the structured "CONDITIONS: a, b, c" line
        let conditionLine: String? = notes.components(separatedBy: "\n").first(where: {
            $0.uppercased().hasPrefix("CONDITIONS:")
        }).map { String($0.dropFirst("CONDITIONS:".count)).trimmingCharacters(in: .whitespaces) }

        let conditions: [String]
        if let line = conditionLine {
            conditions = line.components(separatedBy: ",").map { $0.trimmingCharacters(in: .whitespaces) }
        } else {
            // Fallback: scan all lines for any text that matches a known condition
            conditions = notes.components(separatedBy: "\n")
        }

        // Mapping rules: PMHxCondition.rawValue (or keywords) → pmhChips label
        let mapping: [(keywords: [String], chip: String)] = [
            (["Hypertension", "hypertension"],                     "Hypertension"),
            (["Diabetes mellitus", "T2DM", "Type 2"],              "T2DM"),
            (["Diabetes mellitus", "T1DM", "Type 1"],              "T1DM"),
            (["Heart disease", "IHD", "Ischaemic heart"],          "Ischaemic heart disease"),
            (["Atrial fibrillation", "AF", "atrial fibrillation"], "Atrial fibrillation"),
            (["Heart failure"],                                     "Heart failure"),
            (["Stroke", "TIA"],                                     "Stroke / TIA"),
            (["Chronic kidney disease", "CKD"],                    "CKD"),
            (["COPD", "Chronic obstructive"],                      "COPD"),
            (["Asthma"],                                           "Asthma"),
            (["Liver disease", "Cirrhosis"],                       "Liver disease / Cirrhosis"),
            (["Peptic ulcer"],                                     "Peptic ulcer disease"),
            (["GORD", "Reflux", "GERD"],                          "GORD / Reflux"),
            (["Inflammatory bowel", "IBD", "Crohn", "Colitis"],   "IBD (Crohn's / UC)"),
            (["Cancer", "Malignancy", "Tumour", "Tumor"],         "Malignancy"),
            (["Thyroid"],                                          "Thyroid disease"),
            (["OSA", "Sleep apn", "Obstructive sleep"],           "OSA"),
            (["DVT", "PE", "pulmonary embolism", "thrombosis"],   "DVT / PE"),
            (["Anaemia", "Anemia"],                               "Anaemia"),
            (["Epilepsy", "seizure"],                             "Epilepsy"),
            (["Depression", "Anxiety", "Mental health"],          "Depression / Anxiety"),
            (["Dementia", "Alzheimer"],                           "Dementia"),
            (["Osteoporosis"],                                    "Osteoporosis"),
            (["Rheumatoid arthritis", "Rheumatoid"],              "Rheumatoid arthritis"),
            (["Immunocompromised", "HIV", "AIDS"],                "Immunocompromised"),
        ]

        let lowerConditions = conditions.map { $0.lowercased() }
        for rule in mapping {
            if rule.keywords.contains(where: { kw in
                lowerConditions.contains(where: { $0.contains(kw.lowercased()) })
            }) {
                matched.insert(rule.chip)
            }
        }
        return matched
    }

    // MARK: - P9: surgicalHistory text → PSHx chip pre-population
    // Matches free-text surgical history (from questionnaire or typed notes) against
    // the pshxChips labels by keyword. Called on .onAppear — doctor can modify freely.

    func parsePSHxChipsFromSurgicalHistory(_ text: String) -> Set<String> {
        let lower = text.lowercased()
        var matched = Set<String>()
        let mapping: [(keywords: [String], chip: String)] = [
            (["cholecystectomy", "gallbladder removal"],          "Cholecystectomy"),
            (["appendicectomy", "appendectomy"],                  "Appendicectomy"),
            (["inguinal hernia"],                                 "Inguinal hernia repair"),
            (["umbilical hernia"],                                 "Umbilical hernia repair"),
            (["bowel resection", "small bowel resection"],        "Bowel resection"),
            (["anterior resection", "low anterior"],              "Anterior resection"),
            (["apr", "abdominoperineal"],                         "APR"),
            (["hartmann"],                                        "Hartmann's procedure"),
            (["gastric bypass", "sleeve gastrectomy", "bariatric"], "Gastric bypass / sleeve"),
            (["fundoplication", "nissen"],                        "Fundoplication"),
            (["whipple", "pancreaticoduodenectomy"],              "Whipple's procedure"),
            (["liver resection", "hepatectomy"],                  "Liver resection"),
            (["splenectomy"],                                     "Splenectomy"),
            (["thyroidectomy"],                                   "Thyroidectomy"),
            (["parathyroidectomy"],                               "Parathyroidectomy"),
            (["mastectomy"],                                      "Mastectomy"),
            (["sentinel node", "sentinel lymph"],                 "Sentinel node biopsy"),
            (["laparotomy"],                                      "Laparotomy"),
            (["diagnostic laparoscopy"],                          "Diagnostic laparoscopy"),
            (["ercp"],                                            "ERCP"),
            (["ogd", "gastroscopy", "upper gi endoscopy"],       "OGD / Gastroscopy"),
            (["colonoscopy"],                                     "Colonoscopy"),
            (["haemorrhoidectomy", "hemorrhoidectomy"],           "Haemorrhoidectomy"),
            (["fistula", "fistulotomy", "perianal abscess"],      "Fistula / abscess repair"),
            (["caesarean", "cesarean", "c-section"],              "Caesarean section"),
            (["hysterectomy"],                                    "Hysterectomy"),
        ]
        for rule in mapping {
            if rule.keywords.contains(where: { lower.contains($0) }) {
                matched.insert(rule.chip)
            }
        }
        return matched
    }

    // MARK: - P8: socialHistory text → social chip pre-population
    // Rebuilds the selectedSocialChips set from the "· Key: Value" lines written by
    // appendSocialChip(). This restores the chip state so SurgicalRiskEngine receives
    // the correct smoking/alcohol/lifestyle signals on every ConsultationView open.

    func parseSocialChipsFromHistory(_ text: String) -> Set<String> {
        var chips = Set<String>()
        let lines = text.components(separatedBy: "\n").map {
            $0.trimmingCharacters(in: .whitespaces).trimmingCharacters(in: CharacterSet(charactersIn: "·").union(.whitespaces))
        }
        let smokingOptions  = ["Non-smoker", "Ex-smoker", "Light smoker (<10/day)",
                               "Moderate smoker (10–20/day)", "Heavy smoker (>20/day)"]
        let alcoholOptions  = ["Non-drinker", "Social drinker (<14 units/wk)",
                               "Moderate (14–21 units/wk)", "Heavy (>21 units/wk)"]
        let livingOptions   = ["Lives alone", "Lives with partner", "Lives with family", "Care home resident"]
        let occOptions      = ["Retired", "Sedentary / desk work", "Manual labour", "Healthcare worker"]
        let activityOptions = ["Physically active (>150 min/wk)", "Sedentary lifestyle"]

        for line in lines where !line.isEmpty {
            if line.hasPrefix("Smoking: ") {
                let val = String(line.dropFirst("Smoking: ".count))
                if smokingOptions.contains(val) { chips.insert("Smoking:\(val)") }
            } else if line.hasPrefix("Alcohol: ") {
                let val = String(line.dropFirst("Alcohol: ".count))
                if alcoholOptions.contains(val) { chips.insert("Alcohol:\(val)") }
            } else if line.hasPrefix("Living: ") {
                let val = String(line.dropFirst("Living: ".count))
                if livingOptions.contains(val) { chips.insert("Living:\(val)") }
            } else if line.hasPrefix("Occ: ") {
                let val = String(line.dropFirst("Occ: ".count))
                if occOptions.contains(val) { chips.insert("Occ:\(val)") }
            } else if line.hasPrefix("Activity: ") {
                let val = String(line.dropFirst("Activity: ".count))
                if activityOptions.contains(val) { chips.insert("Activity:\(val)") }
            } else {
                // Free text or legacy unkeyed entries
                chips.insert(line)
            }
        }
        return chips
    }

    // MARK: - Bayesian engine refresh
    // Augments SOCRATES selections with clinical features extracted from free text
    // (HPI, exam findings, notes) so the engine fires from any typed data, not
    // only structured chip selections.

    func refreshBayesian() {
        // Concatenate resulted investigation findings so the clinical text parser
        // can detect critical patterns in imaging/lab reports (e.g. "pneumoperitoneum",
        // "ruptured", "free gas") and raise appropriate clinical alarms.
        let invResultsText = patient.investigations
            .filter { $0.status == .resulted && !$0.result.isEmpty }
            .map { "\($0.name): \($0.result)" }
            .joined(separator: ". ")
        // One clause per field: a negation in one exam field must not reach the next.
        let examOtherText = NegationMatcher.joinClauses([patient.examCVS, patient.examResp, patient.examNeuro, patient.examMSK, patient.examSkin, patient.examOther])
        let parsed = ClinicalTextParser.parse(
            hpi: patient.hpi,
            examGeneral: patient.examGeneral,
            examAbdo: patient.examAbdo,
            examOther: examOtherText.isEmpty ? nil : examOtherText,
            notes: invResultsText.isEmpty ? nil : invResultsText
        )

        // Merge parser-extracted features into the chip-selection dict
        var augmented = socratesSelections
        for (dim, chips) in parsed.featureAugments {
            augmented[dim, default: []].formUnion(chips)
        }

        // Offer a CC hint only when no CC is set yet
        if (patient.chiefComplaint ?? "").isEmpty, let hint = parsed.ccHint {
            patient.chiefComplaint = hint
        }

        let latestVitals = patient.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first
        bayesianDx = BayesianDiagnosisEngine.infer(
            chiefComplaint: patient.chiefComplaint,
            socratesSelections: augmented,
            pmhNotes: patient.pmhNotes,
            surgicalHistory: patient.surgicalHistory,
            examAbdo: patient.examAbdo,
            examGeneral: patient.examGeneral,
            examCVS: patient.examCVS,
            examResp: patient.examResp,
            examNeuro: patient.examNeuro,
            examMSK: patient.examMSK,
            examSkin: patient.examSkin,
            examOther: patient.examOther,
            investigations: patient.investigations,
            ageYears: patient.ageYears,
            sex: patient.sex,
            longitudinal: patient.longitudinalContext,
            latestHR: latestVitals?.heartRate,
            latestSBP: latestVitals?.bpSystolic,
            latestTemp: latestVitals?.temperatureCelsius,
            latestSpO2: latestVitals?.spo2,
            latestRR: latestVitals?.respiratoryRate,
            news2Score: latestVitals.flatMap { $0.hasAnyValue ? $0.news2Score : nil },
            specialtyHint: selectedSpecialtyHint
        )

        // Update alarm list (keep dismissed state across refreshes)
        clinicalAlarms = parsed.clinicalAlarms
    }

    // MARK: - Diagnosis tab

    var diagnosisTab: some View {
        List {
            if !bayesianDx.isEmpty {
                Section {
                    ForEach(bayesianDx) { result in
                        BayesianDxRow(result: result) {
                            patient.workingDiagnosis = result.name
                            patient.workingDiagnosisICD = result.icdCode
                            touch()
                            icdQuery = "\(result.icdCode) \(result.name)"
                            icdSuggestions = []
                        }
                    }
                } header: {
                    HStack(spacing: 6) {
                        Image(systemName: "brain.head.profile").foregroundStyle(.purple)
                        Text("Suggested Differentials")
                            .font(.caption.weight(.semibold))
                        Spacer()
                        Button {
                            refreshBayesian()
                        } label: {
                            Image(systemName: "arrow.clockwise")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        .buttonStyle(.plain)
                    }
                } footer: {
                    Text("Based on CC · SOCRATES · PMH · Exam · Ix · Age/Sex. Apply to confirm.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }

            // ── AutoFunction Action Panel ──────────────────────────────────
            let visibleActions = pipeline.filteredAutoActions(for: patient.visitType)
            if !visibleActions.isEmpty {
                Section {
                    ForEach(visibleActions.prefix(6)) { action in
                        AutoActionRow(action: action)
                    }
                } header: {
                    HStack(spacing: 6) {
                        Image(systemName: "wand.and.sparkles").foregroundStyle(.indigo)
                        Text("Clinical Actions")
                            .font(.caption.weight(.semibold))
                        Spacer()
                        if pipeline.isRunning {
                            ProgressView().scaleEffect(0.7)
                        }
                    }
                } footer: {
                    Text("Deterministic pipeline — SOCRATES · Exam · Ix · Vitals trend · Decision network.")
                        .font(.caption2).foregroundStyle(.secondary)
                }
            }

            // ── DBN Trajectory Panel ───────────────────────────────────────
            if !pipeline.trajectories.isEmpty {
                Section {
                    ForEach(pipeline.trajectories) { traj in
                        TrajectoryRow(trajectory: traj)
                    }
                } header: {
                    HStack(spacing: 6) {
                        Image(systemName: "chart.line.uptrend.xyaxis").foregroundStyle(.orange)
                        Text("Disease Trajectories (12h projection)")
                            .font(.caption.weight(.semibold))
                    }
                }
            }

            // ── Value of Information Panel ─────────────────────────────────
            if !pipeline.informationItems.isEmpty {
                Section {
                    ForEach(Array(pipeline.informationItems.prefix(5))) { item in
                        VOIRow(item: item,
                               alreadyResulted: patient.investigations.contains {
                                   $0.status == .resulted &&
                                   $0.name.lowercased().contains(item.name.lowercased())
                               })
                    }
                } header: {
                    HStack(spacing: 6) {
                        Image(systemName: "lightbulb.min").foregroundStyle(.yellow)
                        Text("Highest-Value Next Investigations (EVPI)")
                            .font(.caption.weight(.semibold))
                    }
                } footer: {
                    Text("Expected value of perfect information — ranked by bits of diagnostic uncertainty resolved.")
                        .font(.caption2).foregroundStyle(.secondary)
                }
            }

            Section {
                HStack {
                    Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                    TextField("Search ICD-10 codes or diagnosis", text: $icdQuery)
                        .autocorrectionDisabled()
                        .accessibilityIdentifier("consult.dx.search")
                        .onChange(of: icdQuery) { _, q in
                            icdSuggestions = q.count >= 2 ? ClinicalSearchService.searchICD(q) : []
                        }
                    if !icdQuery.isEmpty {
                        Button { icdQuery = ""; icdSuggestions = [] } label: {
                            Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                        }
                    }
                }

                ForEach(icdSuggestions.prefix(6)) { icd in
                    Button {
                        patient.workingDiagnosis = icd.description
                        patient.workingDiagnosisICD = icd.code
                        touch()
                        icdQuery = "\(icd.code) \(icd.description)"
                        icdSuggestions = []
                    } label: {
                        HStack {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(icd.description).font(.subheadline).foregroundStyle(.primary)
                                Text(icd.code).font(.caption.monospaced()).foregroundStyle(.secondary)
                            }
                            Spacer()
                            Text(icd.category).font(.caption2).foregroundStyle(.tertiary)
                        }
                    }
                    .accessibilityIdentifier("consult.dx.suggestion")
                }

                if let dx = patient.workingDiagnosis {
                    HStack {
                        Image(systemName: "stethoscope").foregroundStyle(AMColor.accent)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(dx).font(.subheadline.weight(.medium))
                            if let icd = patient.workingDiagnosisICD {
                                Text(icd).font(.caption.monospaced()).foregroundStyle(.secondary)
                            }
                        }
                        Spacer()
                        Button("Clear") {
                            patient.workingDiagnosis = nil; patient.workingDiagnosisICD = nil
                            touch(); icdQuery = ""
                        }.font(.caption).foregroundStyle(.red)
                    }
                    Label("Radiates to: Notes · Prescriptions · Billing",
                          systemImage: "arrow.triangle.branch")
                        .font(.caption).foregroundStyle(AMColor.accent)
                }
            } header: {
                sectionHeader("Working Diagnosis", icon: "stethoscope",
                              filled: patient.workingDiagnosis != nil)
            }
        }
    }


}
