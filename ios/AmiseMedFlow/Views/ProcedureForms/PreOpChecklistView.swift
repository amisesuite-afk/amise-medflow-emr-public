import SwiftUI
import SwiftData

// MARK: - Data model

struct PreOpChecklistData: Codable {
    var checklistDate: Date = .now
    var location: String = ""
    var surgeonName: String = PracticeProfile.current.clinicianNameWithCredentials
    var anaesthetistName: String = ""
    var scrubNurseName: String = ""
    var circulatingNurseName: String = ""

    // MARK: Sign In — before induction of anaesthesia
    var si_identityConfirmed: Bool = false
    var si_siteProcedureConfirmed: Bool = false
    var si_consentConfirmed: Bool = false
    var si_siteMarked: Bool = false
    var si_siteMarkingNA: Bool = false
    var si_anaesthesiaCheckComplete: Bool = false
    var si_pulseOxFunctioning: Bool = false
    var si_knownAllergy: Bool = false
    var si_allergyDetails: String = ""
    var si_difficultAirway: Bool = false
    var si_airwayDetails: String = ""
    var si_bloodLossRisk: Bool = false
    var si_bloodLossPrep: String = ""
    var si_time: Date = .now
    var si_timeRecorded: Bool = false
    var si_confirmedBy: String = ""

    // MARK: Time Out — before skin incision
    var to_teamIntroduced: Bool = false
    var to_patientSiteProcedureConfirmed: Bool = false
    var to_surgeonCriticalSteps: Bool = false
    var to_anaesthesiaConcerns: Bool = false
    var to_nursingEquipmentReady: Bool = false
    var to_antibioticGiven: Bool = false
    var to_antibioticNA: Bool = false
    var to_antibioticName: String = ""
    var to_imagingDisplayed: Bool = false
    var to_imagingNA: Bool = false
    var to_time: Date = .now
    var to_timeRecorded: Bool = false
    var to_confirmedBy: String = ""

    // MARK: Sign Out — before patient leaves operating room
    var so_procedureDocumented: Bool = false
    var so_instrumentCountCorrect: Bool = false
    var so_spongeCountCorrect: Bool = false
    var so_needleCountCorrect: Bool = false
    var so_countDiscrepancy: String = ""
    var so_specimenLabelled: Bool = false
    var so_specimenNA: Bool = false
    var so_specimenDetails: String = ""
    var so_equipmentIssues: Bool = false
    var so_equipmentNotes: String = ""
    var so_recoveryConcerns: String = ""
    var so_time: Date = .now
    var so_timeRecorded: Bool = false
    var so_confirmedBy: String = ""
}

extension Patient {
    var preOpChecklistData: PreOpChecklistData {
        get {
            guard let json = preOpChecklistDataJson,
                  let raw = json.data(using: .utf8) else {
                var d = PreOpChecklistData()
                d.anaesthetistName = consentFormData.anaesthetistName
                return d
            }
            let decoder = JSONDecoder(); decoder.dateDecodingStrategy = .iso8601
            return (try? decoder.decode(PreOpChecklistData.self, from: raw)) ?? PreOpChecklistData()
        }
        set {
            let encoder = JSONEncoder(); encoder.dateEncodingStrategy = .iso8601
            preOpChecklistDataJson = (try? String(data: encoder.encode(newValue), encoding: .utf8)) ?? nil
        }
    }
}

// MARK: - View

struct PreOpChecklistView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) var context

    @State var data = PreOpChecklistData()
    @State var pdfWrapper: PDFDataWrapper?

    var body: some View {
        Form {
            preOpSafetySection
            teamSection
            signInSection
            timeOutSection
            signOutSection
        }
        .navigationTitle("Pre-op Checklist")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .navigationBarTrailing) {
                Button {
                    pdfWrapper = PDFDataWrapper(data: ProcedureFormPDF.preOpChecklist(patient: patient, data: data))
                } label: {
                    Label("Export PDF", systemImage: "arrow.up.doc.fill")
                }
            }
        }
        .sheet(item: $pdfWrapper) { wrapper in
            ShareSheet(items: [wrapper.data])
        }
        .onAppear {
            data = patient.preOpChecklistData

            // Seed date from operation date when the checklist hasn't been started yet
            if !data.si_timeRecorded, let opDate = patient.operationDate {
                data.checklistDate = opDate
                data.si_time = opDate
                data.to_time = opDate
                data.so_time = opDate
            }

            // Cross-populate team from surgery note (only if still blank)
            let sx = patient.surgeryData
            if data.anaesthetistName.isEmpty    { data.anaesthetistName    = sx.anaesthetist }
            if data.scrubNurseName.isEmpty      { data.scrubNurseName      = sx.scrubNurse }
            if data.circulatingNurseName.isEmpty { data.circulatingNurseName = sx.circNurse }

            save()

            // Auto-seed known allergy from patient record
            if !data.si_knownAllergy && !patient.allergies.isEmpty {
                data.si_knownAllergy = true
                if data.si_allergyDetails.isEmpty {
                    data.si_allergyDetails = patient.allergies
                        .map { "\($0.name) (\($0.severity))" }
                        .joined(separator: ", ")
                }
                save()
            }

            // Auto-flag blood loss risk from pre-op lab values
            let labs = LabPanel.parse(from: patient.investigations)
            let anaemia = labs.haemoglobin.map { $0.value < 100 } ?? false
            let lowPlts = labs.platelets.map   { $0.value < 100 } ?? false
            if !data.si_bloodLossRisk && (anaemia || lowPlts || patient.hasAnticoagulation) {
                data.si_bloodLossRisk = true
                if data.si_bloodLossPrep.isEmpty {
                    var reasons: [String] = []
                    if anaemia, let hb = labs.haemoglobin {
                        reasons.append("Hb \(String(format: "%.1f", hb.value)) g/dL")
                    }
                    if lowPlts, let plt = labs.platelets {
                        reasons.append("Plt \(Int(plt.value))")
                    }
                    if patient.hasAnticoagulation { reasons.append("anticoagulation") }
                    data.si_bloodLossPrep = "Large-bore IV × 2; G&S/crossmatch. [\(reasons.joined(separator: ", "))]"
                }
                save()
            }

            // Auto-flag difficult airway from Mallampati ≥ 3
            if !data.si_difficultAirway, let mallampati = patient.mallampatiScore, mallampati >= 3 {
                data.si_difficultAirway = true
                if data.si_airwayDetails.isEmpty {
                    data.si_airwayDetails = "Mallampati class \(mallampati) — anticipate difficult intubation; senior anaesthetist and videolaryngoscope."
                }
                save()
            }

            // Auto-mark site marking N/A for endoscopy (no skin-site marking required)
            if !data.si_siteMarked && !data.si_siteMarkingNA && patient.setting == .endoscopy {
                data.si_siteMarkingNA = true
                save()
            }
        }
    }

}
