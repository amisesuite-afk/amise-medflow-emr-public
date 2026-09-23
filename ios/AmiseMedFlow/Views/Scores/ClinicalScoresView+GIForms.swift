// ClinicalScoresView+GIForms.swift
// GI / hepatic / endoscopy score input forms
// scoreToggle / sectionHeader / recalculate() are internal members
// of ClinicalScoresView; @State vars are also internal.

import SwiftUI

extension ClinicalScoresView {

    @ViewBuilder func giFormBody(_ score: ActiveScore) -> some View {
        switch score {
        case .rockall:        rockallForm
        case .blatchford:     blatchfordForm
        case .aims65:         aims65Form
        case .forrest:        forrestForm
        case .haps:           hapsForm
        case .glasgowImrie:   glasgowImrieForm
        case .albi:           albiForm
        case .auditC:         auditCForm
        case .oakland:        oaklandForm
        default:              giFormBodyB(score)
        }
    }

    @ViewBuilder func giFormBodyB(_ score: ActiveScore) -> some View {
        switch score {
        case .kingsCriteria:  kingsCriteriaForm
        case .losAngeles:     losAngelesForm
        case .meld3:          meld3Form
        case .trueloveWitts:  trueloveWittsForm
        case .harveyBradshaw: harveyBradshawForm
        case .maddrey:        maddreyForm
        case .manning:        manningForm
        case .fongCrs:        fongCrsForm
        default:              EmptyView()
        }
    }


    // MARK: - Rockall

    private var rockallForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            sectionHeader("Age")
            Picker("Age group", selection: $rock.ageGroup) {
                Text("< 60 years (0)").tag(RockallInput.AgeGroup.under60)
                Text("60–79 years (+1)").tag(RockallInput.AgeGroup.sixtyTo79)
                Text("≥ 80 years (+2)").tag(RockallInput.AgeGroup.over80)
            }
            .pickerStyle(.segmented)

            sectionHeader("Shock")
            Picker("Shock", selection: $rock.shock) {
                Text("None (0)").tag(RockallInput.ShockStatus.none)
                Text("Pulse >100, SBP ≥100 (+1)").tag(RockallInput.ShockStatus.pulse100SBPOver100)
                Text("SBP <100 (+2)").tag(RockallInput.ShockStatus.sbpBelow100)
            }
            .pickerStyle(.segmented)

            sectionHeader("Comorbidity")
            Picker("Comorbidity", selection: $rock.comorbidity) {
                Text("None (0)").tag(RockallInput.Comorbidity.none)
                Text("CCF / IHD / Major (+2)").tag(RockallInput.Comorbidity.anyMajor)
                Text("Renal / Liver / Malignancy (+3)").tag(RockallInput.Comorbidity.renalOrLiverOrMalignancy)
            }
            .pickerStyle(.segmented)

            sectionHeader("Endoscopy Diagnosis (post-scope)")
            Picker("Diagnosis", selection: $rock.diagnosis) {
                Text("Mallory-Weiss / no lesion (0)").tag(RockallInput.EndoscopyDiagnosis.malloryWeissOrNoLesion)
                Text("Other diagnosis (+1)").tag(RockallInput.EndoscopyDiagnosis.allOtherDiagnoses)
                Text("Upper GI malignancy (+2)").tag(RockallInput.EndoscopyDiagnosis.upperGIMalignancy)
            }
            .pickerStyle(.segmented)

