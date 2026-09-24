// DischargeSummaryView+Sections.swift
// Section @ViewBuilder functions and helpers for DischargeSummaryView.

import SwiftUI
import SwiftData


extension DischargeSummaryView {

    // MARK: Sections

    var admissionSection: some View {
        Section("Admission & Discharge") {
            TextField("Ward / unit", text: $data.ward)
                .onChange(of: data.ward) { _, _ in save() }
            TextField("Admitting doctor", text: $data.admittingDoctor)
                .onChange(of: data.admittingDoctor) { _, _ in save() }
            TextField("Surgeon", text: $data.surgeonName)
                .onChange(of: data.surgeonName) { _, _ in save() }
            TextField("Anaesthetist", text: $data.anaesthetistName)
                .onChange(of: data.anaesthetistName) { _, _ in save() }
            Toggle("Set admission date", isOn: $hasAdmissionDate)
                .onChange(of: hasAdmissionDate) { _, on in
                    data.admissionDate = on ? (data.admissionDate ?? .now) : nil; save()
                }
            if hasAdmissionDate {
                DatePicker("Admitted", selection: Binding(
                    get: { data.admissionDate ?? .now },
                    set: { data.admissionDate = $0; save() }
                ), displayedComponents: [.date])
            }
            Toggle("Set discharge date", isOn: $hasDischargeDate)
                .onChange(of: hasDischargeDate) { _, on in
                    data.dischargeDate = on ? (data.dischargeDate ?? .now) : nil; save()
                }
            if hasDischargeDate {
                DatePicker("Discharged", selection: Binding(
                    get: { data.dischargeDate ?? .now },
                    set: { data.dischargeDate = $0; save() }
                ), displayedComponents: [.date])
            }
        }
    }

    var diagnosisSection: some View {
        Section("Diagnosis") {
            TextField("Admission diagnosis", text: $data.admissionDiagnosis, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.admissionDiagnosis) { _, _ in save() }
            TextField("Discharge diagnosis", text: $data.dischargeDiagnosis, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.dischargeDiagnosis) { _, _ in save() }
            TextField("ICD-10 code", text: $data.icdCode)
                .onChange(of: data.icdCode) { _, _ in save() }
        }
    }

    var procedureSection: some View {
        Section("Procedure(s) Performed") {
            TextField("Procedure(s) performed (leave blank if none)", text: $data.procedurePerformed, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.procedurePerformed) { _, _ in save() }
        }
    }

