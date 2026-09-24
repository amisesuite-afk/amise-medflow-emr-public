import Foundation
import Network
import Combine
import SwiftData
import Supabase

@MainActor
final class SyncService: ObservableObject {
    @Published var isConnected: Bool = false
    @Published var isOnWiFi: Bool = false
    @Published var pendingCount: Int = 0
    @Published var lastSyncedAt: Date?
    @Published var currentUserEmail: String?
    @Published var currentUserId: String?
    @Published var currentUserRole: UserRole = .frontDesk
    @Published var isSyncing: Bool = false
    @Published var syncError: String?

    private let monitor = NWPathMonitor()
    private let networkQueue = DispatchQueue(label: "com.amise.network")
    var modelContext: ModelContext?
    private var periodicSyncTask: Task<Void, Never>?
    private var realtimeTask: Task<Void, Never>?

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                let connected = path.status == .satisfied
                let onWiFi    = path.usesInterfaceType(.wifi)
                self?.isConnected = connected
                self?.isOnWiFi    = onWiFi
                if connected { await self?.syncIfAuthenticated() }
            }
        }
        monitor.start(queue: networkQueue)
        Task { await restoreSession() }
        startPeriodicSync()
    }

    // MARK: - Session context (injected after ModelContainer is ready)

    func setModelContext(_ context: ModelContext) {
        self.modelContext = context
        // If network was already up (and auto-sync fired before the context arrived), sync now.
        Task { await syncIfAuthenticated() }
        if isSignedIn { startRealtime() }
    }

    // MARK: - Periodic WiFi sync (30 s on WiFi / local network, pauses on cellular)

    private func startPeriodicSync() {
        periodicSyncTask = Task { [weak self] in
            while !Task.isCancelled {
                do { try await Task.sleep(for: .seconds(30)) } catch { break }
                guard let self, self.isOnWiFi else { continue }
                await self.syncIfAuthenticated()
            }
        }
    }

    // MARK: - Realtime subscription (doctor device gets instant update on check-in)

    func startRealtime() {
        realtimeTask?.cancel()
        realtimeTask = Task { [weak self] in
            guard let self else { return }
            let channel = SupabaseConfig.client.realtimeV2.channel("patient-encounter-sync")
            let changes = channel.postgresChange(AnyAction.self, schema: "public", table: "patients")
            try? await channel.subscribeWithError()
            for await _ in changes {
                guard !Task.isCancelled else { break }
                await self.syncIfAuthenticated()
            }
        }
    }

    func stopRealtime() {
        realtimeTask?.cancel()
        realtimeTask = nil
    }

    // MARK: - Auth

    private func restoreSession() async {
        do {
            let session = try await SupabaseConfig.client.auth.session
            currentUserEmail = session.user.email
            currentUserId = session.user.id.uuidString
            await fetchUserRole(userId: session.user.id)
            SyncTombstones.clearRefused()   // the role may have changed since the last launch
            startRealtime()
            // Race-condition fix: setModelContext() may have run before restoreSession()
            // completed (isSignedIn was false at that point), so sync was silently skipped.
            // Trigger it here so a restored session always produces an initial sync.
            await syncIfAuthenticated()
        } catch {
            currentUserEmail = nil
        }
    }

    func signIn(email: String, password: String) async throws {
        let session = try await SupabaseConfig.client.auth.signIn(email: email, password: password)
        AuditLog.record("login", "user", details: ["client": "ios"])
        currentUserEmail = session.user.email
        currentUserId = session.user.id.uuidString
        await fetchUserRole(userId: session.user.id)
        SyncTombstones.clearRefused()   // a different user may be allowed to delete
        await syncIfAuthenticated()
        startRealtime()
    }

    func signOut() async throws {
        AuditLog.record("logout", "user", details: ["client": "ios"])
        await AuditLog.flush()   // upload while still signed in
        try await SupabaseConfig.client.auth.signOut()
        currentUserEmail = nil
        currentUserId = nil
        currentUserRole = .frontDesk
    }

    private func fetchUserRole(userId: UUID) async {
        struct ProfileRow: Decodable { let role: String? }
        do {
            let rows: [ProfileRow] = try await SupabaseConfig.client
                .from("user_profiles")
                .select("role")
                .eq("id", value: userId.uuidString)
                .limit(1)
                .execute()
                .value
            if let raw = rows.first?.role, let role = UserRole(rawValue: raw) {
                currentUserRole = role
            } else {
                currentUserRole = .frontDesk
            }
        } catch {
            currentUserRole = .frontDesk
        }
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
            // Deletes made on this device go up first, as soft deletes. Never throws: a server
            // without Migration 87 keeps the tombstones for later.
            await flushSoftDeletes()
            try await pullPatients(context: context)
            try await pullConfirmedAppointments(context: context)
            try await pushPendingPatients(context: context)
            try await pushPatientEdits(context: context)
            try await pushPendingNotes(context: context)
            try await pullNotes(context: context)
            try await pushPendingPrescriptions(context: context)
            try await pullPrescriptions(context: context)
            try await pushPendingVitals(context: context)
            try await pullVitals(context: context)
            try await pushPendingOperativePlans(context: context)
            try await pullOperativePlans(context: context)
            try await pullDocumentMetadata(context: context)
            try await pushPendingBillingItems(context: context)
            try await pullBillingItems(context: context)
            // Own requests, never throws: a server without the column (migration 86) must not
            // break the rest of the sync.
            await syncPathwayData(context: context)
            // Same for the NEWS2 SpO₂ Scale 2 flag (migration 88). Its pull is in pullPatients.
            await pushNEWS2Scale2(context: context)
            await AuditLog.flush()
            lastSyncedAt = .now
            recountPending(context: context)
        } catch {
            syncError = error.localizedDescription
        }
    }
}
