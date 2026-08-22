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
        await sync(context: ctx)
    }

    func sync(context: ModelContext) async {
        guard !isSyncing else { return }
        isSyncing = true
        syncError = nil
        defer { isSyncing = false }

        do {
            try await pullPatients(context: context)
            try await pushPendingPatients(context: context)
            try await pushPendingNotes(context: context)
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
        let created_at: String
    }

    private func pullPatients(context: ModelContext) async throws {
        let rows: [RemotePatient] = try await SupabaseConfig.client
            .from("patients")
            .select("id, full_name, sex, date_of_birth, phone, email, address, mrn, nok_name, nok_relation, nok_phone, pmh_notes, family_history_notes, insurance_provider, policy_number, created_at")
            .order("created_at", ascending: false)
            .limit(500)
            .execute()
            .value

        let iso = ISO8601DateFormatter()

        for row in rows {
            // Find existing local patient with this remoteId, or create new
            var desc = FetchDescriptor<Patient>(
                predicate: #Predicate { $0.remoteId == row.id }
            )
            desc.fetchLimit = 1

            let existing = try context.fetch(desc).first
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
            patient.syncedAt = .now
            patient.pendingSync = false
        }

        try context.save()
    }

    private func pushPendingPatients(context: ModelContext) async throws {
        let desc = FetchDescriptor<Patient>(
            predicate: #Predicate { $0.pendingSync == true && $0.remoteId == nil }
        )
        let pending = try context.fetch(desc)
        guard !pending.isEmpty else { return }

        for patient in pending {
            struct InsertRow: Encodable {
                let full_name: String
                let sex: String
                let phone: String?
                let email: String?
                let address: String?
            }
            let row = InsertRow(
                full_name: patient.fullName,
                sex: patient.sex.rawValue.lowercased(),
                phone: patient.phone,
                email: patient.email,
                address: patient.address
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

    // MARK: - Note sync

    private func pushPendingNotes(context: ModelContext) async throws {
        let desc = FetchDescriptor<ClinicalNote>(
            predicate: #Predicate { $0.pendingSync == true && $0.remoteId == nil }
        )
        let pending = try context.fetch(desc)
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

    // MARK: - Pending count

    private func recountPending(context: ModelContext) {
        let pCount = (try? context.fetchCount(
            FetchDescriptor<Patient>(predicate: #Predicate { $0.pendingSync == true })
        )) ?? 0
        let nCount = (try? context.fetchCount(
            FetchDescriptor<ClinicalNote>(predicate: #Predicate { $0.pendingSync == true })
        )) ?? 0
        pendingCount = pCount + nCount
    }

    // MARK: - Manual enqueue (for offline writes)

    func enqueue(entityType: String, entityId: String, payload: [String: Any]) {
        pendingCount += 1
    }
}
