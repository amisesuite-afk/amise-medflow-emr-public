// IncomingReportHandling.swift
// Root handling of report PDFs shared to MedFlow from another app ("SLUlabservices", Files,
// Safari): .onOpenURL stages the file (IncomingReportInbox), and the import opens only when it is
// safe to show patient data — app unlocked (BiometricAuthService), signed in, and not in patient
// hand-over mode (PatientHandoverState). Otherwise the file waits, staged, with no UI at all.
// If the app locks while the import is open, the sheet closes; the file stays staged.

import SwiftUI

extension View {
    func incomingReportHandling(bioAuth: BiometricAuthService, sync: SyncService) -> some View {
        modifier(IncomingReportHandling(bioAuth: bioAuth, sync: sync))
    }
}

private struct IncomingReportHandling: ViewModifier {
    @ObservedObject var bioAuth: BiometricAuthService
    @ObservedObject var sync: SyncService
    @ObservedObject private var inbox = IncomingReportInbox.shared
    @ObservedObject private var handover = PatientHandoverState.shared

    @State private var showSheet = false
    @State private var didCleanUp = false

    private var canShow: Bool {
        !bioAuth.isLocked && sync.isSignedIn && !handover.isActive
    }

    func body(content: Content) -> some View {
        content
            .onOpenURL { url in
                inbox.receive(url)
            }
            .task {
                guard !didCleanUp else { return }
                didCleanUp = true
                inbox.launchCleanup()
            }
            .overlay(alignment: .bottom) {
                if canShow && !inbox.staged.isEmpty && !showSheet {
                    banner
                        .padding(.bottom, 70)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                }
            }
            .sheet(isPresented: Binding(get: { showSheet && canShow },
                                        set: { showSheet = $0 })) {
                IncomingReportsSheet(role: sync.currentUserRole, onClose: { showSheet = false })
                    .environmentObject(sync)
                    .tint(AMColor.accent)
                    .interactiveDismissDisabled(true)
            }
            .onChange(of: inbox.pendingPresentation) { _, pending in
                if pending { presentIfSafe() }
            }
            .onChange(of: canShow) { _, _ in
                if inbox.pendingPresentation { presentIfSafe() }
            }
            .alert("Report not imported", isPresented: Binding(
                get: { canShow && inbox.lastRejection != nil },
                set: { if !$0 { inbox.lastRejection = nil } })) {
                Button("OK", role: .cancel) {}
            } message: {
                Text(inbox.lastRejection ?? "")
            }
    }

    private func presentIfSafe() {
        guard canShow, !inbox.staged.isEmpty else { return }
        inbox.pendingPresentation = false
        showSheet = true
    }

    private var banner: some View {
        Button {
            showSheet = true
        } label: {
            Label(inbox.staged.count == 1 ? "1 report received — file it"
                                          : "\(inbox.staged.count) reports received — file them",
                  systemImage: "tray.and.arrow.down.fill")
                .font(.subheadline.weight(.semibold))
                .padding(.horizontal, 16).padding(.vertical, 10)
                .foregroundStyle(.white)
                .background(AMColor.accentDk, in: Capsule())
                .shadow(radius: 4)
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens the reports shared to MedFlow from another app.")
    }
}

// MARK: - Received reports

struct IncomingReportsSheet: View {
    let role: UserRole
    let onClose: () -> Void

    @ObservedObject private var inbox = IncomingReportInbox.shared
    @State private var path: [StagedReport] = []
    @State private var discardTarget: StagedReport?
    @State private var didAutoOpen = false

    var body: some View {
        NavigationStack(path: $path) {
            List {
                if inbox.staged.isEmpty {
                    ContentUnavailableView("No reports waiting", systemImage: "tray",
                                           description: Text("PDFs shared to MedFlow from another app appear here."))
                }
                Section {
                    ForEach(inbox.staged) { report in
                        NavigationLink(value: report) {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(report.displayName).font(.subheadline.weight(.semibold))
                                Text("Received \(report.receivedAt.formatted(date: .abbreviated, time: .shortened))")
                                    .font(.caption).foregroundStyle(.secondary)
                            }
                        }
                        .swipeActions {
                            Button("Discard", role: .destructive) { discardTarget = report }
                        }
                    }
                } header: {
                    Text("Waiting to be filed")
                } footer: {
                    Text("Files are kept on this device only, and removed after 7 days if not filed.")
                }
            }
            .navigationTitle("Received reports")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { onClose() }
                }
            }
            .navigationDestination(for: StagedReport.self) { report in
                ReportImportFlowView(input: ReportImportInput(source: .staged(report)),
                                     fixedPatient: nil, role: role) { outcome in
                    switch outcome {
                    case .saved, .discarded:
                        inbox.remove(report)
                    case .cancelled:
                        break
                    }
                    path.removeAll()
                    if inbox.staged.isEmpty { onClose() }
                }
            }
            .confirmationDialog("Discard this file? It will be deleted from this device.",
                                isPresented: Binding(get: { discardTarget != nil },
                                                     set: { if !$0 { discardTarget = nil } }),
                                titleVisibility: .visible,
                                presenting: discardTarget) { report in
                Button("Discard file", role: .destructive) {
                    inbox.remove(report)
                    discardTarget = nil
                }
                Button("Keep", role: .cancel) { discardTarget = nil }
            }
            .onAppear {
                inbox.reload()
                if !didAutoOpen, inbox.staged.count == 1, let only = inbox.staged.first {
                    didAutoOpen = true
                    path = [only]
                }
            }
        }
    }
}
