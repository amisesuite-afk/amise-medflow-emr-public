// PatientHandoverState.swift
// Whether the device is in patient hand-over mode (the pre-consultation questionnaire is in a
// patient's hands, PatientHandoverPresentation). App-wide flows that would show other patients'
// data — a report received from another app (IncomingReportHandling) — wait until it ends.

import Foundation
import SwiftUI

@MainActor
final class PatientHandoverState: ObservableObject {
    static let shared = PatientHandoverState()

    @Published private(set) var activeCount = 0

    var isActive: Bool { activeCount > 0 }

    func begin() { activeCount += 1 }
    func end() { activeCount = max(0, activeCount - 1) }
}
