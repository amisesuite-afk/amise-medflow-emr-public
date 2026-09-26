// ClinicalScoresView+DecisionRuleForms.swift
// Input forms for the decision rules added with ios-outcomes-calculators: STONE (ureteric stone),
// Ottawa ankle and knee, Canadian CT head, NEXUS, Canadian C-spine, San Francisco syncope rule and
// the Canadian syncope risk score. Each is a checklist (the web's DecisionRuleCard has the same items);
// a value the record answered is ticked and marked "from record" (PatientScoreAutoPopulator+
// DecisionRules.swift) and the clinician reviews every item before saving. Saving stores the value on
// the patient (ScorePersistence), where the Bayesian engine reads it as the rule's band.

import SwiftUI

extension ClinicalScoresView {

    /// The form of a decision-rule calculator, or nil for every other score (formBodyByCategory).
    // AnyView on purpose — see formBodyByCategory.
    func decisionRuleFormBody(_ score: ActiveScore) -> AnyView? {
        switch score {
        case .stoneUreteric:   return AnyView(stoneUretericForm)
        case .ottawaAnkle:     return AnyView(ottawaAnkleForm)
        case .ottawaKnee:      return AnyView(ottawaKneeForm)
        case .canadianCTHead:  return AnyView(canadianCTHeadForm)
        case .nexus:           return AnyView(nexusForm)
        case .canadianCSpine:  return AnyView(canadianCSpineForm)
        case .sfSyncope:       return AnyView(sfSyncopeForm)
        case .canadianSyncope: return AnyView(canadianSyncopeForm)
        default:               return nil
        }
    }

    // MARK: - Helpers

    var fromRecordBadge: some View {
        Text("from record")
            .scaledFont(size: 9, weight: .semibold)
            .foregroundStyle(.teal)
            .padding(.horizontal, 5)
            .padding(.vertical, 2)
            .background(.teal.opacity(0.12), in: Capsule())
            .dynamicTypeSize(...DynamicTypeSize.xxxLarge)
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("Pre-filled from the record")
    }

    /// A checklist item; "from record" when the record pre-filled it (`autoFill`, key = the input
    /// property name).
    func ruleToggle(_ label: String, binding: Binding<Bool>, points: String, key: String) -> some View {
        let fromRecord = autoFill.isAuto(key)
        return Toggle(isOn: binding) {
            HStack(spacing: 6) {
                Text(label)
                    .font(.subheadline)
                if fromRecord { fromRecordBadge }
                Spacer()
                Text(points)
                    .font(.caption.weight(.semibold).monospacedDigit())
                    .foregroundStyle(binding.wrappedValue ? (fromRecord ? .teal : AMColor.accent) : .secondary)
            }
        }
        .toggleStyle(.switch)
        .tint(fromRecord ? .teal : AMColor.accent)
        .padding(.vertical, 2)
    }

