import SwiftUI

// MARK: - Diagnosis Catalogue Sheet
//
// Searchable list of all Bayesian engine candidates (229 across 46 pools).
// The clinician can:
//   • Browse by symptom domain (pool)
//   • Search by name, ICD code, or domain keyword
//   • Tap to set as working diagnosis (no auto-commit — surgeon confirms)
//   • Add a custom diagnosis not yet in the database

struct DiagnosisCatalogueSheet: View {
    @Bindable var patient: Patient
    @Environment(\.dismiss) private var dismiss

    @State private var query = ""
    @State private var selectedPool: String? = nil
    @State private var showAddCustom = false
    @State private var customName = ""
    @State private var customICD = ""

    // All entries, computed once
    private let allEntries = BayesianDiagnosisEngine.allCatalogueEntries

    // MARK: Filtered / grouped results

    private var filteredEntries: [BayesianDiagnosisEngine.CatalogueEntry] {
        let base: [BayesianDiagnosisEngine.CatalogueEntry] = query.count >= 2
            ? BayesianDiagnosisEngine.searchCatalogue(query)
            : (selectedPool != nil
               ? allEntries.filter { $0.pool == selectedPool }
               : allEntries)
        return base
    }

    private var availablePools: [String] {
        Array(Set(allEntries.map(\.pool))).sorted()
    }

