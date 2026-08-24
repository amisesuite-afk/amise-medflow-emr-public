import SwiftUI
import SwiftData

// MARK: - CPT code catalogue (surgical + endoscopy)

struct CPTCode: Identifiable {
    let id = UUID()
    let code: String
    let description: String
    let category: String

    static func search(_ query: String) -> [CPTCode] {
        guard query.count >= 2 else { return [] }
        let q = query.lowercased()
        return all.filter {
            $0.code.hasPrefix(q) ||
            $0.description.lowercased().contains(q) ||
            $0.category.lowercased().contains(q)
        }.prefix(20).map { $0 }
    }

    static func suggest(forDiagnosis dx: String?, icd: String?) -> [CPTCode] {
        guard let dx = dx?.lowercased() else { return [] }
        let pfx = icd?.prefix(3).lowercased() ?? ""
        return all.filter { code in
            let cat = code.category.lowercased()
            if pfx.hasPrefix("k35") || pfx.hasPrefix("k37") { return cat == "appendix" }
            if pfx.hasPrefix("k80") || pfx.hasPrefix("k81") || pfx.hasPrefix("k83") { return cat == "biliary" }
            if pfx.hasPrefix("k40") || pfx.hasPrefix("k41") || pfx.hasPrefix("k43") || pfx.hasPrefix("k44") { return cat == "hernia" }
            if pfx.hasPrefix("k57") { return cat == "colorectal" }
            if pfx.hasPrefix("k85") || pfx.hasPrefix("k86") { return cat == "pancreas" }
            if pfx.hasPrefix("k22") || pfx.hasPrefix("k25") { return cat == "upper gi" }
            if pfx.hasPrefix("c18") || pfx.hasPrefix("c19") || pfx.hasPrefix("c20") { return cat == "colorectal" }
            return code.description.lowercased().contains(dx.prefix(6))
        }.prefix(6).map { $0 }
    }

    static let all: [CPTCode] = [
        .init(code: "44950", description: "Appendectomy, open", category: "Appendix"),
        .init(code: "44960", description: "Appendectomy, open, perforated/peritonitis", category: "Appendix"),
        .init(code: "44970", description: "Laparoscopic appendectomy", category: "Appendix"),
        .init(code: "47562", description: "Laparoscopic cholecystectomy", category: "Biliary"),
        .init(code: "47563", description: "Laparoscopic cholecystectomy with cholangiography", category: "Biliary"),
        .init(code: "47600", description: "Cholecystectomy, open", category: "Biliary"),
        .init(code: "47610", description: "Cholecystectomy, open, with CBD exploration", category: "Biliary"),
        .init(code: "43260", description: "ERCP, diagnostic", category: "Biliary"),
        .init(code: "43262", description: "ERCP with sphincterotomy", category: "Biliary"),
        .init(code: "43264", description: "ERCP with stone extraction", category: "Biliary"),
        .init(code: "43265", description: "ERCP with lithotripsy", category: "Biliary"),
        .init(code: "43267", description: "ERCP with stent placement", category: "Biliary"),
        .init(code: "49505", description: "Inguinal hernia repair, open, age 5+", category: "Hernia"),
        .init(code: "49507", description: "Inguinal hernia repair, open, with mesh", category: "Hernia"),
        .init(code: "49650", description: "Laparoscopic inguinal hernia repair, initial", category: "Hernia"),
        .init(code: "49652", description: "Laparoscopic ventral hernia repair, initial", category: "Hernia"),
        .init(code: "49560", description: "Incisional hernia repair, open, initial", category: "Hernia"),
        .init(code: "49575", description: "Umbilical hernia repair, age 5+", category: "Hernia"),
        .init(code: "44140", description: "Colectomy, partial, with anastomosis", category: "Colorectal"),
        .init(code: "44204", description: "Laparoscopic colectomy, partial, with anastomosis", category: "Colorectal"),
        .init(code: "45378", description: "Colonoscopy, diagnostic", category: "Colorectal"),
        .init(code: "45380", description: "Colonoscopy with biopsy", category: "Colorectal"),
        .init(code: "45385", description: "Colonoscopy with polypectomy", category: "Colorectal"),
        .init(code: "46050", description: "Incision and drainage, perianal abscess", category: "Colorectal"),
        .init(code: "46257", description: "Haemorrhoidectomy, internal and external", category: "Colorectal"),
        .init(code: "46270", description: "Anal fistulotomy, simple or superficial", category: "Colorectal"),
        .init(code: "43239", description: "OGD with biopsy", category: "Upper GI"),
        .init(code: "43235", description: "OGD, diagnostic", category: "Upper GI"),
        .init(code: "43243", description: "OGD with dilation of stricture", category: "Upper GI"),
        .init(code: "43255", description: "OGD with control of haemorrhage", category: "Upper GI"),
        .init(code: "43644", description: "Laparoscopic gastric bypass, Roux-en-Y", category: "Upper GI"),
        .init(code: "43775", description: "Laparoscopic sleeve gastrectomy", category: "Upper GI"),
        .init(code: "48150", description: "Pancreatectomy, partial, distal", category: "Pancreas"),
        .init(code: "48146", description: "Pancreatectomy, distal, laparoscopic", category: "Pancreas"),
        .init(code: "19120", description: "Excision of breast lesion, open", category: "Breast"),
        .init(code: "19301", description: "Mastectomy, partial (lumpectomy)", category: "Breast"),
        .init(code: "19303", description: "Mastectomy, simple, complete", category: "Breast"),
        .init(code: "60220", description: "Total thyroid lobectomy with isthmusectomy", category: "Thyroid"),
        .init(code: "60240", description: "Thyroidectomy, total", category: "Thyroid"),
        .init(code: "10060", description: "Incision and drainage of abscess, simple", category: "Skin/Soft Tissue"),
        .init(code: "11400", description: "Excision of benign skin lesion, trunk, <0.5 cm", category: "Skin/Soft Tissue"),
        .init(code: "11770", description: "Excision of pilonidal cyst, simple", category: "Skin/Soft Tissue"),
        .init(code: "99213", description: "Office visit, established, moderate complexity", category: "Consultation"),
        .init(code: "99214", description: "Office visit, established, high complexity", category: "Consultation"),
        .init(code: "99245", description: "Outpatient consultation, high complexity", category: "Consultation"),
        .init(code: "99232", description: "Subsequent hospital care, moderate complexity", category: "Consultation"),
        .init(code: "99233", description: "Subsequent hospital care, high complexity", category: "Consultation"),
    ]
}

