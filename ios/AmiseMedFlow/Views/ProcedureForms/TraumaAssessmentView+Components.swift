// TraumaAssessmentView+Components.swift
// TraumaLabChip — reusable chip for lab/vital value in trauma assessment.

import SwiftUI
import SwiftData


// MARK: - Trauma lab value chip

struct TraumaLabChip: View {
    let label: String
    let value: String
    var critical: Bool = false

    var body: some View {
        VStack(spacing: 1) {
            Text(label)
                .font(.system(size: 9, weight: .semibold))
                .foregroundStyle(critical ? .red : .secondary)
            Text(value)
                .font(.system(size: 11, weight: .bold))
                .foregroundStyle(critical ? .red : .primary)
        }
        .padding(.horizontal, 8).padding(.vertical, 4)
        .background((critical ? Color.red : Color.secondary).opacity(0.08),
                    in: RoundedRectangle(cornerRadius: 6))
    }
}
