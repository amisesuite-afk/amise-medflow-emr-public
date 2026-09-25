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
    /// Short, PHI-free notice about records the server refused for this user's role
    /// (e.g. "1 change not permitted for your role"). See SyncService+Refusals.swift.
    @Published var syncNotice: String?
    /// True once `currentUserRole` came from the user's `user_profiles` row. The role falls back
    /// to `.frontDesk` when the fetch fails (e.g. offline at launch); the patient push only
    /// leaves out clinician-only columns when the front-desk role is confirmed.
    @Published private(set) var isRoleConfirmed: Bool = false

    private let monitor = NWPathMonitor()
    private let networkQueue = DispatchQueue(label: "com.amise.network")
    var modelContext: ModelContext?
    private var periodicSyncTask: Task<Void, Never>?
    private var realtimeTask: Task<Void, Never>?

    init() {
        #if DEBUG
        // UI-test demo mode (UITestDemoMode.swift, DEBUG only): a synthetic signed-in user and no
        // syncing at all — no network monitor, session restore, periodic or realtime sync.
        if UITestDemoMode.isActive {
            currentUserEmail = UITestDemoMode.userEmail
            currentUserId = UITestDemoMode.userId
            currentUserRole = UITestDemoMode.role
            isRoleConfirmed = true
            return
        }
        #endif
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
        #if DEBUG
        if UITestDemoMode.isActive { return }   // demo mode never syncs
        #endif
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
            SyncRefusals.clearAll()
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
        isRoleConfirmed = false         // never carry a confirmed role over to another user
        await fetchUserRole(userId: session.user.id)
        SyncTombstones.clearRefused()   // a different user may be allowed to delete
        SyncRefusals.clearAll()         // ... or to make the refused edits
        await syncIfAuthenticated()
        startRealtime()
    }

    func signOut() async throws {
        #if DEBUG
        if UITestDemoMode.isActive { return }   // demo mode: no Supabase session to end
        #endif
        AuditLog.record("logout", "user", details: ["client": "ios"])
        await AuditLog.flush()   // upload while still signed in
        try await SupabaseConfig.client.auth.signOut()
        currentUserEmail = nil
        currentUserId = nil
        currentUserRole = .frontDesk
        isRoleConfirmed = false
        syncNotice = nil
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
                isRoleConfirmed = true
            } else {
                currentUserRole = .frontDesk
                isRoleConfirmed = false
            }
        } catch {
            // Keep a role confirmed earlier this session (a transient failure must not change
            // it); otherwise fall back to front desk, unconfirmed.
            if !isRoleConfirmed { currentUserRole = .frontDesk }
        }
    }

    var isSignedIn: Bool { currentUserEmail != nil }

    // MARK: - Sync orchestration

    func syncIfAuthenticated() async {
        #if DEBUG
        if UITestDemoMode.isActive { return }   // demo mode never syncs
        #endif
        guard isSignedIn, let ctx = modelContext else { return }
        await flushOutbox()
        await sync(context: ctx)
    }

    func sync(context: ModelContext) async {
        #if DEBUG
        if UITestDemoMode.isActive { return }   // demo mode never syncs
        #endif
        guard !isSyncing else { return }
        isSyncing = true
        syncError = nil
        defer { isSyncing = false }

        // The launch fetch may have failed (offline): try again, so the role-dependent push
        // (front desk leaves out clinician-only columns) and the UI use the real role.
        if !isRoleConfirmed, let uid = currentUserId.flatMap(UUID.init(uuidString:)) {
            await fetchUserRole(userId: uid)
        }

        // Each step runs on its own: a failure is recorded in syncError and the later steps still
        // run. Inside each push step, errors are handled per record (SyncService+Refusals.swift),
        // so one record the server refuses does not hold back the others. pendingSync is still
        // cleared only on a confirmed write.
        //
        // Deletes made on this device go up first, as soft deletes. Never throws: a server
        // without Migration 87 keeps the tombstones for later.
        await flushSoftDeletes()
        await runSyncStep("pull patients") { try await pullPatients(context: context) }
        await runSyncStep("pull appointments") { try await pullConfirmedAppointments(context: context) }
        await runSyncStep("push new patients") { try await pushPendingPatients(context: context) }
        await runSyncStep("push patient edits") { try await pushPatientEdits(context: context) }
        await runSyncStep("push notes") { try await pushPendingNotes(context: context) }
        await runSyncStep("pull notes") { try await pullNotes(context: context) }
        await runSyncStep("push prescriptions") { try await pushPendingPrescriptions(context: context) }
        await runSyncStep("pull prescriptions") { try await pullPrescriptions(context: context) }
        await runSyncStep("push vitals") { try await pushPendingVitals(context: context) }
        await runSyncStep("pull vitals") { try await pullVitals(context: context) }
        await runSyncStep("push operative plans") { try await pushPendingOperativePlans(context: context) }
        await runSyncStep("pull operative plans") { try await pullOperativePlans(context: context) }
        await runSyncStep("pull documents") { try await pullDocumentMetadata(context: context) }
        await runSyncStep("push billing") { try await pushPendingBillingItems(context: context) }
        await runSyncStep("pull billing") { try await pullBillingItems(context: context) }
        // Own requests, never throws: a server without the column (migration 86) must not
        // break the rest of the sync.
        await syncPathwayData(context: context)
        // Same for the NEWS2 SpO₂ Scale 2 flag (migration 88). Its pull is in pullPatients.
        await pushNEWS2Scale2(context: context)
        await AuditLog.flush()
        if syncError == nil { lastSyncedAt = .now }
        recountPending(context: context)
    }
}
