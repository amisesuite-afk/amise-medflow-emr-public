// ReportImportFlowView.swift
// "Import report": a lab result (Laboratory Services Ltd) or an imaging report (Tapion Hospital
// imaging; OKEU / St Jude's selectable), from a PDF (Files, or shared from another app) or from
// pasted text. Everything happens on the device: PDFKit text, optional on-device Vision OCR for a
// scanned PDF, deterministic parsers. AIService is never used.
//
// Steps: read text → (no text layer: OCR on device / paste / attach and enter by hand) →
// report type + patient (search-first when the file came from another app; never auto-selected) →
// review (identity check + explicit confirmation on any mismatch; every field editable) → Save.
// Nothing is written before Save. The caller wraps this view in a NavigationStack.

import SwiftUI
import SwiftData
import UniformTypeIdentifiers

struct ReportImportInput: Identifiable {
    enum Source {
        case pdf(data: Data, fileName: String)
        case pastedText
        case staged(StagedReport)
    }
    let id = UUID()
    let source: Source
}

enum ReportImportOutcome {
    case saved, cancelled, discarded
}

struct ReportImportFlowView: View {
    let input: ReportImportInput
    /// The chart the import was started from; nil when staff must choose (shared file).
    let fixedPatient: Patient?
    let role: UserRole
    let onFinish: (ReportImportOutcome) -> Void

    private enum Stage { case loading, noText, paste, setup, review }

    @Environment(\.modelContext) private var context
    @Query private var queriedAllPatients: [Patient]
    // Deleted/detached records are dropped before any view reads them.
    private var allPatients: [Patient] { queriedAllPatients.filter(\.isLive) }

    @State private var stage: Stage = .loading
    @State private var pdfData: Data?
    @State private var fileName = ""
    @State private var text = ""
    @State private var origin: ReportTextOrigin = .none
    @State private var noTextReason = ""
    @State private var canOCR = true
    @State private var isWorking = false
    @State private var kind: ReportKind = .lab
    @State private var suggestedKind: ReportKind?
    @State private var imagingSource: ImagingSourceChoice = .tapion
    @State private var customSource = ""
    @State private var header = ReportHeader()
    @State private var search = ""
    @State private var chosenPatient: Patient?
    @State private var labDraft: LabImportDraft?
    @State private var imagingDraft: ImagingImportDraft?
    @State private var showDiscardConfirm = false
    @State private var showPDF = false
    @State private var didStart = false

    private var patient: Patient? {
        (fixedPatient ?? chosenPatient).flatMap { $0.isLive ? $0 : nil }
    }

    private var isStaged: Bool {
        if case .staged = input.source { return true }
        return false
    }

    private var canSaveClinical: Bool { role.hasAccess(to: .nurse) }

