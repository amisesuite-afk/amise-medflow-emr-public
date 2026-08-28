import LocalAuthentication
import SwiftUI

// MARK: - Biometric authentication + auto-lock
//
// Usage: inject as @StateObject in the root view, call .lockIfNeeded() on
// scenePhase == .background, and wrap the app's body with .locked { } overlay.

@MainActor
final class BiometricAuthService: ObservableObject {

    @Published var isLocked = true
    @Published var authError: String?

    // Auto-lock after this many seconds of backgrounding (0 = always lock)
    private let lockAfterSeconds: TimeInterval = 30
    private var backgroundedAt: Date?
    // True only until the very first .active scene-phase fires.
    // Prevents re-locking on every .active event (e.g. Face ID sheet
    // changes the scene phase, which would otherwise trigger an infinite lock loop).
    private var isFirstLaunch = true

    // MARK: - Public API

    /// Call when the app enters the foreground.
    func lockIfTimedOut() {
        if isFirstLaunch {
            isFirstLaunch = false
            isLocked = true
            return
        }
        guard let bg = backgroundedAt else { return }
        if Date().timeIntervalSince(bg) >= lockAfterSeconds {
            isLocked = true
        }
        backgroundedAt = nil
    }

    /// Call when the app moves to the background.
    func recordBackground() {
        backgroundedAt = .now
    }

    /// Authenticate with Face ID, Touch ID, or device passcode.
    func authenticate(reason: String = "Unlock Amise MedFlow") async {
        authError = nil
        let context = LAContext()
        var error: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
            // No biometrics and no passcode — allow access on simulator/dev builds
            #if targetEnvironment(simulator)
            isLocked = false
            #else
            authError = "Device authentication is not configured. Please set a passcode in Settings."
            #endif
            return
        }

        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: reason
            )
            if success { isLocked = false }
        } catch {
            authError = (error as? LAError).map { laErrorMessage($0) } ?? error.localizedDescription
        }
    }

    // MARK: - Helpers

    private func laErrorMessage(_ error: LAError) -> String {
        switch error.code {
        case .biometryNotAvailable:        return "Biometric authentication is not available."
        case .biometryNotEnrolled:         return "No Face ID or Touch ID is set up. Using passcode."
        case .authenticationFailed:        return "Authentication failed. Please try again."
        case .userCancel:                  return "Authentication was cancelled."
        case .userFallback:                return "Use your passcode to unlock."
        case .systemCancel:                return "Authentication was interrupted by the system."
        case .passcodeNotSet:              return "A device passcode is required. Please set one in Settings."
        default:                           return error.localizedDescription
        }
    }
}

// MARK: - Lock screen overlay

struct AppLockScreen: View {
    @ObservedObject var auth: BiometricAuthService

    var body: some View {
        ZStack {
            Color(.systemBackground).ignoresSafeArea()

            VStack(spacing: 28) {
                Image(systemName: "cross.case.fill")
                    .font(.system(size: 52))
                    .foregroundStyle(.tint)

                VStack(spacing: 6) {
                    Text("Amise MedFlow")
                        .font(.title2.weight(.bold))
                    Text("Clinical data is protected.\nAuthenticate to continue.")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .multilineTextAlignment(.center)
                }

                Button {
                    Task { await auth.authenticate() }
                } label: {
                    Label("Unlock", systemImage: biometricIcon)
                        .font(.body.weight(.semibold))
                        .padding(.horizontal, 32)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)

                if let err = auth.authError {
                    Text(err)
                        .font(.caption)
                        .foregroundStyle(.red)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, 32)
                }
            }
            .padding()
        }
        .onAppear {
            Task { await auth.authenticate() }
        }
    }

    private var biometricIcon: String {
        let ctx = LAContext()
        _ = ctx.canEvaluatePolicy(.deviceOwnerAuthentication, error: nil)
        switch ctx.biometryType {
        case .faceID:  return "faceid"
        case .touchID: return "touchid"
        default:       return "lock.open.fill"
        }
    }
}
