import SwiftUI
import SwiftData

struct NoteEditorView: View {
    @Bindable var note: ClinicalNote
    @Environment(\.dismiss) private var dismiss

    private let soapPlaceholders = (
        s: "What the patient reports — symptoms, history, concerns",
        o: "Vital signs, examination findings, investigation results",
        a: "Impression, working diagnosis, problem list",
        p: "Management plan — investigations, medications, follow-up, referrals"
    )

    var body: some View {
        NavigationStack {
            Group {
                if note.noteType.isStructured {
                    soapForm
                } else {
                    freeTextForm
                }
            }
            .navigationTitle(note.noteType.label)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") {
                        note.updatedAt = .now
                        note.pendingSync = true
                        dismiss()
                    }
                }
                ToolbarItem(placement: .bottomBar) {
                    HStack {
                        statusPicker
                        Spacer()
                    }
                }
            }
        }
    }

    // MARK: - SOAP editor

    private var soapForm: some View {
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
            } header: {
                Label("Plan", systemImage: "list.bullet.clipboard")
            }
        }
    }

    // MARK: - Free text editor (operative / endoscopy / discharge / other)

    private var freeTextForm: some View {
        Form {
            Section {
                TextEditor(text: Binding(
                    get: { note.freeText ?? templateFor(note.noteType) },
                    set: { note.freeText = $0 }
                ))
                .frame(minHeight: 300)
                .font(.body.monospaced())
            } header: {
                Label(note.noteType.label, systemImage: note.noteType.icon)
            }
        }
    }

    // MARK: - Status picker

    private var statusPicker: some View {
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

    // MARK: - Templates

    private func templateFor(_ type: NoteType) -> String {
        let today = Date.now.formatted(date: .abbreviated, time: .omitted)
        switch type {
        case .operative:
            return """
            OPERATIVE NOTE  ·  \(today)
            Surgeon: Dr Dawit Daniel Kabiye

            Procedure:
            Indication:
            Anaesthesia:
            Position:
            Prep & drape: Standard
            Incision:

            Findings:


            Technique:


            Haemostasis: Adequate
            Estimated blood loss:
            Irrigation:
            Closure:
            Drains: None
            Specimens:

            Complications: None

            Post-operative instructions:

            """

        case .endoscopy:
            return """
            ENDOSCOPY REPORT  ·  \(today)
            Endoscopist: Dr Dawit Daniel Kabiye

            Procedure:
            Indication:
            Instrument:
            Anaesthesia / sedation:
            Patient position: Left lateral

            FINDINGS
            --------

            Impression / Diagnosis:


            Plan:


            Biopsies / interventions:
            Patient tolerated procedure well.
            """

        case .discharge:
            return """
            DISCHARGE SUMMARY  ·  \(today)
            Consultant: Dr Dawit Daniel Kabiye

            Admitted:
            Discharged:
            Diagnosis:
            Procedures:

            Hospital course:


            Discharge condition:
            Discharge medications:


            Follow-up:
            Return precautions:
            Wound care:
            Diet / activity:
            """

        case .consultation:
            return """
            CONSULTATION NOTE  ·  \(today)
            Consultant: Dr Dawit Daniel Kabiye

            Referring doctor:
            Reason for referral:

            History:


            Examination:


            Impression:


            Recommendations:


            Thank you for this referral.
            """

        case .referralLetter:
            return """
            \(today)

            Dear Dr ,

            RE:

            I am writing to refer this patient for your expert review regarding:


            Relevant history:


            Investigations:


            Current medications:


            I would appreciate your assessment and management.

            Yours sincerely,
            Dr Dawit Daniel Kabiye
            General & Endoscopic Surgeon
            Amise Medical Services, Saint Lucia
            """

        default:
            return ""
        }
    }
}
