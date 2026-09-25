// TodayDashboardView+Sections.swift
// @ViewBuilder section vars: Waiting, Alert, Results Available, Ward,
// Theatre, Endoscopy, Clinic, Calendar, Empty state.

import SwiftUI
import SwiftData
import EventKit

extension TodayDashboardView {

    // MARK: - Waiting (checked in by front desk) Section

    @ViewBuilder
    func waitingSection(_ readyForDoctorPatients: [Patient]) -> some View {
        Section {
            ForEach(readyForDoctorPatients) { patient in
                Button { selectedPatient = patient } label: {
                    HStack(spacing: 10) {
                        Circle()
                            .fill(Color.orange)
                            .frame(width: 8, height: 8)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(patient.fullName)
                                .scaledFont(size: 14, weight: .semibold)
                                .foregroundStyle(.primary)
                            detailLayout {
                                if let cc = patient.chiefComplaint, !cc.isEmpty {
                                    Text(cc)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(dynamicTypeSize.isAccessibilitySize ? 3 : 1)
                                }
                                if let vt = patient.visitType {
                                    Text(vt.shortLabel)
                                        .font(.caption2)
                                        .foregroundStyle(.orange)
                                        .padding(.horizontal, 5)
                                        .padding(.vertical, 1)
                                        .background(Color.orange.opacity(0.12), in: Capsule())
                                }
                            }
                        }
                        Spacer()
                        if let ct = patient.checkInTime {
                            Text(ct.formatted(date: .omitted, time: .shortened))
                                .font(.caption2.monospacedDigit())
                                .foregroundStyle(.secondary)
                        }
                        Image(systemName: "chevron.right")
                            .scaledFont(size: 11, weight: .semibold)
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.vertical, 2)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Text(waitingAccessibilityLabel(patient)))
                .listRowBackground(Color.orange.opacity(0.05))
            }
        } header: {
            HStack {
                Label("Ready for Doctor", systemImage: "person.fill.checkmark")
                    .foregroundStyle(.orange)
                    .scaledFont(size: 11, weight: .heavy)
                    .textCase(nil)
                Spacer()
                Text("\(readyForDoctorPatients.count)")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.orange)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.orange.opacity(0.15), in: Capsule())
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
        }
    }

    // MARK: - Alert Section

    @ViewBuilder
    func alertSection(_ board: TodayBoard) -> some View {
        Section {
            ForEach(board.highAcuityWard) { patient in
                Button { selectedPatient = patient } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                            .scaledFont(size: 14)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(patient.fullName)
                                .scaledFont(size: 14, weight: .semibold)
                                .foregroundStyle(.primary)
                            if let v = board.latestNEWS2[patient.id] {
                                Text("NEWS2 \(v.score) · \(v.risk) risk\(v.isComplete ? "" : " · incomplete")")
                                    .font(.caption)
                                    .foregroundStyle(.red)
                            } else if patient.setting == .emergency {
                                Text("Emergency admission")
                                    .font(.caption)
                                    .foregroundStyle(.red)
                            }
                        }
                        Spacer()
                        if let ward = patient.ward, let bed = patient.bedNumber {
                            Text("\(ward) · \(bed)")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                        Image(systemName: "chevron.right")
                            .scaledFont(size: 11, weight: .semibold)
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.vertical, 2)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Text(alertAccessibilityLabel(patient, board: board)))
                .listRowBackground(Color.red.opacity(0.06))
            }
        } header: {
            Label("Alerts — High acuity", systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
                .scaledFont(size: 11, weight: .heavy)
                .textCase(nil)
        }
    }

    // MARK: - Results Available Section

    @ViewBuilder
    func resultsSection(_ board: TodayBoard) -> some View {
        Section {
            ForEach(board.withNewResults) { patient in
                Button { selectedPatient = patient } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "flask.fill")
                            .foregroundStyle(.teal)
                            .scaledFont(size: 13)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(patient.fullName)
                                .scaledFont(size: 14, weight: .semibold)
                                .foregroundStyle(.primary)
                            Text(board.resultsSummary[patient.id] ?? "")
                                .font(.caption)
                                .foregroundStyle(.teal)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .scaledFont(size: 11, weight: .semibold)
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.vertical, 2)
                }
                .buttonStyle(.plain)
                .accessibilityLabel(Text(A11yLabel.joined([
                    patient.fullName, "New results", board.resultsSummary[patient.id]])))
                .listRowBackground(Color.teal.opacity(0.05))
            }
        } header: {
            Label("Results Available", systemImage: "flask.fill")
                .foregroundStyle(.teal)
                .scaledFont(size: 11, weight: .heavy)
                .textCase(nil)
        }
    }

    // MARK: - Ward Section

    @ViewBuilder
    func wardSection(_ wardPatients: [Patient]) -> some View {
        Section {
            ForEach(wardPatients) { patient in
                Button { selectedPatient = patient } label: {
                    TodayPatientRow(patient: patient, style: .ward)
                }
                .buttonStyle(.plain)
            }
        } header: {
            HStack {
                Label("Ward Round", systemImage: "bed.double.fill")
                    .textCase(nil)
                    .scaledFont(size: 11, weight: .semibold)
                Spacer()
                Text("\(wardPatients.count)")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.secondary.opacity(0.12), in: Capsule())
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
        }
    }

    // MARK: - Theatre Section

    @ViewBuilder
    func theatreSection(_ theatreToday: [Patient]) -> some View {
        Section {
            ForEach(theatreToday) { patient in
                Button { selectedPatient = patient } label: {
                    TodayPatientRow(patient: patient, style: .theatre)
                }
                .buttonStyle(.plain)
            }
        } header: {
            HStack {
                Label("Theatre", systemImage: "scalpel")
                    .textCase(nil)
                    .scaledFont(size: 11, weight: .semibold)
                Spacer()
                Text("\(theatreToday.count) \(theatreToday.count == 1 ? "case" : "cases")")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
        }
    }

    // MARK: - Endoscopy Section

    @ViewBuilder
    func endoscopySection(_ endoscopyToday: [Patient]) -> some View {
        Section {
            ForEach(endoscopyToday) { patient in
                Button { selectedPatient = patient } label: {
                    TodayPatientRow(patient: patient, style: .endoscopy)
                }
                .buttonStyle(.plain)
            }
        } header: {
            HStack {
                Label("Endoscopy", systemImage: "eye.circle")
                    .textCase(nil)
                    .scaledFont(size: 11, weight: .semibold)
                Spacer()
                Text("\(endoscopyToday.count) \(endoscopyToday.count == 1 ? "case" : "cases")")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
        }
    }

    // MARK: - Clinic Section

    @ViewBuilder
    func clinicSection(_ clinicToday: [Patient]) -> some View {
        Section {
            ForEach(clinicToday) { patient in
                Button { selectedPatient = patient } label: {
                    TodayPatientRow(patient: patient, style: .clinic)
                }
                .buttonStyle(.plain)
            }
        } header: {
            HStack {
                Label("Clinic", systemImage: "stethoscope")
                    .textCase(nil)
                    .scaledFont(size: 11, weight: .semibold)
                Spacer()
                Text("\(clinicToday.count)")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.secondary.opacity(0.12), in: Capsule())
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
        }
    }

    // MARK: - Calendar Section (iOS EventKit / Google Calendar sync)

    @ViewBuilder
    func calendarSection(_ todayCalEvents: [EKEvent]) -> some View {
        Section {
            if let err = calSvc.error {
                HStack(spacing: 8) {
                    Image(systemName: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                    Text(err)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 4)
            }
            ForEach(CalendarEventRow.rows(todayCalEvents)) { row in
                let event = row.event
                Button {
                    let parsed = CalendarEventParser.parse(title: event.title ?? "", calLabel: event.calEntryLabel)
                    calEventActionPatient = allPatients.first {
                        $0.fullName.lowercased().trimmingCharacters(in: .whitespaces) ==
                        parsed.name.lowercased().trimmingCharacters(in: .whitespaces)
                    }
                    calEventActionTarget = event
                    showCalEventDialog = true
                } label: {
                    HStack(spacing: 10) {
                        RoundedRectangle(cornerRadius: 2)
                            .fill(event.calEntryColor)
                            .frame(width: 3, height: 32)
                        VStack(alignment: .leading, spacing: 2) {
                            Text(event.title ?? "Untitled")
                                .scaledFont(size: 14, weight: .semibold)
                                .foregroundStyle(.primary)
                                .lineLimit(dynamicTypeSize.isAccessibilitySize ? 3 : 1)
                            HStack(spacing: 6) {
                                if let start = event.startDate {
                                    Text(start.formatted(date: .omitted, time: .shortened))
                                        .font(.caption2.monospacedDigit())
                                        .foregroundStyle(.secondary)
                                }
                                if let calName = event.calendar?.title {
                                    Text(calName)
                                        .font(.caption2)
                                        .foregroundStyle(.secondary)
                                        .padding(.horizontal, 5).padding(.vertical, 1)
                                        .background(event.calEntryColor.opacity(0.12), in: Capsule())
                                }
                            }
                        }
                        Spacer()
                        Text(event.calEntryLabel)
                            .font(.caption2.weight(.bold))
                            .foregroundStyle(event.calEntryColor)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(event.calEntryColor.opacity(0.12), in: Capsule())
                        Image(systemName: "chevron.right")
                            .scaledFont(size: 11, weight: .semibold)
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.vertical, 2)
                    .accessibilityElement(children: .combine)
                }
                .buttonStyle(.plain)
                .accessibilityHint("Shows appointment actions")
            }
        } header: {
            HStack {
                Label("Calendar", systemImage: "calendar")
                    .textCase(nil)
                    .scaledFont(size: 11, weight: .semibold)
                Spacer()
                Text("\(todayCalEvents.count)")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.secondary.opacity(0.12), in: Capsule())
            }
            .accessibilityElement(children: .combine)
            .accessibilityAddTraits(.isHeader)
        }
    }

    // MARK: - Accessibility labels

    /// Detail line of a waiting row: side by side, or stacked at accessibility text sizes.
    var detailLayout: AnyLayout {
        dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(alignment: .leading, spacing: 2))
            : AnyLayout(HStackLayout(spacing: 6))
    }

    func waitingAccessibilityLabel(_ patient: Patient) -> String {
        A11yLabel.joined([
            patient.fullName,
            "Ready for doctor",
            patient.chiefComplaint,
            patient.visitType?.rawValue,
            patient.checkInTime.map { "Checked in \($0.formatted(date: .omitted, time: .shortened))" },
        ])
    }

    func alertAccessibilityLabel(_ patient: Patient, board: TodayBoard) -> String {
        var severity: String?
        if let v = board.latestNEWS2[patient.id] {
            severity = A11yLabel.news2(score: v.score, risk: v.risk, incomplete: !v.isComplete)
        } else if patient.setting == .emergency {
            severity = "Emergency admission"
        }
        var location: String?
        if let ward = patient.ward, let bed = patient.bedNumber { location = "\(ward), bed \(bed)" }
        return A11yLabel.joined(["Alert", patient.fullName, severity, location])
    }

    // MARK: - Empty state

    var emptyStateButtonsLayout: AnyLayout {
        dynamicTypeSize.isAccessibilitySize
            ? AnyLayout(VStackLayout(spacing: 12))
            : AnyLayout(HStackLayout(spacing: 12))
    }

    func emptyState(unimportedCalEventCount: Int) -> some View {
        VStack(spacing: 16) {
            Image(systemName: "calendar.badge.checkmark")
                .font(.system(size: 56))
                .foregroundStyle(AMColor.accent)
                .accessibilityHidden(true)
            Text("Nothing scheduled today")
                .font(.headline)
            Text("Ward patients and today's theatre, endoscopy, and clinic lists will appear here.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            // Side by side, or stacked when the text is too large for one row.
            emptyStateButtonsLayout {
                if unimportedCalEventCount > 0 {
                    Button {
                        showCalendarImport = true
                    } label: {
                        Label("Add from Calendar (\(unimportedCalEventCount))", systemImage: "calendar.badge.plus")
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 20).padding(.vertical, 10)
                            .background(AMColor.accent, in: Capsule())
                            .foregroundStyle(.white)
                            .minimumTouchTarget()
                    }
                    .buttonStyle(.plain)
                }
                Button {
                    showAdd = true
                } label: {
                    Label("Add Patient", systemImage: "plus")
                        .font(.subheadline.weight(.semibold))
                        .padding(.horizontal, 20).padding(.vertical, 10)
                        .background(Color(.secondarySystemBackground), in: Capsule())
                        .foregroundStyle(.primary)
                        .minimumTouchTarget()
                }
                .buttonStyle(.plain)
            }
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

}
