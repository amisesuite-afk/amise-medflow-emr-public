import SwiftUI
import SwiftData
import UIKit

// PatientDemographicsForm.swift
// Patient demographics form — shared between iPhone and iPad.

// MARK: - Demographics form (shared between iPhone details tab and iPad panel)

struct PatientDemographicsForm: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context

    @State private var hasDOB: Bool = false
    @State private var heightStr: String = ""

    var body: some View {
        Form {
            demographicsSection
            clinicalSection
            anthropometricsSection
            if patient.setting == .inpatient || patient.setting == .emergency {
                admissionSection
            }
            if patient.setting == .theatre || patient.setting == .endoscopy {
                procedureSection
            }
            extendedSection
            notesSection
        }
        .onAppear {
            hasDOB = patient.dateOfBirth != nil
            heightStr = patient.heightCm.map { String(format: "%.0f", $0) } ?? ""
        }
    }

    private func touch() {
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }

    private static func generateMRN() -> String {
        let digits = (0..<6).map { _ in String(Int.random(in: 0...9)) }.joined()
        return "AMI-\(digits)"
    }

    // MARK: Identity

    @ViewBuilder
    private var demographicsSection: some View {
        Section("Identity") {
            TextField("Full name", text: $patient.fullName)
                .onChange(of: patient.fullName) { _, _ in touch() }
            Picker("Sex", selection: $patient.sex) {
                ForEach(Sex.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            .onChange(of: patient.sex) { _, _ in touch() }
            Toggle("Date of birth", isOn: $hasDOB)
                .onChange(of: hasDOB) { _, on in
                    if !on { patient.dateOfBirth = nil; touch() }
                    else if patient.dateOfBirth == nil {
                        patient.dateOfBirth = Calendar.current.date(byAdding: .year, value: -40, to: .now)
                        touch()
                    }
                }
            if hasDOB {
                DatePicker("", selection: Binding(
                    get: { patient.dateOfBirth ?? .now },
                    set: { patient.dateOfBirth = $0; touch() }
                ), displayedComponents: .date)
                .labelsHidden()
                LabeledContent("Age") { Text(patient.ageDisplay ?? "—") }
            }
            HStack(spacing: 8) {
                TextField("MRN (optional)", text: Binding(
                    get: { patient.mrn ?? "" },
                    set: { patient.mrn = $0.isEmpty ? nil : $0; touch() }
                ))
                if patient.mrn == nil || (patient.mrn?.isEmpty == true) {
                    Button("Generate") {
                        patient.mrn = Self.generateMRN()
                        touch()
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(AMColor.accent)
                    .buttonStyle(.bordered)
                }
            }
        }
        Section("Contact") {
            TextField("Phone", text: Binding(
                get: { patient.phone ?? "" },
                set: { patient.phone = $0.isEmpty ? nil : $0; touch() }
            )).keyboardType(.phonePad)
            TextField("Email", text: Binding(
                get: { patient.email ?? "" },
                set: { patient.email = $0.isEmpty ? nil : $0; touch() }
            )).keyboardType(.emailAddress).autocapitalization(.none)
            TextField("Address", text: Binding(
                get: { patient.address ?? "" },
                set: { patient.address = $0.isEmpty ? nil : $0; touch() }
            ))
        }
    }

    // MARK: Clinical

    @ViewBuilder
    private var clinicalSection: some View {
        Section("Clinical") {
            Picker("Setting", selection: $patient.setting) {
                ForEach(ClinicalSetting.allCases, id: \.self) {
                    Label($0.rawValue, systemImage: $0.icon).tag($0)
                }
            }
            .onChange(of: patient.setting) { _, _ in touch() }
            Picker("Location", selection: $patient.location) {
                ForEach(ClinicalLocation.selectable(including: patient.location), id: \.self) { Text($0.rawValue).tag($0) }
            }
            .onChange(of: patient.location) { _, _ in touch() }
            Picker("Acuity", selection: $patient.acuity) {
                ForEach(Acuity.allCases, id: \.self) { acuity in
                    HStack {
                        AcuityPip(acuity: acuity).accessibilityHidden(true)
                        Text(acuity.label)
                    }.tag(acuity)
                }
            }
            .onChange(of: patient.acuity) { _, _ in touch() }
            Picker("Visit Type", selection: Binding(
                get: { patient.visitType ?? .newConsult },
                set: { patient.visitType = $0; touch() }
            )) {
                ForEach(VisitType.allCases, id: \.self) { vt in
                    Label(vt.rawValue, systemImage: vt.icon).tag(vt)
                }
            }
            TextField("Chief complaint", text: Binding(
                get: { patient.chiefComplaint ?? "" },
                set: { patient.chiefComplaint = $0.isEmpty ? nil : $0; touch() }
            ))
        }
    }

    // MARK: Anthropometrics

    @ViewBuilder
    private var anthropometricsSection: some View {
        Section("Anthropometrics") {
            HStack {
                TextField("Height (cm)", text: $heightStr)
                    .keyboardType(.decimalPad)
                    .onChange(of: heightStr) { _, v in
                        patient.heightCm = Double(v) ?? nil
                        touch()
                    }
                Text("cm").foregroundStyle(.secondary)
            }
            if let bmi = patient.latestBMI(), let cat = patient.bmiCategory {
                LabeledContent("BMI") {
                    Text(String(format: "%.1f — %@", bmi, cat))
                        .foregroundStyle(bmi < 18.5 || bmi >= 30 ? .orange : .secondary)
                }
            } else if patient.heightCm != nil {
                Label("Record weight in Vitals to calculate BMI", systemImage: "scalemass")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: Admission

    @ViewBuilder
    private var admissionSection: some View {
        Section("Admission") {
            TextField("Ward", text: Binding(
                get: { patient.ward ?? "" },
                set: { patient.ward = $0.isEmpty ? nil : $0; touch() }
            ))
            TextField("Bed", text: Binding(
                get: { patient.bedNumber ?? "" },
                set: { patient.bedNumber = $0.isEmpty ? nil : $0; touch() }
            ))
            DatePicker(
                "Admitted",
                selection: Binding(
                    get: { patient.admittedAt ?? .now },
                    set: { patient.admittedAt = $0; touch() }
                ),
                displayedComponents: [.date, .hourAndMinute]
            )
            if let admitted = patient.admittedAt {
                let los = max(0, Calendar.current.dateComponents([.day], from: admitted, to: .now).day ?? 0)
                LabeledContent("Length of stay") { Text("Day \(los + 1)") }
            }
            Toggle("Expected discharge date", isOn: Binding(
                get: { patient.expectedDischarge != nil },
                set: { on in
                    patient.expectedDischarge = on
                        ? (patient.expectedDischarge ?? Calendar.current.date(byAdding: .day, value: 3, to: .now) ?? .now)
                        : nil
                    touch()
                }
            ))
            if patient.expectedDischarge != nil {
                DatePicker(
                    "Expected d/c",
                    selection: Binding(
                        get: { patient.expectedDischarge ?? .now },
                        set: { patient.expectedDischarge = $0; touch() }
                    ),
                    displayedComponents: .date
                )
            }
        }
    }

    // MARK: Procedure

    @ViewBuilder
    private var procedureSection: some View {
        Section("Procedure") {
            TextField("Appointment / procedure type", text: Binding(
                get: { patient.appointmentType ?? "" },
                set: { patient.appointmentType = $0.isEmpty ? nil : $0; touch() }
            ))
            DatePicker("Date & time",
                       selection: Binding(
                           get: { patient.operationDate ?? .now },
                           set: { patient.operationDate = $0; touch() }
                       ),
                       displayedComponents: [.date, .hourAndMinute])
            if let days = patient.postOpDays {
                LabeledContent("Post-op day", value: "POD \(days)")
            }
            Picker("ASA Class", selection: Binding<Int>(
                get: { patient.asaClass ?? 0 },
                set: { patient.asaClass = $0 == 0 ? nil : $0; touch() }
            )) {
                Text("Not set").tag(0)
                Text("ASA I — Healthy").tag(1)
                Text("ASA II — Mild systemic disease").tag(2)
                Text("ASA III — Severe systemic disease").tag(3)
                Text("ASA IV — Life-threatening disease").tag(4)
                Text("ASA V — Moribund").tag(5)
            }
        }
    }

    // MARK: Extended

    @ViewBuilder
    private var extendedSection: some View {
        Section("Medical History") {
            TextField("Past medical history", text: Binding(
                get: { patient.pmhNotes ?? "" },
                set: { patient.pmhNotes = $0.isEmpty ? nil : $0; touch() }
            ), axis: .vertical).lineLimit(3...)
            TextField("Surgical history", text: Binding(
                get: { patient.surgicalHistory ?? "" },
                set: { patient.surgicalHistory = $0.isEmpty ? nil : $0; touch() }
            ), axis: .vertical).lineLimit(2...)
            TextField("Family history", text: Binding(
                get: { patient.familyHistoryNotes ?? "" },
                set: { patient.familyHistoryNotes = $0.isEmpty ? nil : $0; touch() }
            ), axis: .vertical).lineLimit(2...)
        }
        Section("Next of Kin") {
            TextField("Name", text: Binding(
                get: { patient.nokName ?? "" },
                set: { patient.nokName = $0.isEmpty ? nil : $0; touch() }
            ))
            TextField("Relationship", text: Binding(
                get: { patient.nokRelation ?? "" },
                set: { patient.nokRelation = $0.isEmpty ? nil : $0; touch() }
            ))
            TextField("Phone", text: Binding(
                get: { patient.nokPhone ?? "" },
                set: { patient.nokPhone = $0.isEmpty ? nil : $0; touch() }
            )).keyboardType(.phonePad)
        }
        Section("Insurance") {
            TextField("Provider", text: Binding(
                get: { patient.insuranceProvider ?? "" },
                set: { patient.insuranceProvider = $0.isEmpty ? nil : $0; touch() }
            ))
            TextField("Policy number", text: Binding(
                get: { patient.policyNumber ?? "" },
                set: { patient.policyNumber = $0.isEmpty ? nil : $0; touch() }
            ))
        }
        Section("Referral") {
            Picker("Source", selection: Binding(
                get: { patient.referralSource ?? .selfReferral },
                set: { patient.referralSource = $0; touch() }
            )) {
                ForEach(ReferralSource.allCases, id: \.self) { src in
                    Text(src.rawValue).tag(src)
                }
            }
            TextField("Referring doctor", text: Binding(
                get: { patient.referringDoctor ?? "" },
                set: { patient.referringDoctor = $0.isEmpty ? nil : $0; touch() }
            ))
            TextField("Referring practice", text: Binding(
                get: { patient.referringPractice ?? "" },
                set: { patient.referringPractice = $0.isEmpty ? nil : $0; touch() }
            ))
        }
    }

    // MARK: Notes

    @ViewBuilder
    private var notesSection: some View {
        Section("General Notes") {
            TextEditor(text: Binding(
                get: { patient.notes ?? "" },
                set: { patient.notes = $0.isEmpty ? nil : $0; touch() }
            ))
            .frame(minHeight: 80)
        }
    }
}

