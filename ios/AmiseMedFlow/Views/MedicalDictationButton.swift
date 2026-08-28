import SwiftUI
import Speech

// MARK: - Dictation button that can be embedded next to any TextEditor / TextField
//
// Usage:
//   MedicalDictationButton(mode: .hpi, patient: patient) { polished in
//       hpiText += (hpiText.isEmpty ? "" : "\n\n") + polished
//   }
//
// The button handles the full lifecycle:
//   idle → tap → requesting permissions → recording (live transcript overlay)
//   → tap again (or auto 3-min limit) → AI polishing → callback with text

struct MedicalDictationButton: View {

    let mode:    DictationMode
    let patient: Patient
    let onInsert: (String) -> Void        // called with AI-polished text

    @StateObject private var speech = SpeechService()

    @State private var phase: DictationPhase = .idle
    @State private var liveText = ""
    @State private var showLiveSheet = false
    @State private var showModeMenu  = false
    @State private var activeMode:   DictationMode
    @State private var errorMessage: String?
    @State private var showError = false

    // Auto-stop after 3 minutes to prevent runaway recording
    @State private var recordingTimer: Timer?

    init(mode: DictationMode, patient: Patient, onInsert: @escaping (String) -> Void) {
        self.mode      = mode
        self.patient   = patient
        self.onInsert  = onInsert
        _activeMode    = State(initialValue: mode)
    }

    var body: some View {
        Button {
            switch phase {
            case .idle:
                Task { await beginDictation() }
            case .recording:
                Task { await finishDictation() }
            default:
                break
            }
        } label: {
            ZStack {
                switch phase {
                case .idle:
                    Image(systemName: "mic")
                        .symbolRenderingMode(.hierarchical)
                case .requesting:
                    ProgressView().controlSize(.mini)
                case .recording:
                    Image(systemName: "stop.circle.fill")
                        .foregroundStyle(.red)
                        .symbolEffect(.pulse)
                case .polishing:
                    ProgressView().controlSize(.mini)
                }
            }
            .frame(width: 22, height: 22)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(phase == .recording ? "Stop dictation" : "Start \(activeMode.label) dictation")
        .help(phase == .recording ? "Tap to stop and polish" : "\(activeMode.label) dictation")
        .contextMenu {
            ForEach(DictationMode.allCases) { m in
                Button {
                    activeMode = m
                    Task { await beginDictation() }
                } label: {
                    Label(m.label, systemImage: m.icon)
                }
            }
        }
        .overlay(alignment: .topTrailing) {
            if phase == .recording {
                Circle()
                    .fill(.red)
                    .frame(width: 6, height: 6)
                    .offset(x: 4, y: -4)
            }
        }
        // Live transcript sheet while recording
        .sheet(isPresented: $showLiveSheet, onDismiss: {
            if phase == .recording { Task { await finishDictation() } }
        }) {
            LiveDictationSheet(
                mode: activeMode,
                liveText: $liveText,
                isPolishing: Binding(get: { phase == .polishing }, set: { _ in }),
                onStop: { Task { await finishDictation() } },
                onCancel: { cancelDictation() }
            )
            .presentationDetents([.medium, .large])
            .presentationDragIndicator(.visible)
        }
        .alert("Dictation Error", isPresented: $showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "Unknown error")
        }
        .onChange(of: speech.liveTranscript) { liveText = speech.liveTranscript }
    }

    // MARK: - Dictation flow

    private func beginDictation() async {
        phase = .requesting
        let granted = await speech.requestPermissions()
        guard granted else {
            errorMessage = SpeechError.permissionDenied.errorDescription
            showError = true
            phase = .idle
            return
        }
        do {
            try speech.startRecording()
            phase = .recording
            showLiveSheet = true
            // Auto-stop at 3 minutes
            recordingTimer = Timer.scheduledTimer(withTimeInterval: 180, repeats: false) { _ in
                Task { @MainActor in await self.finishDictation() }
            }
        } catch {
            errorMessage = error.localizedDescription
            showError = true
            phase = .idle
        }
    }

