// PatientRecordPresentation.swift
// How a patient record or consultation opens when tapped in a list.
// iPad: full-screen, one patient at a time, with a visible Back/Close button (a full-screen
//       cover has no swipe-to-dismiss).
//   - Record:       PatientDetailPadView (section bar + content).
//   - Consultation: ConsultationView in its own NavigationStack (so its Save Visit / Complete
//                   toolbar shows), plus a Close button.
// iPhone: unchanged sheets (PatientDetailView for the record, ConsultationView for a consultation).
//
// Deleted-model rule: on iPad the cover stays up while sync, dedup or peer apply may delete the
// patient. The cover content checks `patient.isLive` before building any view that reads the
// patient's attributes and shows a "record no longer available" screen with a Close button.

import SwiftUI
import UIKit

extension View {
    func patientRecordPresentation(item: Binding<Patient?>) -> some View {
        modifier(PatientRecordPresentation(item: item))
    }

    /// Opens ConsultationView for `item`: full screen on iPad, a sheet on iPhone.
    func consultationPresentation(item: Binding<Patient?>,
                                  onDismiss: (() -> Void)? = nil) -> some View {
        modifier(ConsultationPresentation(item: item, onDismiss: onDismiss))
    }
}

private struct PatientRecordPresentation: ViewModifier {
    @Binding var item: Patient?

    func body(content: Content) -> some View {
        if UIDevice.current.userInterfaceIdiom == .pad {
            content.fullScreenCover(item: $item) { patient in
                if patient.isLive {
                    PatientDetailPadView(patient: patient, onBack: { item = nil })
                } else {
                    PatientRecordUnavailableView(onClose: { item = nil })
                }
            }
        } else {
            content.sheet(item: $item) { patient in
                PatientDetailView(patient: patient)
            }
        }
    }
}

private struct ConsultationPresentation: ViewModifier {
    @Binding var item: Patient?
    var onDismiss: (() -> Void)?

    func body(content: Content) -> some View {
        if UIDevice.current.userInterfaceIdiom == .pad {
            content.fullScreenCover(item: $item, onDismiss: onDismiss) { patient in
                if patient.isLive {
                    FullScreenConsultationView(patient: patient, onClose: { item = nil })
                } else {
                    PatientRecordUnavailableView(onClose: { item = nil })
                }
            }
        } else {
            content.sheet(item: $item, onDismiss: onDismiss) { patient in
                // In a NavigationStack so ConsultationView's toolbar (Save Visit / Complete) shows.
                NavigationStack {
                    if patient.isLive {
                        ConsultationView(patient: patient)
                    } else {
                        ContentUnavailableView(
                            "Record No Longer Available",
                            systemImage: "person.crop.circle.badge.xmark",
                            description: Text("This patient record was removed or merged on this device.")
                        )
                    }
                }
            }
        }
    }
}

/// iPad full-screen consultation: ConsultationView in a NavigationStack with a Close button.
private struct FullScreenConsultationView: View {
    let patient: Patient
    let onClose: () -> Void

    var body: some View {
        NavigationStack {
            ConsultationView(patient: patient)
                .toolbar {
                    ToolbarItem(placement: .navigationBarLeading) {
                        Button { onClose() } label: {
                            HStack(spacing: 4) {
                                Image(systemName: "chevron.left")
                                    .fontWeight(.semibold)
                                Text("Close")
                                    .font(.system(size: 13, weight: .semibold))
                            }
                            .foregroundStyle(AMColor.accent)
                        }
                        .accessibilityLabel("Close consultation")
                    }
                }
        }
    }
}

/// Shown in place of a patient record whose patient was deleted (or merged away) while open:
/// the iPad full-screen cover and the iPhone PatientDetailView sheet.
struct PatientRecordUnavailableView: View {
    let onClose: () -> Void

    var body: some View {
        NavigationStack {
            ContentUnavailableView(
                "Record No Longer Available",
                systemImage: "person.crop.circle.badge.xmark",
                description: Text("This patient record was removed or merged on this device.")
            )
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") { onClose() }
                }
            }
        }
    }
}