    var body: some View {
        content
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(isStaged ? "Later" : "Cancel") { onFinish(.cancelled) }
                }
            }
            .task { await start() }
            .confirmationDialog("Discard this file? It will be deleted from this device.",
                                isPresented: $showDiscardConfirm, titleVisibility: .visible) {
                Button("Discard file", role: .destructive) { onFinish(.discarded) }
                Button("Keep", role: .cancel) {}
            }
            .sheet(isPresented: $showPDF) {
                if let pdfData { ReportPDFSheet(data: pdfData) }
            }
    }

    private var title: String {
        switch stage {
        case .review: return kind == .lab ? "Review lab results" : "Review imaging report"
        default: return "Import report"
        }
    }

    @ViewBuilder
    private var content: some View {
        switch stage {
        case .loading:
            VStack(spacing: 12) {
                ProgressView()
                Text("Reading the report on this device…").font(.subheadline).foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .noText:
            noTextView
        case .paste:
            pasteView
        case .setup:
            setupView
        case .review:
            reviewView
        }
    }

    // MARK: Start

    private func start() async {
        guard !didStart else { return }
        didStart = true
        switch input.source {
        case .pastedText:
            stage = .paste
        case .pdf(let data, let name):
            pdfData = data
            fileName = name
            await readPDF(data)
        case .staged(let report):
            fileName = report.displayName + ".pdf"
            guard let data = IncomingReportInbox.shared.data(for: report) else {
                noTextReason = "The file could not be read."
                canOCR = false
                stage = .noText
                return
            }
            pdfData = data
            await readPDF(data)
        }
    }

    private func readPDF(_ data: Data) async {
        let result = await Task.detached(priority: .userInitiated) {
            ReportTextExtractor.extractText(from: data)
        }.value
        switch result {
        case .text(let t, _):
            text = t
            origin = .pdfText
            prepareSetup()
        case .noTextLayer:
            noTextReason = "This PDF has no text layer — it is a scanned image."
            canOCR = true
            stage = .noText
        case .locked:
            noTextReason = "This PDF is password-protected, so its text cannot be read."
            canOCR = false
            stage = .noText
        case .unreadable:
            noTextReason = "This file could not be opened as a PDF."
            canOCR = false
            stage = .noText
        }
    }

    private func prepareSetup() {
        if !text.isEmpty {
            let guess = ReportKindGuesser.guess(text: text)
            suggestedKind = guess
            kind = guess
            header = ReportHeaderParser.parse(lines: LabReportParser.split(text).map(\.text))
        } else {
            suggestedKind = nil
            header = ReportHeader()
        }
        if fixedPatient == nil, search.isEmpty {
            search = PatientIdentityMatcher.searchSeed(from: header.patientName)
        }
        stage = .setup
    }

    // MARK: No text layer

    private var noTextView: some View {
        Form {
            Section {
                Label(noTextReason, systemImage: "doc.text.magnifyingglass")
                    .font(.subheadline.weight(.semibold))
                Text("Choose how to continue. Nothing leaves this device.")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            Section {
                if canOCR, let pdfData {
                    Button {
                        Task { await runOCR(pdfData) }
                    } label: {
                        HStack {
                            Label("Read the scan on this device", systemImage: "text.viewfinder")
                            if isWorking { Spacer(); ProgressView() }
                        }
                    }
                    .disabled(isWorking)
                }
                Button {
                    stage = .paste
                } label: {
                    Label("Paste the report text", systemImage: "doc.on.clipboard")
                }
                if pdfData != nil {
                    Button {
                        text = ""
                        origin = .none
                        prepareSetup()
                    } label: {
                        Label("Attach the PDF and enter results by hand", systemImage: "paperclip")
                    }
                }
                if pdfData != nil {
                    Button { showPDF = true } label: { Label("View PDF", systemImage: "doc.richtext") }
                }
            }
            if isStaged { discardSection }
        }
    }

    private func runOCR(_ data: Data) async {
        isWorking = true
        defer { isWorking = false }
        if let t = await ReportTextExtractor.recognizeText(in: data) {
            text = t
            origin = .ocr
            prepareSetup()
        } else {
            noTextReason = "No text could be read from the scan. Paste the text, or attach the PDF and enter the results by hand."
            canOCR = false
        }
    }

    // MARK: Paste

    private var pasteView: some View {
        Form {
            Section {
                PasteButton(payloadType: String.self) { strings in
                    let pasted = strings.joined(separator: "\n")
                    Task { @MainActor in text = pasted }
                }
                TextEditor(text: $text)
                    .font(.system(.footnote, design: .monospaced))
                    .frame(minHeight: 260)
                    .autocorrectionDisabled()
            } header: {
                Text("Report text")
            } footer: {
                Text("Copy the text from the lab or imaging portal and paste it here.")
            }
            Section {
                Button("Continue") {
                    origin = .pasted
                    prepareSetup()
                }
                .disabled(text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
    }

    // MARK: Setup (type + patient)

    private var searchResults: [Patient] {
        QuestionnairePatientSearch.matches(query: search, in: allPatients)
    }

    private var setupView: some View {
        Form {
            if !fileName.isEmpty || pdfData != nil {
                Section("File") {
                    if !fileName.isEmpty { Text(fileName).font(.subheadline) }
                    if pdfData != nil {
                        Button { showPDF = true } label: { Label("View PDF", systemImage: "doc.richtext") }
                    }
                    if origin == .ocr {
                        Label("Text read from a scanned image on this device", systemImage: "text.viewfinder")
                            .font(.caption).foregroundStyle(.orange)
                    }
                }
            }

            Section {
                Picker("Report type", selection: $kind) {
                    Text("Lab result (Laboratory Services Ltd)").tag(ReportKind.lab)
                    Text("Imaging report").tag(ReportKind.imaging)
                }
                .pickerStyle(.inline)
                .labelsHidden()
                if kind == .imaging {
                    Picker("Imaging source", selection: $imagingSource) {
                        ForEach(ImagingSourceChoice.allCases) { s in Text(s.label).tag(s) }
                    }
                    if imagingSource == .other {
                        TextField("Imaging provider", text: $customSource)
                    }
                }
            } header: {
                Text("Report type")
            } footer: {
                if let suggestedKind {
                    Text("Suggested from the text: \(suggestedKind == .lab ? "lab result" : "imaging report"). Change it if it is wrong.")
                }
            }

            if fixedPatient == nil {
                patientSection
            } else if let patient {
                Section("Patient") {
                    Text(patient.fullName).font(.subheadline.weight(.semibold))
                }
            }

            Section {
                Button {
                    buildDrafts()
                } label: {
                    Text("Continue to review").frame(maxWidth: .infinity).font(.headline)
                }
                .buttonStyle(.borderedProminent)
                .disabled(patient == nil)
                .listRowBackground(Color.clear)
            }

            if isStaged { discardSection }
        }
    }

    /// Search-first, like the questionnaire rule (QuestionnairePatientSearch): nothing until a real
    /// search, at most 5, no default list, never auto-selected.
    private var patientSection: some View {
        Section {
            if header.patientName != nil || header.dateOfBirth != nil {
                VStack(alignment: .leading, spacing: 2) {
                    Text("On the report").font(.caption.weight(.bold)).foregroundStyle(.secondary)
                    Text([header.patientName, header.dateOfBirth.map { "DOB \(ReportImportStyle.dobText($0))" }]
                        .compactMap { $0 }.joined(separator: " · "))
                        .font(.subheadline)
                }
            }
            TextField("Name (3+ letters) or MRN…", text: $search)
                .autocorrectionDisabled()
                .textInputAutocapitalization(.never)
            ForEach(searchResults) { p in
                Button {
                    chosenPatient = p
                } label: {
                    HStack {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(p.fullName).font(.subheadline.weight(.semibold)).foregroundStyle(.primary)
                            Text([p.mrn.map { "MRN \($0)" }, "DOB \(ReportImportStyle.chartDOBText(p.dateOfBirth))"]
                                .compactMap { $0 }.joined(separator: " · "))
                                .font(.caption2).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if chosenPatient?.id == p.id {
                            Image(systemName: "checkmark.circle.fill").foregroundStyle(AMColor.accent)
                        }
                    }
                    .contentShape(Rectangle())   // whole row tappable, not only its text
                }
                .buttonStyle(.plain)
            }
            let q = QuestionnairePatientSearch.normalized(search)
            if !q.isEmpty && searchResults.isEmpty {
                Text(QuestionnairePatientSearch.isNameSearch(q)
                     ? "No match."
                     : "Type at least \(QuestionnairePatientSearch.minimumNameLength) letters of the name, or the MRN.")
                    .font(.caption).foregroundStyle(.secondary)
            }
        } header: {
            Text("Which patient?")
        } footer: {
            Text("The search starts from the surname on the report. Choose the patient yourself — the name and date of birth are checked again before saving.")
        }
    }

    private var discardSection: some View {
        Section {
            Button("Discard this file", role: .destructive) { showDiscardConfirm = true }
        }
    }

    private func buildDrafts() {
        guard let patient else { return }
        let existing = patient.investigations
        switch kind {
        case .lab:
            let report = text.isEmpty
                ? ParsedLabReport(header: ReportHeader(), rows: [], pageCount: 0, layoutWarning: false)
                : LabReportParser.parse(text: text)
            labDraft = LabImportDraft.make(report: report, origin: origin, existing: existing,
                                           now: .now, timeZone: .ect)
        case .imaging:
            let report = ImagingReportParser.parse(text: text)
            imagingDraft = ImagingImportDraft.make(report: report, origin: origin,
                                                   sourceChoice: imagingSource, customSource: customSource,
                                                   now: .now, timeZone: .ect)
        }
        stage = .review
    }

    // MARK: Review

    @ViewBuilder
    private var reviewView: some View {
        if let patient {
            switch kind {
            case .lab:
                LabReportReviewView(
                    draft: Binding(get: { labDraft ?? .empty }, set: { labDraft = $0 }),
                    patient: patient,
                    existing: patient.investigations,
                    pdfData: pdfData,
                    canSaveResults: canSaveClinical,
                    onSave: saveLab)
            case .imaging:
                ImagingReportReviewView(
                    draft: Binding(get: { imagingDraft ?? .empty }, set: { imagingDraft = $0 }),
                    patient: patient,
                    pdfData: pdfData,
                    canSaveReport: canSaveClinical,
                    onSave: saveImaging)
            }
        } else {
            ContentUnavailableView("Patient not available",
                                   systemImage: "person.crop.circle.badge.xmark",
                                   description: Text("The record was removed. Choose the patient again."))
                .onAppear { stage = .setup }
        }
    }

    private var attachment: ReportImportSaver.Attachment? {
        guard let pdfData else { return nil }
        return ReportImportSaver.Attachment(data: pdfData, fileName: documentName,
                                            extractedText: text.isEmpty ? nil : text)
    }

    private var documentName: String {
        switch kind {
        case .lab:
            return ReportImportBuilder.documentFileName(prefix: "LabResults",
                                                        date: labDraft?.collectedAt ?? .now,
                                                        accession: labDraft?.accession ?? "",
                                                        timeZone: .ect)
        case .imaging:
            let prefix = "Imaging_" + IncomingReportStaging.sanitisedDisplayName(imagingDraft?.modality.shortLabel ?? "report")
            return ReportImportBuilder.documentFileName(prefix: prefix,
                                                        date: imagingDraft?.examDate ?? .now,
                                                        accession: imagingDraft?.accession ?? "",
                                                        timeZone: .ect)
        }
    }

    private func saveLab() {
        guard let patient, patient.isLive, let draft = labDraft else { return }
        guard !StoreHealth.blocksNewClinicalData else { return }
        let identity = PatientIdentityMatcher.check(header: draft.header, chartName: patient.fullName,
                                                    chartDOB: patient.dateOfBirth, chartSex: patient.sex,
                                                    timeZones: [TimeZone.ect, TimeZone(identifier: "UTC")!])
        guard !identity.requiresConfirmation || draft.identityConfirmed else { return }
        ReportImportSaver.saveLab(draft: draft, attachment: attachment, patient: patient, context: context,
                                  saveResults: canSaveClinical,
                                  identityConfirmedManually: identity.requiresConfirmation)
        CrashReporting.breadcrumb("Lab report imported", category: "report_import")
        onFinish(.saved)
    }

    private func saveImaging() {
        guard let patient, patient.isLive, let draft = imagingDraft else { return }
        guard !StoreHealth.blocksNewClinicalData else { return }
        let identity = PatientIdentityMatcher.check(header: draft.header, chartName: patient.fullName,
                                                    chartDOB: patient.dateOfBirth, chartSex: patient.sex,
                                                    timeZones: [TimeZone.ect, TimeZone(identifier: "UTC")!])
        guard !identity.requiresConfirmation || draft.identityConfirmed else { return }
        if case .failure? = draft.validatedPortalLink { return }
        ReportImportSaver.saveImaging(draft: draft, attachment: attachment, patient: patient, context: context,
                                      saveReport: canSaveClinical,
                                      identityConfirmedManually: identity.requiresConfirmation)
        CrashReporting.breadcrumb("Imaging report imported", category: "report_import")
        onFinish(.saved)
    }
}

// MARK: - Entry point on the patient record

/// "Import report" row for the Investigations tab and Documents: a PDF from Files (Safari →
/// download → Files → here) or pasted text.
struct ReportImportMenu: View {
    let patient: Patient
    @EnvironmentObject private var sync: SyncService

    @State private var showImporter = false
    @State private var flowInput: ReportImportInput?
    @State private var errorMessage: String?

    var body: some View {
        Menu {
            Button { showImporter = true } label: {
                Label("Import report (PDF)", systemImage: "doc.badge.arrow.up")
            }
            Button { flowInput = ReportImportInput(source: .pastedText) } label: {
                Label("Paste report text", systemImage: "doc.on.clipboard")
            }
        } label: {
            Label("Import lab or imaging report", systemImage: "square.and.arrow.down.on.square")
        }
        .fileImporter(isPresented: $showImporter, allowedContentTypes: [.pdf]) { result in
            handlePicked(result)
        }
        .sheet(item: $flowInput) { input in
            NavigationStack {
                ReportImportFlowView(input: input, fixedPatient: patient, role: sync.currentUserRole) { _ in
                    flowInput = nil
                }
            }
            .interactiveDismissDisabled(true)
        }
        .alert("Import report", isPresented: Binding(get: { errorMessage != nil },
                                                    set: { if !$0 { errorMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(errorMessage ?? "")
        }
    }

    private func handlePicked(_ result: Result<URL, Error>) {
        guard case .success(let url) = result else { return }
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        let size = (try? url.resourceValues(forKeys: [.fileSizeKey]).fileSize) ?? 0
        if size > IncomingReportStaging.maxBytes {
            errorMessage = IncomingReportStaging.Rejection.tooLarge(bytes: size).message
            return
        }
        guard let data = try? Data(contentsOf: url) else {
            errorMessage = "The file could not be read."
            return
        }
        if let rejection = IncomingReportStaging.validate(fileName: url.lastPathComponent,
                                                          byteCount: data.count, header: data.prefix(1024)) {
            errorMessage = rejection.message
            return
        }
        flowInput = ReportImportInput(source: .pdf(data: data, fileName: url.lastPathComponent))
    }
}
