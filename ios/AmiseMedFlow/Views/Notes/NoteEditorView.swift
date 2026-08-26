import SwiftUI
import SwiftData

struct NoteEditorView: View {
    @Bindable var note: ClinicalNote
    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var context
    @StateObject private var ai = AIService()

    @State private var showAIOptions   = false
    @State private var aiError: String?
    @State private var showError       = false
    @State private var showShareSheet  = false
    @State private var shareURL: URL?
    @State private var isExportingPDF  = false

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
                        Button {
                            Task { await exportPDF() }
                        } label: {
                            HStack(spacing: 4) {
                                if isExportingPDF { ProgressView().scaleEffect(0.7) }
                                Label("PDF", systemImage: "arrow.up.doc.fill")
                                    .font(.caption)
                            }
                        }
                        .disabled(isExportingPDF || note.isEmpty || note.patient == nil)
                        .foregroundStyle(.indigo)

                        Button {
                            showAIOptions = true
                        } label: {
                            HStack(spacing: 4) {
                                if ai.isGenerating { ProgressView().scaleEffect(0.7) }
                                Label("AI Draft", systemImage: "sparkles")
                                    .font(.caption)
                            }
                        }
                        .disabled(ai.isGenerating || note.patient == nil)
                        .foregroundStyle(.purple)
                    }
                }
            }
            .confirmationDialog("AI Draft — \(note.noteType.label)", isPresented: $showAIOptions, titleVisibility: .visible) {
                if note.noteType.isStructured, let patient = note.patient {
                    Button("Generate SOAP draft") { Task { await generateSOAP(patient: patient) } }
                }
                if let patient = note.patient {
                    Button("Generate full draft") { Task { await generateFreeText(patient: patient) } }
                }
                Button("Cancel", role: .cancel) {}
            }
            .alert("AI Error", isPresented: $showError) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(aiError ?? "Unknown error")
            }
            .sheet(isPresented: $showShareSheet) {
                if let url = shareURL {
                    ShareSheet(items: [url])
                        .presentationDetents([.medium, .large])
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
                    get: { note.freeText ?? templateFor(note.noteType, patient: note.patient) },
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

    // MARK: - AI generation

    private func generateSOAP(patient: Patient) async {
        do {
            let draft = try await ai.generateSOAP(patient: patient, noteType: note.noteType)
            note.subjective  = draft.s
            note.objective   = draft.o
            note.assessment  = draft.a
            note.plan        = draft.p
            note.updatedAt   = .now
            note.pendingSync = true
        } catch {
            aiError = error.localizedDescription
            showError = true
        }
    }

    private func generateFreeText(patient: Patient) async {
        do {
            let text = try await ai.generateFreeText(patient: patient, noteType: note.noteType)
            note.freeText    = text
            note.updatedAt   = .now
            note.pendingSync = true
        } catch {
            aiError = error.localizedDescription
            showError = true
        }
    }

    // MARK: - PDF export

    private func exportPDF() async {
        guard let patient = note.patient else { return }
        isExportingPDF = true
        defer { isExportingPDF = false }

        let data = ClinicalNotePDF.generate(note: note, patient: patient)

        // Save as PatientDocument so it appears in Documents tab
        let df = DateFormatter()
        df.dateFormat = "yyyy-MM-dd_HHmm"
        let fileName = "\(note.noteType.label.replacingOccurrences(of: " ", with: "_"))_\(df.string(from: note.createdAt)).pdf"
        let doc = PatientDocument(fileName: fileName, mimeType: "application/pdf", category: "Clinical Notes")
        doc.localData = data
        doc.patient = patient
        context.insert(doc)
        patient.updatedAt = .now
        patient.pendingSync = true

        // Write to temp file for share sheet
        let tmp = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)
        try? data.write(to: tmp)
        shareURL = tmp
        showShareSheet = true
    }

    // MARK: - Vitals insert helper

    private func vitalsString(from v: VitalsEntry) -> String {
        let ts = v.recordedAt.formatted(date: .abbreviated, time: .shortened)
        var parts: [String] = ["Vitals (\(ts)):"]
        if let bp = v.bpString          { parts.append("BP \(bp) mmHg") }
        if let hr = v.heartRate          { parts.append("HR \(hr) bpm") }
        if let rr = v.respiratoryRate    { parts.append("RR \(rr) /min") }
        if let t  = v.temperatureCelsius { parts.append("Temp \(String(format: "%.1f", t))°C") }
        if let sp = v.spo2               { parts.append("SpO₂ \(sp)%") }
        if let wt = v.weightKg           { parts.append("Wt \(String(format: "%.1f", wt)) kg") }
        return parts.joined(separator: "  ·  ")
    }

    // MARK: - Templates

    private func templateFor(_ type: NoteType, patient: Patient? = nil) -> String {
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
            let refDr = patient?.referringDoctor.map { "Dr \($0)" } ?? ""
            let refCC = patient?.chiefComplaint ?? ""
            return """
            CONSULTATION NOTE  ·  \(today)
            Consultant: Dr Dawit Daniel Kabiye

            Referring doctor: \(refDr)
            Reason for referral: \(refCC)

            History:


            Examination:


            Impression:


            Recommendations:


            Thank you for this referral.
            """

        case .referralLetter:
            let ptName   = patient.map { "\($0.fullName), \($0.sex.rawValue.prefix(1))\($0.ageYears > 0 ? ", \($0.ageYears)y" : "")" } ?? ""
            let dxLine   = patient?.workingDiagnosis ?? patient?.chiefComplaint ?? ""
            let reLine   = [ptName, dxLine].filter { !$0.isEmpty }.joined(separator: " — ")
            let toLine: String
            if let refDr = patient?.referringDoctor, !refDr.isEmpty {
                let practice = patient?.referringPractice.map { " (\($0))" } ?? ""
                toLine = "Dear Dr \(refDr)\(practice),"
            } else {
                toLine = "Dear Dr ,"
            }
            let meds: String = {
                guard let p = patient, !p.prescriptions.isEmpty else { return "Nil" }
                return p.prescriptions.map { $0.displayLine }.joined(separator: "\n")
            }()
            let allergiesLine: String = {
                guard let p = patient else { return "NKDA" }
                let list = p.allergies
                return list.isEmpty ? "NKDA" : list.map { "\($0.name) (\($0.reaction))" }.joined(separator: "; ")
            }()
            return """
            \(today)

            \(toLine)

            RE: \(reLine)

            I am writing to refer this patient for your expert review regarding:


            Relevant history:


            Investigations:


            Current medications:
            \(meds)

            Allergies: \(allergiesLine)

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
