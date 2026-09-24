// PlanFormView.swift
// PlanFormView — full operative plan form bound to OperativePlan SwiftData model.
// Perioperative flags, theatre booking, consent, anaesthesia, WHO checklist,
// team notes, and AI operative note generation.

import SwiftUI
import SwiftData
import EventKit


// MARK: - Plan form (separated so @Bindable can take non-optional)

private struct PlanForm: View {
    @Bindable var patient: Patient
    @Bindable var plan: OperativePlan
    @ObservedObject var ai: AIService
    @Binding var showAIError: Bool
    @Binding var aiError: String?
    let context: ModelContext

    @StateObject var calSvc = CalendarService()
    @State var bookingDate = Date().addingTimeInterval(86400)  // default: tomorrow
    @State var bookingDurationMins: Double = 90
    @State var bookingNotes = ""
    @State var bookingCalendar: EKCalendar? = nil
    @State var isBooking = false
    @State var bookingMessage: String? = nil
    @State var bookingSuccess = false

    var radiationConsentCategory: String? {
        guard let dx = patient.workingDiagnosis else { return nil }
        return DiagnosisRadiationEngine.radiate(
            workingDiagnosis: dx,
            ageYears: patient.ageYears,
            sex: patient.sex
        )?.consentCategory
    }

    let antibioticChips = [
        "Cefazolin 1g IV", "Cefazolin 2g IV", "Co-amoxiclav 1.2g IV",
        "Metronidazole 500mg IV", "Gentamicin 5mg/kg IV", "Nil (NKDA)"
    ]
    let vteChips = [
        "Enoxaparin 40mg SC", "Enoxaparin 60mg SC", "Enoxaparin 20mg SC",
        "TED stockings only", "Compression boots", "No prophylaxis"
    ]

    @ViewBuilder
    func quickChips(_ values: [String], current: String, onTap: @escaping (String) -> Void) -> some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 6) {
                ForEach(values, id: \.self) { v in
                    let sel = v == current
                    Button(v) { onTap(v) }
                        .font(.caption2.weight(sel ? .semibold : .regular))
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(sel ? AMColor.accent : AMColor.accentLt, in: Capsule())
                        .foregroundStyle(sel ? Color.white : AMColor.accent)
                        .buttonStyle(.plain)
                }
            }
            .padding(.vertical, 2)
        }
    }

    var body: some View {
        List {
            consentSection
            if !perioperativeFlags.isEmpty { perioperativeFlagsSection }
            theatreBookingSection
            anaesthesiaSection
            whoSignIn
            whoTimeOut
            whoSignOut
            progressSection
            teamSection
            aiSection
        }
    }

}
