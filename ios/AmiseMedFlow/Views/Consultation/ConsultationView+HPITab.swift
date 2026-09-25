// ConsultationView+HPITab.swift
// HPI tab: SOCRATES chip builder, exam adaptive chips, prose generation.

import SwiftUI
import SwiftData

extension ConsultationView {

    // MARK: - HPI tab (SOCRATES chip builder)

    // Chip sets re-evaluated whenever the CC changes
    var adaptedSocrateDimensions: [SOCRATESDimension] {
        socrateDimensions(for: patient.chiefComplaint ?? "")
    }

    // MARK: - Exam adaptive chips

    var primaryExamLabel: String {
        let lc = (patient.chiefComplaint ?? "").lowercased()
        if lc.contains("neck") || lc.contains("thyroid") || lc.contains("goitre") || lc.contains("lymph") || lc.contains("goiter") { return "Neck Examination" }
        if lc.contains("breast") || lc.contains("nipple") || lc.contains("mastalgia") { return "Breast Examination" }
        if (lc.contains("chest") && lc.contains("pain")) || lc.contains("angina") || lc.contains("palpitation") { return "Chest / Cardiac" }
        if lc.contains("hernia") || lc.contains("inguinal") || lc.contains("femoral") || lc.contains("groin") { return "Groin / Hernia" }
        if lc.contains("dysphagia") || lc.contains("swallow") { return "Oropharynx / Neck" }
        if lc.contains("perianal") || lc.contains("anal") || lc.contains("haemorrhoid") || lc.contains("hemorrhoid") || lc.contains("rectal") || lc.contains("fissure") || lc.contains("fistula") { return "Perianal / PR Examination" }
        if lc.contains("skin") || lc.contains("mole") || lc.contains("melanoma") || lc.contains("lesion") || lc.contains("lipoma") { return "Skin Lesion" }
        if lc.contains("scrotum") || lc.contains("testicular") || lc.contains("testicle") || lc.contains("orchit") || lc.contains("hydrocele") || lc.contains("scrotal") { return "Scrotal / Testicular" }
        if lc.contains("haematuria") || lc.contains("urinary") || lc.contains("retention") || lc.contains("prostate") { return "Renal / Urological" }
        if lc.contains("parotid") || lc.contains("salivary") { return "Salivary Gland / Jaw" }
        return "Abdomen"
    }