            scoreToggle("Major stigmata of haemorrhage", binding: $rock.majorStigmata, points: "+2")
        }
        .onChange(of: rock) { _, _ in recalculate() }
    }


    // MARK: - Glasgow-Blatchford

    private var blatchfordForm: some View {
        VStack(alignment: .leading, spacing: 12) {
            if autoFill.isAuto("isMale") || autoFill.isAuto("bloodUreaNitrogen")
                || autoFill.isAuto("haemoglobin") || autoFill.isAuto("sbp") {
                HStack(spacing: 4) {
                    Image(systemName: "wand.and.stars").font(.caption2).foregroundStyle(.teal)
                    Text("Sex, BUN, Hb, and SBP pre-filled from patient record — review values.")
                        .font(.caption2).foregroundStyle(.teal)
                }
                .padding(.horizontal, 8).padding(.vertical, 4)
                .background(.teal.opacity(0.1), in: RoundedRectangle(cornerRadius: 6))
            }
            scoreToggle("Patient is male", binding: $blatchI.isMale, points: "", autoKey: "isMale")

            sectionHeader("Blood Urea Nitrogen")
            Picker("BUN", selection: $blatchI.bloodUreaNitrogen) {
                Text("<6.5 mmol/L (0)").tag(BlatchfordInput.BlatchfordBUN.under6_5)
                Text("6.5–7.9 (2)").tag(BlatchfordInput.BlatchfordBUN.bun6_5to7_9)
                Text("8–9.9 (3)").tag(BlatchfordInput.BlatchfordBUN.bun8to9_9)
                Text("10–24.9 (4)").tag(BlatchfordInput.BlatchfordBUN.bun10to24_9)
                Text("≥25 (6)").tag(BlatchfordInput.BlatchfordBUN.bunOver25)
            }
            .pickerStyle(.wheel)
            .frame(height: 100)

            sectionHeader("Haemoglobin")
            if blatchI.isMale {
                Picker("Hb (male)", selection: $blatchI.haemoglobin) {
                    Text("≥13 g/dL (0)").tag(BlatchfordInput.BlatchfordHb.male13plus)
                    Text("12–12.9 (1)").tag(BlatchfordInput.BlatchfordHb.male12to12_9)
                    Text("10–11.9 (3)").tag(BlatchfordInput.BlatchfordHb.male10to11_9)
                    Text("<10 (6)").tag(BlatchfordInput.BlatchfordHb.maleSub10)
                }
                .pickerStyle(.segmented)
            } else {
                Picker("Hb (female)", selection: $blatchI.haemoglobin) {
                    Text("≥12 g/dL (0)").tag(BlatchfordInput.BlatchfordHb.female12plus)
                    Text("10–11.9 (1)").tag(BlatchfordInput.BlatchfordHb.female10to11_9)
                    Text("<10 (6)").tag(BlatchfordInput.BlatchfordHb.femaleSub10)
                }
                .pickerStyle(.segmented)
            }

            sectionHeader("Systolic BP")
            Picker("SBP", selection: $blatchI.sbp) {
                Text(">109 mmHg (0)").tag(BlatchfordInput.BlatchfordSBP.over109)
                Text("100–109 (1)").tag(BlatchfordInput.BlatchfordSBP.sbp100to109)
                Text("90–99 (2)").tag(BlatchfordInput.BlatchfordSBP.sbp90to99)
                Text("<90 (3)").tag(BlatchfordInput.BlatchfordSBP.under90)
            }
            .pickerStyle(.segmented)

            scoreToggle("Heart rate >100 bpm", binding: $blatchI.heartRateOver100, points: "+1", autoKey: "heartRateOver100")
            scoreToggle("Melaena on presentation", binding: $blatchI.melaena, points: "+1")
            scoreToggle("Syncope", binding: $blatchI.syncope, points: "+2")
            scoreToggle("Hepatic disease", binding: $blatchI.hepaticDisease, points: "+2")
            scoreToggle("Cardiac failure", binding: $blatchI.cardiacFailure, points: "+2")
        }
        .onChange(of: blatchI) { _, _ in recalculate() }
    }


    // MARK: - AIMS65

    private var aims65Form: some View {
        Group {
            scoreToggle("A — Albumin <3.0 g/dL",                     binding: $aims65I.albuminUnder3,       points: "+1", autoKey: "albuminUnder3")
            scoreToggle("I — INR >1.5",                               binding: $aims65I.inrOver1point5,      points: "+1", autoKey: "inrOver1point5")
            scoreToggle("M — Altered mental status",                  binding: $aims65I.alteredMentalStatus, points: "+1", autoKey: "alteredMentalStatus")
            scoreToggle("S — Systolic BP ≤90 mmHg",                  binding: $aims65I.systolicBPUnder90,   points: "+1", autoKey: "systolicBPUnder90")
            scoreToggle("5 — Age ≥65 years",                         binding: $aims65I.ageOver65,           points: "+1", autoKey: "ageOver65")
        }
        .onChange(of: aims65I) { _, _ in recalculate() }
    }


    // MARK: - Forrest Classification

    private var forrestForm: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("Forrest Classification of peptic ulcer bleeding (Forrest et al, Lancet 1974; Laine & Peterson, N Engl J Med 1994). Endoscopic classification. Guides need for endoscopic haemostasis and rebleeding risk stratification.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 8)
            Group {
                sectionHeader("Endoscopic Finding")
                apacheSegment("Forrest Grade", selection: $forrestI.grade,
                    options: [
                        (1, "Ia — Spurting haemorrhage (active bleeding jet; rebleed ~90%)"),
                        (2, "Ib — Oozing haemorrhage (active bleeding ooze; rebleed ~55%)"),
                        (3, "IIa — Visible vessel (non-bleeding; rebleed ~43%)"),
                        (4, "IIb — Adherent clot (rebleed ~22%)"),
                        (5, "IIc — Flat pigmented spot (rebleed ~10%)"),
                        (6, "III — Clean ulcer base (rebleed ~5%)")
                    ])
            }
            .onChange(of: forrestI) { _, _ in recalculate() }
        }
    }


    // MARK: - Oakland Score (LGIB)

    private var oaklandForm: some View {
        Group {
            apacheSegment("Age", selection: $oaklandI.ageScore,
                options: [
                    (0, "0 — Age <40 years"),
                    (1, "1 — Age 40–69 years"),
                    (2, "2 — Age ≥70 years")
                ])
            scoreToggle("Male sex", binding: $oaklandI.sexMale, points: "+1")
            scoreToggle("Previous hospital admission for LGIB", binding: $oaklandI.previousLGIB, points: "+1")
            apacheSegment("Digital rectal examination (DRE)", selection: $oaklandI.dre,
                options: [
                    (0, "0 — No blood on DRE"),
                    (1, "1 — Blood on DRE")
                ])
            apacheSegment("Heart rate (bpm)", selection: $oaklandI.heartRate,
                options: [
                    (0, "0 — Heart rate <70 bpm"),
                    (1, "1 — Heart rate 70–89 bpm"),
                    (2, "2 — Heart rate ≥90 bpm")
                ])
            apacheSegment("Systolic blood pressure (mmHg)", selection: $oaklandI.sbp,
                options: [
                    (0, "0 — SBP ≥160 mmHg"),
                    (1, "1 — SBP 130–159 mmHg"),
                    (2, "2 — SBP 100–129 mmHg"),
                    (3, "3 — SBP <100 mmHg")
                ])
            apacheSegment("Haemoglobin (g/dL)", selection: $oaklandI.hbScore,
                options: [
                    (0, "0 — Hb ≥16.0 (M) / ≥13.0 (F) g/dL"),
                    (1, "1 — Hb 13.0–15.9 (M) / 11.0–12.9 (F) g/dL"),
                    (2, "2 — Hb 11.0–12.9 (M) / 9.0–10.9 (F) g/dL"),
                    (3, "3 — Hb 9.0–10.9 (M) / 7.0–8.9 (F) g/dL"),
                    (4, "4 — Hb 7.0–8.9 g/dL"),
                    (5, "5 — Hb <7.0 g/dL")
                ])
        }
        .onChange(of: oaklandI) { _, _ in recalculate() }
    }


    private var kingsCriteriaForm: some View {
        Group {
            scoreToggle("Paracetamol (acetaminophen) aetiology", binding: $kingsI.isParacetamol, points: "arm")
            Divider().padding(.vertical, 4)
            if kingsI.isParacetamol {
                Text("Paracetamol arm — Criteria").font(.caption).foregroundStyle(.secondary).padding(.top, 2)
                scoreToggle("Arterial pH < 7.30 (after resuscitation)", binding: $kingsI.acidosisPhBelow730, points: "single")
                Text("— OR all three of —").font(.caption).foregroundStyle(.secondary).italic()
                scoreToggle("Prothrombin time > 100 s", binding: $kingsI.ptAbove100, points: "triple")
                scoreToggle("Creatinine > 300 µmol/L", binding: $kingsI.creatinineAbove300, points: "triple")
                scoreToggle("Hepatic encephalopathy grade III or IV", binding: $kingsI.encephalopathyGrade34, points: "triple")
            } else {
                Text("Non-paracetamol arm — Criteria").font(.caption).foregroundStyle(.secondary).padding(.top, 2)
                scoreToggle("Prothrombin time > 100 s (alone sufficient)", binding: $kingsI.ptAbove100, points: "major")
                Text("— OR ≥ 3 of the following —").font(.caption).foregroundStyle(.secondary).italic()
                scoreToggle("Prothrombin time > 50 s", binding: $kingsI.ptAbove50, points: "minor")
                scoreToggle("Age < 10 or > 40 years", binding: $kingsI.ageUnder10OrAbove40, points: "minor")
                scoreToggle("Jaundice to encephalopathy > 7 days", binding: $kingsI.jaundiceToDays, points: "minor")
                scoreToggle("Bilirubin > 300 µmol/L", binding: $kingsI.bilirubinAbove300, points: "minor")
                scoreToggle("Unfavourable aetiology (drug/indeterminate)", binding: $kingsI.unfavourableAetiology, points: "minor")
            }
        }
        .onChange(of: kingsI) { _, _ in recalculate() }
    }


    // MARK: - Harmless Acute Pancreatitis Score (#78)

    private var hapsForm: some View {
        Group {
            scoreToggle("No peritoneal irritation on examination", binding: $hapsI.peritonismAbsent, points: "+1", autoKey: "peritonismAbsent")
            scoreToggle("Serum creatinine ≤ 177 µmol/L (< 2 mg/dL)", binding: $hapsI.creatinineNormal, points: "+1", autoKey: "creatinineNormal")
            scoreToggle("Haematocrit ≤ 43% (M) / ≤ 39.6% (F)", binding: $hapsI.haematocritNormal, points: "+1", autoKey: "haematocritNormal")
        }
        .onChange(of: hapsI) { _, _ in recalculate() }
    }

    // MARK: – BISAP Form

    // MARK: – Glasgow-Imrie Form

    private var glasgowImrieForm: some View {
        Group {
            Text("Variables assessed from WORST values within first 48 hours of admission")
                .font(.caption)
                .foregroundStyle(.secondary)
                .padding(.bottom, 4)
            scoreToggle("PaO₂ < 59.2 mmHg (< 7.9 kPa)", binding: $glasgowImrieI.pao2Below59, points: "+1", autoKey: "pao2Below59")
            scoreToggle("Age > 55 years", binding: $glasgowImrieI.ageAbove55, points: "+1", autoKey: "ageAbove55")
            scoreToggle("WBC > 15 × 10⁹/L", binding: $glasgowImrieI.wbcAbove15, points: "+1", autoKey: "wbcAbove15")
            scoreToggle("Serum calcium < 2.0 mmol/L", binding: $glasgowImrieI.calciumBelow2, points: "+1", autoKey: "calciumBelow2")
            scoreToggle("Serum albumin < 32 g/L", binding: $glasgowImrieI.albuminBelow32, points: "+1", autoKey: "albuminBelow32")
            scoreToggle("LDH > 600 IU/L (or > 3× ULN)", binding: $glasgowImrieI.ldh180, points: "+1", autoKey: "ldh180")
            scoreToggle("AST / ALT > 200 IU/L", binding: $glasgowImrieI.ast100, points: "+1", autoKey: "ast100")
            scoreToggle("Serum glucose > 10 mmol/L (non-diabetic)", binding: $glasgowImrieI.glucoseAbove10, points: "+1", autoKey: "glucoseAbove10")
        }
        .onChange(of: glasgowImrieI) { _, _ in recalculate() }
    }


    // MARK: - ALBI
    private var albiForm: some View {
        Group {
            Text("Enter current serum albumin (g/L) and bilirubin (μmol/L). Use most recent lab values.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            HStack {
                Text("Albumin (g/L)")
                Spacer()
                Stepper("\(Int(albiI.albuminGperL)) g/L",
                        value: $albiI.albuminGperL, in: 5...60, step: 1)
                    .fixedSize()
            }
            HStack {
                Text("Bilirubin (μmol/L)")
                Spacer()
                Stepper("\(Int(albiI.bilirubinUmolL)) μmol/L",
                        value: $albiI.bilirubinUmolL, in: 1...500, step: 1)
                    .fixedSize()
            }
            Text("ALBI = (log₁₀(bilirubin) × 0.66) + (albumin × −0.085). Grade 1 ≤−2.60 (safe); Grade 3 >−1.39 (prohibitive risk).")
                .font(.caption2).foregroundStyle(.secondary).padding(.top, 4)
        }
        .onChange(of: albiI) { _, _ in recalculate() }
    }


    // MARK: - AUDIT-C
    private var auditCForm: some View {
        Group {
            Text("3-item alcohol consumption screen. Threshold: ≥4 (men) / ≥3 (women).")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            auditCPicker("How often do you have a drink?",
                         labels: ["Never","Monthly or less","2–4×/month","2–3×/week","4+/week"],
                         value: $auditCI.frequency)
            auditCPicker("How many drinks on a typical day?",
                         labels: ["1–2","3–4","5–6","7–9","10+"],
                         value: $auditCI.typicalDrinks)
            auditCPicker("How often do you have 6+ drinks on one occasion?",
                         labels: ["Never","Less than monthly","Monthly","Weekly","Daily or almost daily"],
                         value: $auditCI.bingeDrinks)
            Toggle("Female (lower threshold: ≥3)", isOn: $auditCI.isFemale)
        }
        .onChange(of: auditCI) { _, _ in recalculate() }
    }


    // MARK: - Los Angeles Classification
    private var losAngelesForm: some View {
        Group {
            Text("Endoscopic grading of oesophagitis at OGD. Select the grade that best matches the observed mucosal breaks.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            Picker("LA Grade", selection: $losAngelesI.grade) {
                Text("None — No erosive oesophagitis").tag(0)
                Text("Grade A — Mucosal break ≤5 mm").tag(1)
                Text("Grade B — Mucosal break >5 mm, not between folds").tag(2)
                Text("Grade C — Breaks between folds, <75% circumference").tag(3)
                Text("Grade D — Breaks ≥75% of oesophageal circumference").tag(4)
            }
            .pickerStyle(.inline)
        }
        .onChange(of: losAngelesI) { _, _ in recalculate() }
    }


    // MARK: - MELD 3.0
    private var meld3Form: some View {
        Group {
            Text("Enter most recent laboratory values. Use current INR, not on anticoagulation adjustment.")
                .font(.caption).foregroundStyle(.secondary).padding(.bottom, 4)
            Toggle("Female sex (+1.33 to score)", isOn: $meld3I.isFemale)
            HStack {
                Text("Creatinine (μmol/L)")
                Spacer()
                Stepper(String(format: "%.0f μmol/L", meld3I.creatinineMmolL),
                        value: $meld3I.creatinineMmolL, in: 10...700, step: 5)
                    .fixedSize()
            }
            HStack {
                Text("Bilirubin (μmol/L)")
                Spacer()
                Stepper(String(format: "%.0f μmol/L", meld3I.bilirubinMmolL),
                        value: $meld3I.bilirubinMmolL, in: 1...500, step: 2)
                    .fixedSize()
            }
            HStack {
                Text("INR")
                Spacer()
                Stepper(String(format: "%.1f", meld3I.inr),
                        value: $meld3I.inr, in: 0.8...12.0, step: 0.1)
                    .fixedSize()
            }
            HStack {
                Text("Sodium (mmol/L)")
                Spacer()
                Stepper("\(meld3I.sodiumMmolL) mmol/L",
                        value: $meld3I.sodiumMmolL, in: 120...145, step: 1)
                    .fixedSize()
            }
            HStack {
                Text("Albumin (g/L)")
                Spacer()
                Stepper(String(format: "%.0f g/L", meld3I.albuminGperL),
                        value: $meld3I.albuminGperL, in: 10...60, step: 1)
                    .fixedSize()
            }
            Text("Score ≥15 = transplant listing threshold. ≥25 = active waitlist priority.")
                .font(.caption2).foregroundStyle(.secondary).padding(.top, 4)
        }
        .onChange(of: meld3I) { _, _ in recalculate() }
    }

}
