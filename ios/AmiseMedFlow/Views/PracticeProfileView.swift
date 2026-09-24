import SwiftUI

// MARK: - Practice profile editor
//
// Edits the PracticeProfile used on every generated document, letter, PDF,
// SMS and email. Changes are held in a local draft and only persisted on Save,
// so a half-typed name never reaches a printed document.

struct PracticeProfileView: View {
    @ObservedObject private var store: PracticeProfileStore
    @Environment(\.dismiss) private var dismiss

    @State private var draft: PracticeProfile
    @State private var showResetConfirm = false

    init(store: PracticeProfileStore = PracticeProfileStore.shared) {
        _store = ObservedObject(wrappedValue: store)
        _draft = State(initialValue: store.profile)
    }

    var body: some View {
        Form {
            Section {
                TextField("Practice name", text: $draft.practiceName,
                          prompt: Text("e.g. Harbour Surgical Associates"))
                TextField("Short name", text: $draft.practiceShortName,
                          prompt: Text("Short name for SMS / email subjects"))
                TextField("Country", text: $draft.country,
                          prompt: Text("Country / jurisdiction"))
                TextField("Brand mark", text: $draft.brandMark,
                          prompt: Text("Short logotype on PDF headers, e.g. HSA"))
                TextField("Brand tagline", text: $draft.brandTagline,
                          prompt: Text("Tagline on consultation PDFs (optional)"))
            } header: {
                Text("Practice")
            } footer: {
                Text("The short name prefixes appointment SMS messages and email subjects. The brand mark is printed large at the top-left of PDF headers.")
            }

            Section {
                TextField("Clinician name", text: $draft.clinicianName,
                          prompt: Text("Full name with title, e.g. Dr Jane Smith"))
                TextField("Short name", text: $draft.clinicianShortName,
                          prompt: Text("Patient-facing, e.g. Dr. Jane Smith"))
                TextField("Credentials", text: $draft.clinicianCredentials,
                          prompt: Text("Post-nominals, e.g. MBBS, FRCS"))
                TextField("Registration number", text: $draft.clinicianRegistrationNumber,
                          prompt: Text("Medical council registration (optional)"))
                    .autocorrectionDisabled()
                TextField("Title", text: $draft.clinicianTitle,
                          prompt: Text("Role under the signature, e.g. General Surgeon"))
                TextField("Specialty", text: $draft.specialty,
                          prompt: Text("e.g. General & Endoscopic Surgery"))
            } header: {
                Text("Clinician")
            } footer: {
                Text("Printed on PDF headers and footers, signature blocks, note templates, forms and letters. The registration number, if set, is added under the signature on letters.")
            }

            Section("Contact") {
                TextField("Primary phone", text: $draft.primaryPhone,
                          prompt: Text("e.g. +1 (758) 555-0100"))
                    .keyboardType(.phonePad)
                TextField("Email", text: $draft.email,
                          prompt: Text("Practice email / calendar account"))
                    .keyboardType(.emailAddress)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
            }

            Section {
                ForEach($draft.sites) { $site in
                    VStack(alignment: .leading, spacing: 6) {
                        TextField("Site name", text: $site.name)
                            .font(.subheadline.weight(.semibold))
                        TextField("Address", text: $site.address)
                            .font(.subheadline)
                        TextField("Phone", text: $site.phone)
                            .font(.subheadline)
                            .keyboardType(.phonePad)
                    }
                    .padding(.vertical, 2)
                }
                .onDelete { offsets in
                    draft.sites.remove(atOffsets: offsets)
                }

                Button {
                    draft.sites.append(PracticeSite(name: ""))
                } label: {
                    Label("Add site", systemImage: "plus.circle")
                }
            } header: {
                Text("Sites")
            } footer: {
                Text("Swipe left on a site to remove it. Blank sites are discarded on save.")
            }

            Section {
                TextField("Letterhead", text: letterheadBinding, axis: .vertical)
                    .lineLimit(3...8)
                Button("Rebuild from fields above") {
                    draft.letterheadLines = draft.suggestedLetterheadLines
                }
            } header: {
                Text("Letterhead")
            } footer: {
                Text("Contact block at the top-right of PDF headers. One line per row; the first line is emphasised and up to four lines are printed.")
            }

            Section {
                TextField("Time zone", text: $draft.timeZoneIdentifier,
                          prompt: Text("e.g. America/St_Lucia"))
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                if !draft.normalized().hasValidTimeZone {
                    Label("Not a recognised time zone identifier", systemImage: "exclamationmark.triangle")
                        .font(.caption)
                        .foregroundStyle(.red)
                }
            } header: {
                Text("Time zone")
            } footer: {
                Text("IANA identifier. Takes effect after the app is relaunched. Document timestamps are still labelled “ECT”.")
            }

            Section("Preview") {
                previewRow("PDF header", PracticeProfile.join([draft.brandMark, draft.practiceName], separator: "  ·  "))
                previewRow("Header subtitle", draft.clinicianLetterheadLine)
                previewRow("Signature", draft.clinicianSignature)
                previewRow("Form surgeon", draft.clinicianNameWithCredentials)
                previewRow("Footer", draft.practiceNameWithCountry)
                previewRow("SMS", "\(draft.displayShortPracticeName): Appt confirmed … Call \(draft.primaryPhoneCompact) to reschedule.")
            }

            Section {
                Button("Reset to Default", role: .destructive) {
                    showResetConfirm = true
                }
                .disabled(store.isDefault && draft.normalized() == PracticeProfile.amiseDefault)
            } footer: {
                Text("Restores the original Amise Medical Services profile.")
            }
        }
        .navigationTitle("Practice Profile")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    store.save(draft)
                    draft = store.profile
                    dismiss()
                }
                .disabled(!canSave)
                .fontWeight(.semibold)
            }
        }
        .confirmationDialog("Reset practice profile?", isPresented: $showResetConfirm, titleVisibility: .visible) {
            Button("Reset to Default", role: .destructive) {
                store.resetToDefault()
                draft = store.profile
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Documents, letters and messages will use the Amise Medical Services details again.")
        }
    }

    // MARK: - Helpers

    private var canSave: Bool {
        let n = draft.normalized()
        return n != store.profile
            && !n.practiceName.isEmpty
            && !n.clinicianName.isEmpty
            && n.hasValidTimeZone
    }

    private var letterheadBinding: Binding<String> {
        Binding(
            get: { draft.letterheadLines.joined(separator: "\n") },
            set: { draft.letterheadLines = $0.components(separatedBy: "\n") }
        )
    }

    private func previewRow(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value.isEmpty ? "—" : value)
                .font(.footnote)
        }
    }
}
