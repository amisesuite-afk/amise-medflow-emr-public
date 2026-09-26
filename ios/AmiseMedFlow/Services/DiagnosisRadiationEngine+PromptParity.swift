import Foundation

// MARK: - Diagnosis radiation: card-level web prompt-parity adjustments (web-last-gaps)
//
// DRIFT NOTE: card-level half of the iOS twin of the web-last-gaps prompt changes in
// `artifacts/dashboard/src/lib/clinical-inference.ts` (the line rules are in
// `PlanSafetyFilter+PromptParity.swift`; vectors in `AmiseMedFlowTests/WebLastGapsParityTests.swift`
// port `artifacts/dashboard/src/lib/__tests__/web-last-gaps.test.ts`). Change them together.
//
//   - Operative cards (cholecystectomy, appendicectomy, hernia repair; adults, not emergency
//     cards): the web operative-template lines — fasting 6 h food / 2 h clear fluids (AAGBI 2010;
//     ESA 2011), SIGN 104 / HerniaSurge 2018 antibiotic prophylaxis, NSAID exclusions (NICE NG148;
//     BNF), no post-operative antibiotics after TG18 Grade I–II cholecystectomy, cirrhosis / ascites
//     before a hernia repair (EHS/AHS 2020). The renally adjusted VTE line is the patient-specific
//     NICE NG89 line (PlanSafetyFilter.vteNote).
//   - GI bleeding cards: when the patient is haemodynamically stable (a recorded SBP or heart rate,
//     no web instability criterion) the resuscitation / cross-match lines give way to the
//     Glasgow-Blatchford / Oakland risk stratification (BSG 2019; NICE CG141; ESGE 2021).
//   - Investigations: D-dimer and occult-malignancy CT in pregnancy; CT abdomen / pelvis in a
//     child or in pregnancy — ultrasound first (RCOG GTG 37a/b; ACOG CO 723; WSES 2020; RCR iRefer).
// Applied by `applySafety` before the line filters, so every line added here is filtered too.

extension DiagnosisRadiationEngine {

