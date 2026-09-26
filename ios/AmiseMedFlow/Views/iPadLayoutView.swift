// iPadLayoutView.swift
// iPad custom 3-column HStack layout.

import SwiftUI
import SwiftData

// MARK: - iPad: custom 3-column HStack layout

private struct RegularRootView: View {
    @EnvironmentObject private var sync: SyncService
    @EnvironmentObject private var peerSync: PeerSyncService
    @State private var selectedSection: AppSection = .outpatients
    @State private var selectedPatient: Patient?
    @State private var showSettings = false
    @State private var showDashboard = false

    // Count badges per patient section
    @Query private var queriedAllPatients: [Patient]
    // Deleted/detached records are dropped before any view reads them (SwiftData
    // crashes when a body touches a deleted model before @Query refreshes).
    private var allPatients: [Patient] { queriedAllPatients.filter(\.isLive) }
    private func count(for section: AppSection) -> Int {
        switch section {
        case .wardRounds:  allPatients.filter { $0.setting == .inpatient || $0.setting == .emergency }.deduped().count
        case .theatre:     allPatients.filter { $0.setting == .theatre }.deduped().count
        case .endoscopy:   allPatients.filter { $0.setting == .endoscopy }.deduped().count
        case .outpatients: allPatients.filter { $0.setting == .outpatient }.deduped().count
        case .schedule:    0
        }
    }

    var body: some View {
        HStack(spacing: 0) {
            if selectedSection == .schedule {
                // Schedule fills the full remaining width
                NavigationStack { ScheduleView() }
                    .frame(maxWidth: .infinity)
            } else if let patient = selectedPatient {
                // Patient selected: full-width clinical workspace
                PatientDetailPadView(patient: patient, onBack: { selectedPatient = nil })
                    .frame(maxWidth: .infinity)
            } else {
                // No patient selected: patient list + empty state placeholder
                NavigationStack {
                    SectionPatientListView(section: selectedSection,
                                           selectedPatient: $selectedPatient)
                }
                .frame(width: 296)

                Rectangle()
                    .fill(Color(.separator))
                    .frame(width: 0.5)
                    .ignoresSafeArea(edges: .vertical)

                ContentUnavailableView(
                    "Select a Patient",
                    systemImage: "person.text.rectangle",
                    description: Text("Choose a patient from the list to view their record.")
                )
                .background(AMColor.bg)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
            }

            Rectangle()
                .fill(AMColor.sidebarGroup.opacity(0.4))
                .frame(width: 0.5)
                .ignoresSafeArea(edges: .vertical)

            // Rightmost column: icon navigation sidebar
            iconSidebar
                .frame(width: 90)
                .ignoresSafeArea(edges: .vertical)
        }
        .ignoresSafeArea(.keyboard)
        .onChange(of: selectedSection) { _, _ in selectedPatient = nil }
        .sheet(isPresented: $showSettings) { SettingsView() }
        .sheet(isPresented: $showDashboard) {
            DashboardView()
                .environmentObject(sync)
                .environmentObject(peerSync)
        }
    }

    // MARK: Sidebar

    private var iconSidebar: some View {
        VStack(spacing: 0) {
            // App mark — tap for clinical dashboard
            Button { showDashboard = true } label: {
                VStack(spacing: 3) {
                    Image(systemName: "cross.case.fill")
                        .font(.system(size: 22, weight: .semibold))
                        .foregroundStyle(AMColor.accent)
                    Text("AMF")
                        .font(.system(size: 9, weight: .heavy))
                        .foregroundStyle(AMColor.sidebarText)
                        .tracking(1.5)
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 18)
            }
            .buttonStyle(.plain)

            Rectangle()
                .fill(AMColor.sidebarGroup.opacity(0.4))
                .frame(height: 0.5)

            // Section buttons (patient sections + schedule)
            VStack(spacing: 2) {
                ForEach(AppSection.allCases) { section in
                    iconSidebarButton(section, count: count(for: section))
                }
            }
            .padding(.vertical, 10)

            Spacer()

            Rectangle()
                .fill(AMColor.sidebarGroup.opacity(0.4))
                .frame(height: 0.5)

            // Compact sync status in sidebar
            SyncStatusBar()
                .frame(maxWidth: .infinity)
                .padding(.vertical, 10)

            Rectangle()
                .fill(AMColor.sidebarGroup.opacity(0.4))
                .frame(height: 0.5)

            Button { showSettings = true } label: {
                VStack(spacing: 4) {
                    Image(systemName: "gearshape")
                        .font(.system(size: 21))
                    Text("Settings")
                        .font(.system(size: 10, weight: .medium))
                }
                .foregroundStyle(AMColor.sidebarText)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
            }
            .buttonStyle(.plain)
        }
        .background(AMColor.sidebarBg)
    }

    @ViewBuilder
    private func iconSidebarButton(_ section: AppSection, count: Int) -> some View {
        let isSel = selectedSection == section
        Button { selectedSection = section } label: {
            ZStack(alignment: .topTrailing) {
                VStack(spacing: 4) {
                    Image(systemName: section.icon)
                        .font(.system(size: 22, weight: isSel ? .semibold : .regular))
                    Text(section.shortLabel)
                        .font(.system(size: 10, weight: .medium))
                        .lineLimit(1)
                }
                .foregroundStyle(isSel ? AMColor.sidebarActive : AMColor.sidebarText)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 12)
                .background(isSel ? AMColor.accent.opacity(0.15) : Color.clear,
                            in: RoundedRectangle(cornerRadius: 8))
                .overlay(alignment: .trailing) {
                    if isSel {
                        Capsule()
                            .fill(AMColor.accent)
                            .frame(width: 3, height: 28)
                    }
                }

                // Patient count badge
                if count > 0 {
                    Text("\(count)")
                        .font(.system(size: 9, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 2)
                        .background(isSel ? AMColor.accent : Color.secondary.opacity(0.55), in: Capsule())
                        .offset(x: -6, y: 6)
                }
            }
        }
        .buttonStyle(.plain)
        .animation(.easeInOut(duration: 0.12), value: isSel)
        .padding(.horizontal, 6)
    }
}
