// NoteEditorView+Editor.swift
// Signed note viewer, SOAP editor, free text editor, status picker.

import SwiftUI
import SwiftData

extension NoteEditorView {

    // MARK: - Signed note (read-only)

    var signedNoteView: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 6) {
                    Image(systemName: "lock.fill").foregroundStyle(.green)
                    Text("This note has been signed and cannot be edited.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.green.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))

                Text(note.contentForSync)
                    .font(.body)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .textSelection(.enabled)

                Text("Signed \(note.updatedAt.formatted(date: .long, time: .shortened))")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding()
        }
    }

    func createAddendum() {
        guard let patient = note.patient else { return }
        let addendum = ClinicalNote(noteType: note.noteType, patient: patient)
        let prefix = "ADDENDUM to \(note.noteType.label) dated \(note.createdAt.formatted(date: .abbreviated, time: .omitted)):\n\n"
        if note.noteType.isStructured {
            addendum.subjective = prefix
        } else {
            addendum.freeText = prefix
        }
        context.insert(addendum)
        try? context.save()
        dismiss()
    }

    // MARK: - SOAP editor

    var soapForm: some View {
        Form {
            Section {
                TextEditor(text: Binding(
                    get: { note.subjective ?? "" },
                    set: { note.subjective = $0.isEmpty ? nil : $0 }
                ))
                .frame(minHeight: 80)
                .overlay(alignment: .topLeading) {
                    if (note.subjective ?? "").isEmpty {
                        Text(soapPlaceholders.s)
                            .foregroundStyle(.tertiary)
                            .padding(.top, 8)
                            .padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
            } header: {
                Label("Subjective", systemImage: "person.fill")
            }

            Section {
                TextEditor(text: Binding(
                    get: { note.objective ?? "" },
                    set: { note.objective = $0.isEmpty ? nil : $0 }
                ))
                .frame(minHeight: 80)
                .overlay(alignment: .topLeading) {
                    if (note.objective ?? "").isEmpty {
                        Text(soapPlaceholders.o)
                            .foregroundStyle(.tertiary)
                            .padding(.top, 8)
                            .padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
                if let patient = note.patient,
                   let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first,
                   v.hasAnyValue {
                    Button {
                        let existing = (note.objective ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                        let vitalsText = vitalsString(from: v)
                        note.objective = existing.isEmpty ? vitalsText : existing + "\n\n" + vitalsText
                    } label: {
                        Label("Insert latest vitals", systemImage: "waveform.path.ecg")
                            .font(.caption)
                    }
                    .foregroundStyle(.teal)
                }
                if let patient = note.patient, !patient.allergies.isEmpty {
                    Button {
                        let list = patient.allergies.map { "\($0.name) (\($0.reaction), \($0.severity))" }.joined(separator: "; ")
                        let allergyLine = "Allergies: \(list)"
                        let existing = (note.objective ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                        note.objective = existing.isEmpty ? allergyLine : existing + "\n" + allergyLine
                    } label: {
                        Label("Insert allergies", systemImage: "exclamationmark.shield")
                            .font(.caption)
                    }
                    .foregroundStyle(.orange)
                }
                if let patient = note.patient {
                    let examParts: [(String, String?)] = [
                        ("General", patient.examGeneral), ("CVS", patient.examCVS),
                        ("Resp", patient.examResp), ("Abdomen", patient.examAbdo),
                        ("Neuro", patient.examNeuro), ("Other", patient.examOther),
                    ]
                    let examLines = examParts.compactMap { label, val -> String? in
                        guard let v = val, !v.isEmpty else { return nil }
                        return "\(label): \(v)"
                    }
                    if !examLines.isEmpty {
                        Button {
                            let examText = "Examination:\n" + examLines.joined(separator: "\n")
                            let existing = (note.objective ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                            note.objective = existing.isEmpty ? examText : existing + "\n\n" + examText
                        } label: {
                            Label("Insert examination findings", systemImage: "stethoscope")
                                .font(.caption)
                        }
                        .foregroundStyle(.teal)
                    }
                    let resulted = patient.investigations.filter { $0.status == .resulted }
                    if !resulted.isEmpty {
                        Button {
                            let invLines = resulted.map { "\($0.name): \($0.result.isEmpty ? "result available" : $0.result)" }
                            let invText = "Investigations:\n" + invLines.joined(separator: "\n")
                            let existing = (note.objective ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                            note.objective = existing.isEmpty ? invText : existing + "\n\n" + invText
                        } label: {
                            Label("Insert investigation results (\(resulted.count))", systemImage: "flask")
                                .font(.caption)
                        }
                        .foregroundStyle(.blue)
                    }
                }
            } header: {
                Label("Objective", systemImage: "stethoscope")
            }

            Section {
                TextEditor(text: Binding(
                    get: { note.assessment ?? "" },
                    set: { note.assessment = $0.isEmpty ? nil : $0 }
                ))
                .frame(minHeight: 80)
                .overlay(alignment: .topLeading) {
                    if (note.assessment ?? "").isEmpty {
                        Text(soapPlaceholders.a)
                            .foregroundStyle(.tertiary)
                            .padding(.top, 8)
                            .padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
                if let patient = note.patient,
                   let aText = patient.assessmentText, !aText.isEmpty {
                    Button {
                        let existing = (note.assessment ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                        note.assessment = existing.isEmpty ? aText : existing + "\n\n" + aText
                    } label: {
                        Label("Insert from Assessment tab", systemImage: "doc.text.magnifyingglass")
                            .font(.caption)
                    }
                    .foregroundStyle(.teal)
                }
                if let patient = note.patient,
                   let dx = patient.workingDiagnosis, (note.assessment ?? "").isEmpty {
                    Button {
                        let icdSuffix = patient.workingDiagnosisICD.map { " [\($0)]" } ?? ""
                        note.assessment = "Working diagnosis: \(dx)\(icdSuffix)"
                    } label: {
                        Label("Use working diagnosis: \(dx)", systemImage: "stethoscope")
                            .font(.caption)
                            .lineLimit(1)
                    }
                    .foregroundStyle(.secondary)
                }
            } header: {
                Label("Assessment", systemImage: "doc.text.magnifyingglass")
            }

            Section {
                TextEditor(text: Binding(
                    get: { note.plan ?? "" },
                    set: { note.plan = $0.isEmpty ? nil : $0 }
                ))
                .frame(minHeight: 80)
                .overlay(alignment: .topLeading) {
                    if (note.plan ?? "").isEmpty {
                        Text(soapPlaceholders.p)
                            .foregroundStyle(.tertiary)
                            .padding(.top, 8)
                            .padding(.leading, 4)
                            .allowsHitTesting(false)
                    }
                }
                if let patient = note.patient,
                   let mgmt = patient.managementPlan, !mgmt.isEmpty,
                   (note.plan ?? "").isEmpty {
                    Button {
                        note.plan = mgmt
                    } label: {
                        Label("Import management plan from Consultation", systemImage: "list.bullet.clipboard")
                            .font(.caption)
                    }
                    .foregroundStyle(.teal)
                }
                if let patient = note.patient,
                   let radiationPlan = DiagnosisRadiationEngine.radiate(
                       workingDiagnosis: patient.workingDiagnosis,
                       ageYears: patient.ageYears,
                       sex: patient.sex
                   ),
                   !radiationPlan.planTemplate.isEmpty {
                    Button {
                        let existing = (note.plan ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
                        let template = radiationPlan.planTemplate.trimmingCharacters(in: .whitespacesAndNewlines)
                        note.plan = existing.isEmpty ? template : existing + "\n\n" + template
                    } label: {
                        Label("Insert \(radiationPlan.conditionName) plan", systemImage: "wand.and.stars")
                            .font(.caption)
                            .lineLimit(1)
                    }
                    .foregroundStyle(.teal)
                }
            } header: {
                Label("Plan", systemImage: "list.bullet.clipboard")
            }
        }
    }

    // MARK: - Free text editor (operative / endoscopy / discharge / other)

    var freeTextForm: some View {
        Form {
            Section {
                TextEditor(text: Binding(
                    get: { note.freeText ?? templateFor(note.noteType, patient: note.patient) },
                    set: { note.freeText = $0 }
                ))
                .frame(minHeight: 300)
                .font(.body.monospaced())
                .overlay(alignment: .bottom) {
                    // Dictation is available when the note belongs to a patient
                    if let patient = note.patient {
                        HStack {
                            MedicalDictationButton(
                                mode: dictationModeFor(note.noteType),
                                patient: patient
                            ) { polished in
                                note.freeText = (note.freeText ?? "") + (note.freeText?.isEmpty == false ? "\n\n" : "") + polished
                            }
                            .padding(8)
                            .background(.ultraThinMaterial, in: Circle())
                            Spacer()
                        }
                        .padding(.horizontal, 12)
                        .padding(.bottom, 8)
                    }
                }
            } header: {
                Label(note.noteType.label, systemImage: note.noteType.icon)
            }
        }
    }

    // MARK: - Status picker

    var statusPicker: some View {
        Picker("Status", selection: $note.status) {
            ForEach(NoteStatus.allCases, id: \.self) { s in
                Label(
                    s == .draft ? "Draft" : "Signed",
                    systemImage: s == .draft ? "pencil.circle" : "checkmark.seal.fill"
                ).tag(s)
            }
        }
        .pickerStyle(.segmented)
        .fixedSize()
    }

}