    /// The card after the web-last-gaps adjustments for this patient.
    static func promptParityCard(_ r: DiagnosisRadiation, _ c: RadiationContext) -> DiagnosisRadiation {
        let s = PlanSafetyFilter.signals(c)
        var plan = r.planTemplate
        var investigations = r.investigations

        // GI bleeding: stable → risk stratification, no routine cross-match.
        if r.conditionName == "Upper GI Bleeding" || r.conditionName == "Lower GI Bleeding", PlanSafetyFilter.giBleedStable(s) {
            var lines = plan.components(separatedBy: "\n")
            if r.conditionName == "Upper GI Bleeding",
               let i = lines.firstIndex(where: { $0.hasPrefix("- Resuscitate: two large-bore cannulae") }) {
                lines[i] = "- " + PlanSafetyFilter.stableUpperGIBleedLine
                lines.insert("- Restrictive red-cell transfusion only if needed — threshold Hb 70 g/L (80 g/L with cardiovascular disease) (ESGE 2021; NICE CG141)", at: i + 1)
            } else if r.conditionName == "Lower GI Bleeding",
                      let i = lines.firstIndex(where: { $0.hasPrefix("- Oakland score ≤8") }) {
                lines[i] = "- " + PlanSafetyFilter.stableLowerGIBleedLine
            }
            plan = lines.joined(separator: "\n")
            investigations = investigations.map { (inv: DiagnosisRadiation.SuggestedInvestigation) -> DiagnosisRadiation.SuggestedInvestigation in
                guard inv.name.lowercased().contains("crossmatch") else { return inv }
                return DiagnosisRadiation.SuggestedInvestigation(name: inv.name.replacingOccurrences(of: "crossmatch", with: "group and save (cross-match only if haemodynamically significant)"),
                             category: inv.category, rationale: inv.rationale)
            }
        }

        // Operative-template lines (adults; not on recognise-and-redirect cards).
        let extra = operativeTemplateLines(r, s)
        if !extra.isEmpty {
            plan = plan.trimmingCharacters(in: .newlines) + "\n" + extra.joined(separator: "\n") + "\n"
        }

        // Investigations in pregnancy and in children.
        investigations = investigations.map { (inv: DiagnosisRadiation.SuggestedInvestigation) -> DiagnosisRadiation.SuggestedInvestigation in
            let text = "\(inv.name) \(inv.rationale)".lowercased()
            var rationale = inv.rationale
            if s.pregnancy == .pregnant {
                if text.contains("d-dimer") && !text.contains("not recommended") && !text.contains("not used") {
                    rationale += " — PREGNANCY: D-dimer is not recommended to diagnose VTE in pregnancy (it is unhelpful in pregnancy — RCOG GTG 37a/b); go straight to imaging."
                } else if text.contains("occult malignan") {
                    rationale += " — PREGNANCY: no ionising occult-malignancy screen; ultrasound first, MRI if needed, only for a specific clinical question (ACOG CO 723, 2017)."
                }
            }
            if s.child, PlanSafetyFilter.test(#"\bct\b[^\n]{0,40}(abdo|pelvi)"#, text),
               !PlanSafetyFilter.test(#"inconclusive|non-diagnostic|equivocal|\bif us\b|\bif uss\b|child|paediatric"#, text) {
                rationale += " — CHILD: ultrasound first; CT only if ultrasound is inconclusive and the diagnosis is still uncertain (WSES 2020; RCR iRefer)."
            }
            return rationale == inv.rationale ? inv : DiagnosisRadiation.SuggestedInvestigation(name: inv.name, category: inv.category, rationale: rationale)
        }

        return DiagnosisRadiation(
            conditionName: r.conditionName, icd10Primary: r.icd10Primary, investigations: investigations,
            planTemplate: plan, billingCodes: r.billingCodes, consentCategory: r.consentCategory,
            urgencyNote: r.urgencyNote, redFlags: r.redFlags, followUp: r.followUp,
            guidelineReference: r.guidelineReference, scoringCriteria: r.scoringCriteria,
            referralSuggestions: r.referralSuggestions)
    }

    /// The web operative-template lines for a cholecystectomy, appendicectomy or hernia card.
    static func operativeTemplateLines(_ r: DiagnosisRadiation, _ s: PlanSafetyFilter.Signals) -> [String] {
        guard !s.child, !r.planTemplate.contains("RECOGNISE AND REDIRECT"),
              let consent = r.consentCategory?.lowercased() else { return [] }
        let name = r.conditionName.lowercased()
        var lines: [String] = []
        if consent.contains("cholecystectomy") {
            lines = [PlanSafetyFilter.fastingLine,
                     PlanSafetyFilter.lapCholeProphylaxisLine(highRisk: PlanSafetyFilter.lapCholeHighRisk(s)),
                     PlanSafetyFilter.analgesiaLine(s)]
            if PlanSafetyFilter.acuteCholecystitis(s) { lines.append(PlanSafetyFilter.postCholecystectomyAntibioticsLine) }
        } else if consent.contains("appendicectomy") {
            lines = [PlanSafetyFilter.analgesiaLine(s)]
        } else if name.contains("hernia") {
            let cirrhosis = PlanSafetyFilter.cirrhosisAscites(s)
            if cirrhosis { lines.append(PlanSafetyFilter.cirrhosisHerniaLine) }
            lines += [PlanSafetyFilter.fastingLine,
                      PlanSafetyFilter.herniaProphylaxisLine(incarcerated: PlanSafetyFilter.herniaIncarcerated(s)),
                      PlanSafetyFilter.analgesiaLine(s)]
            if cirrhosis { lines.append(PlanSafetyFilter.cirrhosisHerniaInpatientLine) }
        }
        guard !lines.isEmpty else { return [] }
        return ["- Peri-operative (patient-specific):"] + lines.map { "- \($0)" }
    }
}
