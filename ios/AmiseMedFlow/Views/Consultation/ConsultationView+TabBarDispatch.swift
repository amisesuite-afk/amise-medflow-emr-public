// ConsultationView+TabBarDispatch.swift
// Tab bar and tab content dispatch.

import SwiftUI
import SwiftData

extension ConsultationView {

    // MARK: - Horizontal tab bar

    var tabBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 0) {
                ForEach(ConsultTab.allCases, id: \.self) { tab in
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { activeTab = tab }
                    } label: {
                        VStack(spacing: 0) {
                            HStack(spacing: 4) {
                                if tabFilled(tab) {
                                    Circle()
                                        .fill(activeTab == tab ? AMColor.accent : Color.green)
                                        .frame(width: 5, height: 5)
                                }
                                Text(tab.rawValue)
                                    .font(.system(size: 13, weight: activeTab == tab ? .bold : .semibold))
                                    .foregroundStyle(activeTab == tab ? AMColor.accent : AMColor.sidebarText)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 10)
                            }
                            Rectangle()
                                .fill(activeTab == tab ? AMColor.accent : Color.clear)
                                .frame(height: 2)
                        }
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 4)
        }
        .background(AMColor.sidebarBg)
        .frame(height: 44)
    }

    func tabFilled(_ tab: ConsultTab) -> Bool {
        switch tab {
        case .cc:        return !(patient.chiefComplaint ?? "").isEmpty
        case .hpi:       return !(patient.hpi ?? "").isEmpty
        case .pmh:       return !(patient.pmhNotes ?? "").isEmpty || !patient.pmhEntries.isEmpty
        case .pshx:      return !(patient.surgicalHistory ?? "").isEmpty || !patient.pshxEntries.isEmpty
        case .meds:      return !patient.prescriptions.isEmpty
        case .allergies: return !patient.allergies.isEmpty
        case .social:    return !(patient.socialHistory ?? "").isEmpty
        case .exam:           return !(patient.examGeneral ?? "").isEmpty || !(patient.examAbdo ?? "").isEmpty
        case .investigations: return !patient.investigations.isEmpty
        case .diagnosis:      return patient.workingDiagnosis != nil
        case .plan:      return !(patient.managementPlan ?? "").isEmpty
        case .history:   return !patient.encounters.isEmpty
        }
    }

    // MARK: - Tab content dispatch

    @ViewBuilder
    var tabContent: some View {
        switch activeTab {
        case .cc:        ccTab
        case .hpi:       hpiTab
        case .pmh:       pmhTab
        case .pshx:      pshxTab
        case .meds:      List { medicationsSection }
        case .allergies: allergiesTab
        case .social:    socialTab
        case .exam:           examTab
        case .investigations: investigationsTab
        case .diagnosis:      diagnosisTab
        case .plan:      planTab
        case .history:   encounterHistoryTab
        }
    }


}
