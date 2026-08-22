import SwiftUI

// MARK: - CPT code catalogue (surgical + endoscopy)

struct CPTCode: Identifiable {
    let id = UUID()
    let code: String
    let description: String
    let category: String
    let rvu: Double  // relative value unit — indicative, not a fee

    static func search(_ query: String) -> [CPTCode] {
        guard query.count >= 2 else { return [] }
        let q = query.lowercased()
        return all.filter {
            $0.code.hasPrefix(q) ||
            $0.description.lowercased().contains(q) ||
            $0.category.lowercased().contains(q)
        }.prefix(20).map { $0 }
    }

    // Suggests codes that match the working diagnosis (ICD prefix → category mapping)
    static func suggest(forDiagnosis dx: String?, icd: String?) -> [CPTCode] {
        guard let dx = dx?.lowercased() else { return [] }
        let icdPfx = icd?.prefix(3).lowercased() ?? ""
        return all.filter { code in
            let cat = code.category.lowercased()
            let desc = code.description.lowercased()
            if icdPfx.hasPrefix("k35") || icdPfx.hasPrefix("k37") { return cat == "appendix" }
            if icdPfx.hasPrefix("k80") || icdPfx.hasPrefix("k81") || icdPfx.hasPrefix("k83") { return cat == "biliary" }
            if icdPfx.hasPrefix("k40") || icdPfx.hasPrefix("k41") || icdPfx.hasPrefix("k43") || icdPfx.hasPrefix("k44") { return cat == "hernia" }
            if icdPfx.hasPrefix("k57") { return cat == "colorectal" }
            if icdPfx.hasPrefix("k85") || icdPfx.hasPrefix("k86") { return cat == "pancreas" }
            if icdPfx.hasPrefix("k22") || icdPfx.hasPrefix("k25") || icdPfx.hasPrefix("k26") { return cat == "upper gi" }
            if icdPfx.hasPrefix("c18") || icdPfx.hasPrefix("c19") || icdPfx.hasPrefix("c20") { return cat == "colorectal" }
            // Fallback: keyword match on description
            return desc.contains(dx.prefix(6))
        }.prefix(6).map { $0 }
    }