    var primaryExamChips: [String] {
        let lc = (patient.chiefComplaint ?? "").lowercased()
        if lc.contains("neck") || lc.contains("thyroid") || lc.contains("goitre") || lc.contains("lymph") || lc.contains("goiter") {
            return ["Mobile, non-tender.", "Fixed to deep tissue.", "Moves on swallowing.", "Pulsatile; bruit present.", "Hard and irregular.", "Smooth and soft.", "Tender.", "Non-tender.", "Thyroid diffusely enlarged.", "Single nodule.", "Multiple nodes palpable.", "No palpable lymphadenopathy."]
        }
        if lc.contains("breast") || lc.contains("nipple") || lc.contains("mastalgia") {
            return ["Mobile, non-tender.", "Fixed to overlying skin.", "Fixed to pectoral muscle.", "Irregular, hard.", "Smooth, soft.", "Nipple inversion.", "Skin dimpling / peau d'orange.", "Axillary nodes palpable.", "Axillary nodes not palpable.", "Nipple discharge.", "No skin changes."]
        }
        if (lc.contains("chest") && lc.contains("pain")) || lc.contains("angina") || lc.contains("palpitation") {
            return ["No chest wall tenderness.", "Reproducible on palpation.", "Apex beat non-displaced.", "Bilateral air entry.", "No peripheral oedema.", "Peripheral pulses present.", "JVP not elevated."]
        }
        if lc.contains("hernia") || lc.contains("inguinal") || lc.contains("femoral") || lc.contains("groin") {
            return ["Cough impulse present.", "Reducible.", "Irreducible.", "Above inguinal ligament.", "Below inguinal ligament.", "Extending into scrotum.", "Transilluminates.", "No transillumination.", "Tender on palpation.", "Soft, easily reducible."]
        }
        if lc.contains("dysphagia") || lc.contains("swallow") {
            return ["Oropharynx clear.", "No neck mass.", "Moves on swallowing.", "Cervical lymphadenopathy.", "Voice normal on exam.", "Hoarse voice."]
        }
        if lc.contains("perianal") || lc.contains("anal") || lc.contains("haemorrhoid") || lc.contains("hemorrhoid") || lc.contains("rectal") || lc.contains("fissure") || lc.contains("fistula") {
            return ["Perianal skin normal.", "External haemorrhoids visible.", "Perianal erythema.", "Fluctuant perianal mass.", "Skin tag.", "External fistula opening.", "Posterior midline fissure.", "Normal rectal tone on DRE.", "Tender on DRE.", "Blood on glove.", "Mucosa normal on PR."]
        }
        if lc.contains("skin") || lc.contains("mole") || lc.contains("melanoma") || lc.contains("lesion") || lc.contains("lipoma") {
            return ["Well-defined border.", "Ill-defined border.", "Pigmented lesion.", "Non-pigmented.", "Raised >2 mm.", "Flat.", "Ulcerated.", "Smooth surface.", "Regional nodes not palpable.", "Regional nodes enlarged.", "Satellite lesions."]
        }
        if lc.contains("scrotum") || lc.contains("testicular") || lc.contains("testicle") || lc.contains("orchit") || lc.contains("hydrocele") || lc.contains("scrotal") {
            return ["Tender testis.", "Non-tender.", "Transilluminates (hydrocele).", "No transillumination.", "Warm and erythematous.", "Normal cremasteric reflex.", "Absent cremasteric reflex.", "Epididymal cyst.", "Scrotal oedema.", "Mass separate from testis."]
        }
        if lc.contains("haematuria") || lc.contains("urinary") || lc.contains("retention") || lc.contains("prostate") {
            return ["No renal angle tenderness.", "Right renal angle tender.", "Left renal angle tender.", "Bladder palpable to umbilicus.", "Suprapubic tenderness.", "Prostate smooth, not enlarged (DRE).", "Prostate enlarged, benign (DRE).", "Prostate hard, irregular (DRE)."]
        }
        if lc.contains("parotid") || lc.contains("salivary") {
            return ["Soft, mobile.", "Firm, fixed.", "Tender.", "Non-tender.", "Facial nerve intact.", "Bimanual — stone palpable.", "No stone palpable.", "Erythema overlying skin."]
        }
        return ["Soft, non-tender.", "Tender RUQ.", "Tender RLQ.", "Guarding.", "Rigidity.", "Murphy's +ve.", "Bowel sounds normal.", "No organomegaly.", "Hepatomegaly.", "Distended."]
    }

    var primaryCVSChips: [String] {
        let lc = (patient.chiefComplaint ?? "").lowercased()
        if (lc.contains("chest") && lc.contains("pain")) || lc.contains("angina") || lc.contains("palpitation") || lc.contains("cardiac") {
            return ["Regular rate and rhythm.", "Irregular (AF).", "Dual heart sounds.", "Systolic murmur.", "Ejection systolic murmur.", "S3 gallop.", "Elevated JVP.", "Pitting oedema ankles.", "Peripheral pulses present bilaterally.", "Absent left radial pulse."]
        }
        return ["Regular rate and rhythm. No murmurs.", "Dual heart sounds.", "Systolic murmur.", "Pitting oedema ankles.", "Elevated JVP."]
    }

