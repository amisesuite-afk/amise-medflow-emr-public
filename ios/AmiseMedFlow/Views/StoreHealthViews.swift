// StoreHealthViews.swift
// UI for the on-device store state (Services/StoreHealth.swift):
//  • `storeHealthBanner()` — a banner pinned above every main screen when the store is not the
//    normal on-disk one. Red and not dismissible in the in-memory fallback. Tapping it opens the
//    storage diagnostics (the front-desk iPad shell has no Settings tab).
//  • `storeWriteBlockedAlert(isPresented:)` — the alert shown when a new patient or a note
//    signature is refused because nothing would be kept.
//  • `StoreDiagnosticsRows` — status, store file size and moved-aside copies, shown in
//    Settings → Diagnostics and in the banner's sheet.

import SwiftUI

extension View {
    /// Pins the storage banner to the top of this screen. Nothing is shown while the store is
    /// the normal on-disk one.
    func storeHealthBanner() -> some View {
        safeAreaInset(edge: .top, spacing: 0) {
            StoreHealthBanner()
        }
    }

    /// "Storage error" alert for actions refused while `StoreHealth.blocksNewClinicalData`.
    func storeWriteBlockedAlert(isPresented: Binding<Bool>) -> some View {
        alert(StoreHealth.blockedAlertTitle, isPresented: isPresented) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(StoreHealth.blockedAlertMessage)
        }
    }
}

// MARK: - Banner

struct StoreHealthBanner: View {
    @State private var showDetails = false

    var body: some View {
        switch StoreHealth.status {
        case .onDisk:
            EmptyView()
        case .inMemoryFallback:
            banner(text: StoreHealth.inMemoryBannerText,
                   icon: "exclamationmark.octagon.fill",
                   background: AMColor.emergency)
        case .onDiskAfterMoveAside(let backupName):
            banner(text: StoreHealth.movedAsideBannerText(backupName: backupName),
                   icon: "exclamationmark.triangle.fill",
                   background: AMColor.priorityCol)
        }
    }

    private func banner(text: String, icon: String, background: Color) -> some View {
        Button {
            showDetails = true
        } label: {
            HStack(alignment: .top, spacing: 10) {
                Image(systemName: icon)
                    .font(.headline)
                Text(text)
                    .font(.subheadline.weight(.bold))
                    .multilineTextAlignment(.leading)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
                Image(systemName: "info.circle")
                    .font(.subheadline.weight(.bold))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(background)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(text)
        .accessibilityHint("Shows storage diagnostics")
        .sheet(isPresented: $showDetails) {
            NavigationStack {
                Form {
                    Section("Storage") {
                        StoreDiagnosticsRows()
                    }
                }
                .navigationTitle("Diagnostics")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Done") { showDetails = false }
                    }
                }
            }
        }
    }
}

// MARK: - Diagnostics rows

struct StoreDiagnosticsRows: View {

    private var statusColor: Color {
        switch StoreHealth.status {
        case .onDisk:               return Color.green
        case .onDiskAfterMoveAside: return Color.orange
        case .inMemoryFallback:     return Color.red
        }
    }

    private var sizeLabel: String {
        StoreHealth.isInMemoryFallback ? "Store file size (not in use)" : "Store file size"
    }

    private var explanation: String {
        StoreHealth.isInMemoryFallback
            ? "The database on this device could not be opened, so this session is running in memory and nothing entered now will be kept. The database file itself has not been changed. Do not delete or reinstall the app — contact support."
            : "The previous database could not be opened. It was moved aside, not deleted, and is listed above. Do not delete or reinstall the app — contact support to recover it."
    }

    var body: some View {
        LabeledContent("Patient data storage") {
            Text(StoreHealth.statusText)
                .fontWeight(StoreHealth.isInMemoryFallback ? .bold : .regular)
                .foregroundStyle(statusColor)
        }

        LabeledContent(sizeLabel, value: StoreHealth.storeFileSizeText)

        let backups = StoreHealth.backupFileNames
        if backups.isEmpty {
            LabeledContent("Moved-aside store files", value: "None")
        } else {
            VStack(alignment: .leading, spacing: 4) {
                Text("Moved-aside store files")
                ForEach(backups, id: \.self) { name in
                    Text(name)
                        .font(.caption.monospaced())
                        .foregroundStyle(.secondary)
                        .textSelection(.enabled)
                }
            }
            .padding(.vertical, 2)
        }

        if StoreHealth.status != .onDisk {
            Text(explanation)
                .font(.caption)
                .foregroundStyle(statusColor)
        }
    }
}
