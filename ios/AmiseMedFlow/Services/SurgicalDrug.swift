// SurgicalDrug.swift
// SurgicalDrug type, search(), and popular accessor.
// Bulk formulary data is in SurgicalDrug+Formulary.swift.

import Foundation

struct SurgicalDrug: Identifiable, Equatable, Hashable {
    let id = UUID()
    let name: String
    let category: String
    let commonDoses: String
    let route: String
    let notes: String
    var sideEffects: String = ""
    var contraindications: String = ""
    var renalDosing: String = ""
    var hepaticDosing: String = ""
    var monitoring: String = ""

    static func search(_ query: String) -> [SurgicalDrug] {
        guard query.count >= 1 else { return [] }
        let q = query.lowercased()
        let formularyHits = allDrugs.filter {
            $0.name.lowercased().contains(q) ||
            $0.category.lowercased().contains(q)
        }
        let formularyNames = Set(formularyHits.map { $0.name.lowercased() })
        let customHits = CustomDrugStore.shared.asDrugs.filter {
            $0.name.lowercased().contains(q) && !formularyNames.contains($0.name.lowercased())
        }
        return (formularyHits + customHits).prefix(20).map { $0 }
    }

    // Curated subset shown when the search field is focused but empty — the
    // most commonly prescribed drugs in a general/endoscopic surgical practice.
    private static let _popularNames: Set<String> = [
        // Antihypertensives / Cardiac
        "Amlodipine", "Losartan", "Lisinopril", "Ramipril", "Atenolol",
        "Bisoprolol", "Metoprolol", "Furosemide", "Hydrochlorothiazide",
        "Spironolactone", "Valsartan", "Candesartan", "Perindopril",
        // Lipid / Antiplatelet
        "Atorvastatin", "Simvastatin", "Rosuvastatin", "Aspirin", "Clopidogrel",
        // Diabetes
        "Metformin", "Gliclazide", "Insulin aspart (NovoRapid)", "Empagliflozin (Jardiance)",
        // Analgesics / GI
        "Paracetamol", "Ibuprofen", "Naproxen",
        "Omeprazole", "Pantoprazole", "Esomeprazole (Nexium)",
        // Anticoagulants
        "Enoxaparin", "Warfarin",
        // Endocrine
        "Levothyroxine", "Prednisolone",
        // Antiemetics
        "Metoclopramide", "Ondansetron",
        // Respiratory
        "Salbutamol (Albuterol)", "Beclometasone (Clenil, QVAR)",
        // CNS / Psychiatry
        "Sertraline", "Diazepam",
        // Urology
        "Tamsulosin (Flomax)",
        // Allergy
        "Cetirizine (Zyrtec)", "Loratadine (Claritin)", "Chlorphenamine (Piriton)",
        // Antibiotics (common)
        "Amoxicillin", "Co-amoxiclav (Augmentin)", "Doxycycline", "Metronidazole",
        "Ciprofloxacin", "Flucloxacillin",
        // Anaesthetic adjuncts
        "Morphine", "Tramadol",
    ]
    static var popular: [SurgicalDrug] {
        allDrugs.filter { _popularNames.contains($0.name) }
                .sorted { $0.name < $1.name }
    }

    // Split into private sub-arrays to avoid Swift type-checker timeout on large literals.
    static let allDrugs: [SurgicalDrug] =
        _drugs1 + _drugs2 + _drugs3 + _drugs4 + _drugs5 + _drugs6 + _drugs7 + _drugs8 + _drugs9
}