    var hpiTab: some View {
        List {
            // Specialty early form: targeted discriminating chips before full SOCRATES
            specialtyEarlyFormSection

            // SOCRATES builder accordion
            Section {
                ForEach(adaptedSocrateDimensions) { dim in
                    socratesDimRow(dim)
                }
            } header: {
                let filled = adaptedSocrateDimensions.filter { !(socratesSelections[$0.id] ?? []).isEmpty }.count
                HStack {
                    Label("SOCRATES Builder", systemImage: "square.grid.2x2")
                    Spacer()
                    Text("\(filled)/\(adaptedSocrateDimensions.count)")
                        .font(.caption.weight(.semibold).monospacedDigit())
                        .foregroundStyle(filled == adaptedSocrateDimensions.count ? .green : .secondary)
                }
            }

            // Live preview + apply
            if let preview = socratesPreview {
                Section {
                    Text(preview)
                        .font(.callout)
                        .foregroundStyle(.primary)
                        .padding(.vertical, 4)
                    Button {
                        patient.hpi = preview; touch()
                    } label: {
                        Label("Apply to HPI", systemImage: "checkmark.circle.fill")
                    }
                    .foregroundStyle(AMColor.accent)
                } header: {
                    Label("Preview", systemImage: "text.viewfinder")
                }
            }

            // Manual / AI fallback
            Section {
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.hpi ?? "" },
                                            set: { patient.hpi = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 140)
                        .accessibilityIdentifier("consult.hpi.editor")
                        .medicalDictation(mode: .hpi, patient: patient,
                                          text: Binding(get: { patient.hpi ?? "" },
                                                        set: { patient.hpi = $0.isEmpty ? nil : $0; touch() }))
                    if (patient.hpi ?? "").isEmpty {
                        Text("Committed HPI will appear here — or type directly")
                            .foregroundStyle(.tertiary).font(.caption)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
                Button {
                    Task { await draftHPI() }
                } label: {
                    HStack {
                        Label("AI Draft HPI", systemImage: "sparkles")
                        Spacer()
                        if ai.isGenerating { ProgressView() }
                    }
                }
                .disabled(ai.isGenerating || (patient.chiefComplaint ?? "").isEmpty)
                .foregroundStyle(.purple)
            } header: {
                sectionHeader("HPI Text", icon: "text.bubble",
                              filled: !(patient.hpi ?? "").isEmpty)
            }
        }
    }

    // MARK: - SOCRATES dimension accordion row

