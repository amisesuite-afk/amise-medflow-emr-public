// ClinicalScoringEngine+Neurology.swift
// Neurology / Stroke scoring
// No AI, no network calls — HIPAA-safe.

import Foundation

extension ClinicalScoringEngine {
    // MARK: - NIHSS (NIH Stroke Scale)

    static func nihss(_ i: NIHSSInput) -> ClinicalScore {
        let total = i.consciousness + i.locQuestions + i.locCommands +
                    i.gazeDeviation + i.visualFields + i.facialPalsy +
                    i.motorArmLeft + i.motorArmRight +
                    i.motorLegLeft + i.motorLegRight +
                    i.limbAtaxia + i.sensory + i.language +
                    i.dysarthria + i.extinction

        let (risk, interp, recs, flags): (ScoreRisk, String, [String], [String]) = switch total {
        case 0:
            (.low, "No stroke deficit — NIHSS 0",
             ["Review for TIA; consider DWI-MRI if symptoms resolved (ABCD² ≥4)",
              "Assess for AF, carotid disease, and modifiable stroke risk factors",
              "Early dual antiplatelet (if TIA/minor stroke): aspirin + clopidogrel for 21 days"],
             [])
        case 1...4:
            (.low, "Minor stroke — NIHSS 1–4",
             ["Admit to stroke unit for monitoring and investigation",
              "Brain CT/MRI within 24 h; MRI DWI preferred for lacunar/posterior fossa lesions",
              "Antiplatelet therapy or anticoagulation per aetiology (AF → NOAC; non-cardioembolic → antiplatelet)",
              "Swallowing screen before oral intake; physiotherapy and OT assessment",
              "Early secondary prevention: BP, lipid, glucose management"],
             [])
        case 5...15:
            (.moderate, "Moderate stroke — NIHSS 5–15",
             ["Immediate stroke unit admission; continuous monitoring",
              "IV alteplase if within 4.5 h of onset and eligible (NIHSS 4–25 typical range)",
              "Consider mechanical thrombectomy if large vessel occlusion (NIHSS ≥6) within 24 h",
              "CT/CTA or MRI/MRA urgently; carotid imaging if anterior circulation stroke",
              "Dysphagia assessment; NG feeding if unsafe swallow",
              "Neurological rehabilitation team referral within 24–48 h"],
             [])
        case 16...20:
            (.high, "Moderate-severe stroke — NIHSS 16–20",
             ["Immediate stroke unit or HDU admission; airway protection assessment",
              "Urgent thrombectomy evaluation for large vessel occlusion",
              "Alteplase if within 4.5 h and no contraindications",
              "Neurosurgical opinion for cerebellar or malignant MCA infarction",
              "Intensive rehabilitation planning; speech and language therapy",
              "Family counselling regarding functional prognosis"],
             ["NIHSS 16–20 — moderate-severe stroke; urgent thrombectomy evaluation and stroke unit care required"])
        default:
            (.high, "Severe stroke — NIHSS ≥21",
             ["ICU or stroke HDU; early discussion with neurosurgical team",
              "Decompressive hemicraniectomy for malignant MCA infarction (age <60 within 48 h)",
              "Consider thrombectomy if LVO identified and within intervention window",
              "Palliative care consultation if appropriate given stroke severity and premorbid status",
              "Full rehabilitation potential assessment after initial stabilisation",
              "Hydration, aspiration pneumonia prevention, pressure care, anticoagulation for DVT prophylaxis"],
             ["NIHSS ≥21 — severe stroke; high mortality and disability risk; ICU-level care and early neurosurgical consultation required"])
        }

        let items: [ScoredItem] = [
            ScoredItem(label: "Level of consciousness (\(["Alert","Not alert/arousable","Obtunded","Unresponsive"][min(i.consciousness,3)]))", points: Double(i.consciousness), present: i.consciousness > 0),
            ScoredItem(label: "LOC questions (month/age) (\(["Both correct","One correct","Neither"][min(i.locQuestions,2)]))", points: Double(i.locQuestions), present: i.locQuestions > 0),
            ScoredItem(label: "LOC commands (open/close eyes, grip) (\(["Both","One","Neither"][min(i.locCommands,2)]))", points: Double(i.locCommands), present: i.locCommands > 0),
            ScoredItem(label: "Gaze (\(["Normal","Partial palsy","Forced deviation"][min(i.gazeDeviation,2)]))", points: Double(i.gazeDeviation), present: i.gazeDeviation > 0),
            ScoredItem(label: "Visual fields (\(["No loss","Partial hemianopia","Complete hemianopia","Bilateral"][min(i.visualFields,3)]))", points: Double(i.visualFields), present: i.visualFields > 0),
            ScoredItem(label: "Facial palsy (\(["Normal","Minor","Partial","Complete"][min(i.facialPalsy,3)]))", points: Double(i.facialPalsy), present: i.facialPalsy > 0),
            ScoredItem(label: "Motor arm left (\(["No drift","Drift <10s","Effort vs gravity","No effort","No movement"][min(i.motorArmLeft,4)]))", points: Double(i.motorArmLeft), present: i.motorArmLeft > 0),
            ScoredItem(label: "Motor arm right (\(["No drift","Drift <10s","Effort vs gravity","No effort","No movement"][min(i.motorArmRight,4)]))", points: Double(i.motorArmRight), present: i.motorArmRight > 0),
            ScoredItem(label: "Motor leg left (\(["No drift","Drift <5s","Effort vs gravity","No effort","No movement"][min(i.motorLegLeft,4)]))", points: Double(i.motorLegLeft), present: i.motorLegLeft > 0),
            ScoredItem(label: "Motor leg right (\(["No drift","Drift <5s","Effort vs gravity","No effort","No movement"][min(i.motorLegRight,4)]))", points: Double(i.motorLegRight), present: i.motorLegRight > 0),
            ScoredItem(label: "Limb ataxia (\(["Absent","One limb","Two limbs"][min(i.limbAtaxia,2)]))", points: Double(i.limbAtaxia), present: i.limbAtaxia > 0),
            ScoredItem(label: "Sensory (\(["Normal","Mild-moderate loss","Severe/absent"][min(i.sensory,2)]))", points: Double(i.sensory), present: i.sensory > 0),
            ScoredItem(label: "Language (\(["No aphasia","Mild aphasia","Severe aphasia","Mute/global"][min(i.language,3)]))", points: Double(i.language), present: i.language > 0),
            ScoredItem(label: "Dysarthria (\(["Normal","Mild-moderate","Severe/intubated"][min(i.dysarthria,2)]))", points: Double(i.dysarthria), present: i.dysarthria > 0),
            ScoredItem(label: "Extinction/inattention (\(["None","One modality","Profound"][min(i.extinction,2)]))", points: Double(i.extinction), present: i.extinction > 0)
        ]

        return ClinicalScore(
            systemName: "NIH Stroke Scale",
            abbreviation: "NIHSS",
            score: Double(total), maxScore: 42,
            risk: risk,
            interpretation: "NIHSS \(total) — \(interp)",
            recommendations: recs,
            items: items,
            redFlags: flags,
            evidenceNote: "Brott T et al. Stroke 1989;20:864–870. Adams HP et al. Stroke 1999;30:1765–1769."
        )
    }

