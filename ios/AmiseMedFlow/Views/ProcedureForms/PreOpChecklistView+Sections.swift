// PreOpChecklistView+Sections.swift
// Section @ViewBuilder functions and helpers for PreOpChecklistView.

import SwiftUI
import SwiftData


extension PreOpChecklistView {

    // MARK: - Sections

    @ViewBuilder
    var preOpSafetySection: some View {
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
                            let critParts: [String] = {
                                var p: [String] = []
                                if let hb = labs.haemoglobin, hb.value < 8   { p.append("Hb \(String(format: "%.1f", hb.value)) g/dL") }
                                if let pl = labs.platelets,  pl.value < 50   { p.append("Plt \(Int(pl.value)) ×10⁹/L") }
                                if let cr = labs.creatinine, cr.value > 300  { p.append("Cr \(Int(cr.value)) µmol/L") }
                                if let ir = labs.inr,        ir.value > 2.5  { p.append("INR \(String(format: "%.1f", ir.value))") }
                                if let na = labs.sodium, na.value < 120 || na.value > 155 { p.append("Na \(Int(na.value)) mmol/L") }
                                if let k  = labs.potassium, k.value < 2.5 || k.value > 6.0 { p.append("K \(String(format: "%.1f", k.value)) mmol/L") }
                                if let la = labs.lactate,    la.value >= 4.0 { p.append("Lactate \(String(format: "%.1f", la.value)) mmol/L") }
                                if let tr = labs.troponin,   tr.value > 52   { p.append("Troponin \(Int(tr.value)) ng/L") }
                                if let ca = labs.calcium, ca.value < 1.75 || ca.value > 3.0 { p.append("Ca \(String(format: "%.2f", ca.value)) mmol/L") }
                                if let gl = labs.glucose, gl.value < 3.0 || gl.value > 20.0 { p.append("Glucose \(String(format: "%.1f", gl.value)) mmol/L") }
                                return p
                            }()
                            Text(critParts.isEmpty
                                 ? "Review FBC, coagulation, and renal function before induction of anaesthesia."
                                 : critParts.joined(separator: " · "))
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

    var teamSection: some View {
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

    var signInSection: some View {
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

    var timeOutSection: some View {
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

    var signOutSection: some View {
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

    var signInComplete: Bool {
        data.si_identityConfirmed && data.si_siteProcedureConfirmed &&
        data.si_consentConfirmed && (data.si_siteMarked || data.si_siteMarkingNA) &&
        data.si_anaesthesiaCheckComplete && data.si_pulseOxFunctioning &&
        data.si_timeRecorded
    }

    var timeOutComplete: Bool {
        data.to_teamIntroduced && data.to_patientSiteProcedureConfirmed &&
        data.to_surgeonCriticalSteps && data.to_anaesthesiaConcerns &&
        data.to_nursingEquipmentReady &&
        (data.to_antibioticGiven || data.to_antibioticNA) &&
        (data.to_imagingDisplayed || data.to_imagingNA) &&
        data.to_timeRecorded
    }

    var signOutComplete: Bool {
        data.so_procedureDocumented &&
        data.so_instrumentCountCorrect && data.so_spongeCountCorrect && data.so_needleCountCorrect &&
        (data.so_specimenLabelled || data.so_specimenNA) &&
        data.so_timeRecorded
    }

    func save() {
        patient.preOpChecklistData = data
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }

    @ViewBuilder
    func phaseHeader(_ title: String, subtitle: String, complete: Bool) -> some View {
        HStack(spacing: 6) {
            Text(title)
            Text("·")
                .foregroundStyle(.secondary)
            Text(subtitle)
                .font(.caption)
                .foregroundStyle(.secondary)
            Spacer()
            Image(systemName: complete ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(complete ? .green : .secondary.opacity(0.4))
                .font(.system(size: 14))
        }
    }

    @ViewBuilder
    func checkRow(_ label: String, value: Binding<Bool>,
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
            .contentShape(Rectangle())   // whole row tappable, not only its text
        }
        .buttonStyle(.plain)
    }

    @ViewBuilder
    func phaseTimeRow(label: String,
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
