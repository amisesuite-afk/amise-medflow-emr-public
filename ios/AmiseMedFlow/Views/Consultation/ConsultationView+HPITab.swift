// ConsultationView+HPITab.swift
// HPI tab: the history builder (frame chosen from the complaint: ConsultationView+HistoryFrame.swift),
// exam adaptive chips, prose generation.

import SwiftUI
import SwiftData

extension ConsultationView {

    // MARK: - HPI tab (history builder)

    // MARK: - Exam adaptive chips

    // The primary examination field follows the complaint's history frame (the history step's own
    // classification, including the clinician's frame switch): ExamRegion.swift.

    /// History frame ids of the complaint, primary first (Exam step: region and high-yield signs).
    var examFrameIDs: [String] {
        let resolved = resolvedHistoryFrame
        var ids = [resolved.frame.id]
        for id in resolved.choice.secondary where !ids.contains(id) { ids.append(id) }
        return ids
    }

    var examRegion: ExamRegion {
        ExamRegion.forFrame(resolvedHistoryFrame.frame.id, complaint: patient.chiefComplaint ?? "")
    }

    /// The primary (abdominal / regional) field: the region's label and chips when the region is
    /// recorded there, else "Abdomen" with its usual chips.
    var primaryExamLabel: String { examRegion.label(for: .abdo) }

    var primaryExamChips: [String] { examRegion.chips(for: .abdo) }

    var primaryCVSChips: [String] { examRegion.chips(for: .cvs) }

    var hpiTab: some View {
        List {
            // Specialty early form: targeted discriminating chips before the history builder
            specialtyEarlyFormSection

            // History builder: SOCRATES for pain, the complaint's own questions otherwise
            historyFrameSection

            // Live preview + apply
            if let preview = historyPreview {
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
                        Label(DraftButtonText.title(section: "HPI"), systemImage: DraftButtonText.systemImage())
                        Spacer()
                        if ai.isGenerating { ProgressView() }
                    }
                }
                .disabled(ai.isGenerating || (patient.chiefComplaint ?? "").isEmpty)
                .foregroundStyle(AMColor.accent)
                .accessibilityLabel(DraftButtonText.accessibilityLabel(section: "HPI"))
                .accessibilityIdentifier("consult.hpi.draft")
            } header: {
                sectionHeader("HPI Text", icon: "text.bubble",
                              filled: !(patient.hpi ?? "").isEmpty)
            }
        }
    }

    // MARK: - Quick Clinical Flags toggle + auto-advance (specialty early-form chips)

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
            let ids = resolvedHistoryFrame.dimensions.map(\.id)
            if let idx = ids.firstIndex(of: dimId), idx + 1 < ids.count {
                withAnimation(.easeInOut(duration: 0.18)) { socratesExpandedDim = ids[idx + 1] }
            }
        }
    }

    // MARK: - HPI prose generation from SOCRATES chips (pain frames; historyPreview chooses)

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
