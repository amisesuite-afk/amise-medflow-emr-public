// ReportImportBuilder.swift
// Turns a reviewed lab or imaging import into records, in the existing structures:
//   - each included lab row → an InvestigationEntry (category Blood, status Resulted) named so
//     Patient.latestLab(named:) and LabPanel read it as the right analyte (LabAnalyteCatalog),
//     with `result` starting with the value ("106 µmol/L · ref 60-110 · converted from 1.2 mg/dL"),
//     orderedAt/resultedAt = collection time, source "Laboratory Services Ltd (imported PDF)";
//   - an imaging report → one InvestigationEntry (category Imaging) with Impression and Findings
//     in `result`, source "Tapion Hospital imaging (imported PDF)", optional portal link;
//   - the PDF → a PatientDocument ("Lab / Bloods" or "Imaging"), like the other PDFs the app files.
// Nothing is written until the clinician taps Save on the review screen (ReportImportSaver).

import Foundation
import SwiftData

// MARK: - Lab draft

struct LabImportRow: Identifiable, Equatable {
    var id = UUID()
    var include: Bool
    var reportLabel: String
    var analyteKey: String?
    /// Saved name for an unmapped row (editable); mapped rows are saved under the catalogue name.
    var name: String
    var valueText: String
    var unit: String
    var referenceRange: String
    var flag: String
    var comment: String
    var collectedAt: Date
    var specimen: LabSpecimen
    var sourceLine: String

    private static let differentialKeys: Set<String> = ["neutrophils", "lymphocytes", "monocytes", "eosinophils", "basophils"]

    /// The InvestigationEntry name this row is saved under.
    var savedName: String {
        if let a = LabAnalyteCatalog.analyte(forKey: analyteKey) {
            if Self.differentialKeys.contains(a.key), LabUnits.normalise(unit) == "%" { return a.name + " %" }
            return a.name
        }
        return name.trimmingCharacters(in: .whitespaces)
    }

    var isEmpty: Bool {
        savedName.isEmpty || valueText.trimmingCharacters(in: .whitespaces).isEmpty
    }

    func assessment(existing: [InvestigationEntry] = []) -> LabRowAssessment {
        var a = LabRowNormaliser.assess(analyteKey: analyteKey, name: savedName, valueText: valueText,
                                        unit: unit, referenceRange: referenceRange, flag: flag,
                                        specimen: specimen)
        if ReportImportBuilder.isAlreadyRecorded(name: savedName, storedValue: a.storedValue,
                                                 at: collectedAt, in: existing) {
            a.issues.append(.alreadyInRecord)
        }
        return a
    }
}

struct LabImportDraft: Equatable {
    var rows: [LabImportRow]
    var header: ReportHeader
    var collectedAt: Date
    var reportedAt: Date?
    var accession: String
    var origin: ReportTextOrigin
    var layoutWarning: Bool
    var identityConfirmed = false
    var flaggedChecked = false

    static let empty = LabImportDraft(rows: [], header: ReportHeader(), collectedAt: Date(),
                                      reportedAt: nil, accession: "", origin: .none, layoutWarning: false)

    static func make(report: ParsedLabReport, origin: ReportTextOrigin,
                     existing: [InvestigationEntry], now: Date, timeZone: TimeZone) -> LabImportDraft {
        let h = report.header
        let collected = (h.collected ?? h.examDate ?? h.received ?? h.reported)?.date(in: timeZone) ?? now
        let rows = report.rows.map { r -> LabImportRow in
            var row = LabImportRow(include: true, reportLabel: r.reportLabel, analyteKey: r.analyteKey,
                                   name: r.reportLabel, valueText: r.valueText, unit: r.unit,
                                   referenceRange: r.referenceRange, flag: r.flag, comment: r.comment,
                                   collectedAt: collected, specimen: r.specimen, sourceLine: r.sourceLine)
            row.include = !row.assessment(existing: existing).excludedByDefault
            return row
        }
        return LabImportDraft(rows: rows, header: h, collectedAt: collected,
                              reportedAt: h.reported?.date(in: timeZone),
                              accession: h.accession ?? "", origin: origin,
                              layoutWarning: report.layoutWarning)
    }

