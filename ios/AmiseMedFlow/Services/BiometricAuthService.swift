import LocalAuthentication
import SwiftUI

// MARK: - Biometric authentication + auto-lock
//
// iPhone: Face ID (or Touch ID) via .deviceOwnerAuthenticationWithBiometrics.
//         Falls back to a passcode button only when biometry is locked out.
// iPad:   Device passcode via .deviceOwnerAuthentication. The system presents
//         the standard passcode sheet, which iOS can save via iCloud Keychain.

@MainActor
final class BiometricAuthService: ObservableObject {

    @Published var isLocked = true
    @Published var authError: String?
    @Published var showPasscodeFallback = false   // iPhone only: offer passcode after Face ID lockout

    private let lockAfterSeconds: TimeInterval = 30
    private var backgroundedAt: Date?
    private var isFirstLaunch = true

    // MARK: - Device type helpers

    var isPhone: Bool { UIDevice.current.userInterfaceIdiom == .phone }

    var biometryType: LABiometryType {
        let ctx = LAContext()
        _ = ctx.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: nil)
        return ctx.biometryType
    }

    // MARK: - Lifecycle hooks

    func lockIfTimedOut() {
        if isFirstLaunch {
            isFirstLaunch = false
            isLocked = true
            return
        }
        guard let bg = backgroundedAt else { return }
        if Date().timeIntervalSince(bg) >= lockAfterSeconds {
            isLocked = true
            showPasscodeFallback = false
        }
        backgroundedAt = nil
    }

    func recordBackground() {
        backgroundedAt = .now
    }

    // MARK: - Authenticate

    /// Primary entry point — picks the right strategy per device.
    func authenticate(reason: String = "Unlock Amise MedFlow") async {
        if isPhone {
            await authenticateWithBiometrics(reason: reason)
        } else {
            await authenticateWithPasscode(reason: reason)
        }
    }

    /// iPhone path: Face ID / Touch ID. Surfaces a passcode button on lockout.
    func authenticateWithBiometrics(reason: String = "Unlock Amise MedFlow") async {
        authError = nil
        showPasscodeFallback = false

        let context = LAContext()
        var policyError: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &policyError) else {
            // Biometry not enrolled or not available — go straight to passcode
            await authenticateWithPasscode(reason: reason)
            return
        }

        do {
            let ok = try await context.evaluatePolicy(
                .deviceOwnerAuthenticationWithBiometrics,
                localizedReason: reason
            )
            if ok { isLocked = false }
        } catch let laError as LAError {
            switch laError.code {
            case .biometryLockout:
                // Face ID locked after too many failures — offer passcode
                showPasscodeFallback = true
                authError = "Face ID is locked. Use your passcode to continue."
            case .authenticationFailed:
                authError = "Face ID did not recognise you. Try again."
            case .userFallback:
                // User tapped "Enter Passcode" in the system sheet
                await authenticateWithPasscode(reason: reason)
            case .userCancel, .systemCancel:
                authError = nil   // user dismissed — don't show an error
            case .biometryNotAvailable, .biometryNotEnrolled:
                await authenticateWithPasscode(reason: reason)
            default:
                authError = laError.localizedDescription
            }
        } catch {
            authError = error.localizedDescription
        }
    }

    /// iPad path (and iPhone fallback): device passcode. iOS presents its own
    /// secure UI and can save the credential to iCloud Keychain automatically.
    func authenticateWithPasscode(reason: String = "Unlock Amise MedFlow") async {
        authError = nil
        showPasscodeFallback = false

        let context = LAContext()
        var policyError: NSError?

        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &policyError) else {
            #if targetEnvironment(simulator)
            isLocked = false
            #else
            authError = "Please enable a device passcode in Settings → Face ID & Passcode."
            #endif
            return
        }

        do {
            let ok = try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: reason
            )
            if ok { isLocked = false }
        } catch let laError as LAError {
            switch laError.code {
            case .userCancel, .systemCancel:
                authError = nil
            default:
                authError = laError.localizedDescription
            }
        } catch {
            authError = error.localizedDescription
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

                // Primary action
                Button {
                    Task { await auth.authenticate() }
                } label: {
                    Label(primaryLabel, systemImage: primaryIcon)
                        .font(.body.weight(.semibold))
                        .padding(.horizontal, 32)
                        .padding(.vertical, 12)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)

                // iPhone only: passcode fallback shown after Face ID lockout
                if auth.isPhone && auth.showPasscodeFallback {
                    Button("Use Passcode") {
                        Task { await auth.authenticateWithPasscode() }
                    }
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                }

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

    private var primaryIcon: String {
        if !auth.isPhone {
            return "lock.open.fill"   // iPad: passcode sheet
        }
        switch auth.biometryType {
        case .faceID:  return "faceid"
        case .touchID: return "touchid"
        default:       return "lock.open.fill"
        }
    }

    private var primaryLabel: String {
        if !auth.isPhone { return "Enter Passcode" }
        switch auth.biometryType {
        case .faceID:  return "Unlock with Face ID"
        case .touchID: return "Unlock with Touch ID"
        default:       return "Unlock"
        }
    }
}
