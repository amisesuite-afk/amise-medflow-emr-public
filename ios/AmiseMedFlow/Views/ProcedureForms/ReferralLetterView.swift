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
                d.patientBackground   = [pmhNotes, familyHistoryNotes].compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: "\n")
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