    /// Rows that will be saved.
    var includedRows: [LabImportRow] { rows.filter { $0.include && !$0.isEmpty } }

    /// Included rows that need the "I have checked the flagged values" tick.
    func flaggedIncludedCount(existing: [InvestigationEntry]) -> Int {
        includedRows.filter { $0.assessment(existing: existing).needsAttention }.count
    }
}

// MARK: - Imaging draft

enum ImagingSourceChoice: String, CaseIterable, Identifiable {
    case tapion, okeu, stJudes, other
    var id: String { rawValue }

    var label: String {
        switch self {
        case .tapion:  return "Tapion Hospital imaging"
        case .okeu:    return "OKEU Hospital imaging"
        case .stJudes: return "St Jude's Hospital imaging"
        case .other:   return "Other"
        }
    }
}

struct ImagingImportDraft: Equatable {
    var header: ReportHeader
    var modality: ImagingModality
    var examTitle: String
    var examDate: Date
    var accession: String
    var impression: String
    var findings: String
    var clinicalHistory: String
    var sourceChoice: ImagingSourceChoice
    var customSource: String
    var portalLink: String = ""
    var origin: ReportTextOrigin
    var identityConfirmed = false
    var textChecked = false

    static let empty = ImagingImportDraft(header: ReportHeader(), modality: .other, examTitle: "",
                                          examDate: Date(), accession: "", impression: "",
                                          findings: "", clinicalHistory: "", sourceChoice: .tapion,
                                          customSource: "", origin: .none)

    static func make(report: ParsedImagingReport, origin: ReportTextOrigin,
                     sourceChoice: ImagingSourceChoice, customSource: String,
                     now: Date, timeZone: TimeZone) -> ImagingImportDraft {
        let h = report.header
        let date = (h.examDate ?? h.collected ?? h.reported)?.date(in: timeZone) ?? now
        var findings = report.findings
        if findings.isEmpty, report.impression.isEmpty {
            findings = report.fullText
        }
        return ImagingImportDraft(header: h, modality: report.modality ?? .other,
                                  examTitle: report.examTitle ?? "", examDate: date,
                                  accession: h.accession ?? "", impression: report.impression,
                                  findings: findings, clinicalHistory: report.clinicalHistory,
                                  sourceChoice: sourceChoice, customSource: customSource,
                                  origin: origin)
    }

    var sourceName: String {
        let custom = customSource.trimmingCharacters(in: .whitespaces)
        if sourceChoice == .other { return custom.isEmpty ? "Imaging provider" : custom }
        return sourceChoice.label
    }

    var validatedPortalLink: Result<URL, PortalLinkError>? {
        let t = portalLink.trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : PortalLink.validate(t)
    }
}

// MARK: - Builder (pure)

enum ReportImportBuilder {

    static let labProvider = "Laboratory Services Ltd"

    /// "(imported PDF)", "(pasted text)", "(scanned PDF, read on device)".
    static func provenance(_ origin: ReportTextOrigin, hasPDF: Bool) -> String {
        switch origin {
        case .pdfText: return "(imported PDF)"
        case .ocr: return "(scanned PDF, read on device)"
        case .pasted: return hasPDF ? "(imported PDF, pasted text)" : "(pasted text)"
        case .none: return hasPDF ? "(imported PDF, entered by hand)" : "(entered by hand)"
        }
    }

    static func labSource(origin: ReportTextOrigin, hasPDF: Bool) -> String {
        "\(labProvider) \(provenance(origin, hasPDF: hasPDF))"
    }

    static func imagingSource(_ draft: ImagingImportDraft, hasPDF: Bool) -> String {
        "\(draft.sourceName) \(provenance(draft.origin, hasPDF: hasPDF))"
    }