    private func finishDictation() async {
        guard phase == .recording else { return }
        recordingTimer?.invalidate(); recordingTimer = nil
        phase = .polishing
        do {
            let result = try await speech.stopAndPolish(mode: activeMode)
            showLiveSheet = false
            phase = .idle
            onInsert(result.polished)
        } catch {
            showLiveSheet = false
            phase = .idle
            if let se = error as? SpeechError, se == .emptyTranscript {
                errorMessage = se.errorDescription
            } else {
                errorMessage = error.localizedDescription
            }
            showError = true
        }
    }

    private func cancelDictation() {
        recordingTimer?.invalidate(); recordingTimer = nil
        Task {
            _ = await speech.stopRecording()
            phase = .idle
        }
    }
}

// MARK: - Dictation phase

private enum DictationPhase { case idle, requesting, recording, polishing }

// MARK: - Live transcript sheet

private struct LiveDictationSheet: View {
    let mode:       DictationMode
    @Binding var liveText:   String
    @Binding var isPolishing: Bool
    let onStop:   () -> Void
    let onCancel: () -> Void

    var body: some View {
        NavigationStack {
            ZStack {
                VStack(alignment: .leading, spacing: 16) {
                    // Mode badge
                    Label(mode.label, systemImage: mode.icon)
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(.quaternary, in: Capsule())

                    // Live transcript
                    ScrollView {
                        Text(liveText.isEmpty ? "Listening…" : liveText)
                            .font(.body)
                            .foregroundStyle(liveText.isEmpty ? .tertiary : .primary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(12)
                            .background(.quaternary.opacity(0.4), in: RoundedRectangle(cornerRadius: 10))
                    }

                    Divider()

                    // Waveform animation (decorative)
                    WaveformView()
                        .frame(height: 36)
                }
                .padding()

                // Polishing overlay
                if isPolishing {
                    ZStack {
                        Color(.systemBackground).opacity(0.92)
                        VStack(spacing: 12) {
                            ProgressView().scaleEffect(1.2)
                            Text("AI is polishing your \(mode.label.lowercased())…")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }
                    }
                    .ignoresSafeArea()
                }
            }
            .navigationTitle("Dictating")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel", role: .cancel) { onCancel() }
                        .disabled(isPolishing)
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        onStop()
                    } label: {
                        Label("Done", systemImage: "checkmark.circle.fill")
                            .labelStyle(.titleAndIcon)
                            .font(.body.weight(.semibold))
                    }
                    .buttonStyle(.borderedProminent)
                    .disabled(isPolishing)
                }
            }
        }
    }
}

// MARK: - Simple waveform animation (no audio level access needed)

private struct WaveformView: View {
    @State private var phase: CGFloat = 0
    let barCount = 24

    var body: some View {
        GeometryReader { geo in
            HStack(spacing: geo.size.width / CGFloat(barCount * 2)) {
                ForEach(0..<barCount, id: \.self) { i in
                    RoundedRectangle(cornerRadius: 2)
                        .fill(Color.accentColor.opacity(0.7))
                        .frame(
                            width: geo.size.width / CGFloat(barCount * 2),
                            height: barHeight(index: i, phase: phase, maxH: geo.size.height)
                        )
                }
            }
        }
        .onAppear {
            withAnimation(.linear(duration: 1.2).repeatForever(autoreverses: false)) {
                phase = .pi * 2
            }
        }
    }

    private func barHeight(index: Int, phase: CGFloat, maxH: CGFloat) -> CGFloat {
        let angle = phase + CGFloat(index) * (.pi / 6)
        let norm  = (sin(angle) + 1) / 2    // 0…1
        return max(4, norm * maxH * 0.9)
    }
}

// MARK: - Convenience modifier — adds a dictation mic to any TextEditor toolbar

struct DictationToolbar: ViewModifier {
    let mode:    DictationMode
    let patient: Patient
    @Binding var text: String

    func body(content: Content) -> some View {
        content
            .toolbar {
                ToolbarItemGroup(placement: .keyboard) {
                    MedicalDictationButton(mode: mode, patient: patient) { polished in
                        text += (text.isEmpty ? "" : "\n\n") + polished
                    }
                    Spacer()
                    Button("Done") { UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil) }
                }
            }
    }
}

extension View {
    func medicalDictation(mode: DictationMode, patient: Patient, text: Binding<String>) -> some View {
        modifier(DictationToolbar(mode: mode, patient: patient, text: text))
    }
}