    // MARK: - modified Rankin Scale (mRS)

    struct MRSInput: Equatable {
        // modified Rankin Scale (van Swieten JC et al. Stroke 1988;19:604–607)
        // 0–6 ordinal scale of stroke-related disability / dependence
        // 0 = no symptoms; 1 = no significant disability; 2 = slight disability;
        // 3 = moderate disability; 4 = moderately severe disability;
        // 5 = severe disability; 6 = dead
        var level: Int = 0   // 0–6
    }

    static func mRS(_ i: MRSInput) -> ClinicalScore {
        let level = max(0, min(6, i.level))

        let (risk, interp, recs, flags): (ScoreRisk, String, [String], [String]) = switch level {
        case 0:
            (.low, "No symptoms",
             ["Confirm aetiology and initiate secondary prevention (antiplatelet/anticoagulation, statin, antihypertensive)",
              "Risk factor optimisation: BP <130/80, LDL-C <1.8 mmol/L in stroke/TIA",
              "Outpatient neurology or stroke follow-up at 1 month"],
             [])
        case 1:
            (.low, "No significant disability despite symptoms — all usual duties and activities carried out",
             ["Secondary prevention as above",
              "Reassure re: functional recovery; lifestyle counselling (exercise, diet, smoking cessation)",
              "Driving may be permitted subject to local DVLA / transport authority guidelines"],
             [])
        case 2:
            (.low, "Slight disability — unable to carry out some previous activities but independent without assistance in own affairs",
             ["Outpatient physiotherapy and occupational therapy assessment",
              "Driving restrictions: assess individually; typically restricted ≥1 month post-stroke",
              "Cognitive assessment if memory or executive function concerns",
              "Secondary prevention and risk factor control"],
             [])
        case 3:
            (.moderate, "Moderate disability — requiring some help but able to walk without assistance",
             ["Inpatient or community stroke rehabilitation programme",
              "OT home assessment for adaptive equipment and environmental modification",
              "Speech and language therapy if communication or swallowing affected",
              "Carer support services referral",
              "Antispasticity management if upper/lower limb spasticity present"],
             [])
        case 4:
            (.high, "Moderately severe disability — unable to walk and attend to own bodily needs without assistance",
             ["Inpatient rehabilitation or specialist nursing facility",
              "Multidisciplinary stroke team: physiotherapy, OT, SLT, dietetics, psychology",
              "Spasticity management, pressure ulcer prevention, deep vein thrombosis prophylaxis",
              "Carer training and community discharge planning",
              "Depression and post-stroke emotional lability screening (PHQ-9)"],
             ["mRS 4 — high care dependency; discharge planning must address 24-hour care needs"])
        case 5:
            (.high, "Severe disability — bedridden, incontinent and requiring constant nursing care and attention",
             ["Ongoing inpatient or long-term care placement",
              "Goal-setting with family: rehabilitation potential vs. palliative approach",
              "Enteral nutrition if dysphagia prevents adequate oral intake",
              "Spasticity, contracture, and pressure care intensive management",
              "Palliative care team involvement if appropriate"],
             ["mRS 5 — severe dependency; high mortality within 1 year; multi-disciplinary goals-of-care discussion required"])
        default: // 6
            (.high, "Dead",
             ["Document cause of death; complete relevant notifications",
              "Offer family bereavement support",
              "Mortality and morbidity review if stroke care quality concerns"],
             ["mRS 6 — patient deceased"])
        }

        let labels = ["No symptoms",
                      "No significant disability",
                      "Slight disability — independent",
                      "Moderate disability — walks unaided",
                      "Moderately severe disability — needs assistance",
                      "Severe disability — fully dependent",
                      "Dead"]
        let items = [ScoredItem(label: "mRS Level \(level): \(labels[level])", points: Double(level), present: true)]

        return ClinicalScore(
            systemName: "modified Rankin Scale",
            abbreviation: "mRS \(level)",
            score: Double(level), maxScore: 6,
            risk: risk,
            interpretation: "mRS \(level) — \(interp)",
            recommendations: recs,
            items: items,
            redFlags: flags,
            evidenceNote: "van Swieten JC et al. Stroke 1988;19:604–607. Rankin J. Scott Med J 1957;2:200–215."
        )
    }


}