    /// The saved `result`: value first (what latestLab/LabPanel read), then range, flag,
    /// conversion, comment and the label as printed.
    static func resultText(row: LabImportRow, assessment: LabRowAssessment) -> String {
        var parts: [String] = []
        parts.append("\(assessment.storedValue) \(assessment.storedUnit)".trimmingCharacters(in: .whitespaces))
        if let range = displayedRange(row: row, assessment: assessment) { parts.append("ref \(range)") }
        let flag = row.flag.trimmingCharacters(in: .whitespaces)
        if !flag.isEmpty { parts.append(flag) }
        else if assessment.abnormality.isAbnormal { parts.append(assessment.abnormality.label) }
        if let note = assessment.conversionNote { parts.append(note) }
        let comment = row.comment.trimmingCharacters(in: .whitespaces)
        if !comment.isEmpty { parts.append(comment) }
        let label = row.reportLabel.trimmingCharacters(in: .whitespaces)
        if !label.isEmpty, label.lowercased() != row.savedName.lowercased() {
            parts.append("as printed: \(label)")
        }
        return parts.joined(separator: " · ")
    }

    /// The printed reference range; after a unit conversion it keeps the printed unit, so it is
    /// never read against the converted value ("11.8 mmol/L · ref 70-99 mg/dL").
    static func displayedRange(row: LabImportRow, assessment: LabRowAssessment) -> String? {
        let range = row.referenceRange.trimmingCharacters(in: .whitespaces)
        guard !range.isEmpty else { return nil }
        let unit = row.unit.trimmingCharacters(in: .whitespaces)
        return assessment.conversionNote != nil && !unit.isEmpty ? "\(range) \(unit)" : range
    }

    static func labEntry(row: LabImportRow, reportedAt: Date?, accession: String,
                         source: String, documentId: UUID?) -> InvestigationEntry {
        let a = row.assessment()
        var e = InvestigationEntry(name: row.savedName,
                                   category: row.specimen == .blood ? .blood : .other,
                                   status: .resulted,
                                   result: resultText(row: row, assessment: a),
                                   orderedAt: row.collectedAt,
                                   resultedAt: row.collectedAt,
                                   suggestedFor: "")
        e.source = source
        let acc = accession.trimmingCharacters(in: .whitespaces)
        e.accession = acc.isEmpty ? nil : acc
        e.referenceRange = displayedRange(row: row, assessment: a)
        let flag = row.flag.trimmingCharacters(in: .whitespaces)
        e.flag = flag.isEmpty ? (a.abnormality.isAbnormal ? a.abnormality.label : nil) : flag
        e.reportedAt = reportedAt
        e.documentId = documentId
        return e
    }

    static func labEntries(draft: LabImportDraft, source: String, documentId: UUID?) -> [InvestigationEntry] {
        draft.includedRows.map {
            labEntry(row: $0, reportedAt: draft.reportedAt, accession: draft.accession,
                     source: source, documentId: documentId)
        }
    }

    /// Same test name, same first value token, same time (within a minute): already imported.
    static func isAlreadyRecorded(name: String, storedValue: String, at date: Date,
                                  in existing: [InvestigationEntry]) -> Bool {
        let lower = name.lowercased()
        return existing.contains { e in
            guard e.status == .resulted, e.name.lowercased() == lower else { return false }
            let when = e.resultedAt ?? e.orderedAt
            guard abs(when.timeIntervalSince(date)) < 60 else { return false }
            return e.result.split(separator: " ").first.map(String.init) == storedValue
        }
    }

    static func imagingResultText(_ d: ImagingImportDraft) -> String {
        var parts: [String] = []
        let impression = d.impression.trimmingCharacters(in: .whitespacesAndNewlines)
        let findings = d.findings.trimmingCharacters(in: .whitespacesAndNewlines)
        let history = d.clinicalHistory.trimmingCharacters(in: .whitespacesAndNewlines)
        if !impression.isEmpty { parts.append("Impression: \(impression)") }
        if !findings.isEmpty { parts.append("Findings: \(findings)") }
        if !history.isEmpty { parts.append("Clinical history: \(history)") }
        if parts.isEmpty { parts.append("See attached report.") }
        return parts.joined(separator: "\n\n")
    }

