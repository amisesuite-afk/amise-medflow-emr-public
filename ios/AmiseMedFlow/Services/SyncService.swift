import Foundation
import Network
import Combine
import SwiftData
import Supabase

@MainActor
final class SyncService: ObservableObject {
    @Published var isConnected: Bool = false
    @Published var pendingCount: Int = 0
    @Published var lastSyncedAt: Date?
    @Published var currentUserEmail: String?
    @Published var isSyncing: Bool = false
    @Published var syncError: String?

    private let monitor = NWPathMonitor()
    private let networkQueue = DispatchQueue(label: "com.amise.network")
    private var modelContext: ModelContext?

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                let connected = path.status == .satisfied
                self?.isConnected = connected
                if connected { await self?.syncIfAuthenticated() }
            }
        }
        monitor.start(queue: networkQueue)
        Task { await restoreSession() }
    }

    // MARK: - Session context (injected after ModelContainer is ready)

    func setModelContext(_ context: ModelContext) {
        self.modelContext = context
    }

    // MARK: - Auth

    private func restoreSession() async {
        do {
            let session = try await SupabaseConfig.client.auth.session
            currentUserEmail = session.user.email
        } catch {
            currentUserEmail = nil
        }
    }

    func signIn(email: String, password: String) async throws {
        let session = try await SupabaseConfig.client.auth.signIn(email: email, password: password)
        currentUserEmail = session.user.email
        await syncIfAuthenticated()
    }

    func signOut() async throws {
        try await SupabaseConfig.client.auth.signOut()
        currentUserEmail = nil
    }

    var isSignedIn: Bool { currentUserEmail != nil }

    // MARK: - Sync orchestration

    func syncIfAuthenticated() async {
        guard isSignedIn, let ctx = modelContext else { return }
        await flushOutbox()
        await sync(context: ctx)
    }

    func sync(context: ModelContext) async {
        guard !isSyncing else { return }
        isSyncing = true
        syncError = nil
        defer { isSyncing = false }

        do {
            try await pullPatients(context: context)
            try await pullConfirmedAppointments(context: context)
            try await pushPendingPatients(context: context)
            try await pushPatientEdits(context: context)
            try await pushPendingNotes(context: context)
            try await pullNotes(context: context)
            lastSyncedAt = .now
            recountPending(context: context)
        } catch {
            syncError = error.localizedDescription
        }
    }

    // MARK: - Patient sync

    private struct RemotePatient: Decodable {
        let id: String
        let full_name: String
        let sex: String?
        let date_of_birth: String?
        let phone: String?
        let email: String?
        let address: String?
        let mrn: String?
        let nok_name: String?
        let nok_relation: String?
        let nok_phone: String?
        let pmh_notes: String?
        let family_history_notes: String?
        let insurance_provider: String?
        let policy_number: String?
        let setting: String?
        let location: String?
        let acuity: String?
        let created_at: String
    }

    private func pullPatients(context: ModelContext) async throws {
        let rows: [RemotePatient] = try await SupabaseConfig.client
            .from("patients")
            .select("id, full_name, sex, date_of_birth, phone, email, address, mrn, nok_name, nok_relation, nok_phone, pmh_notes, family_history_notes, insurance_provider, policy_number, setting, location, acuity, created_at")
            .order("created_at", ascending: false)
            .limit(500)
            .execute()
            .value

        let iso = ISO8601DateFormatter()

        // Load all local patients once, then match in Swift (avoids #Predicate capture issues)
        let allLocal = try context.fetch(FetchDescriptor<Patient>())

        for row in rows {
            let existing = allLocal.first { $0.remoteId == row.id }
            let patient = existing ?? {
                let p = Patient(fullName: row.full_name)
                context.insert(p)
                return p
            }()

            patient.remoteId = row.id
            patient.fullName = row.full_name
            patient.sex = Sex(rawValue: row.sex?.capitalized ?? "") ?? .unspecified
            if let dob = row.date_of_birth { patient.dateOfBirth = iso.date(from: dob) }
            patient.phone = row.phone
            patient.email = row.email
            patient.address = row.address
            patient.mrn = row.mrn
            patient.nokName = row.nok_name
            patient.nokRelation = row.nok_relation
            patient.nokPhone = row.nok_phone
            patient.pmhNotes = row.pmh_notes
            patient.familyHistoryNotes = row.family_history_notes
            patient.insuranceProvider = row.insurance_provider
            patient.policyNumber = row.policy_number
            if let s = row.setting { patient.setting = ClinicalSetting(rawValue: s.capitalized) ?? .outpatient }
            if let l = row.location { patient.location = ClinicalLocation(rawValue: locationDisplayName(l)) ?? .rodney_bay }
            if let a = row.acuity { patient.acuity = acuityFromString(a) }
            patient.syncedAt = .now
            patient.pendingSync = false
        }

        try context.save()
    }

    private func locationDisplayName(_ code: String) -> String {
        switch code {
        case "rodney_bay": return "Rodney Bay"
        case "tapion":     return "Tapion"
        case "okeu":       return "OKEU"
        case "victoria":   return "Victoria"
        default:           return "Other"
        }
    }

    private func locationCode(_ location: ClinicalLocation) -> String {
        switch location {
        case .rodney_bay: return "rodney_bay"
        case .tapion:     return "tapion"
        case .okeu:       return "okeu"
        case .victoria:   return "victoria"
        case .other:      return "other"
        }
    }

    private func acuityFromString(_ s: String) -> Acuity {
        switch s {
        case "emergency": return .emergency
        case "urgent":    return .urgent
        case "priority":  return .priority
        default:          return .routine
        }
    }

    private func pushPendingPatients(context: ModelContext) async throws {
        let pending = try context.fetch(FetchDescriptor<Patient>())
            .filter { $0.pendingSync && $0.remoteId == nil }
        guard !pending.isEmpty else { return }

        for patient in pending {
            struct InsertRow: Encodable {
                let full_name: String
                let sex: String
                let phone: String?
                let email: String?
                let address: String?
                let mrn: String?
                let nok_name: String?
                let nok_relation: String?
                let nok_phone: String?
                let insurance_provider: String?
                let policy_number: String?
                let pmh_notes: String?
                let family_history_notes: String?
                let setting: String
                let location: String
                let acuity: String
            }
            let row = InsertRow(
                full_name: patient.fullName,
                sex: patient.sex.rawValue.lowercased(),
                phone: patient.phone,
                email: patient.email,
                address: patient.address,
                mrn: patient.mrn,
                nok_name: patient.nokName,
                nok_relation: patient.nokRelation,
                nok_phone: patient.nokPhone,
                insurance_provider: patient.insuranceProvider,
                policy_number: patient.policyNumber,
                pmh_notes: patient.pmhNotes,
                family_history_notes: patient.familyHistoryNotes,
                setting: patient.setting.rawValue.lowercased(),
                location: locationCode(patient.location),
                acuity: patient.acuity.label.lowercased()
            )
            struct InsertResponse: Decodable { let id: String }
            let response: [InsertResponse] = try await SupabaseConfig.client
                .from("patients")
                .insert(row)
                .select("id")
                .execute()
                .value
            if let first = response.first {
                patient.remoteId = first.id
                patient.pendingSync = false
                patient.syncedAt = .now
            }
        }
        try context.save()
    }

    // MARK: - Pull confirmed appointments → auto-create patient records

    private struct RemoteAppointment: Decodable {
        let id: String
        let patient_name: String?
        let patient_phone: String?
        let patient_email: String?
        let reason: String?
        let preferred_slot: String?
        let status: String?
        let created_at: String
    }

    private func pullConfirmedAppointments(context: ModelContext) async throws {
        let oneWeekAgo = ISO8601DateFormatter().string(from: Date(timeIntervalSinceNow: -7 * 86400))
        let rows: [RemoteAppointment] = try await SupabaseConfig.client
            .from("appointment_requests")
            .select("id, patient_name, patient_phone, patient_email, reason, preferred_slot, status, created_at")
            .in("status", values: ["staff_confirmed", "patient_confirmed"])
            .gte("created_at", value: oneWeekAgo)
            .order("created_at", ascending: false)
            .limit(200)
            .execute()
            .value

        let allLocal = try context.fetch(FetchDescriptor<Patient>())

        for appt in rows {
            guard let name = appt.patient_name, !name.isEmpty else { continue }
            // Avoid duplicates: match by appointment_id stored in remoteId, or by name+phone
            let existing = allLocal.first { p in
                p.remoteId == "appt:\(appt.id)" ||
                (p.fullName.lowercased() == name.lowercased() && p.phone == appt.patient_phone)
            }
            guard existing == nil else { continue }

            let p = Patient(fullName: name)
            p.phone = appt.patient_phone
            p.email = appt.patient_email
            p.chiefComplaint = appt.reason
            p.remoteId = "appt:\(appt.id)"  // sentinel so we don't push this back
            p.pendingSync = false
            p.syncedAt = .now
            context.insert(p)
        }
        try context.save()
    }

    // MARK: - Push edits to existing synced patients

    private func pushPatientEdits(context: ModelContext) async throws {
        let dirty = try context.fetch(FetchDescriptor<Patient>())
            .filter { $0.pendingSync && $0.remoteId != nil }
        guard !dirty.isEmpty else { return }

        for patient in dirty {
            guard let remoteId = patient.remoteId else { continue }
            struct UpdateRow: Encodable {
                let full_name: String
                let sex: String
                let phone: String?
                let email: String?
                let address: String?
                let mrn: String?
                let nok_name: String?
                let nok_relation: String?
                let nok_phone: String?
                let insurance_provider: String?
                let policy_number: String?
                let pmh_notes: String?
                let family_history_notes: String?
                let working_diagnosis: String?
                let working_diagnosis_icd: String?
                let setting: String
                let location: String
                let acuity: String
            }
            let row = UpdateRow(
                full_name: patient.fullName,
                sex: patient.sex.rawValue.lowercased(),
                phone: patient.phone,
                email: patient.email,
                address: patient.address,
                mrn: patient.mrn,
                nok_name: patient.nokName,
                nok_relation: patient.nokRelation,
                nok_phone: patient.nokPhone,
                insurance_provider: patient.insuranceProvider,
                policy_number: patient.policyNumber,
                pmh_notes: patient.pmhNotes,
                family_history_notes: patient.familyHistoryNotes,
                working_diagnosis: patient.workingDiagnosis,
                working_diagnosis_icd: patient.workingDiagnosisICD,
                setting: patient.setting.rawValue.lowercased(),
                location: locationCode(patient.location),
                acuity: patient.acuity.label.lowercased()
            )
            try await SupabaseConfig.client
                .from("patients")
                .update(row)
                .eq("id", value: remoteId)
                .execute()
            patient.pendingSync = false
            patient.syncedAt = .now
        }
        try context.save()
    }

    // MARK: - Note sync

    private func pushPendingNotes(context: ModelContext) async throws {
        let pending = try context.fetch(FetchDescriptor<ClinicalNote>())
            .filter { $0.pendingSync && $0.remoteId == nil }
        guard !pending.isEmpty else { return }

        for note in pending {
            guard let patientRemoteId = note.patient?.remoteId, !note.isEmpty else { continue }

            struct NoteRow: Encodable {
                let patient_id: String
                let note_type: String
                let status: String
                let content: String
                let ai_assisted: Bool
            }
            let row = NoteRow(
                patient_id: patientRemoteId,
                note_type: note.noteType.rawValue,
                status: note.status.rawValue,
                content: note.contentForSync,
                ai_assisted: false
            )
            struct NoteResponse: Decodable { let id: String }
            let response: [NoteResponse] = try await SupabaseConfig.client
                .from("clinical_notes")
                .insert(row)
                .select("id")
                .execute()
                .value
            if let first = response.first {
                note.remoteId = first.id
                note.pendingSync = false
                note.syncedAt = .now
            }
        }
        try context.save()
    }

    // MARK: - Pull clinical notes from remote

    private struct RemoteNote: Decodable {
        let id: String
        let patient_id: String
        let note_type: String
        let status: String
        let content: String?
        let created_at: String
    }

    private func pullNotes(context: ModelContext) async throws {
        let rows: [RemoteNote] = try await SupabaseConfig.client
            .from("clinical_notes")
            .select("id, patient_id, note_type, status, content, created_at")
            .order("created_at", ascending: false)
            .limit(200)
            .execute()
            .value

        let allLocalNotes  = try context.fetch(FetchDescriptor<ClinicalNote>())
        let allLocalPatients = try context.fetch(FetchDescriptor<Patient>())

        for row in rows {
            let patient = allLocalPatients.first { $0.remoteId == row.patient_id }
            guard let patient else { continue }

            let existing = allLocalNotes.first { $0.remoteId == row.id }
            let note: ClinicalNote
            if let e = existing {
                note = e
            } else {
                let noteType = NoteType(rawValue: row.note_type) ?? .other
                note = ClinicalNote(noteType: noteType, patient: patient)
                context.insert(note)
            }

            note.remoteId = row.id
            note.status = NoteStatus(rawValue: row.status) ?? .draft
            // Restore structured SOAP fields; fall back to freeText for all other types
            if note.noteType.isStructured, let content = row.content {
                restoreSOAPFields(note: note, content: content)
            } else {
                note.freeText = row.content
            }
            note.syncedAt = .now
            note.pendingSync = false
        }

        try context.save()
    }

    // MARK: - SOAP content → structured fields

    private func restoreSOAPFields(note: ClinicalNote, content: String) {
        // Content is formatted by contentForSync: "S:\n...\n\nO:\n...\n\nA:\n...\n\nP:\n..."
        var s = "", o = "", a = "", p = ""
        var current: Character? = nil
        var buffer = ""

        func flush() {
            switch current {
            case "S": s = buffer.trimmingCharacters(in: .whitespacesAndNewlines)
            case "O": o = buffer.trimmingCharacters(in: .whitespacesAndNewlines)
            case "A": a = buffer.trimmingCharacters(in: .whitespacesAndNewlines)
            case "P": p = buffer.trimmingCharacters(in: .whitespacesAndNewlines)
            default: break
            }
        }

        for line in content.components(separatedBy: "\n") {
            if line == "S:" || line == "O:" || line == "A:" || line == "P:" {
                flush()
                current = line.first
                buffer = ""
            } else {
                buffer += (buffer.isEmpty ? "" : "\n") + line
            }
        }
        flush()

        note.subjective = s.isEmpty ? nil : s
        note.objective  = o.isEmpty ? nil : o
        note.assessment = a.isEmpty ? nil : a
        note.plan       = p.isEmpty ? nil : p
    }

    // MARK: - Pending count

    private func recountPending(context: ModelContext) {
        let pCount = (try? context.fetch(FetchDescriptor<Patient>()))?.filter { $0.pendingSync }.count ?? 0
        let nCount = (try? context.fetch(FetchDescriptor<ClinicalNote>()))?.filter { $0.pendingSync }.count ?? 0
        pendingCount = pCount + nCount
    }

    // MARK: - Offline write queue (persisted in UserDefaults, flushed on reconnect)

    private static let outboxKey = "com.amise.medflow.sync-outbox"

    private struct OutboxEntry: Codable {
        let entityType: String
        let entityId:   String
        let payload:    [String: String]   // values serialised to String for Codable compatibility
        let enqueuedAt: Date
    }

    func enqueue(entityType: String, entityId: String, payload: [String: Any]) {
        var entries = loadOutbox()
        // Serialise Any values to String to survive Codable round-trip
        let stringPayload = payload.reduce(into: [String: String]()) { dict, pair in
            dict[pair.key] = "\(pair.value)"
        }
        entries.append(OutboxEntry(entityType: entityType, entityId: entityId,
                                   payload: stringPayload, enqueuedAt: .now))
        saveOutbox(entries)
        pendingCount += 1
    }

    private func flushOutbox() async {
        var entries = loadOutbox()
        guard !entries.isEmpty else { return }

        var failed: [OutboxEntry] = []
        for entry in entries {
            do {
                // Re-drive the appropriate push by marking the local entity dirty again.
                // Entities are identified by entityType + entityId (local UUID string).
                guard let ctx = modelContext else { failed.append(entry); continue }
                switch entry.entityType {
                case "patient":
                    let all = try ctx.fetch(FetchDescriptor<Patient>())
                    if let p = all.first(where: { $0.id.uuidString == entry.entityId }) {
                        p.pendingSync = true
                    }
                case "clinical_note":
                    let all = try ctx.fetch(FetchDescriptor<ClinicalNote>())
                    if let n = all.first(where: { $0.id.uuidString == entry.entityId }) {
                        n.pendingSync = true
                    }
                default:
                    break
                }
            } catch {
                failed.append(entry)
            }
        }
        saveOutbox(failed)
        pendingCount = max(0, pendingCount - (entries.count - failed.count))

        // Let the normal sync push handle re-marked entities
        if let ctx = modelContext {
            try? await pushPendingPatients(context: ctx)
            try? await pushPendingNotes(context: ctx)
        }
    }

    private func loadOutbox() -> [OutboxEntry] {
        guard let data = UserDefaults.standard.data(forKey: Self.outboxKey),
              let entries = try? JSONDecoder().decode([OutboxEntry].self, from: data)
        else { return [] }
        return entries
    }

    private func saveOutbox(_ entries: [OutboxEntry]) {
        if let data = try? JSONEncoder().encode(entries) {
            UserDefaults.standard.set(data, forKey: Self.outboxKey)
        }
    }
}
