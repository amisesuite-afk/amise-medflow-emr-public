// PatientScoreAutoPopulator+TG18Organ.swift
// TG18 Grade III organ dysfunction read from the record for the Tokyo cholecystitis and
// cholangitis auto-fill (clinical validation 2026-09: the auto-fill ignored SBP 82 on
// noradrenaline, a reduced AVPU, creatinine 238 µmol/L and platelets 88 and returned Grade II, so
// a patient in septic shock was under-graded until every organ box was ticked by hand).
// Deterministic; negation-aware free text; the clinician can untick any field.

import Foundation

extension PatientScoreAutoPopulator {

    /// The TG18 organ-dysfunction criteria present in the record. Respiratory dysfunction
    /// (PaO₂/FiO₂ < 300) is never inferred from SpO₂.
    struct TG18OrganDysfunction {
        var cardiovascular = false   // hypotension needing vasopressors (SBP < 90 used as the record proxy)
        var neurological = false     // reduced level of consciousness (ACVPU other than Alert)
        var renal = false            // oliguria or creatinine > 2.0 mg/dL (177 µmol/L)
        var hepatic = false          // PT-INR > 1.5
        var haematological = false   // platelets < 100 × 10⁹/L
    }

    static func tg18OrganDysfunction(patient: Patient) -> TG18OrganDysfunction {
        var o = TG18OrganDysfunction()
        let vitals = patient.latestVitals
        let text = NegationMatcher.joinClauses([patient.examGeneral, patient.examOther, patient.hpi, patient.assessmentText])

        if let sbp = vitals?.bpSystolic, sbp < 90 { o.cardiovascular = true }
        if NegationMatcher.containsAnyAffirmed(text, ["noradrenaline", "norepinephrine", "vasopressor", "inotrope"]) {
            o.cardiovascular = true
        }
        if let avpu = vitals?.avpu, avpu != .alert { o.neurological = true }
        if let cr = patient.latestLab(named: ["creatinine"]) {
            let mgdl = cr > 20 ? cr / 88.4 : cr
            if mgdl > 2.0 { o.renal = true }
        }
        if NegationMatcher.containsAnyAffirmed(text, ["oliguria", "oliguric", "anuria", "anuric"]) { o.renal = true }
        if let inr = patient.latestLab(named: ["inr", "pt-inr"]), inr > 1.5 { o.hepatic = true }
        if let plt = patient.latestLab(named: ["platelets", "platelet count"]) {
            let perNanolitre = plt > 1000 ? plt / 1000 : plt
            if perNanolitre < 100 { o.haematological = true }
        }
        return o
    }
}