    static let all: [CPTCode] = [
        // Appendix
        .init(code: "44950", description: "Appendectomy, open", category: "Appendix", rvu: 13.4),
        .init(code: "44960", description: "Appendectomy, open, perforated with abscess or peritonitis", category: "Appendix", rvu: 20.1),
        .init(code: "44970", description: "Laparoscopic appendectomy", category: "Appendix", rvu: 15.2),

        // Biliary / cholecystectomy
        .init(code: "47562", description: "Laparoscopic cholecystectomy", category: "Biliary", rvu: 18.8),
        .init(code: "47563", description: "Laparoscopic cholecystectomy with cholangiography", category: "Biliary", rvu: 20.5),
        .init(code: "47600", description: "Cholecystectomy, open", category: "Biliary", rvu: 22.4),
        .init(code: "47610", description: "Cholecystectomy, open, with exploration of CBD", category: "Biliary", rvu: 29.8),
        .init(code: "43260", description: "ERCP, diagnostic", category: "Biliary", rvu: 12.0),
        .init(code: "43262", description: "ERCP with sphincterotomy", category: "Biliary", rvu: 16.3),
        .init(code: "43264", description: "ERCP with stone extraction", category: "Biliary", rvu: 18.5),
        .init(code: "43265", description: "ERCP with lithotripsy", category: "Biliary", rvu: 21.0),
        .init(code: "43267", description: "ERCP with stent placement", category: "Biliary", rvu: 19.8),

        // Hernia
        .init(code: "49505", description: "Inguinal hernia repair, open, age 5+", category: "Hernia", rvu: 12.4),
        .init(code: "49507", description: "Inguinal hernia repair, open, with mesh, age 5+", category: "Hernia", rvu: 14.0),
        .init(code: "49650", description: "Laparoscopic inguinal hernia repair, initial", category: "Hernia", rvu: 18.2),
        .init(code: "49652", description: "Laparoscopic ventral hernia repair, initial", category: "Hernia", rvu: 20.5),
        .init(code: "49560", description: "Repair of initial incisional hernia, open", category: "Hernia", rvu: 17.2),
        .init(code: "49565", description: "Repair of recurrent incisional hernia, open", category: "Hernia", rvu: 21.6),
        .init(code: "49575", description: "Repair of umbilical hernia, age 5+", category: "Hernia", rvu: 9.5),

        // Colorectal
        .init(code: "44140", description: "Colectomy, partial, with anastomosis", category: "Colorectal", rvu: 34.5),
        .init(code: "44145", description: "Colectomy, partial, with colostomy", category: "Colorectal", rvu: 37.2),
        .init(code: "44204", description: "Laparoscopic colectomy, partial, with anastomosis", category: "Colorectal", rvu: 42.0),
        .init(code: "44160", description: "Colectomy, partial, with removal of terminal ileum", category: "Colorectal", rvu: 38.5),
        .init(code: "45378", description: "Colonoscopy, diagnostic", category: "Colorectal", rvu: 6.2),
        .init(code: "45380", description: "Colonoscopy with biopsy", category: "Colorectal", rvu: 8.5),
        .init(code: "45385", description: "Colonoscopy with polypectomy", category: "Colorectal", rvu: 10.3),
        .init(code: "45384", description: "Colonoscopy with hot biopsy forceps", category: "Colorectal", rvu: 9.0),
        .init(code: "46050", description: "Incision and drainage, perianal abscess", category: "Colorectal", rvu: 5.4),
        .init(code: "46257", description: "Haemorrhoidectomy, internal and external", category: "Colorectal", rvu: 12.8),
        .init(code: "46270", description: "Anal fistulotomy, simple or superficial", category: "Colorectal", rvu: 8.3),

        // Upper GI / endoscopy
        .init(code: "43239", description: "OGD with biopsy", category: "Upper GI", rvu: 7.2),
        .init(code: "43235", description: "OGD, diagnostic", category: "Upper GI", rvu: 5.4),
        .init(code: "43236", description: "OGD with submucosal injection", category: "Upper GI", rvu: 8.1),
        .init(code: "43238", description: "OGD with ultrasound", category: "Upper GI", rvu: 9.5),
        .init(code: "43243", description: "OGD with dilation of stricture", category: "Upper GI", rvu: 9.8),
        .init(code: "43248", description: "OGD with guidewire dilation", category: "Upper GI", rvu: 10.2),
        .init(code: "43255", description: "OGD with control of haemorrhage", category: "Upper GI", rvu: 12.5),
        .init(code: "43644", description: "Laparoscopic gastric bypass, Roux-en-Y", category: "Upper GI", rvu: 55.0),
        .init(code: "43775", description: "Laparoscopic sleeve gastrectomy", category: "Upper GI", rvu: 40.2),

        // Pancreas
        .init(code: "48150", description: "Pancreatectomy, partial, distal", category: "Pancreas", rvu: 58.0),
        .init(code: "48155", description: "Pancreatectomy, near-total", category: "Pancreas", rvu: 68.0),
        .init(code: "48146", description: "Pancreatectomy, distal, laparoscopic", category: "Pancreas", rvu: 62.0),

        // Breast
        .init(code: "19120", description: "Excision of breast lesion, open", category: "Breast", rvu: 10.5),
        .init(code: "19301", description: "Mastectomy, partial (lumpectomy)", category: "Breast", rvu: 16.3),
        .init(code: "19303", description: "Mastectomy, simple, complete", category: "Breast", rvu: 24.5),
        .init(code: "19307", description: "Mastectomy, radical, including axillary dissection", category: "Breast", rvu: 35.0),

        // Thyroid / parathyroid
        .init(code: "60220", description: "Total thyroid lobectomy with isthmusectomy", category: "Thyroid", rvu: 24.3),
        .init(code: "60240", description: "Thyroidectomy, total", category: "Thyroid", rvu: 32.5),
        .init(code: "60252", description: "Thyroidectomy for malignancy, with neck dissection", category: "Thyroid", rvu: 45.0),

        // Skin / soft tissue
        .init(code: "11400", description: "Excision of benign skin lesion, trunk, <0.5 cm", category: "Skin/Soft Tissue", rvu: 3.2),
        .init(code: "11600", description: "Excision of malignant skin lesion, trunk, <0.5 cm", category: "Skin/Soft Tissue", rvu: 5.1),
        .init(code: "10060", description: "Incision and drainage of abscess, simple", category: "Skin/Soft Tissue", rvu: 2.8),
        .init(code: "10080", description: "Incision and drainage, pilonidal cyst, simple", category: "Skin/Soft Tissue", rvu: 4.6),
        .init(code: "11770", description: "Excision of pilonidal cyst, simple", category: "Skin/Soft Tissue", rvu: 10.2),

        // E&M / consultations
        .init(code: "99213", description: "Office visit, established patient, moderate complexity", category: "Consultation", rvu: 2.6),
        .init(code: "99214", description: "Office visit, established patient, high complexity", category: "Consultation", rvu: 3.9),
        .init(code: "99245", description: "Consultation, new patient, high complexity", category: "Consultation", rvu: 5.3),
        .init(code: "99232", description: "Subsequent hospital care, moderate complexity", category: "Consultation", rvu: 2.3),
        .init(code: "99233", description: "Subsequent hospital care, high complexity", category: "Consultation", rvu: 3.3),
    ]
}