// MARK: - View

struct BillingView: View {
    @Bindable var patient: Patient
    @Environment(\.modelContext) private var context

    @State private var cptQuery = ""
    @State private var cptSuggestions: [CPTCode] = []

    private var items: [BillingLineItem] {
        patient.billingItems.sorted { $0.addedAt < $1.addedAt }
    }

    private var suggested: [CPTCode] {
        CPTCode.suggest(forDiagnosis: patient.workingDiagnosis, icd: patient.workingDiagnosisICD)
            .filter { code in !patient.billingItems.contains(where: { $0.cptCode == code.code }) }
    }

    var body: some View {
        List {
            searchSection
            if !suggested.isEmpty { suggestedSection }
            if !items.isEmpty { selectedSection }
        }
        .navigationTitle("Billing")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - Search

    @ViewBuilder
    private var searchSection: some View {
        Section("CPT Code Search") {
            VStack(alignment: .leading, spacing: 0) {
                HStack {
                    Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                    TextField("Procedure name or CPT code", text: $cptQuery)
                        .autocorrectionDisabled()
                        .onChange(of: cptQuery) { _, q in
                            cptSuggestions = q.count >= 2 ? CPTCode.search(q) : []
                        }
                    if !cptQuery.isEmpty {
                        Button { cptQuery = ""; cptSuggestions = [] }
                            label: { Image(systemName: "xmark.circle.fill").foregroundStyle(.secondary) }
                    }
                }
                if !cptSuggestions.isEmpty {
                    Divider().padding(.top, 6)
                    ForEach(cptSuggestions.prefix(8)) { cpt in
                        Button { add(cpt) } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(cpt.description).font(.subheadline).foregroundStyle(.primary)
                                    Text(cpt.code).font(.caption.monospaced()).foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(cpt.category).font(.caption2).foregroundStyle(.tertiary)
                            }
                        }
                        .padding(.vertical, 4)
                        Divider()
                    }
                }
            }
        }
    }

    // MARK: - Suggested

    @ViewBuilder
    private var suggestedSection: some View {
        Section {
            if let dx = patient.workingDiagnosis {
                Label("Suggested for: \(dx)", systemImage: "stethoscope")
                    .font(.caption).foregroundStyle(.secondary)
            }
            ForEach(suggested) { cpt in
                Button { add(cpt) } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(cpt.description).font(.subheadline).foregroundStyle(.primary)
                            Text(cpt.code).font(.caption.monospaced()).foregroundStyle(.secondary)
                        }
                        Spacer()
                        Image(systemName: "plus.circle").foregroundStyle(.teal)
                    }
                }
            }
        } header: {
            Label("Suggested Codes", systemImage: "sparkles").foregroundStyle(.teal)
        }
    }

    // MARK: - Selected

    private var totalXCD: Double {
        items.reduce(0) { $0 + $1.amountXCD * Double($1.units) }
    }

    @ViewBuilder
    private var selectedSection: some View {
        Section("Billing Sheet") {
            ForEach(items) { item in
                BillingItemRow(item: item)
            }
            .onDelete { indexSet in
                indexSet.forEach { context.delete(items[$0]) }
            }
        }

        Section {
            HStack {
                Text("\(items.count) line\(items.count == 1 ? "" : "s")")
                    .font(.caption).foregroundStyle(.secondary)
                Spacer()
                if totalXCD > 0 {
                    Text("XCD \(totalXCD, format: .number.precision(.fractionLength(2)))")
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundStyle(AMColor.accent)
                }
            }

            ShareLink(item: buildSheet()) {
                Label("Export Billing Sheet", systemImage: "square.and.arrow.up")
                    .font(.subheadline.weight(.medium))
            }
        }
    }

    // MARK: - Helpers

    private func add(_ code: CPTCode) {
        guard !patient.billingItems.contains(where: { $0.cptCode == code.code }) else { return }
        let item = BillingLineItem(code: code.code, description: code.description, category: code.category)
        item.patient = patient
        context.insert(item)
        cptQuery = ""
        cptSuggestions = []
    }

    private func buildSheet() -> String {
        let today = Date.now.formatted(date: .abbreviated, time: .omitted)
        var parts: [String] = [
            "BILLING SHEET",
            "Patient:  \(patient.fullName)  ·  \(patient.sex.rawValue.prefix(1)), \(patient.ageYears)y",
            "Date:     \(today)",
        ]
        if let dx = patient.workingDiagnosis {
            let icd = patient.workingDiagnosisICD.map { " (\($0))" } ?? ""
            parts.append("Diagnosis: \(dx)\(icd)")
        }
        parts.append("")
        parts.append(String(repeating: "-", count: 64))
        parts.append("CPT      Qty  Mod   Fee (XCD)   Description")
        parts.append(String(repeating: "-", count: 64))
        for item in items {
            let fee = item.amountXCD > 0 ? String(format: "%.2f", item.amountXCD * Double(item.units)) : "—"
            let mod = item.modifier.isEmpty ? "    " : item.modifier.padding(toLength: 4, withPad: " ", startingAt: 0)
            let feeCol = fee.padding(toLength: 11, withPad: " ", startingAt: 0)
            parts.append("\(item.cptCode.padding(toLength: 8, withPad: " ", startingAt: 0))  ×\(item.units)   \(mod)  \(feeCol) \(item.cptDescription)")
            if !item.note.isEmpty { parts.append("           Note: \(item.note)") }
        }
        parts.append(String(repeating: "-", count: 64))
        if totalXCD > 0 {
            parts.append("TOTAL                                    XCD \(String(format: "%.2f", totalXCD))")
        }
        parts.append("")
        parts.append("Surgeon: Dr Dawit Daniel Kabiye · Amise Medical Services, Saint Lucia")
        return parts.joined(separator: "\n")
    }
}

// MARK: - Inline row editor

private struct BillingItemRow: View {
    @Bindable var item: BillingLineItem
    @State private var amountText: String = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(item.cptCode).font(.subheadline.monospaced().weight(.semibold))
                Spacer()
                Stepper("", value: $item.units, in: 1...10)
                    .labelsHidden().fixedSize()
                Text("×\(item.units)").font(.caption).foregroundStyle(.secondary)
            }
            Text(item.cptDescription).font(.caption).foregroundStyle(.secondary)
            HStack(spacing: 12) {
                TextField("Modifier", text: $item.modifier).font(.caption).frame(width: 72)

                HStack(spacing: 3) {
                    Text("XCD").font(.caption2).foregroundStyle(.tertiary)
                    TextField("Fee", text: $amountText)
                        .font(.caption.weight(.semibold))
                        .keyboardType(.decimalPad)
                        .frame(width: 64)
                        .onChange(of: amountText) { _, v in
                            item.amountXCD = Double(v) ?? 0
                        }
                }

                TextField("Note", text: $item.note).font(.caption)
            }
        }
        .padding(.vertical, 2)
        .onAppear {
            if item.amountXCD > 0 {
                amountText = String(format: "%.2f", item.amountXCD)
            }
        }
    }
}
