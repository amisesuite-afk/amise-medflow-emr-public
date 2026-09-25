// ConsultationView+TabBarDispatch.swift
// Pathway step bar, step footer and tab content dispatch.

import SwiftUI
import SwiftData

extension ConsultationView {

    // MARK: - Pathway step bar

    /// Steps for the chosen pathway, in order. Other tabs stay reachable from "More".
    var pathwaySteps: [ConsultTab] { pathway.steps }
    var otherTabs: [ConsultTab] { ConsultTab.allCases.filter { !pathwaySteps.contains($0) } }

    /// `filled`: the steps with documentation, from `filledTabs()` (computed once per render).
    func tabBar(filled: Set<ConsultTab>) -> some View {
        HStack(spacing: 0) {
            Button { showPathwayPicker = true } label: {
                HStack(spacing: 4) {
                    Image(systemName: pathway.icon)
                    Text(pathway.title)
                        .lineLimit(1)
                    Image(systemName: "chevron.down").font(.system(size: 9, weight: .bold))
                }
                .font(.system(size: 12, weight: .bold))
                .foregroundStyle(Color(hex: pathway.accentHex))
                .padding(.horizontal, 10).padding(.vertical, 6)
                .background(Color(hex: pathway.accentHex).opacity(0.15), in: Capsule())
            }
            .buttonStyle(.plain)
            .padding(.leading, 8)

            ScrollViewReader { proxy in
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 0) {
                        ForEach(Array(pathwaySteps.enumerated()), id: \.element) { idx, tab in
                            stepButton(tab, number: idx + 1, isFilled: filled.contains(tab)).id(tab)
                        }
                        // A tab opened from "More" shows at the end while it is active.
                        if otherTabs.contains(activeTab) {
                            stepButton(activeTab, number: nil, isFilled: filled.contains(activeTab)).id(activeTab)
                        }
                        Menu {
                            ForEach(otherTabs, id: \.self) { tab in
                                Button(tab.rawValue) { withAnimation(.easeInOut(duration: 0.15)) { activeTab = tab } }
                            }
                        } label: {
                            Text("More")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(AMColor.sidebarText)
                                .padding(.horizontal, 12)
                                .padding(.vertical, 10)
                        }
                    }
                    .padding(.horizontal, 4)
                }
                .onChange(of: activeTab) { _, tab in
                    withAnimation { proxy.scrollTo(tab, anchor: .center) }
                }
            }
        }
        .background(AMColor.sidebarBg)
        .frame(height: 44)
    }

    private func stepButton(_ tab: ConsultTab, number: Int?, isFilled: Bool) -> some View {
        Button {
            withAnimation(.easeInOut(duration: 0.15)) { activeTab = tab }
        } label: {
            VStack(spacing: 0) {
                HStack(spacing: 4) {
                    if isFilled {
                        Circle()
                            .fill(activeTab == tab ? AMColor.accent : Color.green)
                            .frame(width: 5, height: 5)
                    }
                    Text(number.map { "\($0) " } ?? "")
                        .font(.system(size: 10, weight: .bold).monospacedDigit())
                        .foregroundColor(AMColor.sidebarGroup)
                    + Text(pathway.label(for: tab))
                        .font(.system(size: 13, weight: activeTab == tab ? .bold : .semibold))
                        .foregroundColor(activeTab == tab ? AMColor.accent : AMColor.sidebarText)
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 10)
                Rectangle()
                    .fill(activeTab == tab ? AMColor.accent : Color.clear)
                    .frame(height: 2)
            }
        }
        .buttonStyle(.plain)
    }

    // MARK: - Step footer (Back / Next)

    @ViewBuilder
    var stepFooter: some View {
        if let idx = pathwaySteps.firstIndex(of: activeTab) {
            let prev = idx > 0 ? pathwaySteps[idx - 1] : nil
            let next = idx + 1 < pathwaySteps.count ? pathwaySteps[idx + 1] : nil
            HStack {
                if let prev {
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { activeTab = prev }
                    } label: {
                        Label(pathway.label(for: prev), systemImage: "chevron.left")
                            .font(.system(size: 13, weight: .semibold))
                    }
                }
                Spacer()
                Text("Step \(idx + 1) of \(pathwaySteps.count)")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
                Spacer()
                if let next {
                    Button {
                        withAnimation(.easeInOut(duration: 0.15)) { activeTab = next }
                    } label: {
                        HStack(spacing: 4) {
                            Text("Next: \(pathway.label(for: next))")
                            Image(systemName: "chevron.right")
                        }
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 12).padding(.vertical, 7)
                        .background(AMColor.accent, in: Capsule())
                    }
                } else {
                    Label("Last step", systemImage: "flag.checkered")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundStyle(.secondary)
                }
            }
            .buttonStyle(.plain)
            .foregroundStyle(AMColor.accent)
            .padding(.horizontal, 14)
            .padding(.vertical, 8)
            .background(.bar)
        }
    }

    typealias PathwayProgress = (filled: Int, total: Int, missing: [String])

    /// Completion of the chosen pathway's documentation steps (Risk and Last-visit are
    /// informational and not counted).
    var pathwayProgress: PathwayProgress { pathwayProgress(filledTabs()) }

    /// Same, from an already-computed filled set (body computes it once per render).
    func pathwayProgress(_ filled: Set<ConsultTab>) -> PathwayProgress {
        ListPerf.pathwayProgress(steps: pathwaySteps,
                                 uncounted: [.risk, .history],
                                 filled: filled,
                                 label: { pathway.label(for: $0) })
    }

    /// The pathway steps (and the active tab, when opened from "More") that have documentation.
    func filledTabs() -> Set<ConsultTab> {
        var tabs = pathwaySteps
        if !tabs.contains(activeTab) { tabs.append(activeTab) }
        return Set(tabs.filter { tabFilled($0) })
    }

    func tabFilled(_ tab: ConsultTab) -> Bool {
        switch tab {
        case .cc:        return !(patient.chiefComplaint ?? "").isEmpty
        case .hpi:       return !(patient.hpi ?? "").isEmpty
        case .pmh:       return !(patient.pmhNotes ?? "").isEmpty || !patient.pmhEntries.isEmpty
        case .pshx:      return !(patient.surgicalHistory ?? "").isEmpty || !patient.pshxEntries.isEmpty
        case .meds:      return !patient.prescriptions.isEmpty
        case .allergies: return !patient.allergies.isEmpty
        case .social:    return !(patient.socialHistory ?? "").isEmpty
        case .exam:           return !(patient.examGeneral ?? "").isEmpty || !(patient.examAbdo ?? "").isEmpty
        case .investigations: return !patient.investigations.isEmpty
        case .diagnosis:      return patient.workingDiagnosis != nil
        case .plan:      return !(patient.managementPlan ?? "").isEmpty
        case .history:   return !patient.encounters.isEmpty
        case .risk:      return patient.visitType != nil
        case .ward:
            return patient.pathwayData.ward.reviewedAt.map { Calendar.current.isDateInToday($0) } ?? false
        case .trauma:    return patient.traumaDataJson != nil
        case .burns:     return !patient.pathwayData.burns.regionFractions.values.filter { $0 > 0 }.isEmpty
        case .screening: return !patient.pathwayData.wellness.statuses.isEmpty
        case .preop:     return patient.preOpChecklistDataJson != nil
        case .consent:   return patient.consentFormDataJson != nil
        }
    }

    // MARK: - Tab content dispatch

    @ViewBuilder
    var tabContent: some View {
        switch activeTab {
        case .cc:        ccTab
        case .hpi:       hpiTab
        case .pmh:       pmhTab
        case .pshx:      pshxTab
        case .meds:      List { medicationsSection }
        case .allergies: allergiesTab
        case .social:    socialTab
        case .exam:           examTab
        case .investigations: investigationsTab
        case .diagnosis:      diagnosisTab
        case .plan:      planTab
        case .history:   encounterHistoryTab
        case .risk:      riskTab
        case .ward:      WardReviewPanel(patient: patient)
        case .trauma:    TraumaAssessmentView(patient: patient)
        case .burns:     BurnsAssessmentView(patient: patient)
        case .screening: WellnessScreeningView(patient: patient)
        case .preop:     PreOpChecklistView(patient: patient)
        case .consent:   ConsentFormView(patient: patient)
        }
    }

    // MARK: - Follow-up: last visit reference

    /// Shown above the Interval-history step of a follow-up so the previous diagnosis and
    /// plan are in view while taking the interval history.
    @ViewBuilder
    var lastVisitCard: some View {
        if pathway == .followUp, activeTab == .hpi,
           let last = patient.encounters.filter(\.isComplete).max(by: { $0.encounterDate < $1.encounterDate }) {
            VStack(alignment: .leading, spacing: 3) {
                HStack(spacing: 6) {
                    Image(systemName: "clock.arrow.circlepath").foregroundStyle(AMColor.accent)
                    Text("Last visit \(last.encounterDate.formatted(date: .abbreviated, time: .omitted)) · \(last.visitType.shortLabel)")
                        .font(.caption.weight(.semibold))
                    Spacer()
                    Button("Open") { lastVisitShown = last }
                        .font(.caption.weight(.semibold))
                }
                if let dx = last.workingDiagnosis, !dx.isEmpty {
                    Text("Dx: \(dx)").font(.caption)
                }
                if let plan = last.managementPlan, !plan.isEmpty {
                    Text("Plan: \(plan)").font(.caption).foregroundStyle(.secondary).lineLimit(3)
                }
            }
            .padding(.horizontal, 14).padding(.vertical, 8)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(AMColor.accentLt.opacity(0.5))
        }
    }

    // MARK: - Risk step

    var riskTab: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                RiskSnapshotCard(flags: VisitRiskAssessment.assess(patient, pathway: pathway))
                if !surgicalRiskAlerts.isEmpty {
                    VStack(alignment: .leading, spacing: 4) {
                        Label("Surgical risk alerts", systemImage: "exclamationmark.shield")
                            .font(.subheadline.weight(.semibold))
                        ForEach(surgicalRiskAlerts) { a in
                            Text("• \(a.title) — \(a.action)")
                                .font(.caption)
                        }
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 12))
                }
                Text("VISIT PATHWAY")
                    .font(.system(size: 11, weight: .heavy))
                    .tracking(0.6)
                    .foregroundStyle(.secondary)
                VisitPathwayPicker(patient: patient, current: pathway, onSelect: { choosePathway($0) }, showsRisk: false)
            }
            .padding(16)
        }
    }
}
