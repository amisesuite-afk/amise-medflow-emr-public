// ConsultationView+PMHTab.swift
// Past medical history tab and medication history section.

import SwiftUI
import SwiftData

extension ConsultationView {

    // MARK: - PMH tab

    // MARK: - PMH medications section

    var medicationsSection: some View {
        Section {
            // PMH-derived quick-picks — deterministic, no AI
            let pmhMeds = pmhDerivedMedSuggestions
            if !pmhMeds.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Label("From your PMH — tap to add", systemImage: "cross.case")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 6) {
                            ForEach(pmhMeds, id: \.self) { name in
                                Button {
                                    let match = ClinicalSearchService.searchDrugs(name).first
                                    if let drug = match {
                                        medQuery = drug.name
                                        expandedMed = drug
                                        medDose = drug.commonDoses
                                        medRoute = drug.route
                                        medFreq = "OD"
                                        medSuggestions = []
                                    } else {
                                        addMedicationEntry(name: name, dose: "", route: "Oral", freq: "OD")
                                    }
                                } label: {
                                    Text(name)
                                        .font(.caption.weight(.medium))
                                        .padding(.horizontal, 10).padding(.vertical, 5)
                                        .background(AMColor.accentLt, in: Capsule())
                                        .foregroundStyle(AMColor.accent)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .padding(.vertical, 2)
            }

            // Drug search field
            HStack(spacing: 8) {
                Image(systemName: "pills").foregroundStyle(.secondary)
                TextField("Search medication…", text: $medQuery)
                    .autocorrectionDisabled()
                    .onChange(of: medQuery) { _, q in
                        medSuggestions = q.count >= 2 ? ClinicalSearchService.searchDrugs(q) : []
                        if expandedMed != nil && expandedMed?.name.lowercased() != q.lowercased() {
                            expandedMed = nil
                        }
                    }
                if !medQuery.isEmpty {
                    Button { medQuery = ""; medSuggestions = []; expandedMed = nil } label: {
                        Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                    }.buttonStyle(.plain)
                }
            }

            // Drug suggestion list
            ForEach(medSuggestions.prefix(6)) { drug in
                Button {
                    medQuery  = drug.name
                    expandedMed = drug
                    medDose   = drug.commonDoses
                    medRoute  = drug.route
                    medFreq   = "OD"
                    medSuggestions = []
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(drug.name).font(.subheadline).foregroundStyle(.primary)
                            Text(drug.category).font(.caption).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(drug.commonDoses).font(.caption2).foregroundStyle(.tertiary)
                    }
                    .contentShape(Rectangle())   // whole row tappable, not only its text
                }.buttonStyle(.plain)
            }

            // Inline dose/route/frequency submenu
            if let drug = expandedMed {
                VStack(alignment: .leading, spacing: 10) {
                    HStack {
                        Label(drug.name, systemImage: "pill.fill")
                            .font(.subheadline.weight(.semibold))
                            .foregroundStyle(AMColor.accent)
                        Spacer()
                        Button { expandedMed = nil; medQuery = "" } label: {
                            Image(systemName: "xmark").font(.caption)
                        }.buttonStyle(.plain).foregroundStyle(.secondary)
                    }

                    // Dose
                    VStack(alignment: .leading, spacing: 4) {
                        Text("DOSE").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                        HStack(spacing: 6) {
                            TextField("e.g. 500 mg", text: $medDose)
                                .font(.callout)
                                .frame(maxWidth: .infinity)
                            if !drug.commonDoses.isEmpty && medDose != drug.commonDoses {
                                Button(drug.commonDoses) { medDose = drug.commonDoses }
                                    .font(.caption2).buttonStyle(.bordered).tint(.teal)
                            }
                        }
                    }

                    // Route chips
                    VStack(alignment: .leading, spacing: 4) {
                        Text("ROUTE").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(["Oral","IV","IM","SC","Topical","Inhaled","PR","SL"], id: \.self) { r in
                                    let sel = medRoute == r
                                    Button(r) { medRoute = r }
                                        .font(.caption2.weight(sel ? .semibold : .regular))
                                        .padding(.horizontal, 8).padding(.vertical, 3)
                                        .background(sel ? AMColor.accent : AMColor.accentLt, in: Capsule())
                                        .foregroundStyle(sel ? .white : AMColor.accent)
                                        .buttonStyle(.plain)
                                }
                            }
                        }
                    }

                    // Frequency chips
                    VStack(alignment: .leading, spacing: 4) {
                        Text("FREQUENCY").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                        ScrollView(.horizontal, showsIndicators: false) {
                            HStack(spacing: 6) {
                                ForEach(["OD","BD","TDS","QDS","PRN","STAT","Nocte","Weekly"], id: \.self) { f in
                                    let sel = medFreq == f
                                    Button(f) { medFreq = f }
                                        .font(.caption2.weight(sel ? .semibold : .regular))
                                        .padding(.horizontal, 8).padding(.vertical, 3)
                                        .background(sel ? AMColor.accent : AMColor.accentLt, in: Capsule())
                                        .foregroundStyle(sel ? .white : AMColor.accent)
                                        .buttonStyle(.plain)
                                }
                            }
                        }
                    }

                    if !drug.notes.isEmpty {
                        Text(drug.notes).font(.caption.italic()).foregroundStyle(.secondary)
                    }

                    Button {
                        addMedicationEntry(name: drug.name, dose: medDose, route: medRoute, freq: medFreq)
                        expandedMed = nil; medQuery = ""; medDose = ""; medRoute = "Oral"; medFreq = "OD"
                    } label: {
                        Label("Add to current medications", systemImage: "plus.circle.fill")
                            .font(.callout.weight(.semibold))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(AMColor.accent)
                }
                .padding(.vertical, 4)
            }

            // AI suggestions
            if !aiMedSuggestions.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Label("AI Suggestions — tap to add", systemImage: "brain")
                        .font(.caption.weight(.semibold)).foregroundStyle(.secondary)
                    ForEach(aiMedSuggestions, id: \.self) { name in
                        Button {
                            let match = ClinicalSearchService.searchDrugs(name).first
                            if let drug = match {
                                medQuery = drug.name; expandedMed = drug
                                medDose = drug.commonDoses; medRoute = drug.route; medFreq = "OD"
                            } else {
                                addMedicationEntry(name: name, dose: "", route: "Oral", freq: "OD")
                            }
                            aiMedSuggestions.removeAll { $0 == name }
                        } label: {
                            HStack(spacing: 8) {
                                Image(systemName: "plus.circle").foregroundStyle(AMColor.accent)
                                Text(name).font(.callout)
                                Spacer()
                            }
                            .contentShape(Rectangle())   // whole row tappable, not only its text
                        }.buttonStyle(.plain)
                    }
                }
            }

            // AI Suggest Medications — on hold (HIPAA compliance)
            // Button hidden; re-enable when clinical AI clearance is in place.

            // Current medication list
            if !patient.prescriptions.isEmpty {
                Divider()
                let sortedRx = patient.prescriptions.sorted { $0.prescribedAt > $1.prescribedAt }
                ForEach(sortedRx) { rx in
                    HStack(spacing: 10) {
                        Image(systemName: "pill")
                            .font(.system(size: 11))
                            .foregroundStyle(AMColor.accent)
                            .frame(width: 16)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(rx.drug).font(.callout.weight(.semibold))
                            Text(rx.displayLine)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(rx.prescribedAt.formatted(.dateTime.month(.abbreviated).year()))
                            .font(.caption2.monospacedDigit())
                            .foregroundStyle(.tertiary)
                    }
                }
                .onDelete { idxSet in
                    for i in idxSet {
                        AuditLog.record("delete", "prescription", patient: patient, resourceId: sortedRx[i].syncCode)
                        SyncTombstones.add(sortedRx[i].remoteId, in: .prescriptions)
                        context.delete(sortedRx[i])
                    }
                    touch()
                }
            }
        } header: {
            sectionHeader("Medications", icon: "pills",
                          filled: !patient.prescriptions.isEmpty)
        }
    }

    var pmhTab: some View {
        List {
            // Structured entries — one row per condition
            if !patient.pmhEntries.isEmpty {
                Section {
                    ForEach(patient.pmhEntries.indices, id: \.self) { i in
                        pmhEntryRow(index: i)
                    }
                    .onDelete { idxSet in
                        var list = patient.pmhEntries
                        list.remove(atOffsets: idxSet)
                        patient.pmhEntries = list
                        touch()
                    }
                } header: {
                    sectionHeader("Medical History (\(patient.pmhEntries.count))",
                                  icon: "stethoscope", filled: true)
                }
            }

            Section {
                // Bypass card — PMH already on record
                if !(patient.pmhNotes ?? "").isEmpty && !pmhBypassConfirmed {
                    historyBypassCard(
                        title: "PMH already on record",
                        subtitle: "Still accurate for this encounter?",
                        onConfirm: { pmhBypassConfirmed = true }
                    )
                }

                // NKPMH quick-set
                Button {
                    patient.pmhNotes = "No known past medical history (NKPMH)"
                    pmhChipSelections = []
                    pmhBypassConfirmed = true
                    touch()
                } label: {
                    Label("No known PMH (NKPMH)", systemImage: "checkmark.shield")
                        .font(.subheadline)
                        .foregroundStyle(.green)
                }
                .buttonStyle(.plain)

                // Condition list
                ForEach(pmhChips, id: \.self) { chip in
                    let sel = pmhChipSelections.contains(chip)
                    Button {
                        pmhChipSelections.formSymmetricDifference([chip])
                        recomputeRisk()
                    } label: {
                        HStack(spacing: 10) {
                            Image(systemName: sel ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 13))
                                .foregroundStyle(sel ? AMColor.accent : Color.secondary)
                            Text(chip)
                                .font(.callout.weight(sel ? .semibold : .regular))
                                .foregroundStyle(.primary)
                            Spacer()
                        }
                        .contentShape(Rectangle())   // whole row tappable, not only its text
                    }.buttonStyle(.plain)
                }

                // Apply button
                if !pmhChipSelections.isEmpty {
                    Button {
                        appendHistory(existing: patient.pmhNotes, chips: pmhChipSelections) {
                            patient.pmhNotes = $0
                        }
                        // Create structured entries for each new condition
                        var entries = patient.pmhEntries
                        for chip in pmhChipSelections.sorted() {
                            if !entries.contains(where: { $0.condition == chip }) {
                                entries.append(PMHEntry(condition: chip))
                            }
                        }
                        patient.pmhEntries = entries
                        pmhChipSelections = []
                        pmhBypassConfirmed = true
                        touch()
                    } label: {
                        Label("Append \(pmhChipSelections.count) condition\(pmhChipSelections.count == 1 ? "" : "s") to PMH Notes",
                              systemImage: "plus.circle.fill")
                    }
                    .foregroundStyle(AMColor.accent)
                }

                // Manual text editor
                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.pmhNotes ?? "" },
                                            set: { patient.pmhNotes = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 100)
                    if (patient.pmhNotes ?? "").isEmpty {
                        Text("Free-text PMH — or tick conditions above")
                            .foregroundStyle(.tertiary).font(.caption)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            } header: {
                sectionHeader("Past Medical History", icon: "clock.arrow.circlepath",
                              filled: !(patient.pmhNotes ?? "").isEmpty)
            }

            // Surgical risk profile — reactive to PMH chips, medications, age, BMI, social
            if !surgicalRiskAlerts.isEmpty {
                surgicalRiskSection
            }

            Section {
                ForEach(familyHistoryChips, id: \.self) { chip in
                    let sel = fhChipSelections.contains(chip)
                    Button { fhChipSelections.formSymmetricDifference([chip]) } label: {
                        HStack(spacing: 10) {
                            Image(systemName: sel ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 13))
                                .foregroundStyle(sel ? AMColor.accent : Color.secondary)
                            Text(chip)
                                .font(.callout.weight(sel ? .semibold : .regular))
                                .foregroundStyle(.primary)
                            Spacer()
                        }
                        .contentShape(Rectangle())   // whole row tappable, not only its text
                    }.buttonStyle(.plain)
                }

                if !fhChipSelections.isEmpty {
                    Button {
                        appendHistory(existing: patient.familyHistoryNotes, chips: fhChipSelections) {
                            patient.familyHistoryNotes = $0
                        }
                        fhChipSelections = []
                        touch()
                    } label: {
                        Label("Append \(fhChipSelections.count) item\(fhChipSelections.count == 1 ? "" : "s") to Family History",
                              systemImage: "plus.circle.fill")
                    }
                    .foregroundStyle(AMColor.accent)
                }

                ZStack(alignment: .topLeading) {
                    TextEditor(text: Binding(get: { patient.familyHistoryNotes ?? "" },
                                            set: { patient.familyHistoryNotes = $0.isEmpty ? nil : $0; touch() }))
                        .frame(minHeight: 80)
                    if (patient.familyHistoryNotes ?? "").isEmpty {
                        Text("Free-text — or tick conditions above")
                            .foregroundStyle(.tertiary).font(.caption)
                            .padding(.top, 8).padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            } header: {
                sectionHeader("Family History", icon: "person.2",
                              filled: !(patient.familyHistoryNotes ?? "").isEmpty)
            }
        }
    }


}
