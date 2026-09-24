import SwiftUI
import SwiftData

struct ClinicalReasoningView: View {
    @Bindable var patient: Patient
    @State private var isDrafting = false
    @State private var aiError: String?
    @State private var showError = false

    private var latestVitals: VitalsEntry? {
        patient.vitalsEntries.sorted { $0.recordedAt > $1.recordedAt }.first
    }

    private var redFlags: [RedFlag] {
        var flags: [RedFlag] = []

        if let v = latestVitals, v.hasAnyValue {
            if v.news2Score >= 7 {
                flags.append(.init(text: "NEWS2 \(v.news2Score) — immediate medical review required", severity: .critical))
            } else if v.news2Score >= 5 {
                flags.append(.init(text: "NEWS2 \(v.news2Score) — urgent clinical review required", severity: .urgent))
            }
            if let spo = v.spo2, spo < 94 {
                flags.append(.init(text: "SpO₂ \(spo)% — hypoxia", severity: spo < 90 ? .critical : .urgent))
            }
            if let sys = v.bpSystolic {
                if sys > 180 { flags.append(.init(text: "Systolic BP \(sys) mmHg — hypertensive emergency range", severity: .critical)) }
                if sys < 90  { flags.append(.init(text: "Systolic BP \(sys) mmHg — hypotension", severity: .critical)) }
            }
            if let hr = v.heartRate {
                if hr > 130 { flags.append(.init(text: "HR \(hr) bpm — tachycardia", severity: .urgent)) }
                if hr < 40  { flags.append(.init(text: "HR \(hr) bpm — bradycardia", severity: .critical)) }
            }
            if let rr = v.respiratoryRate {
                if rr > 24 { flags.append(.init(text: "RR \(rr)/min — tachypnoea", severity: .urgent)) }
                if rr <= 8 { flags.append(.init(text: "RR \(rr)/min — bradypnoea", severity: .critical)) }
            }
            if let temp = v.temperatureCelsius {
                if temp > 38.5 { flags.append(.init(text: "Temp \(String(format: "%.1f", temp))°C — pyrexia", severity: .moderate)) }
                if temp < 36.0 { flags.append(.init(text: "Temp \(String(format: "%.1f", temp))°C — hypothermia", severity: .urgent)) }
            }
        }

        if let hpi = patient.hpi?.lowercased() {
            let hpiFlags: [(String, String, Severity)] = [
                ("haematemesis",  "Haematemesis — upper GI bleed",           .critical),
                ("hematemesis",   "Haematemesis — upper GI bleed",           .critical),
                ("malaena",       "Malaena — GI blood loss",                 .critical),
                ("melena",        "Malaena — GI blood loss",                 .critical),
                ("chest pain",    "Chest pain — exclude ACS/PE/dissection",  .critical),
                ("dysphagia",     "Progressive dysphagia — investigate for obstruction/malignancy", .urgent),
                ("jaundice",      "Jaundice — investigate hepatobiliary cause", .urgent),
                ("weight loss",   "Weight loss — screen for malignancy",     .moderate),
                ("rectal bleed",  "Rectal bleeding — investigate lower GI",  .urgent),
                ("pulsatile mass","Pulsatile abdominal mass — exclude AAA",  .critical),
            ]
            for (keyword, label, severity) in hpiFlags {
                if hpi.contains(keyword) && !flags.contains(where: { $0.text.hasPrefix(label.prefix(12)) }) {
                    flags.append(.init(text: label, severity: severity))
                }
            }
        }

        for a in patient.criticalAllergies {
            flags.append(.init(text: "Anaphylaxis risk: \(a.name) — \(a.reaction)", severity: .critical))
        }

        // Scan resulted investigation results for critical imaging / lab findings
        let invResultText = patient.investigations
            .filter { $0.status == .resulted && !$0.result.isEmpty }
            .map { "\($0.name): \($0.result)".lowercased() }
            .joined(separator: ". ")
        if !invResultText.isEmpty {
            let invFlags: [(String, String, Severity)] = [
                ("aortic dissection",  "Imaging: aortic dissection — emergency cardiothoracic surgery", .critical),
                ("intimal flap",       "Imaging: intimal flap — exclude aortic dissection",             .critical),
                ("pneumoperitoneum",   "Imaging: pneumoperitoneum — emergency laparotomy",              .critical),
                ("free gas",           "Imaging: free intraperitoneal gas — likely perforation",        .critical),
                ("adenocarcinoma",     "Pathology: adenocarcinoma — urgent MDT referral",               .urgent),
                ("malignancy suspected","Pathology: malignancy suspected — 2-week-wait pathway",        .urgent),
                ("metastatic",         "Pathology/imaging: metastatic disease — oncology referral",     .urgent),
                ("pulmonary embolism", "Imaging: pulmonary embolism confirmed",                         .critical),
                ("deep vein thrombosis","Imaging: DVT confirmed — anticoagulation required",            .urgent),
            ]
            for (keyword, label, severity) in invFlags {
                if invResultText.contains(keyword) && !flags.contains(where: { $0.text.hasPrefix(label.prefix(20)) }) {
                    flags.append(.init(text: label, severity: severity))
                }
            }
        }

        return flags.sorted { $0.severity.rawValue < $1.severity.rawValue }
    }