// MARK: - Billing line item

struct BillingItem: Identifiable {
    let id = UUID()
    var code: CPTCode
    var units: Int = 1
    var modifier: String = ""
    var note: String = ""
}

// MARK: - View

struct BillingView: View {
    @Bindable var patient: Patient
    @State private var cptQuery = ""
    @State private var cptSuggestions: [CPTCode] = []
    @State private var billingItems: [BillingItem] = []
    @State private var showSuggested = true

    private var suggested: [CPTCode] {
        CPTCode.suggest(forDiagnosis: patient.workingDiagnosis, icd: patient.workingDiagnosisICD)
    }

    var body: some View {
        List {
            searchSection

            if showSuggested && !suggested.isEmpty {
                suggestedSection
            }

            if !billingItems.isEmpty {
                selectedSection
            }
        }
        .navigationTitle("Billing")
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - CPT search

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

    // MARK: - Suggested from working diagnosis

    @ViewBuilder
    private var suggestedSection: some View {
        Section {
            if let dx = patient.workingDiagnosis {
                HStack {
                    Image(systemName: "stethoscope").foregroundStyle(.teal)
                    Text("Suggested for: \(dx)").font(.caption).foregroundStyle(.secondary)
                    Spacer()
                    Button(showSuggested ? "Hide" : "Show") { showSuggested.toggle() }
                        .font(.caption)
                }
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
            Label("Suggested Codes", systemImage: "sparkles")
                .foregroundStyle(.teal)
        }
    }

    // MARK: - Selected items

    @ViewBuilder
    private var selectedSection: some View {
        Section("Billing Sheet") {
            ForEach($billingItems) { $item in
                VStack(alignment: .leading, spacing: 6) {
                    HStack {
                        Text(item.code.code)
                            .font(.subheadline.monospaced().weight(.semibold))
                        Spacer()
                        Stepper("", value: $item.units, in: 1...10)
                            .labelsHidden()
                            .fixedSize()
                        Text("×\(item.units)").font(.caption).foregroundStyle(.secondary)
                    }
                    Text(item.code.description).font(.caption).foregroundStyle(.secondary)
                    HStack(spacing: 12) {
                        TextField("Modifier", text: $item.modifier)
                            .font(.caption)
                            .frame(width: 80)
                        TextField("Note", text: $item.note)
                            .font(.caption)
                    }
                }
                .padding(.vertical, 2)
            }
            .onDelete { indexSet in billingItems.remove(atOffsets: indexSet) }

            HStack {
                Text("Total codes").font(.caption).foregroundStyle(.secondary)
                Spacer()
                Text("\(billingItems.count) line\(billingItems.count == 1 ? "" : "s")")
                    .font(.caption.weight(.semibold))
            }

            ShareLink(item: buildBillingSheet()) {
                Label("Export Billing Sheet", systemImage: "square.and.arrow.up")
            }
            .font(.subheadline)
        }
    }

    // MARK: - Helpers

    private func add(_ code: CPTCode) {
        guard !billingItems.contains(where: { $0.code.code == code.code }) else { return }
        billingItems.append(BillingItem(code: code))
        cptQuery = ""
        cptSuggestions = []
    }

    private func buildBillingSheet() -> String {
        let header = "BILLING SHEET — \(patient.fullName) — \(Date.now.formatted(date: .abbreviated, time: .omitted))"
        let dx = patient.workingDiagnosis.map { "Diagnosis: \($0)" + (patient.workingDiagnosisICD.map { " (\($0))" } ?? "") } ?? ""
        let lines = billingItems.map { item in
            "\(item.code.code)  ×\(item.units)  \(item.modifier.isEmpty ? "" : "Mod:\(item.modifier)  ")\(item.code.description)"
        }.joined(separator: "\n")
        return [header, dx, "", lines].joined(separator: "\n")
    }
}
