import SwiftUI
import SwiftData

// MARK: - Data model

struct PreOpChecklistData: Codable {
    var checklistDate: Date = .now
    var location: String = ""
    var surgeonName: String = "Dr Dawit Daniel Kabiye, MD, DM"
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
    @Environment(\.modelContext) private var context

    @State private var data = PreOpChecklistData()
    @State private var pdfWrapper: PDFDataWrapper?

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
        }
    }

    // MARK: - Sections

    @ViewBuilder
    private var preOpSafetySection: some View {
        let labs = LabPanel.parse(from: patient.investigations)
        if labs.hasCriticalValues || patient.hasCriticalAllergy {
            Section {
                if labs.hasCriticalValues {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "flask.fill")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.red)
                            .frame(width: 20)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Critical lab values present")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(.red)
                            Text("Review FBC, coagulation, and renal function before induction of anaesthesia.")
                                .font(.system(size: 11))
                                .foregroundStyle(.secondary)
                        }
                    }
                }
                if patient.hasCriticalAllergy {
                    HStack(alignment: .top, spacing: 10) {
                        Image(systemName: "exclamationmark.shield.fill")
                            .font(.system(size: 14, weight: .bold))
                            .foregroundStyle(.red)
                            .frame(width: 20)
                        VStack(alignment: .leading, spacing: 2) {
                            Text("Critical allergy")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(.red)
                            let crit = patient.allergies.filter {
                                $0.severity.lowercased().contains("severe") ||
                                $0.severity.lowercased().contains("anaphyl")
                            }
                            if !crit.isEmpty {
                                Text(crit.map { "\($0.name) — \($0.severity)" }.joined(separator: "\n"))
                                    .font(.system(size: 11))
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                }
            } header: {
                Label("Pre-op Safety Flags", systemImage: "exclamationmark.triangle.fill")
                    .foregroundStyle(.red)
            }
        }
    }

    private var teamSection: some View {
        Section("Team & Date") {
            DatePicker("Date", selection: Binding(
                get: { data.checklistDate },
                set: { data.checklistDate = $0; save() }
            ), displayedComponents: [.date])
            TextField("Location / Theatre", text: $data.location,
                      prompt: Text("e.g. Tapion OR 1"))
                .onChange(of: data.location) { _, _ in save() }
            TextField("Surgeon", text: $data.surgeonName)
                .onChange(of: data.surgeonName) { _, _ in save() }
            TextField("Anaesthetist", text: $data.anaesthetistName)
                .onChange(of: data.anaesthetistName) { _, _ in save() }
            TextField("Scrub nurse", text: $data.scrubNurseName)
                .onChange(of: data.scrubNurseName) { _, _ in save() }
            TextField("Circulating nurse", text: $data.circulatingNurseName)
                .onChange(of: data.circulatingNurseName) { _, _ in save() }
        }
    }

    private var signInSection: some View {
        Section {
            checkRow("Patient identity confirmed (name, DOB, MRN)", value: $data.si_identityConfirmed)
            checkRow("Site and procedure confirmed", value: $data.si_siteProcedureConfirmed)
            checkRow("Consent obtained and signed", value: $data.si_consentConfirmed)

            HStack(spacing: 12) {
                checkRow("Surgical site marked", value: $data.si_siteMarked)
                Divider()
                checkRow("N/A", value: $data.si_siteMarkingNA)
            }

            checkRow("Anaesthesia machine / medication check complete", value: $data.si_anaesthesiaCheckComplete)
            checkRow("Pulse oximeter on and functioning", value: $data.si_pulseOxFunctioning)

            // Known allergy
            checkRow("Known allergy?", value: $data.si_knownAllergy, accent: .orange)
            if data.si_knownAllergy {
                TextField("Allergy details", text: $data.si_allergyDetails)
                    .onChange(of: data.si_allergyDetails) { _, _ in save() }
            }

            // Difficult airway
            checkRow("Difficult airway / aspiration risk?", value: $data.si_difficultAirway, accent: .orange)
            if data.si_difficultAirway {
                TextField("Airway plan / details", text: $data.si_airwayDetails, axis: .vertical)
                    .lineLimit(2...)
                    .onChange(of: data.si_airwayDetails) { _, _ in save() }
            }

            // Blood loss risk
            checkRow("Risk of blood loss > 500 mL?", value: $data.si_bloodLossRisk, accent: .orange)
            if data.si_bloodLossRisk {
                TextField("IV access / fluid preparation", text: $data.si_bloodLossPrep)
                    .onChange(of: data.si_bloodLossPrep) { _, _ in save() }
            }

            phaseTimeRow(label: "Sign In time",
                         recorded: $data.si_timeRecorded,
                         time: $data.si_time,
                         confirmedBy: $data.si_confirmedBy)
        } header: {
            phaseHeader("Sign In", subtitle: "Before induction of anaesthesia",
                        complete: signInComplete)
        }
    }

    private var timeOutSection: some View {
        Section {
            checkRow("All team members introduced by name and role", value: $data.to_teamIntroduced)
            checkRow("Patient identity, site and procedure confirmed by all", value: $data.to_patientSiteProcedureConfirmed)
            checkRow("Surgeon: critical steps, duration, anticipated blood loss stated", value: $data.to_surgeonCriticalSteps)
            checkRow("Anaesthesia: patient-specific concerns stated", value: $data.to_anaesthesiaConcerns)
            checkRow("Nursing: sterility confirmed, equipment issues stated", value: $data.to_nursingEquipmentReady)

            // Antibiotic prophylaxis
            HStack(spacing: 12) {
                checkRow("Antibiotic prophylaxis given (within 60 min)", value: $data.to_antibioticGiven)
                Divider()
                checkRow("N/A", value: $data.to_antibioticNA)
            }
            if data.to_antibioticGiven {
                TextField("Antibiotic and dose", text: $data.to_antibioticName,
                          prompt: Text("e.g. Cefazolin 2g IV"))
                    .onChange(of: data.to_antibioticName) { _, _ in save() }
            }

            // Essential imaging
            HStack(spacing: 12) {
                checkRow("Essential imaging displayed", value: $data.to_imagingDisplayed)
                Divider()
                checkRow("N/A", value: $data.to_imagingNA)
            }

            phaseTimeRow(label: "Time Out time",
                         recorded: $data.to_timeRecorded,
                         time: $data.to_time,
                         confirmedBy: $data.to_confirmedBy)
        } header: {
            phaseHeader("Time Out", subtitle: "Before skin incision",
                        complete: timeOutComplete)
        }
    }

    private var signOutSection: some View {
        Section {
            checkRow("Procedure name documented", value: $data.so_procedureDocumented)
            checkRow("Instrument count correct", value: $data.so_instrumentCountCorrect)
            checkRow("Sponge count correct", value: $data.so_spongeCountCorrect)
            checkRow("Needle / sharps count correct", value: $data.so_needleCountCorrect)
            if !data.so_instrumentCountCorrect || !data.so_spongeCountCorrect || !data.so_needleCountCorrect {
                TextField("Count discrepancy / action taken", text: $data.so_countDiscrepancy, axis: .vertical)
                    .lineLimit(2...)
                    .onChange(of: data.so_countDiscrepancy) { _, _ in save() }
            }

            // Specimen
            HStack(spacing: 12) {
                checkRow("Specimen labelled (name, site, laterality)", value: $data.so_specimenLabelled)
                Divider()
                checkRow("N/A", value: $data.so_specimenNA)
            }
            if data.so_specimenLabelled {
                TextField("Specimen details", text: $data.so_specimenDetails,
                          prompt: Text("e.g. Gallbladder — histopathology"))
                    .onChange(of: data.so_specimenDetails) { _, _ in save() }
            }

            checkRow("Equipment issues to be addressed?", value: $data.so_equipmentIssues, accent: .orange)
            if data.so_equipmentIssues {
                TextField("Equipment notes", text: $data.so_equipmentNotes, axis: .vertical)
                    .lineLimit(2...)
                    .onChange(of: data.so_equipmentNotes) { _, _ in save() }
            }

            TextField("Key concerns for recovery / ward handover",
                      text: $data.so_recoveryConcerns, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.so_recoveryConcerns) { _, _ in save() }

            phaseTimeRow(label: "Sign Out time",
                         recorded: $data.so_timeRecorded,
                         time: $data.so_time,
                         confirmedBy: $data.so_confirmedBy)
        } header: {
            phaseHeader("Sign Out", subtitle: "Before patient leaves operating room",
                        complete: signOutComplete)
        }
    }

    // MARK: - Helpers

    private var signInComplete: Bool {
        data.si_identityConfirmed && data.si_siteProcedureConfirmed &&
        data.si_consentConfirmed && (data.si_siteMarked || data.si_siteMarkingNA) &&
        data.si_anaesthesiaCheckComplete && data.si_pulseOxFunctioning &&
        data.si_timeRecorded
    }

    private var timeOutComplete: Bool {
        data.to_teamIntroduced && data.to_patientSiteProcedureConfirmed &&
        data.to_surgeonCriticalSteps && data.to_anaesthesiaConcerns &&
        data.to_nursingEquipmentReady &&
        (data.to_antibioticGiven || data.to_antibioticNA) &&
        (data.to_imagingDisplayed || data.to_imagingNA) &&
        data.to_timeRecorded
    }

    private var signOutComplete: Bool {
        data.so_procedureDocumented &&
        data.so_instrumentCountCorrect && data.so_spongeCountCorrect && data.so_needleCountCorrect &&
        (data.so_specimenLabelled || data.so_specimenNA) &&
        data.so_timeRecorded
    }

    private func save() {
        patient.preOpChecklistData = data
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }

    @ViewBuilder
    private func phaseHeader(_ title: String, subtitle: String, complete: Bool) -> some View {
        HStack(spacing: 6) {
            Text(title)
            Text("·")
                .foregroundStyle(.secondary)
            Text(subtitle)
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
            Image(systemName: complete ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(complete ? .green : Color.secondary.opacity(0.4))
                .font(.system(size: 14))
        }
    }

    @ViewBuilder
    private func checkRow(_ label: String, value: Binding<Bool>,
                          accent: Color = AMColor.accent) -> some View {
        Button {
            value.wrappedValue.toggle()
            save()
        } label: {
            HStack(spacing: 10) {
                Image(systemName: value.wrappedValue ? "checkmark.square.fill" : "square")
                    .foregroundStyle(value.wrappedValue ? accent : .secondary)
                    .font(.system(size: 18))
                Text(label)
                    .font(.subheadline)
                    .foregroundStyle(.primary)
                    .multilineTextAlignment(.leading)
                Spacer()
            }
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    private func phaseTimeRow(label: String,
                              recorded: Binding<Bool>,
                              time: Binding<Date>,
                              confirmedBy: Binding<String>) -> some View {
        Toggle(label, isOn: recorded)
            .onChange(of: recorded.wrappedValue) { _, newVal in
                if newVal { time.wrappedValue = .now }
                save()
            }
        if recorded.wrappedValue {
            DatePicker("Time", selection: time, displayedComponents: [.hourAndMinute])
                .onChange(of: time.wrappedValue) { _, _ in save() }
            TextField("Confirmed by", text: confirmedBy)
                .onChange(of: confirmedBy.wrappedValue) { _, _ in save() }
        }
    }
}
