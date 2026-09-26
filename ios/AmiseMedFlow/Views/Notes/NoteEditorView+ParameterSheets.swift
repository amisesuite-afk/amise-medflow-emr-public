// NoteEditorView+ParameterSheets.swift
// Parameter sheets for note draft generation.

import SwiftUI
import SwiftData

// MARK: - Parameter sheets for note draft generation

struct ReferralParamsSheet: View {
    @Binding var specialty: String
    @Binding var reason: String
    let onGenerate: () -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section("Referring to") {
                    TextField("Specialty (e.g. Cardiology, Oncology)", text: $specialty)
                        .autocorrectionDisabled()
                }
                Section("Reason for referral") {
                    TextField("Brief clinical reason…", text: $reason, axis: .vertical)
                        .lineLimit(3...)
                }
                Section {
                    Button {
                        onGenerate()
                    } label: {
                        Label("Draft Referral Letter", systemImage: "doc.text.magnifyingglass")
                            .frame(maxWidth: .infinity)
                    }
                    .foregroundStyle(.purple)
                }
            }
            .navigationTitle("Referral Details")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium])
    }
}

struct DischargeParamsSheet: View {
    @Binding var treatment: String
    @Binding var followUp: String
    let onGenerate: () -> Void

    var body: some View {
        NavigationStack {
            Form {
                Section("Treatment provided") {
                    TextField("Procedures, interventions, medications given…", text: $treatment, axis: .vertical)
                        .lineLimit(3...)
                }
                Section("Follow-up plan") {
                    TextField("Outpatient review, district nurse, GP, investigations…", text: $followUp, axis: .vertical)
                        .lineLimit(3...)
                }
                Section {
                    Button {
                        onGenerate()
                    } label: {
                        Label("Draft Discharge Summary", systemImage: "doc.text.magnifyingglass")
                            .frame(maxWidth: .infinity)
                    }
                    .foregroundStyle(.purple)
                }
            }
            .navigationTitle("Discharge Details")
            .navigationBarTitleDisplayMode(.inline)
        }
        .presentationDetents([.medium])
    }
}
