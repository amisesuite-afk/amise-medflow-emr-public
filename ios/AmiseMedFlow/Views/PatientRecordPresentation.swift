// PatientRecordPresentation.swift
// How a patient record opens when tapped in a list.
// iPad: full-screen clinical workspace (PatientDetailPadView: section sidebar + content),
//       one patient at a time, with a Back button to return to the list.
// iPhone: the existing PatientDetailView sheet.

import SwiftUI
import UIKit

extension View {
    func patientRecordPresentation(item: Binding<Patient?>) -> some View {
        modifier(PatientRecordPresentation(item: item))
    }
}

private struct PatientRecordPresentation: ViewModifier {
    @Binding var item: Patient?

    func body(content: Content) -> some View {
        if UIDevice.current.userInterfaceIdiom == .pad {
            content.fullScreenCover(item: $item) { patient in
                PatientDetailPadView(patient: patient, onBack: { item = nil })
            }
        } else {
            content.sheet(item: $item) { patient in
                PatientDetailView(patient: patient)
            }
        }
    }
}
