import SwiftUI
import SwiftData

// PatientHandoverShareLink.swift
// The "Patient Handover" share button of the patient record (iPhone toolbar, iPad header).

/// Share button for `Patient.handoverText`, in its own view on purpose.
///
/// `handoverText` reads almost the whole chart (HPI, assessment, plan, PMH/PSHx, allergies,
/// medications, investigations, sorted vitals). When the record screen built the ShareLink in its
/// own body, SwiftUI tracked all of those fields for that screen, so every keystroke in the
/// embedded consultation (HPI, exam, plan…) re-rendered the whole record screen - header, section
/// bar, tab view and the consultation with it - and built the handover text twice. Here only this
/// button re-renders, and the text is built once per render.
struct PatientHandoverShareLink<Label: View>: View {
    let patient: Patient
    @ViewBuilder let label: () -> Label

    var body: some View {
        // Never read a deleted record (removed or merged while open).
        if patient.isLive {
            let text = patient.handoverText
            ShareLink(item: text,
                      subject: Text("Patient Handover — \(patient.fullName)"),
                      message: Text(text)) {
                label()
            }
        }
    }
}