    static func imagingEntry(draft: ImagingImportDraft, source: String, documentId: UUID?) -> InvestigationEntry {
        var e = InvestigationEntry(name: ImagingReportParser.investigationName(modality: draft.modality, exam: draft.examTitle),
                                   category: .imaging,
                                   status: .resulted,
                                   result: imagingResultText(draft),
                                   orderedAt: draft.examDate,
                                   resultedAt: draft.examDate,
                                   suggestedFor: "")
        e.source = source
        let acc = draft.accession.trimmingCharacters(in: .whitespaces)
        e.accession = acc.isEmpty ? nil : acc
        if case .success(let url)? = draft.validatedPortalLink { e.portalURL = url.absoluteString }
        e.documentId = documentId
        return e
    }

    /// PDF file name without patient identifiers.
    static func documentFileName(prefix: String, date: Date, accession: String, timeZone: TimeZone) -> String {
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = timeZone
        f.dateFormat = "yyyy-MM-dd"
        let acc = IncomingReportStaging.sanitisedDisplayName(accession)
        let suffix = accession.trimmingCharacters(in: .whitespaces).isEmpty ? "" : "_\(acc)"
        return "\(prefix)_\(f.string(from: date))\(suffix).pdf"
    }
}

// MARK: - Saving (the only place that writes)

@MainActor
enum ReportImportSaver {

    struct Attachment {
        let data: Data
        let fileName: String
        let extractedText: String?
    }

    private static func attach(_ a: Attachment, category: String, to patient: Patient,
                               context: ModelContext, sourceTag: String) -> PatientDocument {
        let doc = PatientDocument(fileName: a.fileName, mimeType: "application/pdf", category: category)
        doc.localData = a.data
        doc.extractedText = a.extractedText
        doc.patient = patient
        context.insert(doc)
        AuditLog.record("create", "document", patient: patient, resourceId: doc.id.uuidString,
                        details: ["category": category, "source": sourceTag])
        return doc
    }

    private static func touch(_ patient: Patient, context: ModelContext) {
        patient.updatedAt = .now
        patient.pendingSync = true
        try? context.save()
    }

    /// Saves the included rows (when `saveResults`) and attaches the PDF. Returns the number of
    /// results saved.
    @discardableResult
    static func saveLab(draft: LabImportDraft, attachment: Attachment?, patient: Patient,
                        context: ModelContext, saveResults: Bool, identityConfirmedManually: Bool) -> Int {
        guard patient.isLive else { return 0 }
        let sourceTag = attachment != nil ? "pdf_import" : "pasted_text"
        var documentId: UUID?
        if let attachment {
            documentId = attach(attachment, category: "Lab / Bloods", to: patient, context: context, sourceTag: sourceTag).id
        }
        var count = 0
        if saveResults {
            let source = ReportImportBuilder.labSource(origin: draft.origin, hasPDF: attachment != nil)
            let entries = ReportImportBuilder.labEntries(draft: draft, source: source, documentId: documentId)
            if !entries.isEmpty {
                var list = patient.investigations
                list.append(contentsOf: entries)
                patient.investigations = list
                count = entries.count
                AuditLog.record("create", "lab_result", patient: patient,
                                details: ["source": sourceTag, "rows": "\(count)",
                                          "identity": identityConfirmedManually ? "confirmed_by_clinician" : "matched"])
            }
        }
        touch(patient, context: context)
        return count
    }

    static func saveImaging(draft: ImagingImportDraft, attachment: Attachment?, patient: Patient,
                            context: ModelContext, saveReport: Bool, identityConfirmedManually: Bool) {
        guard patient.isLive else { return }
        let sourceTag = attachment != nil ? "pdf_import" : "pasted_text"
        var documentId: UUID?
        if let attachment {
            documentId = attach(attachment, category: "Imaging", to: patient, context: context, sourceTag: sourceTag).id
        }
        if saveReport {
            let entry = ReportImportBuilder.imagingEntry(
                draft: draft, source: ReportImportBuilder.imagingSource(draft, hasPDF: attachment != nil),
                documentId: documentId)
            var list = patient.investigations
            list.append(entry)
            patient.investigations = list
            AuditLog.record("create", "imaging_report", patient: patient,
                            details: ["source": sourceTag, "modality": draft.modality.rawValue,
                                      "identity": identityConfirmedManually ? "confirmed_by_clinician" : "matched"])
        }
        touch(patient, context: context)
    }
}
