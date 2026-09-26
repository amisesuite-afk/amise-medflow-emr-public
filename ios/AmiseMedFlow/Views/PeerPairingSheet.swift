// PeerPairingSheet.swift
// Settings → Nearby devices → Pair a device.
// Opening it shows a 6-digit code on this device (valid 2 minutes). On the other device, open the
// same screen and type the code into "Enter the code from your other device". Done once per pair
// of devices; after that they sync whenever they are near each other.

import SwiftUI

struct PeerPairingSheet: View {
    @EnvironmentObject private var peerSync: PeerSyncService
    @Environment(\.dismiss) private var dismiss
    @State private var typedCode = ""
    @FocusState private var codeFieldFocused: Bool

    var body: some View {
        NavigationStack {
            Form {
                // Device A: show the code
                Section {
                    if let code = peerSync.pairingCode {
                        VStack(spacing: 6) {
                            Text(Self.spaced(code))
                                .font(.system(size: 40, weight: .bold, design: .monospaced))
                                .foregroundStyle(AMColor.accent)
                                .accessibilityLabel("Pairing code \(code.map { String($0) }.joined(separator: " "))")
                            if let expiry = peerSync.pairingCodeExpiresAt {
                                TimelineView(.periodic(from: .now, by: 1)) { context in
                                    Text(Self.remaining(until: expiry, now: context.date))
                                        .font(.caption.monospacedDigit())
                                        .foregroundStyle(.secondary)
                                }
                            }
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 8)

                        Button("New code") { peerSync.showPairingCode() }
                    } else {
                        Button {
                            peerSync.showPairingCode()
                        } label: {
                            Label("Show a code on this device", systemImage: "number.square")
                        }
                        .disabled(!peerSync.isRunning || peerSync.isPairingInProgress)
                    }
                } header: {
                    Text("This device")
                } footer: {
                    Text("Type this code on your other device within 2 minutes. Each code works once.")
                }

                // Device B: type the code
                Section {
                    TextField("6-digit code", text: $typedCode)
                        .keyboardType(.numberPad)
                        .textContentType(.oneTimeCode)
                        .font(.title3.monospacedDigit())
                        .focused($codeFieldFocused)
                        .onChange(of: typedCode) { _, value in
                            let digits = String(value.filter { $0.isASCII && $0.isNumber }.prefix(6))
                            if digits != value { typedCode = digits }
                        }
                        .disabled(peerSync.isPairingInProgress)

                    Button {
                        codeFieldFocused = false
                        if peerSync.enterPairingCode(typedCode) { typedCode = "" }
                    } label: {
                        if peerSync.isPairingInProgress {
                            HStack(spacing: 8) {
                                ProgressView()
                                Text("Pairing…")
                            }
                        } else {
                            Text("Pair")
                        }
                    }
                    .disabled(PeerPairingCrypto.normalizedCode(typedCode) == nil
                              || peerSync.isPairingInProgress || !peerSync.isRunning)
                } header: {
                    Text("Or enter the code from your other device")
                }

                if !peerSync.pairingStatus.isEmpty {
                    Section {
                        Label(peerSync.pairingStatus, systemImage: statusSucceeded ? "checkmark.circle.fill" : "info.circle")
                            .font(.callout)
                            .foregroundStyle(statusSucceeded ? Color.green : Color.primary)
                    }
                }

                if !peerSync.isRunning {
                    Section {
                        Label("Sign in to pair and sync nearby devices.", systemImage: "person.crop.circle.badge.exclamationmark")
                            .font(.callout)
                            .foregroundStyle(.orange)
                    }
                }
            }
            .navigationTitle("Pair a device")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
            .onAppear {
                if peerSync.pairingCode == nil, !peerSync.isPairingInProgress, peerSync.isRunning {
                    peerSync.showPairingCode()
                }
            }
            .onDisappear { peerSync.endPairingScreen() }
        }
    }

    private var statusSucceeded: Bool { peerSync.pairingStatus.hasPrefix("Paired with") }

    /// "123456" → "123 456".
    static func spaced(_ code: String) -> String {
        guard code.count == 6 else { return code }
        return "\(code.prefix(3)) \(code.suffix(3))"
    }

    static func remaining(until expiry: Date, now: Date) -> String {
        let seconds = max(0, Int(expiry.timeIntervalSince(now).rounded(.up)))
        guard seconds > 0 else { return "Expired. Tap New code." }
        return String(format: "Expires in %d:%02d", seconds / 60, seconds % 60)
    }
}
