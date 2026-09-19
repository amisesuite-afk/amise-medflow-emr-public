import SwiftUI
import SwiftData

// MARK: - Data model

struct PatientInstructionsData: Codable {
    var dischargeDate: Date = .now
    var surgeonName: String = "Dr Dawit Daniel Kabiye, MD, DM"
    var procedurePerformed: String = ""
    var procedureExplanation: String = ""

    // Wound / site care
    var woundCareInstructions: String = ""
    var sutureInfo: String = ""

    // Diet
    var dietInstructions: String = ""

    // Activity and driving
    var activityInstructions: String = ""
    var drivingInstructions: String = ""

    // Medications and pain relief
    var medicationInstructions: String = ""

    // Follow-up
    var followUpInstructions: String = ""

    // Additional warnings (standard ones are always printed)
    var additionalWarnings: String = ""

    // Contact
    var contactPhone: String = "+1 (758) 284-0557"
    var contactAddress: String = "Amise Medical Services, Saint Lucia"

    // Additional notes
    var additionalNotes: String = ""
}

extension Patient {
    var patientInstructionsData: PatientInstructionsData {
        get {
            guard let json = patientInstructionsDataJson,
                  let raw = json.data(using: .utf8) else {
                return defaultPatientInstructions
            }
            let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
            return (try? decoder.decode(PatientInstructionsData.self, from: raw)) ?? defaultPatientInstructions
        }
        set {
            let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
            patientInstructionsDataJson = (try? String(data: encoder.encode(newValue), encoding: .utf8)) ?? nil
        }
    }

    private var defaultPatientInstructions: PatientInstructionsData {
        var d = PatientInstructionsData()
        d.procedurePerformed = surgeryData.procedureName
        switch visitType {
        case .surgeryElective, .surgeryEmergency, .dayOfSurgery:
            d.woundCareInstructions =
                "Keep your wound dry for 48 hours. You may shower after this, " +
                "directing water away from the wound. Do not submerge in a bath, " +
                "pool, or the sea until the wound is fully healed."
            d.sutureInfo =
                "Your sutures will be reviewed at your follow-up appointment. " +
                "Dissolvable sutures absorb over 2–4 weeks. Non-dissolvable " +
                "sutures or staples will be removed at the clinic."
            d.dietInstructions =
                "Start with clear fluids and light foods as tolerated. " +
                "Return to your normal diet gradually over the next 24–48 hours."
            d.activityInstructions =
                "Rest for the first 24–48 hours. Avoid heavy lifting (more than " +
                "5 kg) for 4 weeks, or as specifically advised by your surgeon."
            d.drivingInstructions =
                "Do not drive for at least 24 hours after your anaesthetic, and " +
                "only when you can perform an emergency stop comfortably without pain."
            d.medicationInstructions =
                "Take pain relief as prescribed. Paracetamol 1 g every 6 hours " +
                "and Ibuprofen 400 mg every 8 hours with food may be taken as " +
                "needed. Do not exceed the recommended doses on the packaging."
            d.followUpInstructions =
                "Please attend your follow-up appointment as arranged, " +
                "typically 2 weeks after your operation."
        case .ogd:
            d.woundCareInstructions = "No wound care required."
            d.dietInstructions =
                "You may eat and drink normally once the throat numbness has " +
                "worn off — usually within 1 hour. A mild sore throat for " +
                "1–2 days is normal."
            d.activityInstructions =
                "You may resume normal activities the following day. " +
                "Mild bloating or belching is normal and will pass."
            d.drivingInstructions =
                "Do not drive for 24 hours if you received sedation."
            d.medicationInstructions =
                "Take your usual medications unless advised otherwise."
            d.followUpInstructions =
                "Results will be discussed at your follow-up appointment " +
                "or communicated to you directly as arranged."
        case .colonoscopy:
            d.woundCareInstructions = "No wound care required."
            d.dietInstructions =
                "You may resume a normal diet. Drink plenty of fluids. " +
                "Mild abdominal cramping and bloating after the procedure " +
                "is normal and will settle over a few hours."
            d.activityInstructions =
                "You may resume normal activities the following day."
            d.drivingInstructions =
                "Do not drive for 24 hours if you received sedation."
            d.medicationInstructions =
                "Resume your usual medications as normal, including any " +
                "blood-thinning medications from the date advised by your doctor."
            d.followUpInstructions =
                "Results and any biopsy findings will be discussed at your " +
                "follow-up appointment or communicated to you directly."
        case .ercp:
            d.woundCareInstructions = "No wound care required."
            d.dietInstructions =
                "Commence with clear fluids and light meals. Gradually " +
                "return to a normal diet as tolerated."
            d.activityInstructions =
                "Rest for 24 hours. You may experience mild abdominal " +
                "discomfort — this is expected. If you develop severe upper " +
                "abdominal pain, please contact us or go to the emergency department."
            d.drivingInstructions =
                "Do not drive for 24 hours after your procedure."
            d.medicationInstructions =
                "Take pain relief as prescribed. Resume blood-thinning " +
                "medications only on the date specifically advised by your doctor."
            d.followUpInstructions =
                "A follow-up appointment will be arranged as discussed."
        case .postOp:
            d.followUpInstructions =
                "Continue attending your scheduled follow-up appointments. " +
                "Contact us if you have any concerns before your next visit."
            d.activityInstructions =
                "Continue to observe any activity restrictions given at discharge."
            d.medicationInstructions =
                "Continue all medications as prescribed. Do not stop any " +
                "prescribed medication without consulting your surgeon."
        default:
            d.followUpInstructions =
                "A follow-up appointment will be arranged as discussed."
        }
        return d
    }
}

