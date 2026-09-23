import SwiftUI
import SwiftData

// MARK: - Data model

struct ReferralLetterData: Codable {
    var letterDate: Date = .now
    var fromDoctor: String = "Dr Dawit Daniel Kabiye, MD, DM"
    var fromPractice: String = "Amise Medical Services, Saint Lucia"
    var toDoctor: String = ""
    var toPractice: String = ""
    var letterType: String = "Referral"
    var urgency: String = "Routine"
    var salutation: String = ""
    var patientBackground: String = ""
    var presentingComplaint: String = ""
    var clinicalFindings: String = ""
    var investigationsOrdered: String = ""
    var managementToDate: String = ""
    var diagnosis: String = ""
    var requestedAction: String = ""
    var closingNote: String = ""
    var copyTo: String = ""
}

extension Patient {
    var referralLetterData: ReferralLetterData {
        get {
            guard let json = referralLetterDataJson,
                  let raw = json.data(using: .utf8) else {
                var d = ReferralLetterData()
                d.diagnosis           = workingDiagnosis ?? ""
                d.presentingComplaint = chiefComplaint ?? ""

                // patientBackground — prefer structured entries for completeness
                var bgParts: [String] = []
                let pmh = pmhEntries
                if !pmh.isEmpty {
                    let pmhText = pmh.map { e in
                        let yr = e.yearText.isEmpty ? "" : " (\(e.yearText))"
                        return "• \(e.condition)\(yr)"
                    }.joined(separator: "\n")
                    bgParts.append("PMH:\n\(pmhText)")
                } else if let pmhFree = pmhNotes, !pmhFree.isEmpty {
                    bgParts.append("PMH: \(pmhFree)")
                }
                let pshx = pshxEntries
                if !pshx.isEmpty {
                    let pshxText = pshx.map { e in
                        var line = "• \(e.procedure)"
                        if !e.yearText.isEmpty { line += " (\(e.yearText))" }
                        if !e.anaesthetic.isEmpty { line += " [\(e.anaesthetic)]" }
                        return line
                    }.joined(separator: "\n")
                    bgParts.append("Surgical history:\n\(pshxText)")
                } else if let pshxFree = surgicalHistory, !pshxFree.isEmpty {
                    bgParts.append("Surgical history: \(pshxFree)")
                }
                if let fhx = familyHistoryNotes, !fhx.isEmpty { bgParts.append("Family history: \(fhx)") }
                if let soc = socialHistory, !soc.isEmpty { bgParts.append("Social history: \(soc)") }
                d.patientBackground = bgParts.joined(separator: "\n\n")

                let proc = surgeryData.procedureName
                if !proc.isEmpty { d.managementToDate = "Patient underwent \(proc)." }
                return d
            }
            let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
            return (try? decoder.decode(ReferralLetterData.self, from: raw)) ?? ReferralLetterData()
        }
        set {
            let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
            referralLetterDataJson = (try? String(data: encoder.encode(newValue), encoding: .utf8)) ?? nil
        }
    }
}

// MARK: - View