    var courseSection: some View {
        Section {
            TextField("Summary of in-hospital course", text: $data.inHospitalCourse, axis: .vertical)
                .lineLimit(4...)
                .onChange(of: data.inHospitalCourse) { _, _ in save() }
            TextField("Complications (none if blank)", text: $data.complicationsInHospital, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.complicationsInHospital) { _, _ in save() }
            Toggle("Blood transfusion given", isOn: $data.bloodTransfusion)
                .onChange(of: data.bloodTransfusion) { _, _ in save() }
            if data.bloodTransfusion {
                HStack {
                    Text("Units")
                    Spacer()
                    TextField("—", text: $data.bloodUnits)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 60)
                        .onChange(of: data.bloodUnits) { _, _ in save() }
                    Text("unit(s)").foregroundStyle(.secondary)
                }
            }
            Toggle("ITU / HDU admission", isOn: $data.ituAdmission)
                .onChange(of: data.ituAdmission) { _, _ in save() }
            if data.ituAdmission {
                HStack {
                    Text("Duration")
                    Spacer()
                    TextField("—", text: $data.ituDays)
                        .keyboardType(.numberPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 60)
                        .onChange(of: data.ituDays) { _, _ in save() }
                    Text("days").foregroundStyle(.secondary)
                }
            }
        } header: {
            HStack {
                Text("In-Hospital Course")
                Spacer()
                MedicalDictationButton(mode: .consultation, patient: patient) { polished in
                    data.inHospitalCourse += (data.inHospitalCourse.isEmpty ? "" : "\n\n") + polished
                    save()
                }
            }
        }
    }

    var resultsSection: some View {
        Section("Results Pending / Received") {
            TextField("Pathology / histology results", text: $data.pathologyResults, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.pathologyResults) { _, _ in save() }
            TextField("Imaging results", text: $data.imagingResults, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.imagingResults) { _, _ in save() }
        }
    }

    var dischargeStatusSection: some View {
        Section("Discharge Status") {
            Picker("Destination", selection: $data.dischargeDestination) {
                ForEach(["Home", "Home with district nurse", "Nursing home",
                         "Rehab facility", "Transfer to another hospital", "Deceased"], id: \.self) { Text($0) }
            }
            .onChange(of: data.dischargeDestination) { _, _ in save() }
            Picker("Mobility", selection: $data.mobileStatus) {
                ForEach(["Ambulatory", "Ambulatory with aid", "Wheelchair", "Bed-bound"], id: \.self) { Text($0) }
            }
            .onChange(of: data.mobileStatus) { _, _ in save() }
            TextField("Discharge medications", text: $data.dischargeMedications, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.dischargeMedications) { _, _ in save() }
            Picker("VTE risk assessment", selection: $data.vteAssessment) {
                ForEach(["Low risk", "Moderate risk", "High risk"], id: \.self) { Text($0) }
            }
            .onChange(of: data.vteAssessment) { _, _ in save() }
            Toggle("VTE prophylaxis prescribed", isOn: $data.vteProphylaxisGiven)
                .onChange(of: data.vteProphylaxisGiven) { _, _ in save() }
            if data.vteProphylaxisGiven {
                TextField("Agent (e.g. Enoxaparin 40 mg OD)", text: $data.vteProphylaxisAgent)
                    .onChange(of: data.vteProphylaxisAgent) { _, _ in save() }
                TextField("Duration (e.g. 28 days)", text: $data.vteProphylaxisDuration)
                    .onChange(of: data.vteProphylaxisDuration) { _, _ in save() }
            }
        }
    }

    var woundDrainSection: some View {
        Section("Wound & Drain") {
            TextField("Wound care instructions", text: $data.woundCare, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.woundCare) { _, _ in save() }
            Toggle("Drain in situ at discharge", isOn: $data.drainInSitu)
                .onChange(of: data.drainInSitu) { _, _ in save() }
            if data.drainInSitu {
                TextField("Drain type", text: $data.drainType)
                    .onChange(of: data.drainType) { _, _ in save() }
                Toggle("Set removal date", isOn: $hasDrainRemovalDate)
                    .onChange(of: hasDrainRemovalDate) { _, on in
                        data.drainRemovalDate = on ? (data.drainRemovalDate ?? .now) : nil; save()
                    }
                if hasDrainRemovalDate {
                    DatePicker("Drain removal", selection: Binding(
                        get: { data.drainRemovalDate ?? .now },
                        set: { data.drainRemovalDate = $0; save() }
                    ), displayedComponents: [.date])
                }
            }
        }
    }

    var restrictionsSection: some View {
        Section("Restrictions & Advice") {
            TextField("Activity restrictions", text: $data.activityRestrictions, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.activityRestrictions) { _, _ in save() }
            TextField("Dietary advice", text: $data.dietaryAdvice, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.dietaryAdvice) { _, _ in save() }
        }
    }

    var returnPrecautionsSection: some View {
        Section("Return Precautions") {
            chipMultiSelect("", options: returnPrecautionOptions, selected: $data.returnPrecautions)
                .onChange(of: data.returnPrecautions) { _, _ in save() }
            TextField("Other precautions", text: $data.returnPrecautionsOther, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.returnPrecautionsOther) { _, _ in save() }
        }
    }

    var followUpSection: some View {
        Section("Follow-up") {
            TextField("Follow-up appointment / instructions", text: $data.followUpAppointment, axis: .vertical)
                .lineLimit(2...)
                .onChange(of: data.followUpAppointment) { _, _ in save() }
        }
    }

    var gpSection: some View {
        Section("GP / Referrer Notification") {
            Toggle("GP / referring doctor notified", isOn: $data.gpNotified)
                .onChange(of: data.gpNotified) { _, _ in save() }
            if data.gpNotified {
                TextField("GP / referrer name", text: $data.gpName)
                    .onChange(of: data.gpName) { _, _ in save() }
            }
        }
    }

    var additionalSection: some View {
        Section("Additional Notes") {
            TextField("Any other relevant information", text: $data.additionalNotes, axis: .vertical)
                .lineLimit(3...)
                .onChange(of: data.additionalNotes) { _, _ in save() }
        }
    }

    // MARK: Helpers

    func save() {
        patient.dischargeSummaryData = data
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }

    @ViewBuilder
    func chipMultiSelect(_ label: String, options: [String], selected: Binding<[String]>) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            if !label.isEmpty {
                Text(label).font(.system(size: 12)).foregroundStyle(.secondary)
            }
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 6) {
                    ForEach(options, id: \.self) { opt in
                        let on = selected.wrappedValue.contains(opt)
                        Button {
                            if on { selected.wrappedValue.removeAll { $0 == opt } }
                            else  { selected.wrappedValue.append(opt) }
                        } label: {
                            Text(opt)
                                .font(.system(size: 11, weight: on ? .semibold : .regular))
                                .foregroundStyle(on ? .white : .primary)
                                .padding(.horizontal, 10).padding(.vertical, 5)
                                .background(on ? AMColor.accent : Color.secondary.opacity(0.12), in: Capsule())
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
    }

}