    /// A choice item (segmented), options as (value, label).
    func rulePicker(_ label: String, selection: Binding<Int>, options: [(Int, String)], key: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Text(label)
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.secondary)
                    .textCase(.uppercase)
                if autoFill.isAuto(key) { fromRecordBadge }
            }
            Picker(label, selection: selection) {
                ForEach(0..<options.count, id: \.self) { idx in
                    Text(options[idx].1).tag(options[idx].0)
                }
            }
            .pickerStyle(.segmented)
        }
        .padding(.vertical, 2)
    }

    func ruleApplies(_ text: String) -> some View {
        Text(text)
            .font(.caption)
            .foregroundStyle(.secondary)
            .fixedSize(horizontal: false, vertical: true)
            .padding(.bottom, 4)
    }

    // MARK: - STONE score (ureteric stone)

    private var stoneUretericForm: some View {
        VStack(alignment: .leading, spacing: 6) {
            ruleApplies("Adult with flank pain: probability of an uncomplicated ureteric stone (Moore 2014). Derived in the USA; the origin item was not validated in Caribbean populations. Not the local 'Stone CT features' score.")
            ruleToggle("Male sex", binding: $stoneUretericI.male, points: "+2", key: "male")
            rulePicker("Duration of pain", selection: $stoneUretericI.timing,
                       options: [(0, "> 24 h (0)"), (1, "6–24 h (+1)"), (2, "< 6 h (+3)")], key: "timing")
            ruleToggle("Origin: non-black (as derived)", binding: $stoneUretericI.nonBlack, points: "+3", key: "nonBlack")
            rulePicker("Nausea / vomiting", selection: $stoneUretericI.nausea,
                       options: [(0, "None (0)"), (1, "Nausea (+1)"), (2, "Vomiting (+2)")], key: "nausea")
            ruleToggle("Haematuria (microscopic or dipstick)", binding: $stoneUretericI.haematuria, points: "+3", key: "haematuria")
        }
        .onChange(of: stoneUretericI) { _, _ in recalculate() }
    }

    // MARK: - Ottawa ankle and foot rules

    private var ottawaAnkleForm: some View {
        VStack(alignment: .leading, spacing: 6) {
            ruleApplies("Acute ankle or midfoot injury, adults (validated in children over 5). Tenderness means bone tenderness at the posterior edge or tip of the malleolus (distal 6 cm).")
            sectionHeader("Malleolar zone")
            ruleToggle("Lateral malleolus bone tenderness", binding: $ottawaAnkleI.lateralMalleolus, points: "X-ray", key: "lateralMalleolus")
            ruleToggle("Medial malleolus bone tenderness", binding: $ottawaAnkleI.medialMalleolus, points: "X-ray", key: "medialMalleolus")
            sectionHeader("Midfoot zone")
            ruleToggle("Base of fifth metatarsal tenderness", binding: $ottawaAnkleI.fifthMetatarsalBase, points: "X-ray", key: "fifthMetatarsalBase")
            ruleToggle("Navicular tenderness", binding: $ottawaAnkleI.navicular, points: "X-ray", key: "navicular")
            sectionHeader("Weight bearing")
            ruleToggle("Unable to take 4 steps, after the injury and now", binding: $ottawaAnkleI.unableToBearWeight, points: "X-ray", key: "unableToBearWeight")
        }
        .onChange(of: ottawaAnkleI) { _, _ in recalculate() }
    }

    // MARK: - Ottawa knee rule

    private var ottawaKneeForm: some View {
        VStack(alignment: .leading, spacing: 6) {
            ruleApplies("Acute knee injury, adults 18 or over.")
            ruleToggle("Age 55 or over", binding: $ottawaKneeI.age55OrOver, points: "X-ray", key: "age55OrOver")
            ruleToggle("Isolated tenderness of the patella", binding: $ottawaKneeI.isolatedPatellaTenderness, points: "X-ray", key: "isolatedPatellaTenderness")
            ruleToggle("Tenderness of the head of the fibula", binding: $ottawaKneeI.fibularHeadTenderness, points: "X-ray", key: "fibularHeadTenderness")
            ruleToggle("Unable to flex to 90 degrees", binding: $ottawaKneeI.unableToFlex90, points: "X-ray", key: "unableToFlex90")
            ruleToggle("Unable to take 4 steps, after the injury and now", binding: $ottawaKneeI.unableToBearWeight, points: "X-ray", key: "unableToBearWeight")
        }
        .onChange(of: ottawaKneeI) { _, _ in recalculate() }
    }

    // MARK: - Canadian CT head rule

    private var canadianCTHeadForm: some View {
        VStack(alignment: .leading, spacing: 6) {
            ruleApplies("Minor head injury: GCS 13–15 with witnessed loss of consciousness, amnesia or disorientation; age 16 or over; not anticoagulated; no seizure. Otherwise use NICE NG232.")
            sectionHeader("High risk")
            ruleToggle("GCS below 15 two hours after the injury", binding: $canadianCTHeadI.gcsBelow15At2h, points: "High", key: "gcsBelow15At2h")
            ruleToggle("Suspected open or depressed skull fracture", binding: $canadianCTHeadI.suspectedOpenOrDepressedFracture, points: "High", key: "suspectedOpenOrDepressedFracture")
            ruleToggle("Any sign of basal skull fracture", binding: $canadianCTHeadI.basalSkullFractureSign, points: "High", key: "basalSkullFractureSign")
            ruleToggle("Vomiting twice or more", binding: $canadianCTHeadI.vomitingTwiceOrMore, points: "High", key: "vomitingTwiceOrMore")
            ruleToggle("Age 65 or over", binding: $canadianCTHeadI.age65OrOver, points: "High", key: "age65OrOver")
            sectionHeader("Medium risk")
            ruleToggle("Amnesia for 30 minutes or more before the impact", binding: $canadianCTHeadI.amnesiaBefore30min, points: "Medium", key: "amnesiaBefore30min")
            ruleToggle("Dangerous mechanism (pedestrian struck, ejected, fall > 3 ft or 5 stairs)", binding: $canadianCTHeadI.dangerousMechanism, points: "Medium", key: "dangerousMechanism")
        }
        .onChange(of: canadianCTHeadI) { _, _ in recalculate() }
    }

    // MARK: - NEXUS

    private var nexusForm: some View {
        VStack(alignment: .leading, spacing: 6) {
            ruleApplies("Blunt trauma with possible neck injury: imaging is not needed when none of the five is present.")
            ruleToggle("Posterior midline cervical tenderness", binding: $nexusI.midlineTenderness, points: "Image", key: "midlineTenderness")
            ruleToggle("Focal neurological deficit", binding: $nexusI.focalNeurologicalDeficit, points: "Image", key: "focalNeurologicalDeficit")
            ruleToggle("Altered alertness", binding: $nexusI.alteredAlertness, points: "Image", key: "alteredAlertness")
            ruleToggle("Intoxication", binding: $nexusI.intoxication, points: "Image", key: "intoxication")
            ruleToggle("Painful distracting injury", binding: $nexusI.distractingInjury, points: "Image", key: "distractingInjury")
        }
        .onChange(of: nexusI) { _, _ in recalculate() }
    }

    // MARK: - Canadian C-spine rule

    private var canadianCSpineForm: some View {
        VStack(alignment: .leading, spacing: 6) {
            ruleApplies("Alert (GCS 15), stable adults after blunt trauma with neck pain or a dangerous mechanism.")
            sectionHeader("High-risk factor (any: image)")
            ruleToggle("Age 65 or over", binding: $canadianCSpineI.age65OrOver, points: "Image", key: "age65OrOver")
            ruleToggle("Dangerous mechanism", binding: $canadianCSpineI.dangerousMechanism, points: "Image", key: "dangerousMechanism")
            ruleToggle("Paraesthesia in the extremities", binding: $canadianCSpineI.paraesthesiaInExtremities, points: "Image", key: "paraesthesiaInExtremities")
            sectionHeader("Low risk and movement")
            ruleToggle("A low-risk factor (simple rear-end collision, sitting in the department, walking at any time, delayed neck pain or no midline tenderness)",
                       binding: $canadianCSpineI.lowRiskFactor, points: "Needed", key: "lowRiskFactor")
            ruleToggle("Able to rotate the neck 45 degrees left and right", binding: $canadianCSpineI.ableToRotate45, points: "Needed", key: "ableToRotate45")
        }
        .onChange(of: canadianCSpineI) { _, _ in recalculate() }
    }

    // MARK: - San Francisco syncope rule

    private var sfSyncopeForm: some View {
        VStack(alignment: .leading, spacing: 6) {
            ruleApplies("Syncope: any CHESS criterion means a higher risk of a serious outcome within 7 days. Prognostic: it does not change the differential.")
            ruleToggle("History of congestive heart failure", binding: $sfSyncopeI.congestiveHeartFailure, points: "+1", key: "congestiveHeartFailure")
            ruleToggle("Haematocrit below 30 %", binding: $sfSyncopeI.haematocritBelow30, points: "+1", key: "haematocritBelow30")
            ruleToggle("Abnormal ECG (non-sinus rhythm or new changes)", binding: $sfSyncopeI.abnormalECG, points: "+1", key: "abnormalECG")
            ruleToggle("Shortness of breath", binding: $sfSyncopeI.shortnessOfBreath, points: "+1", key: "shortnessOfBreath")
            ruleToggle("Systolic BP below 90 mmHg at triage", binding: $sfSyncopeI.systolicBelow90, points: "+1", key: "systolicBelow90")
        }
        .onChange(of: sfSyncopeI) { _, _ in recalculate() }
    }

    // MARK: - Canadian syncope risk score

    private var canadianSyncopeForm: some View {
        VStack(alignment: .leading, spacing: 6) {
            ruleApplies("Adults after syncope: 30-day risk of a serious adverse event. Prognostic: it does not change the differential.")
            sectionHeader("Clinical evaluation")
            ruleToggle("Predisposition to vasovagal symptoms (warm crowded place, prolonged standing, fear, emotion, pain)",
                       binding: $canadianSyncopeI.vasovagalPredisposition, points: "−1", key: "vasovagalPredisposition")
            ruleToggle("History of heart disease", binding: $canadianSyncopeI.heartDisease, points: "+1", key: "heartDisease")
            ruleToggle("Any systolic BP below 90 or above 180 mmHg", binding: $canadianSyncopeI.abnormalSystolic, points: "+2", key: "abnormalSystolic")
            sectionHeader("Investigations")
            ruleToggle("Troponin above the 99th centile", binding: $canadianSyncopeI.troponinRaised, points: "+2", key: "troponinRaised")
            ruleToggle("Abnormal QRS axis (below −30 or above 100 degrees)", binding: $canadianSyncopeI.abnormalQRSAxis, points: "+1", key: "abnormalQRSAxis")
            ruleToggle("QRS duration above 130 ms", binding: $canadianSyncopeI.qrsOver130, points: "+1", key: "qrsOver130")
            ruleToggle("Corrected QT above 480 ms", binding: $canadianSyncopeI.qtcOver480, points: "+2", key: "qtcOver480")
            rulePicker("Diagnosis in the emergency department", selection: $canadianSyncopeI.edDiagnosis,
                       options: [(0, "Neither (0)"), (1, "Vasovagal (−2)"), (2, "Cardiac (+2)")], key: "edDiagnosis")
        }
        .onChange(of: canadianSyncopeI) { _, _ in recalculate() }
    }
}