struct ReferralLetterView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context

    @State private var data = ReferralLetterData()
    @State private var pdfWrapper: PDFDataWrapper?

    var body: some View {
        Form {
            letterHeaderSection
            recipientSection
            patientContextSection
            letterBodySection
            closingSection
        }
        .navigationTitle("Referral / Reply Letter")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    let pdf = ProcedureFormPDF.referralLetter(patient: patient, data: data)
                    pdfWrapper = PDFDataWrapper(data: pdf)
                } label: {
                    Label("Export PDF", systemImage: "arrow.up.doc.fill")
                }
            }
        }
        .sheet(item: $pdfWrapper) { wrapper in
            ShareSheet(items: [wrapper.data])
        }
        .onAppear {
            data = patient.referralLetterData

            var needsSave = false

            // Clinical findings: examination + latest vitals
            if data.clinicalFindings.isEmpty {
                var findingParts: [String] = []
                let examPairs: [(String, String?)] = [
                    ("General",      patient.examGeneral),
                    ("CVS",          patient.examCVS),
                    ("Respiratory",  patient.examResp),
                    ("Abdomen",      patient.examAbdo),
                    ("Neurological", patient.examNeuro),
                    ("MSK",          patient.examMSK),
                    ("Skin",         patient.examSkin),
                    ("Other",        patient.examOther),
                ]
                for (label, val) in examPairs {
                    if let v = val, !v.isEmpty { findingParts.append("\(label): \(v)") }
                }
                if let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first,
                   v.hasAnyValue {
                    var vParts: [String] = ["NEWS2 \(v.news2Score) (\(v.news2Risk))"]
                    if let bp = v.bpString  { vParts.append("BP \(bp)") }
                    if let hr = v.heartRate { vParts.append("HR \(hr)") }
                    if let t  = v.temperatureCelsius { vParts.append(String(format: "Temp %.1f°C", t)) }
                    if let s  = v.spo2 { vParts.append("SpO₂ \(s)%") }
                    findingParts.append("Vitals: " + vParts.joined(separator: ", "))
                }
                if !findingParts.isEmpty {
                    data.clinicalFindings = findingParts.joined(separator: "\n")
                    needsSave = true
                }
            }

            // Pre-fill investigations/results from resulted entries when not yet entered
            if data.investigationsOrdered.isEmpty {
                let resulted = patient.investigations.filter { $0.status == .resulted }
                if !resulted.isEmpty {
                    data.investigationsOrdered = resulted
                        .map { $0.result.isEmpty ? $0.name : "\($0.name): \($0.result)" }
                        .joined(separator: "\n")
                    needsSave = true
                }
            }

            // Cross-populate management history from surgery note when not yet entered
            if data.managementToDate.isEmpty {
                let proc = patient.surgeryData.procedureName
                if !proc.isEmpty {
                    data.managementToDate = "Patient underwent \(proc)."
                    needsSave = true
                }
            }

            if needsSave { save() }
        }
    }

    // MARK: Sections

    private var letterHeaderSection: some View {
        Section("Letter Details") {
            Picker("Type", selection: $data.letterType) {
                ForEach(["Referral", "Reply to GP", "Reply to specialist",
                         "Discharge summary letter", "Second opinion request",
                         "Insurance / medicolegal report"], id: \.self) { Text($0) }
            }
            .onChange(of: data.letterType) { _, _ in save() }
            Picker("Urgency", selection: $data.urgency) {
                ForEach(["Routine", "Soon (within 2 weeks)", "Urgent (within 48 h)", "Emergency"], id: \.self) { Text($0) }
            }
            .onChange(of: data.urgency) { _, _ in save() }
            DatePicker("Letter date", selection: Binding(
                get: { data.letterDate },
                set: { data.letterDate = $0; save() }
            ), displayedComponents: [.date])
        }
    }

    private var recipientSection: some View {
        Section("Recipient") {
            TextField("To (doctor name)", text: $data.toDoctor)
                .onChange(of: data.toDoctor) { _, _ in save() }
            TextField("Practice / hospital", text: $data.toPractice)
                .onChange(of: data.toPractice) { _, _ in save() }
            TextField("Opening salutation (optional)", text: $data.salutation,
                      prompt: Text("e.g. I am writing regarding this patient whom I review in clinic…"))
                .onChange(of: data.salutation) { _, _ in save() }
        }
    }

    private var patientContextSection: some View {
        Section {
            TextField("Background / medical history", text: $data.patientBackground, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.patientBackground) { _, _ in save() }
            TextField("Presenting complaint / reason for referral", text: $data.presentingComplaint, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.presentingComplaint) { _, _ in save() }
            TextField("Clinical findings", text: $data.clinicalFindings, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.clinicalFindings) { _, _ in save() }
            TextField("Investigations / results", text: $data.investigationsOrdered, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.investigationsOrdered) { _, _ in save() }
            TextField("Management to date", text: $data.managementToDate, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.managementToDate) { _, _ in save() }
            TextField("Diagnosis / impression", text: $data.diagnosis, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.diagnosis) { _, _ in save() }
        } header: {
            HStack {
                Text("Patient Information")
                Spacer()
                MedicalDictationButton(mode: .consultation, patient: patient) { polished in
                    data.presentingComplaint += (data.presentingComplaint.isEmpty ? "" : "\n\n") + polished
                    save()
                }
            }
        }
    }

    private var letterBodySection: some View {
        Section("Request / Action Required") {
            TextField("What you are requesting from the recipient", text: $data.requestedAction, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.requestedAction) { _, _ in save() }
        }
    }

    private var closingSection: some View {
        Section("Closing") {
            TextField("Closing paragraph (leave blank for default)", text: $data.closingNote, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.closingNote) { _, _ in save() }
            TextField("From", text: $data.fromDoctor)
                .onChange(of: data.fromDoctor) { _, _ in save() }
            TextField("Copy to (cc)", text: $data.copyTo)
                .onChange(of: data.copyTo) { _, _ in save() }
        }
    }

    // MARK: Helpers

    private func save() {
        patient.referralLetterData = data
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }
}