    @ViewBuilder
    func socratesDimRow(_ dim: SOCRATESDimension) -> some View {
        let selections = socratesSelections[dim.id] ?? []
        let isExpanded = socratesExpandedDim == dim.id

        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.18)) {
                    socratesExpandedDim = isExpanded ? nil : dim.id
                }
            } label: {
                HStack(spacing: 8) {
                    Image(systemName: dim.icon)
                        .foregroundStyle(selections.isEmpty ? .secondary : AMColor.accent)
                        .frame(width: 20, alignment: .center)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(dim.title)
                            .font(.system(size: 13, weight: .semibold))
                            .foregroundStyle(.primary)
                        if !selections.isEmpty {
                            Text(selections.sorted().joined(separator: " · "))
                                .font(.caption)
                                .foregroundStyle(AMColor.accent)
                                .lineLimit(1)
                        } else if !isExpanded {
                            Text(dim.question)
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                    }
                    Spacer()
                    if !selections.isEmpty {
                        Text("\(selections.count)")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundStyle(.white)
                            .frame(width: 18, height: 18)
                            .background(AMColor.accent, in: Circle())
                    }
                    Image(systemName: isExpanded ? "chevron.up" : "chevron.down")
                        .font(.system(size: 11))
                        .foregroundStyle(.tertiary)
                }
                .padding(.vertical, 6)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if isExpanded {
                ChipFlow(hSpacing: 8, vSpacing: 8) {
                    ForEach(dim.chips, id: \.self) { chip in
                        let isSelected = selections.contains(chip)
                        Button {
                            toggleSOCRATES(dimId: dim.id, chip: chip, multiSelect: dim.multiSelect)
                        } label: {
                            Text(chip)
                                .font(.system(size: 12, weight: isSelected ? .semibold : .regular))
                                .padding(.horizontal, 10)
                                .padding(.vertical, 5)
                                .background(isSelected ? AMColor.accent : AMColor.accentLt, in: Capsule())
                                .foregroundStyle(isSelected ? Color.white : AMColor.accent)
                                .animation(.easeInOut(duration: 0.12), value: isSelected)
                        }
                        .buttonStyle(.plain)
                    }
                }
                .padding(.top, 10)
                .padding(.bottom, 4)
            }
        }
    }

    // MARK: - SOCRATES chip toggle + auto-advance

    func toggleSOCRATES(dimId: String, chip: String, multiSelect: Bool) {
        var current = socratesSelections[dimId] ?? []
        if multiSelect {
            if current.contains(chip) { current.remove(chip) } else { current.insert(chip) }
        } else {
            current = current.contains(chip) ? [] : [chip]
        }
        socratesSelections[dimId] = current

        // Auto-advance to next dim on single-select
        if !multiSelect && !current.isEmpty {
            let ids = adaptedSocrateDimensions.map(\.id)
            if let idx = ids.firstIndex(of: dimId), idx + 1 < ids.count {
                withAnimation(.easeInOut(duration: 0.18)) { socratesExpandedDim = ids[idx + 1] }
            }
        }
    }

    // MARK: - HPI prose generation from SOCRATES chips

    var socratesPreview: String? {
        guard adaptedSocrateDimensions.contains(where: { !(socratesSelections[$0.id] ?? []).isEmpty }) else { return nil }
        return buildHpiProse()
    }

    func buildHpiProse() -> String {
        let cc   = patient.chiefComplaint ?? "presenting complaint"
        let onset = (socratesSelections["onset"] ?? []).first ?? ""
        let sites = (socratesSelections["site"] ?? []).sorted()
        let chars = (socratesSelections["character"] ?? []).sorted()
        let rad   = socratesSelections["radiation"]?.first
        let assoc = (socratesSelections["associations"] ?? []).sorted()
        let timing = (socratesSelections["timing"] ?? []).sorted()
        let exc   = (socratesSelections["exacerbating"] ?? []).sorted()
        let rel   = (socratesSelections["relieving"] ?? []).sorted()
        let sev   = socratesSelections["severity"]?.first

        var parts: [String] = []

        // Opening sentence
        var open = patient.fullName
        if patient.ageYears > 0 {
            open += ", a \(patient.ageYears)-year-old \(patient.sex.rawValue.lowercased()),"
        }
        open += " presents with \(cc)"
        if !onset.isEmpty { open += " of \(onset.lowercased()) duration" }
        open += "."
        parts.append(open)

        // Character + site
        if !chars.isEmpty || !sites.isEmpty {
            var s = "The \(cc)"
            if !chars.isEmpty { s += " is \(joinList(chars.map { $0.lowercased() })) in character" }
            if !sites.isEmpty { s += (chars.isEmpty ? " is" : ",") + " localised to the \(joinList(sites))" }
            parts.append(s + ".")
        }

        // Radiation
        if let r = rad, r != "No radiation" {
            parts.append("The pain radiates to the \(r.lowercased()).")
        }

        // Timing
        if !timing.isEmpty {
            parts.append("Symptoms are \(joinList(timing.map { $0.lowercased() })) in nature.")
        }

        // Associations
        if !assoc.isEmpty {
            parts.append("Associated symptoms include \(joinList(assoc.map { $0.lowercased() })).")
        }

        // Exacerbating
        if !exc.isEmpty {
            parts.append("Symptoms are exacerbated by \(joinList(exc.map { $0.lowercased() })).")
        }

        // Relieving
        let relFiltered = rel.filter { $0 != "Nothing" }
        if !relFiltered.isEmpty {
            parts.append("Relief is obtained with \(joinList(relFiltered.map { $0.lowercased() })).")
        }

        // Severity
        if let s = sev {
            parts.append("Severity is rated as \(s.lowercased()).")
        }

        return parts.joined(separator: " ")
    }

    func joinList(_ items: [String]) -> String {
        switch items.count {
        case 0: return ""
        case 1: return items[0]
        case 2: return "\(items[0]) and \(items[1])"
        default: return items.dropLast().joined(separator: ", ") + ", and \(items.last!)"
        }
    }


}
