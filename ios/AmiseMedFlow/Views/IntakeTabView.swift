import SwiftUI

struct IntakeTabView: View {
    @Bindable var patient: Patient

    private struct Field: Identifiable {
        let id: String
        let label: String
        let icon: String
        let value: String
        let required: Bool
        var isComplete: Bool { !value.isEmpty }
    }

    private var fields: [Field] {
        [
            Field(id: "name",       label: "Full name",          icon: "person",                  value: patient.fullName,                          required: true),
            Field(id: "sex",        label: "Sex",                icon: "figure.stand",             value: patient.sex == .unspecified ? "" : patient.sex.rawValue, required: true),
            Field(id: "dob",        label: "Date of birth",      icon: "calendar.badge.clock",     value: patient.dateOfBirth.map { DateFormatter.localizedString(from: $0, dateStyle: .medium, timeStyle: .none) } ?? "", required: true),
            Field(id: "phone",      label: "Phone",              icon: "phone",                    value: patient.phone ?? "",                        required: true),
            Field(id: "email",      label: "Email",              icon: "envelope",                 value: patient.email ?? "",                        required: false),
            Field(id: "address",    label: "Address",            icon: "location",                 value: patient.address ?? "",                      required: false),
            Field(id: "mrn",        label: "MRN",                icon: "number.circle",            value: patient.mrn ?? "",                          required: false),
            Field(id: "cc",         label: "Chief complaint",    icon: "text.bubble",              value: patient.chiefComplaint ?? "",               required: true),
            Field(id: "pmh",        label: "Past medical history", icon: "clock.arrow.circlepath", value: patient.pmhNotes ?? "",                     required: true),
            Field(id: "sx",         label: "Surgical history",   icon: "scissors",                 value: patient.surgicalHistory ?? "",              required: true),
            Field(id: "allergies",  label: "Allergies",          icon: "exclamationmark.shield",   value: patient.allergiesJson ?? "",                required: true),
            Field(id: "nok",        label: "Next of kin name",   icon: "person.2",                 value: patient.nokName ?? "",                      required: true),
            Field(id: "nokphone",   label: "Next of kin phone",  icon: "phone.badge.checkmark",    value: patient.nokPhone ?? "",                     required: true),
            Field(id: "insurance",  label: "Insurance provider", icon: "creditcard",               value: patient.insuranceProvider ?? "",            required: false),
            Field(id: "policy",     label: "Policy number",      icon: "doc.text",                 value: patient.policyNumber ?? "",                 required: false),
            Field(id: "social",     label: "Social history",     icon: "house",                    value: patient.socialHistory ?? "",                required: false),
        ]
    }

    private var required: [Field]  { fields.filter { $0.required } }
    private var optional: [Field]  { fields.filter { !$0.required } }
    private var missingRequired: Int { required.filter { !$0.isComplete }.count }

    private var completionFraction: Double {
        required.isEmpty ? 1.0 : Double(required.filter { $0.isComplete }.count) / Double(required.count)
    }

    var body: some View {
        List {
            progressSection
            Section("Required") {
                ForEach(required) { IntakeFieldRow(field: $0) }
            }
            Section("Optional") {
                ForEach(optional) { IntakeFieldRow(field: $0) }
            }
        }
        .navigationTitle("Intake Checklist")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var progressSection: some View {
        Section {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text(missingRequired == 0
                         ? "Intake complete"
                         : "\(missingRequired) required field\(missingRequired == 1 ? "" : "s") missing")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(missingRequired == 0 ? .green : .orange)
                    Spacer()
                    Text("\(Int(completionFraction * 100))%")
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundStyle(missingRequired == 0 ? .green : .orange)
                }
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        RoundedRectangle(cornerRadius: 3)
                            .fill(Color.secondary.opacity(0.2))
                            .frame(height: 6)
                        RoundedRectangle(cornerRadius: 3)
                            .fill(missingRequired == 0 ? Color.green : Color.orange)
                            .frame(width: geo.size.width * completionFraction, height: 6)
                            .animation(.spring(duration: 0.4), value: completionFraction)
                    }
                }
                .frame(height: 6)

                if missingRequired == 0 {
                    Label("All required fields complete — chart ready", systemImage: "checkmark.seal.fill")
                        .font(.caption).foregroundStyle(.green)
                }
            }
            .padding(.vertical, 4)
        }
    }
}

// MARK: - Row

private struct IntakeFieldRow: View {
    let field: IntakeTabView.Field

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: field.isComplete
                  ? "checkmark.circle.fill"
                  : (field.required ? "exclamationmark.circle.fill" : "circle"))
                .foregroundStyle(field.isComplete ? .green : (field.required ? .orange : .secondary))
                .font(.system(size: 17))

            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 6) {
                    Image(systemName: field.icon)
                        .font(.system(size: 11)).foregroundStyle(.secondary)
                    Text(field.label)
                        .font(.system(size: 13, weight: .semibold))
                    if field.required && !field.isComplete {
                        Text("Required")
                            .font(.system(size: 10, weight: .semibold)).foregroundStyle(.orange)
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Color.orange.opacity(0.12), in: Capsule())
                    }
                }
                if !field.value.isEmpty {
                    // Truncate allergiesJson display
                    let display: String = field.id == "allergies"
                        ? (field.isComplete ? "Recorded" : "")
                        : field.value
                    if !display.isEmpty {
                        Text(display)
                            .font(.system(size: 12)).foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                } else {
                    Text("Not entered")
                        .font(.system(size: 12)).foregroundStyle(.tertiary).italic()
                }
            }
        }
        .padding(.vertical, 2)
    }
}
