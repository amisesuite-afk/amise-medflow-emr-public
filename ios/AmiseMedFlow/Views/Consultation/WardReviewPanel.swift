// WardReviewPanel.swift
// Ward-review pathway, first step: admission/post-op day, latest observations with NEWS2,
// and a structured round checklist. "Add to progress" appends a dated summary to the
// progress (HPI) field. It is only written when the clinician taps.

import SwiftUI
import SwiftData

struct WardReviewPanel: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context
    @State private var data = WardReview()
    @State private var loaded = false
    @State private var showVitals = false
    @State private var added = false

    private var latestVitals: VitalsEntry? {
        patient.vitalsEntries.filter(\.hasAnyValue).sorted { $0.recordedAt > $1.recordedAt }.first
    }

    var body: some View {
        Form {
            statusSection
            vitalsSection
            checklistSection
            actionSection
        }
        .onAppear(perform: load)
        .sheet(isPresented: $showVitals) { VitalsEntryView(patient: patient) }
    }

    private var statusSection: some View {
        Section {
            HStack(spacing: 16) {
                if let admitted = patient.admittedAt {
                    let d = Calendar.current.dateComponents([.day], from: admitted, to: .now).day ?? 0
                    metric("Admission day", "\(d + 1)")
                }
                if let pod = patient.postOpDays { metric("Post-op day", "\(pod)") }
                if let bed = patient.bedNumber, !bed.isEmpty {
                    metric("Bed", [patient.ward, bed].compactMap { $0 }.joined(separator: " · "))
                }
            }
            if patient.admittedAt == nil && patient.postOpDays == nil {
                Text("Admission date not recorded.").font(.caption).foregroundStyle(.secondary)
            }
        }
    }

    private var vitalsSection: some View {
        Section {
            if let v = latestVitals {
                let hours = Int(Date.now.timeIntervalSince(v.recordedAt) / 3600)
                HStack {
                    NEWS2Badge(score: v.news2Score, risk: v.news2Risk)
                    Text(hours < 1 ? "Within the last hour" : "\(hours) h ago")
                        .font(.caption)
                        .foregroundStyle(hours >= 12 ? .orange : .secondary)
                    Spacer()
                }
                Text(vitalsLine(v)).font(.caption.monospacedDigit())
                if v.news2Score >= 5 || v.news2HasRedFlag {
                    Label(v.news2Score >= 7 || v.news2HasRedFlag
                          ? "NEWS2 high — urgent/emergency response."
                          : "NEWS2 ≥5 — urgent ward-based response.",
                          systemImage: "exclamationmark.triangle.fill")
                        .font(.caption.weight(.semibold)).foregroundStyle(.red)
                }
            } else {
                Text("No observations recorded.").font(.caption).foregroundStyle(.orange)
            }
            Button { showVitals = true } label: { Label("Record observations", systemImage: "plus.circle") }
        } header: {
            Text("Observations")
        }
    }

    private var checklistSection: some View {
        Section {
            ForEach(WardReview.items, id: \.self) { item in
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(item).font(.subheadline)
                        Spacer()
                        markButton(item, .ok, "checkmark", .green)
                        markButton(item, .concern, "exclamationmark", .orange)
                    }
                    if data.marks[item] == .concern {
                        TextField("Detail", text: Binding(
                            get: { data.notes[item] ?? "" },
                            set: { data.notes[item] = $0; save() }))
                            .font(.caption)
                    }
                }
            }
        } header: {
            Text("Round checklist")
        } footer: {
            let concerns = WardReview.items.filter { data.marks[$0] == .concern }.count
            let done = WardReview.items.filter { data.marks[$0] != nil }.count
            Text("\(done)/\(WardReview.items.count) reviewed" + (concerns > 0 ? " · \(concerns) concern\(concerns == 1 ? "" : "s")" : ""))
        }
    }

    private var actionSection: some View {
        Section {
            Button { addToProgress() } label: {
                Label(added ? "Added to progress" : "Add round summary to progress",
                      systemImage: added ? "checkmark.circle.fill" : "text.badge.plus")
            }
            .disabled(data.marks.isEmpty)
        }
    }

    // MARK: - Helpers

    private func markButton(_ item: String, _ mark: WardReview.Mark, _ icon: String, _ color: Color) -> some View {
        let on = data.marks[item] == mark
        return Button {
            data.marks[item] = on ? nil : mark
            data.reviewedAt = .now
            save()
        } label: {
            Image(systemName: icon)
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(on ? .white : color)
                .frame(width: 28, height: 28)
                .background(on ? color : color.opacity(0.12), in: Circle())
        }
        .buttonStyle(.borderless)
    }

    private func metric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary)
            Text(value).font(.system(size: 17, weight: .bold).monospacedDigit())
        }
    }

    private func vitalsLine(_ v: VitalsEntry) -> String {
        var parts: [String] = []
        if let bp = v.bpString { parts.append("BP \(bp)") }
        if let hr = v.heartRate { parts.append("HR \(hr)") }
        if let rr = v.respiratoryRate { parts.append("RR \(rr)") }
        if let s = v.spo2 { parts.append("SpO₂ \(s)%\(v.onSupplementalO2 ? " on O₂" : "")") }
        if let t = v.temperatureCelsius { parts.append(String(format: "T %.1f°C", t)) }
        return parts.joined(separator: " · ")
    }

    private func addToProgress() {
        var lines: [String] = []
        if let v = latestVitals {
            lines.append("Obs: \(vitalsLine(v)) — NEWS2 \(v.news2Score)")
        }
        for item in WardReview.items {
            guard let m = data.marks[item] else { continue }
            let note = data.notes[item].map { $0.isEmpty ? "" : " — \($0)" } ?? ""
            lines.append("\(item): \(m == .ok ? "OK" : "CONCERN")\(m == .concern ? note : "")")
        }
        let header = "Ward review \(Date.now.formatted(date: .abbreviated, time: .shortened))"
        if let pod = patient.postOpDays { lines.insert("Post-op day \(pod)", at: 0) }
        let block = header + "\n" + lines.joined(separator: "\n")
        let existing = patient.hpi ?? ""
        patient.hpi = existing.isEmpty ? block : existing + "\n\n" + block
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
        added = true
    }

    private func load() {
        guard !loaded else { return }
        loaded = true
        data = patient.pathwayData.ward
        // A new day is a new round: start the checklist fresh.
        if let r = data.reviewedAt, !Calendar.current.isDateInToday(r) { data = WardReview() }
    }

    private func save() {
        var all = patient.pathwayData
        all.ward = data
        patient.pathwayData = all
    }
}