    // MARK: - Body

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                searchBar
                if query.isEmpty { poolFilter }
                Divider()
                if filteredEntries.isEmpty {
                    emptyState
                } else {
                    catalogueList
                }
            }
            .background(AMColor.bg)
            .navigationTitle("Diagnostic Catalogue")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        showAddCustom = true
                    } label: {
                        Image(systemName: "plus")
                    }
                }
            }
            .sheet(isPresented: $showAddCustom) {
                addCustomSheet
            }
        }
    }

    // MARK: - Search bar

    private var searchBar: some View {
        HStack(spacing: 8) {
            Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
            TextField("Search diagnosis, ICD code, or symptom domain…", text: $query)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
            if !query.isEmpty {
                Button { query = "" } label: {
                    Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary)
                }
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 12)
        .background(AMColor.card)
    }

    // MARK: - Pool filter chips

    private var poolFilter: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                filterChip("All", isSelected: selectedPool == nil) {
                    selectedPool = nil
                }
                ForEach(availablePools, id: \.self) { pool in
                    filterChip(poolDisplayName(pool), isSelected: selectedPool == pool) {
                        selectedPool = selectedPool == pool ? nil : pool
                    }
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 8)
        }
        .background(AMColor.card)
    }

    private func filterChip(_ label: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.system(size: 12, weight: .medium))
                .padding(.horizontal, 10)
                .padding(.vertical, 5)
                .background(isSelected ? AMColor.accent.opacity(0.15) : Color(.secondarySystemBackground))
                .foregroundStyle(isSelected ? AMColor.accent : .secondary)
                .clipShape(Capsule())
                .overlay(Capsule().strokeBorder(isSelected ? AMColor.accent.opacity(0.4) : Color.clear, lineWidth: 1))
        }
    }

    // MARK: - Catalogue list

    private var catalogueList: some View {
        List(filteredEntries) { entry in
            Button {
                setWorkingDiagnosis(name: entry.name, icd: entry.icd)
            } label: {
                HStack(alignment: .top, spacing: 10) {
                    // Tier badge
                    Text(entry.tier)
                        .font(.system(size: 10, weight: .heavy).monospaced())
                        .foregroundStyle(.white)
                        .frame(width: 20, height: 20)
                        .background(tierColor(entry.tier))
                        .clipShape(RoundedRectangle(cornerRadius: 4))
                        .padding(.top, 2)

                    VStack(alignment: .leading, spacing: 3) {
                        Text(entry.name)
                            .font(.subheadline.weight(.medium))
                            .foregroundStyle(.primary)
                        HStack(spacing: 6) {
                            Text(entry.icd)
                                .font(.system(size: 11).monospaced())
                                .foregroundStyle(.secondary)
                            Text("·")
                                .foregroundStyle(.secondary)
                            Text(poolDisplayName(entry.pool))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    }
                    Spacer()
                    if patient.workingDiagnosis == entry.name {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.teal)
                    }
                }
                .contentShape(Rectangle())
            }
            .listRowBackground(
                patient.workingDiagnosis == entry.name
                    ? AMColor.accent.opacity(0.07)
                    : Color.clear
            )
        }
        .listStyle(.plain)
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 12) {
            Spacer()
            Image(systemName: "magnifyingglass.circle")
                .font(.system(size: 44))
                .foregroundStyle(.tertiary)
            Text("No matches for "\(query)"")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Button("Add Custom Diagnosis") {
                customName = query
                showAddCustom = true
            }
            .buttonStyle(.bordered)
            Spacer()
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Add custom diagnosis sheet

    private var addCustomSheet: some View {
        NavigationStack {
            Form {
                Section("New Diagnosis") {
                    TextField("Diagnosis name", text: $customName)
                    TextField("ICD-10 code (optional)", text: $customICD)
                        .autocorrectionDisabled()
                        .textInputAutocapitalization(.characters)
                }
                Section {
                    Text("Custom diagnoses are saved for this patient only. They appear in the working diagnosis field and clinical notes.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }
            .navigationTitle("Custom Diagnosis")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { showAddCustom = false }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Set") {
                        let name = customName.trimmingCharacters(in: .whitespaces)
                        guard !name.isEmpty else { return }
                        let icd = customICD.trimmingCharacters(in: .whitespaces)
                        setWorkingDiagnosis(name: name, icd: icd.isEmpty ? nil : icd)
                        showAddCustom = false
                    }
                    .disabled(customName.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }

    // MARK: - Helpers

    private func setWorkingDiagnosis(name: String, icd: String?) {
        patient.workingDiagnosis = name
        patient.workingDiagnosisICD = icd
        patient.workingDiagnosisCC = patient.chiefComplaint
        patient.updatedAt = .now
        patient.pendingSync = true
        dismiss()
    }

    private func tierColor(_ tier: String) -> Color {
        switch tier {
        case "A": return .teal
        case "B": return .blue
        case "C": return .orange
        default:  return .gray
        }
    }

    /// Human-readable pool name from camelCase pool key.
    private func poolDisplayName(_ key: String) -> String {
        let known: [String: String] = [
            "abdominalPain": "Abdominal Pain",
            "jaundice": "Jaundice",
            "dysphagia": "Dysphagia",
            "rectalBleeding": "Rectal Bleeding",
            "bowelHabit": "Bowel Habit",
            "breastLump": "Breast",
            "neckLump": "Neck Lump",
            "thyroidPathology": "Thyroid",
            "hernia": "Hernia",
            "perianal": "Perianal",
            "weightLoss": "Weight Loss",
            "refluxGERD": "Reflux / GERD",
            "groinPain": "Groin Pain",
            "chestPain": "Chest Pain",
            "shortnessOfBreath": "Breathlessness",
            "feverInfection": "Fever / Infection",
            "urinarySymptoms": "Urinary",
            "jointPain": "Joint Pain",
            "hypertensionReview": "Hypertension",
            "diabetesReview": "Diabetes",
            "nauseaVomiting": "Nausea / Vomiting",
            "upperGIBleed": "Upper GI Bleed",
            "postOpReview": "Post-op Review",
            "adrenalEndocrine": "Adrenal / Endocrine",
            "vascularSurgical": "Vascular",
            "smallBowelObstruction": "Small Bowel Obstruction",
            "pilonidalDisease": "Pilonidal Disease",
            "renalColic": "Renal Colic",
            "strokeTIA": "Stroke / TIA",
            "anaemia": "Anaemia",
            "woundInfection": "Wound Infection",
            "sepsisConditions": "Sepsis",
            "necrotizingInfection": "Necrotising Infection",
            "venousThromboEmbolism": "VTE",
            "acuteLimbIschaemia": "Acute Limb Ischaemia",
            "skinLesion": "Skin Lesion",
            "scrotalTesticular": "Scrotal / Testicular",
            "urinaryRetention": "Urinary Retention",
            "rectalProlapse": "Rectal Prolapse",
            "parotidSalivary": "Parotid / Salivary",
            "headache": "Headache",
            "dizzinessVertigo": "Dizziness / Vertigo",
            "backPain": "Back Pain",
            "fatigue": "Fatigue",
            "cough": "Cough",
            "generalMedicine": "General Medicine",
        ]
        return known[key] ?? key
    }
}