    private var pendingInvestigations: [InvestigationEntry] {
        patient.investigations.filter { $0.status == .ordered || $0.status == .pending }
    }

    private var resultedInvestigations: [InvestigationEntry] {
        patient.investigations.filter { $0.status == .resulted }
    }

    var body: some View {
        List {
            patientBannerSection
            if !redFlags.isEmpty { redFlagsSection }
            if !pendingInvestigations.isEmpty { pendingSection }
            if !resultedInvestigations.isEmpty { resultsSection }
            if let pmh = patient.pmhNotes, !pmh.isEmpty { pmhSection(pmh) }
            if !patient.allergies.isEmpty { allergiesSection }
            aiSection
        }
        .navigationTitle("Clinical Reasoning")
        .navigationBarTitleDisplayMode(.inline)
        .alert("AI Error", isPresented: $showError) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(aiError ?? "Unknown error")
        }
    }

    // MARK: - Sections

    private var patientBannerSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 10) {
                HStack(alignment: .top) {
                    VStack(alignment: .leading, spacing: 4) {
                        if let dx = patient.workingDiagnosis {
                            HStack(spacing: 6) {
                                Image(systemName: "stethoscope").font(.caption).foregroundStyle(.teal)
                                Text(dx).font(.system(size: 14, weight: .semibold)).foregroundStyle(.teal)
                                if let icd = patient.workingDiagnosisICD {
                                    Text("(\(icd))").font(.caption).foregroundStyle(.secondary)
                                }
                            }
                        }
                        if let cc = patient.chiefComplaint {
                            HStack(spacing: 6) {
                                Image(systemName: "text.bubble").font(.caption).foregroundStyle(.secondary)
                                Text(cc).font(.system(size: 13)).foregroundStyle(.secondary)
                            }
                        }
                    }
                    Spacer()
                    acuityBadge
                }

                if let v = latestVitals, v.hasAnyValue {
                    HStack(spacing: 6) {
                        Image(systemName: "waveform.path.ecg").font(.caption2).foregroundStyle(.secondary)
                        Text("NEWS2 \(v.news2Score) — \(v.news2RiskDisplay)")
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color(hex: v.news2Color))
                        Spacer()
                        Text(v.recordedAt, style: .relative)
                            .font(.caption2).foregroundStyle(.tertiary)
                    }
                } else {
                    Label("No vitals recorded", systemImage: "exclamationmark.circle")
                        .font(.caption).foregroundStyle(.orange)
                }
            }
            .padding(.vertical, 4)
        }
    }

    private var acuityBadge: some View {
        VStack(spacing: 2) {
            Circle().fill(Color(hex: patient.acuity.color)).frame(width: 10, height: 10)
            Text(patient.acuity.label.uppercased())
                .font(.system(size: 9, weight: .heavy))
                .foregroundStyle(Color(hex: patient.acuity.color))
                .textCase(.uppercase)
        }
    }

    private var redFlagsSection: some View {
        Section {
            ForEach(redFlags, id: \.text) { flag in
                HStack(spacing: 10) {
                    Image(systemName: flag.severity == .critical ? "exclamationmark.triangle.fill" : "exclamationmark.circle.fill")
                        .foregroundStyle(flag.severity == .critical ? .red : (flag.severity == .urgent ? .orange : .yellow))
                        .font(.system(size: 13))
                    Text(flag.text)
                        .font(.system(size: 13))
                }
                .padding(.vertical, 2)
            }
        } header: {
            Label("Clinical Red Flags", systemImage: "exclamationmark.shield.fill")
                .foregroundStyle(.red)
        }
    }

    private var pendingSection: some View {
        Section {
            ForEach(pendingInvestigations, id: \.id) { inv in
                HStack {
                    Image(systemName: inv.category.icon)
                        .foregroundStyle(.blue).font(.caption)
                    Text(inv.name).font(.system(size: 13))
                    Spacer()
                    Text(inv.status == .ordered ? "Ordered" : "Pending")
                        .font(.caption).foregroundStyle(.blue)
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(Color.blue.opacity(0.1), in: Capsule())
                }
            }
        } header: {
            Label("Awaiting Results", systemImage: "clock.badge.exclamationmark")
                .foregroundStyle(.orange)
        }
    }

    private var resultsSection: some View {
        Section {
            ForEach(resultedInvestigations, id: \.id) { inv in
                VStack(alignment: .leading, spacing: 2) {
                    HStack {
                        Image(systemName: inv.category.icon)
                            .foregroundStyle(.green).font(.caption)
                        Text(inv.name).font(.system(size: 13, weight: .semibold))
                        Spacer()
                        Text("Resulted").font(.caption).foregroundStyle(.green)
                    }
                    if !inv.result.isEmpty {
                        Text(inv.result).font(.system(size: 12)).foregroundStyle(.secondary)
                            .padding(.leading, 18)
                    }
                }
                .padding(.vertical, 2)
            }
        } header: {
            Label("Investigation Results", systemImage: "doc.text.magnifyingglass")
        }
    }

    private func pmhSection(_ pmh: String) -> some View {
        Section {
            Text(pmh).font(.system(size: 13)).foregroundStyle(.secondary)
        } header: {
            Label("Past Medical History", systemImage: "clock.arrow.circlepath")
        }
    }

    private var allergiesSection: some View {
        Section {
            ForEach(patient.allergies, id: \.id) { a in
                HStack(spacing: 8) {
                    Image(systemName: patient.hasCriticalAllergy && (a.severity.lowercased().contains("anaphylaxis") || a.severity.lowercased().contains("severe")) ? "exclamationmark.shield.fill" : "exclamationmark.shield")
                        .foregroundStyle(a.severity.lowercased().contains("anaphylaxis") || a.severity.lowercased().contains("severe") ? .red : .orange)
                        .font(.caption)
                    VStack(alignment: .leading, spacing: 1) {
                        Text(a.name).font(.system(size: 13, weight: .semibold))
                        Text("\(a.reaction) — \(a.severity)")
                            .font(.system(size: 11)).foregroundStyle(.secondary)
                    }
                }
            }
        } header: {
            Label("Allergy Alert", systemImage: "exclamationmark.shield")
                .foregroundStyle(.orange)
        }
    }

    private var aiSection: some View {
        Section {
            if let reasoning = patient.aiClinicalReasoning {
                Text(reasoning)
                    .font(.system(size: 13))
                    .foregroundStyle(.primary)
                Button("Clear Summary") {
                    patient.aiClinicalReasoning = nil
                    patient.updatedAt = .now
                    patient.pendingSync = true
                }
                .font(.caption).foregroundStyle(.secondary)
            }
            Button {
                Task { await generateReasoning() }
            } label: {
                HStack(spacing: 8) {
                    if isDrafting { ProgressView().scaleEffect(0.8) }
                    Label(patient.aiClinicalReasoning == nil ? "Generate Clinical Summary" : "Regenerate Summary",
                          systemImage: "doc.text.magnifyingglass")
                        .foregroundStyle(.teal)
                }
            }
            .disabled(isDrafting)
        } header: {
            Label("Clinical Reasoning", systemImage: "stethoscope")
        } footer: {
            Text("Auto-generated from the patient's chart data. The surgeon retains full clinical responsibility.")
                .font(.caption2).foregroundStyle(.tertiary)
        }
    }

    // MARK: - AI generation

    private func generateReasoning() async {
        isDrafting = true
        defer { isDrafting = false }
        let text = SOAPDraftEngine.narrativeSummary(patient: patient)
        guard !text.isEmpty, text != "Clinical summary to be completed." else {
            aiError = "Insufficient clinical data to generate a summary. Please complete the consultation first."
            showError = true
            return
        }
        patient.aiClinicalReasoning = text
        patient.updatedAt = .now
        patient.pendingSync = true
    }

    // MARK: - Supporting types

    private struct RedFlag {
        let text: String
        let severity: Severity
    }

    private enum Severity: Int {
        case critical = 0, urgent = 1, moderate = 2
    }
}
