// ImagingReportReviewView.swift
// Review of a parsed imaging report (Tapion Hospital imaging; OKEU / St Jude's selectable)
// before saving: patient identity check with explicit confirmation, editable modality, exam,
// date, accession, impression and findings, an optional portal link (opened in Safari only,
// never fetched, never with credentials). Images are not imported: they stay in the portal.

import SwiftUI

struct ImagingReportReviewView: View {
    @Binding var draft: ImagingImportDraft
    let patient: Patient
    let pdfData: Data?
    /// Nurse or doctor: may save the report. Front desk may only attach the PDF.
    let canSaveReport: Bool
    let onSave: () -> Void

    @State private var showPDF = false

    private var identity: ReportIdentityCheck {
        PatientIdentityMatcher.check(header: draft.header, chartName: patient.fullName,
                                     chartDOB: patient.dateOfBirth, chartSex: patient.sex,
                                     timeZones: [TimeZone.ect, TimeZone(identifier: "UTC")!])
    }

    private var linkError: PortalLinkError? {
        if case .failure(let e)? = draft.validatedPortalLink { return e }
        return nil
    }

    private var hasContent: Bool {
        !draft.impression.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            || !draft.findings.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private var canSave: Bool {
        guard patient.isLive, !StoreHealth.blocksNewClinicalData else { return false }
        if identity.requiresConfirmation && !draft.identityConfirmed { return false }
        guard canSaveReport else { return pdfData != nil }
        if linkError != nil { return false }
        if draft.origin == .ocr && !draft.textChecked { return false }
        return hasContent || pdfData != nil
    }

    private var saveTitle: String {
        canSaveReport ? "Save imaging report" : "Attach PDF"
    }

    var body: some View {
        Form {
            Section {
                ReportIdentityCard(check: identity, header: draft.header, patient: patient,
                                   confirmed: $draft.identityConfirmed)
                    .listRowInsets(EdgeInsets(top: 8, leading: 8, bottom: 8, trailing: 8))
            }
            if !canSaveReport {
                Section {
                    Label("Only a nurse or doctor can save the report. You can attach the PDF to the record.",
                          systemImage: "lock")
                        .font(.subheadline)
                }
            }

            Section("Examination") {
                Picker("Modality", selection: $draft.modality) {
                    ForEach(ImagingModality.allCases) { m in Text(m.displayName).tag(m) }
                }
                TextField("Examination (e.g. Abdomen and pelvis)", text: $draft.examTitle)
                DatePicker("Exam date", selection: $draft.examDate)
                TextField("Accession / study number", text: $draft.accession)
                    .autocorrectionDisabled()
                LabeledContent("Saved as",
                               value: ImagingReportParser.investigationName(modality: draft.modality, exam: draft.examTitle))
                if let pdfData {
                    Button { showPDF = true } label: { Label("View PDF", systemImage: "doc.richtext") }
                        .sheet(isPresented: $showPDF) { ReportPDFSheet(data: pdfData) }
                }
            }

            Section {
                Picker("Source", selection: $draft.sourceChoice) {
                    ForEach(ImagingSourceChoice.allCases) { s in Text(s.label).tag(s) }
                }
                if draft.sourceChoice == .other {
                    TextField("Imaging provider", text: $draft.customSource)
                }
            } header: {
                Text("Source")
            } footer: {
                Text("Saved as “\(ReportImportBuilder.imagingSource(draft, hasPDF: pdfData != nil))”.")
            }

            Section {
                TextField("https://…", text: $draft.portalLink)
                    .keyboardType(.URL)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                if let linkError {
                    Label(linkError.message, systemImage: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .foregroundStyle(.orange)
                } else if case .success(let url)? = draft.validatedPortalLink {
                    Link(destination: url) {
                        Label("Open in portal", systemImage: "safari")
                    }
                }
            } header: {
                Text("Portal link (optional)")
            } footer: {
                Text("Images stay in the hospital portal; they are not imported. The link only opens Safari — MedFlow never signs in to the portal or stores portal passwords.")
            }

            Section("Impression / conclusion") {
                TextEditor(text: $draft.impression)
                    .frame(minHeight: 100)
            }
            Section("Findings") {
                TextEditor(text: $draft.findings)
                    .frame(minHeight: 160)
            }
            if !draft.clinicalHistory.isEmpty {
                Section("Clinical history (from the report)") {
                    TextEditor(text: $draft.clinicalHistory)
                        .frame(minHeight: 60)
                }
            }

            if draft.origin == .ocr && canSaveReport {
                Section {
                    Toggle(isOn: $draft.textChecked) {
                        Text("I have checked this text against the scanned PDF")
                            .font(.subheadline.weight(.semibold))
                    }
                }
            }

            Section {
                Button(action: onSave) {
                    Text(saveTitle).frame(maxWidth: .infinity).font(.headline)
                }
                .buttonStyle(.borderedProminent)
                .disabled(!canSave)
                .listRowBackground(Color.clear)
            } footer: {
                if StoreHealth.blocksNewClinicalData {
                    Text(StoreHealth.blockedAlertMessage)
                } else {
                    Text("Nothing is saved until you tap \(saveTitle).")
                }
            }
        }
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button(saveTitle, action: onSave).disabled(!canSave)
            }
        }
    }
}