// MARK: - View

struct PatientInstructionsView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context

    @State private var data = PatientInstructionsData()
    @State private var pdfWrapper: PDFDataWrapper?

    var body: some View {
        Form {
            headerSection
            if isEndoscopy { endoscopyNotesSection }
            woundSection
            dietSection
            activitySection
            medicationSection
            followUpSection
            warningsSection
            contactSection
            if !data.additionalNotes.isEmpty || true { additionalSection }
        }
        .navigationTitle("Patient Instructions")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    pdfWrapper = PDFDataWrapper(
                        data: ProcedureFormPDF.patientInstructions(patient: patient, data: data))
                } label: {
                    Label("Export PDF", systemImage: "arrow.up.doc.fill")
                }
            }
        }
        .sheet(item: $pdfWrapper) { wrapper in
            ShareSheet(items: [wrapper.data])
        }
        .onAppear {
            data = patient.patientInstructionsData
        }
    }

    private var isEndoscopy: Bool {
        patient.visitType == .ogd || patient.visitType == .colonoscopy || patient.visitType == .ercp
    }

    // MARK: - Sections

    private var headerSection: some View {
        Section("Discharge Details") {
            DatePicker("Date", selection: Binding(
                get: { data.dischargeDate },
                set: { data.dischargeDate = $0; save() }
            ), displayedComponents: [.date])
            TextField("Surgeon", text: $data.surgeonName)
                .onChange(of: data.surgeonName) { _, _ in save() }
            TextField("Procedure performed", text: $data.procedurePerformed)
                .onChange(of: data.procedurePerformed) { _, _ in save() }
            TextField("Plain-language explanation of procedure (optional)",
                      text: $data.procedureExplanation, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.procedureExplanation) { _, _ in save() }
        }
    }

    private var endoscopyNotesSection: some View {
        Section {
            Text("Mild sore throat / bloating after endoscopy is expected and will settle.")
                .font(.caption)
                .foregroundStyle(.secondary)
            Text("Mild abdominal cramping after colonoscopy is normal.")
                .font(.caption)
                .foregroundStyle(.secondary)
        } header: {
            Text("What to expect")
        }
    }

    private var woundSection: some View {
        Section("Wound / Site Care") {
            TextField("Wound care instructions", text: $data.woundCareInstructions, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.woundCareInstructions) { _, _ in save() }
            TextField("Sutures / dressings", text: $data.sutureInfo, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.sutureInfo) { _, _ in save() }
        }
    }

    private var dietSection: some View {
        Section("Diet and Fluids") {
            TextField("Diet instructions", text: $data.dietInstructions, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.dietInstructions) { _, _ in save() }
        }
    }

    private var activitySection: some View {
        Section("Activity and Driving") {
            TextField("Activity restrictions", text: $data.activityInstructions, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.activityInstructions) { _, _ in save() }
            TextField("Driving", text: $data.drivingInstructions, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.drivingInstructions) { _, _ in save() }
        }
    }

    private var medicationSection: some View {
        Section("Medications and Pain Relief") {
            TextField("Medication instructions", text: $data.medicationInstructions, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.medicationInstructions) { _, _ in save() }
        }
    }

    private var followUpSection: some View {
        Section("Follow-up") {
            TextField("Follow-up instructions", text: $data.followUpInstructions, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.followUpInstructions) { _, _ in save() }
        }
    }

    private var warningsSection: some View {
        Section {
            ForEach(standardWarnings, id: \.self) { warning in
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                        .font(.system(size: 12))
                    Text(warning)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            TextField("Additional warning signs (optional)",
                      text: $data.additionalWarnings, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.additionalWarnings) { _, _ in save() }
        } header: {
            Text("When to Seek Urgent Help")
        } footer: {
            Text("These standard warning signs are always printed. Add any procedure-specific alerts above.")
                .font(.caption2)
        }
    }

    private var contactSection: some View {
        Section("Contact Details") {
            TextField("Phone", text: $data.contactPhone)
                .onChange(of: data.contactPhone) { _, _ in save() }
            TextField("Practice address", text: $data.contactAddress)
                .onChange(of: data.contactAddress) { _, _ in save() }
        }
    }

    private var additionalSection: some View {
        Section("Additional Notes") {
            TextField("Any other information for the patient",
                      text: $data.additionalNotes, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.additionalNotes) { _, _ in save() }
        }
    }

    // MARK: - Helpers

    private let standardWarnings = [
        "Fever above 38.5°C (101.3°F)",
        "Increasing pain not controlled by prescribed pain relief",
        "Signs of wound infection: redness, swelling, warmth, or discharge",
        "Excessive bleeding from the wound or any body opening",
        "Difficulty breathing or chest pain — call 911 immediately",
        "Inability to pass urine for more than 6–8 hours",
        "Persistent vomiting preventing fluid intake",
    ]

    private func save() {
        patient.patientInstructionsData = data
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }
}
