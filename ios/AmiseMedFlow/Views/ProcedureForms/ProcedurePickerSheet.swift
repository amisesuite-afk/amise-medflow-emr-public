import SwiftUI

// MARK: - Procedure Picker Sheet
//
// Shown from SurgeryNoteView and ConsentFormView. The surgeon picks a procedure
// from the 25-template library; the sheet calls back with the selected template
// so the caller applies only the fields it cares about.

struct ProcedurePickerSheet: View {
    @Environment(\.dismiss) private var dismiss
    let onSelect: (ProcedureTemplate) -> Void

    @State private var query = ""
    @State private var selectedCategory: ProcedureTemplate.Category? = nil

    private var categories: [ProcedureTemplate.Category] { ProcedureTemplate.Category.allCases }

    private var results: [ProcedureTemplate] {
        let pool = selectedCategory.map { cat in ProcedureTemplate.all.filter { $0.category == cat } }
                   ?? ProcedureTemplate.all
        guard !query.isEmpty else { return pool }
        let q = query.lowercased()
        return pool.filter { $0.name.lowercased().contains(q) || $0.shortName.lowercased().contains(q) }
    }

    private var grouped: [(ProcedureTemplate.Category, [ProcedureTemplate])] {
        if selectedCategory != nil || !query.isEmpty {
            let cats = Set(results.map(\.category))
            return ProcedureTemplate.Category.allCases
                .filter { cats.contains($0) }
                .map { cat in (cat, results.filter { $0.category == cat }) }
        }
        return ProcedureTemplate.byCategory
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                categoryFilterBar

                List {
                    if results.isEmpty {
                        emptyState
                    } else {
                        ForEach(grouped, id: \.0) { category, templates in
                            Section(category.rawValue) {
                                ForEach(templates) { template in
                                    templateRow(template)
                                }
                            }
                        }
                    }
                }
                .listStyle(.insetGrouped)
                .searchable(text: $query, placement: .navigationBarDrawer(displayMode: .always),
                            prompt: "Search procedures…")
            }
            .navigationTitle("Choose Procedure")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
    }

    // MARK: - Category filter pills

    private var categoryFilterBar: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                filterPill("All", isSelected: selectedCategory == nil) {
                    selectedCategory = nil
                }
                ForEach(categories, id: \.self) { cat in
                    filterPill(cat.rawValue, isSelected: selectedCategory == cat) {
                        selectedCategory = selectedCategory == cat ? nil : cat
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
        }
        .background(Color(.systemGroupedBackground))
    }

    private func filterPill(_ label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 13, weight: isSelected ? .semibold : .regular))
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(isSelected ? AMColor.accent : Color(.secondarySystemBackground))
                .foregroundStyle(isSelected ? Color.white : Color.primary)
                .clipShape(Capsule())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Template row

    private func templateRow(_ template: ProcedureTemplate) -> some View {
        Button {
            onSelect(template)
            dismiss()
        } label: {
            HStack(alignment: .top, spacing: 12) {
                VStack(alignment: .leading, spacing: 3) {
                    Text(template.name)
                        .font(.system(size: 15, weight: .medium))
                        .foregroundStyle(.primary)
                    Text("\(template.anaesthesiaType) · \(template.position)")
                        .font(.system(size: 12))
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(AMColor.accent)
            }
            .padding(.vertical, 2)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    // MARK: - Empty state

    private var emptyState: some View {
        Section {
            HStack {
                Spacer()
                VStack(spacing: 8) {
                    Image(systemName: "magnifyingglass")
                        .font(.title2)
                        .foregroundStyle(.tertiary)
                    Text("No procedures match \"\(query)\"")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                }
                .padding(.vertical, 20)
                Spacer()
            }
        }
    }
}
