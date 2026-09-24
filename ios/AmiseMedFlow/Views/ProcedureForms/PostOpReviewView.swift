import SwiftUI
import SwiftData

// MARK: - Data model

struct PostOpReviewData: Codable {
    var reviewDate: Date?
    var postOpDay: Int = 1
    var reviewedBy: String = "Dr Dawit Daniel Kabiye MD DM"
    var procedure: String = ""
    var procedureDate: Date?

    // Symptoms
    var pain: Int = 0
    var nausea: Bool = false
    var vomiting: Bool = false
    var fever: Bool = false
    var dyspnoea: Bool = false

    // Wound
    var woundInspected: Bool = true
    var woundStatus: String = "Clean and dry"
    var woundFindings: [String] = []
    var woundNotes: String = ""

    // Drain
    var drainPresent: Bool = false
    var drainOutput: String = ""
    var drainFluid: String = "Serous"
    var drainRemoved: Bool = false

    // GI recovery
    var flatus: Bool = false
    var bowelsOpen: Bool = false
    var toleratingDiet: Bool = false
    var dietType: String = "Free fluids"
    var nauseaVomiting: Bool = false

    // Urinary
    var urinaryCatheter: Bool = false
    var urineOutput: String = ""
    var catheterRemoved: Bool = false

    // Mobility
    var mobilising: Bool = false
    var physioSeen: Bool = false

    // VTE
    var dvtProphylaxisGiven: Bool = true
    var teds: Bool = true

    // Vitals
    var tempNormal: Bool = true
    var bpNormal: Bool = true
    var hrNormal: Bool = true
    var news2: String = ""
    var vitalsNotes: String = ""

    // Labs
    var labsOrdered: [String] = []
    var labNotes: String = ""

    // Assessment / plan
    var assessment: String = ""
    var plan: String = ""
    var expectedDischargeDate: Date?
    var dischargeBarriers: [String] = []
}

extension Patient {
    var postOpReviewData: PostOpReviewData {
        get {
            guard let json = postOpReviewDataJson,
                  let raw = json.data(using: .utf8) else {
                var d = PostOpReviewData()
                let sx = surgeryData
                d.procedure    = sx.procedureName
                d.drainPresent = sx.drainInserted
                if let op = operationDate {
                    d.procedureDate = op
                    d.postOpDay = max(1, Calendar.current.dateComponents([.day], from: op, to: .now).day ?? 1)
                }
                return d
            }
            let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
            return (try? decoder.decode(PostOpReviewData.self, from: raw)) ?? PostOpReviewData()
        }
        set {
            let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
            postOpReviewDataJson = (try? String(data: encoder.encode(newValue), encoding: .utf8)) ?? nil
        }
    }
}

// MARK: - View

struct PostOpReviewView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) var context

    @State var data = PostOpReviewData()
    @State var hasReviewDate = false
    @State var hasExpectedDischarge = false
    @State var pdfWrapper: PDFDataWrapper?

    let woundFindingOptions = [
        "Sutures intact", "Staples intact", "Wound open / dehiscence",
        "Purulent discharge", "Haematoma", "Seroma",
        "Superficial infection", "Deep infection", "Healing well"
    ]
    let drainFluidOptions = ["Serous", "Serosanguineous", "Sanguineous", "Bile", "Pus", "Enteric content"]
    let labOptions = ["FBC", "U&E / Creatinine", "LFT", "CRP", "Serum amylase",
                               "Coagulation", "Blood cultures", "Wound swab", "Urine MC&S"]
    let dischargeBarrierOptions = [
        "Ongoing pain", "Nausea / vomiting", "Wound concern",
        "Awaiting pathology", "Awaiting imaging", "Social care",
        "Physiotherapy input needed", "District nurse arrangement", "Medical clearance needed"
    ]

    var body: some View {
        Form {
            reviewHeaderSection
            symptomsSection
            woundSection
            if data.drainPresent { drainSection }
            giRecoverySection
            urinarySection
            mobilityVTESection
            vitalsSection
            labsSection
            assessmentSection
            dischargeSection
        }
        .navigationTitle("Post-op Review")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    let pdf = ProcedureFormPDF.postOpReview(patient: patient, data: data)
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
            data = patient.postOpReviewData
            hasReviewDate = data.reviewDate != nil
            hasExpectedDischarge = data.expectedDischargeDate != nil

            // Cross-populate drain state from surgery note when not yet set
            // (handles re-opening after surgery note was updated)
            if !data.drainPresent && patient.surgeryData.drainInserted {
                data.drainPresent = true
                save()
            }

            // Pre-fill NEWS2 from latest recorded vitals
            if data.news2.isEmpty,
               let latest = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first,
               latest.hasAnyValue {
                data.news2 = "\(latest.news2Score)"
                save()
            }

            // Auto-populate vitals boolean flags on first open (before any edits saved)
            if patient.postOpReviewDataJson == nil,
               let latest = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first,
               latest.hasAnyValue {
                if let temp = latest.temperatureCelsius {
                    data.tempNormal = (temp >= 36.0 && temp <= 37.5)
                }
                if let sys = latest.bpSystolic {
                    data.bpNormal = (sys >= 90 && sys <= 140)
                }
                if let hr = latest.heartRate {
                    data.hrNormal = (hr >= 50 && hr <= 100)
                }
                save()
            }

            // Pre-fill lab notes with resulted investigations if not yet recorded
            if data.labNotes.isEmpty {
                let resulted = patient.investigations
                    .filter { $0.status == .resulted && !$0.result.isEmpty }
                    .sorted { ($0.resultedAt ?? $0.orderedAt) > ($1.resultedAt ?? $1.orderedAt) }
                if !resulted.isEmpty {
                    data.labNotes = resulted.prefix(8)
                        .map { "\($0.name): \($0.result)" }
                        .joined(separator: "\n")
                    save()
                }
            }
        }
    }

}
