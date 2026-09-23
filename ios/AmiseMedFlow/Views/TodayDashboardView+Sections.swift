// TodayDashboardView+Sections.swift
// @ViewBuilder section vars: Waiting, Alert, Results Available, Ward,
// Theatre, Endoscopy, Clinic, Calendar, Empty state.

import SwiftUI
import SwiftData
import EventKit

extension TodayDashboardView {

    // MARK: - Waiting (checked in by front desk) Section

    @ViewBuilder
    var waitingSection: some View {
        Section {
            ForEach(readyForDoctorPatients) { patient in
                Button { selectedPatient = patient } label: {
                    HStack(spacing: 10) {
                        Circle()
                            .fill(Color.orange)
                            .frame(width: 8, height: 8)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(patient.fullName)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(.primary)
                            HStack(spacing: 6) {
                                if let cc = patient.chiefComplaint, !cc.isEmpty {
                                    Text(cc)
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                        .lineLimit(1)
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
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.vertical, 2)
                }
                .buttonStyle(.plain)
                .listRowBackground(Color.orange.opacity(0.05))
            }
        } header: {
            HStack {
                Label("Ready for Doctor", systemImage: "person.fill.checkmark")
                    .foregroundStyle(.orange)
                    .font(.system(size: 11, weight: .heavy))
                    .textCase(nil)
                Spacer()
                Text("\(readyForDoctorPatients.count)")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.orange)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.orange.opacity(0.15), in: Capsule())
            }
        }
    }

    // MARK: - Alert Section

    @ViewBuilder
    var alertSection: some View {
        Section {
            ForEach(highAcuityWard) { patient in
                Button { selectedPatient = patient } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "exclamationmark.triangle.fill")
                            .foregroundStyle(.red)
                            .font(.system(size: 14))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(patient.fullName)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(.primary)
                            if let v = patient.vitalsEntries.sorted(by: { $0.recordedAt > $1.recordedAt }).first {
                                Text("NEWS2 \(v.news2Score) · \(v.news2Risk) risk")
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
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.vertical, 2)
                }
                .buttonStyle(.plain)
                .listRowBackground(Color.red.opacity(0.06))
            }
        } header: {
            Label("Alerts — High acuity", systemImage: "exclamationmark.triangle.fill")
                .foregroundStyle(.red)
                .font(.system(size: 11, weight: .heavy))
                .textCase(nil)
        }
    }

    // MARK: - Results Available Section

    @ViewBuilder
    var resultsSection: some View {
        Section {
            ForEach(patientsWithNewResults) { patient in
                Button { selectedPatient = patient } label: {
                    HStack(spacing: 10) {
                        Image(systemName: "flask.fill")
                            .foregroundStyle(.teal)
                            .font(.system(size: 13))
                        VStack(alignment: .leading, spacing: 2) {
                            Text(patient.fullName)
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(.primary)
                            let resultedInvs = patient.investigations
                                .filter { $0.status == .resulted && !$0.result.isEmpty }
                            Text(resultedInvs.prefix(2).map { $0.name }.joined(separator: ", ")
                                 + (resultedInvs.count > 2 ? " +\(resultedInvs.count - 2) more" : ""))
                                .font(.caption)
                                .foregroundStyle(.teal)
                        }
                        Spacer()
                        Image(systemName: "chevron.right")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.vertical, 2)
                }
                .buttonStyle(.plain)
                .listRowBackground(Color.teal.opacity(0.05))
            }
        } header: {
            Label("Results Available", systemImage: "flask.fill")
                .foregroundStyle(.teal)
                .font(.system(size: 11, weight: .heavy))
                .textCase(nil)
        }
    }

    // MARK: - Ward Section

    @ViewBuilder
    var wardSection: some View {
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
                    .font(.system(size: 11, weight: .semibold))
                Spacer()
                Text("\(wardPatients.count)")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.secondary.opacity(0.12), in: Capsule())
            }
        }
    }

    // MARK: - Theatre Section

    @ViewBuilder
    var theatreSection: some View {
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
                    .font(.system(size: 11, weight: .semibold))
                Spacer()
                Text("\(theatreToday.count) \(theatreToday.count == 1 ? "case" : "cases")")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Endoscopy Section

    @ViewBuilder
    var endoscopySection: some View {
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
                    .font(.system(size: 11, weight: .semibold))
                Spacer()
                Text("\(endoscopyToday.count) \(endoscopyToday.count == 1 ? "case" : "cases")")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }
        }
    }

    // MARK: - Clinic Section

    @ViewBuilder
    var clinicSection: some View {
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
                    .font(.system(size: 11, weight: .semibold))
                Spacer()
                Text("\(clinicToday.count)")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.secondary.opacity(0.12), in: Capsule())
            }
        }
    }

    // MARK: - Calendar Section (iOS EventKit / Google Calendar sync)

    @ViewBuilder
    var calendarSection: some View {
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
            ForEach(todayCalEvents, id: \.eventIdentifier) { event in
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
                                .font(.system(size: 14, weight: .semibold))
                                .foregroundStyle(.primary)
                                .lineLimit(1)
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
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.tertiary)
                    }
                    .padding(.vertical, 2)
                }
                .buttonStyle(.plain)
            }
        } header: {
            HStack {
                Label("Calendar", systemImage: "calendar")
                    .textCase(nil)
                    .font(.system(size: 11, weight: .semibold))
                Spacer()
                Text("\(todayCalEvents.count)")
                    .font(.caption2.monospacedDigit())
                    .foregroundStyle(.secondary)
                    .padding(.horizontal, 6).padding(.vertical, 2)
                    .background(Color.secondary.opacity(0.12), in: Capsule())
            }
        }
    }

    // MARK: - Empty state

    var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "calendar.badge.checkmark")
                .font(.system(size: 56))
                .foregroundStyle(AMColor.accent)
            Text("Nothing scheduled today")
                .font(.headline)
            Text("Ward patients and today's theatre, endoscopy, and clinic lists will appear here.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 40)
            HStack(spacing: 12) {
                if unimportedCalEventCount > 0 {
                    Button {
                        showCalendarImport = true
                    } label: {
                        Label("Add from Calendar (\(unimportedCalEventCount))", systemImage: "calendar.badge.plus")
                            .font(.subheadline.weight(.semibold))
                            .padding(.horizontal, 20).padding(.vertical, 10)
                            .background(AMColor.accent, in: Capsule())
                            .foregroundStyle(.white)
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
                }
                .buttonStyle(.plain)
            }
            .padding(.top, 8)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

}
