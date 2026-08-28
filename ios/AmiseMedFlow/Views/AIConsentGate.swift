import SwiftUI

// MARK: - AI & PHI Consent Gate
//
// AI features (note generation, clinical reasoning, document summarisation)
// transmit de-contextualised patient data to the Anthropic API.
// This sheet must be accepted once per installation before any AI feature fires.
// For HIPAA-covered entities a BAA with Anthropic is also required — see
// https://privacy.anthropic.com/en/articles/9793526-anthropic-business-associate-agreement
//
// The accepted flag is stored in UserDefaults (not Keychain) because it is
// not a credential — it is a UI gate and resets if the app is reinstalled,
// which is the correct behaviour (re-consent on reinstall).

private let consentKey = "ai_phi_consent_v2"

extension View {
    /// Presents the AI/PHI disclosure sheet once per installation.
    /// Place this on a long-lived view that appears after sign-in.
    func requireAIConsent() -> some View {
        self.modifier(AIConsentGateModifier())
    }
}

private struct AIConsentGateModifier: ViewModifier {
    @AppStorage(consentKey) private var accepted: Bool = false
    @State private var showSheet = false

    func body(content: Content) -> some View {
        content
            .onAppear { if !accepted { showSheet = true } }
            .sheet(isPresented: $showSheet) {
                AIConsentSheet(accepted: $accepted, showSheet: $showSheet)
                    .interactiveDismissDisabled(true)
            }
    }
}

struct AIConsentSheet: View {
    @Binding var accepted: Bool
    @Binding var showSheet: Bool

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {

                    // Icon + title
                    VStack(alignment: .leading, spacing: 6) {
                        Image(systemName: "brain.head.profile")
                            .font(.system(size: 40))
                            .foregroundStyle(.purple)
                        Text("AI Features & Patient Data")
                            .font(.title2.weight(.bold))
                        Text("Please read before using AI-assisted features.")
                            .foregroundStyle(.secondary)
                    }

                    Divider()

                    disclosureBlock(
                        icon: "arrow.up.forward.circle",
                        iconColor: .orange,
                        title: "Data transmitted to Anthropic",
                        body: """
                        When you use AI features (note generation, clinical reasoning, \
                        document summarisation), de-contextualised patient data is sent \
                        to the Anthropic API for processing. This may include clinical \
                        history, examination findings, investigations, and documents.
                        """
                    )

                    disclosureBlock(
                        icon: "doc.text.magnifyingglass",
                        iconColor: .teal,
                        title: "HIPAA / BAA requirement",
                        body: """
                        If your practice is a HIPAA-covered entity, you must execute a \
                        Business Associate Agreement (BAA) with Anthropic before using \
                        these features with real patient data. \
                        Contact: privacy@anthropic.com
                        """
                    )

                    disclosureBlock(
                        icon: "checkmark.shield",
                        iconColor: .green,
                        title: "AI assists — clinician decides",
                        body: """
                        All AI-generated content is a draft for review. \
                        The clinician remains fully responsible for every clinical decision, \
                        diagnosis, prescription, and documented record. \
                        AI output must be reviewed and approved before use.
                        """
                    )

                    disclosureBlock(
                        icon: "nosign",
                        iconColor: .red,
                        title: "Do not use with identifiable data if no BAA is in place",
                        body: """
                        If you have not executed a BAA with Anthropic, use AI features \
                        only with anonymised or synthetic data for testing purposes.
                        """
                    )

                    Divider()

                    Button {
                        accepted = true
                        showSheet = false
                    } label: {
                        Text("I Understand — Continue")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(.purple)
                    .padding(.top, 4)
                }
                .padding()
            }
            .navigationTitle("AI Disclosure")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    @ViewBuilder
    private func disclosureBlock(icon: String, iconColor: Color, title: String, body: String) -> some View {
        HStack(alignment: .top, spacing: 14) {
            Image(systemName: icon)
                .font(.title3)
                .foregroundStyle(iconColor)
                .frame(width: 28)
            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                Text(body)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }
}

// MARK: - Convenience guard for individual AI buttons

/// Returns true if the AI consent has been accepted.
/// Use this to gate inline AI buttons that live outside the main navigation.
func aiConsentAccepted() -> Bool {
    UserDefaults.standard.bool(forKey: consentKey)
}
