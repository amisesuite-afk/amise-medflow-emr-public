import Foundation
import Security
import SwiftData

// MARK: - Keychain helpers (private to this file)

enum KCHelper {
    private static let service = "com.amisesuite.medflow.nas"

    static func save(_ value: String, forKey key: String) {
        let data = Data(value.utf8)
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key
        ]
        SecItemDelete(query as CFDictionary)
        var add = query
        add[kSecValueData] = data
        SecItemAdd(add as CFDictionary, nil)
    }

    static func load(key: String) -> String? {
        let query: [CFString: Any] = [
            kSecClass:            kSecClassGenericPassword,
            kSecAttrService:      service,
            kSecAttrAccount:      key,
            kSecReturnData:       true,
            kSecMatchLimit:       kSecMatchLimitOne
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess,
              let data = item as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    static func delete(key: String) {
        let query: [CFString: Any] = [
            kSecClass:       kSecClassGenericPassword,
            kSecAttrService: service,
            kSecAttrAccount: key
        ]
        SecItemDelete(query as CFDictionary)
    }
}

// MARK: - NAS connection status

enum NASConnectionStatus: Equatable {
    case unconfigured
    case ok
    case error(String)

    var label: String {
        switch self {
        case .unconfigured: return "Not configured"
        case .ok:           return "Connected"
        case .error(let m): return m
        }
    }
}

// MARK: - Backup event

struct NASBackupEvent: Identifiable {
    let id    = UUID()
    let at: Date
    let recordCount: Int
    let sizeBytes: Int
    let success: Bool
    let errorMessage: String?
}

// MARK: - NASBackupError

enum NASBackupError: LocalizedError {
    case invalidURL(String)
    case httpError(Int, String)
    case notConfigured

    var errorDescription: String? {
        switch self {
        case .invalidURL(let u):        return "Invalid URL: \(u)"
        case .httpError(let c, let op): return "\(op) returned HTTP \(c)"
        case .notConfigured:            return "NAS not configured"
        }
    }
}

// MARK: - NASBackupService

/// WebDAV backup to a local NAS (Synology, QNAP) or any WebDAV server.
/// Also works over Tailscale — enter the Tailscale IP as the server URL.
///
/// Credentials are stored in Keychain; the server URL is stored in UserDefaults.
/// All network operations run async; published state updates happen on MainActor.
@MainActor
final class NASBackupService: ObservableObject {

    // MARK: - Editable config (binds directly to SwiftUI)

    @Published var serverURL: String {
        didSet { UserDefaults.standard.set(serverURL, forKey: "nas_webdav_url") }
    }

    @Published var username: String {
        didSet { KCHelper.save(username, forKey: "nas_username") }
    }

    @Published var password: String {
        didSet { KCHelper.save(password, forKey: "nas_password") }
    }

    // MARK: - Read-only state

    @Published private(set) var isBackingUp: Bool = false
    @Published private(set) var isTesting:   Bool = false
    @Published private(set) var lastBackupAt: Date? {
        didSet {
            if let d = lastBackupAt {
                UserDefaults.standard.set(d, forKey: "nas_last_backup_at")
            }
        }
    }
    @Published private(set) var lastBackupCount: Int     = 0
    @Published var backupError: String?     = nil
    @Published var connectionStatus: NASConnectionStatus = .unconfigured
    @Published private(set) var recentEvents: [NASBackupEvent] = []
    /// Document upload progress while a backup runs; nil otherwise (NASBackupService+Documents).
    @Published var documentProgress: NASDocumentProgress? = nil
    /// Documents part of the last backup run (counts and sizes only; kept in UserDefaults).
    @Published var lastDocumentsSummary: NASDocumentsSummary? = NASDocumentsSummary.loadSaved()

    var isConfigured: Bool {
        !serverURL.trimmingCharacters(in: .whitespaces).isEmpty
    }

    // MARK: - Init

    init() {
        serverURL   = UserDefaults.standard.string(forKey: "nas_webdav_url") ?? ""
        username    = KCHelper.load(key: "nas_username") ?? ""
        password    = KCHelper.load(key: "nas_password") ?? ""
        lastBackupAt = UserDefaults.standard.object(forKey: "nas_last_backup_at") as? Date
        connectionStatus = (UserDefaults.standard.string(forKey: "nas_webdav_url") ?? "").isEmpty
            ? .unconfigured : .ok
    }

    // MARK: - URLSession

    lazy var session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.requestCachePolicy    = .reloadIgnoringLocalCacheData
        cfg.timeoutIntervalForRequest  = 30
        cfg.timeoutIntervalForResource = 120
        return URLSession(configuration: cfg)
    }()

    /// For document files: a large PDF or photo over Tailscale can take longer than the
    /// 120-second limit of `session`.
    lazy var documentSession: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.requestCachePolicy    = .reloadIgnoringLocalCacheData
        cfg.urlCache              = nil
        cfg.timeoutIntervalForRequest  = 60
        cfg.timeoutIntervalForResource = 1_800
        return URLSession(configuration: cfg)
    }()

    // MARK: - Test connection

    func testConnection() async {
        guard isConfigured else {
            connectionStatus = .unconfigured
            return
        }
        isTesting   = true
        backupError = nil
        defer { isTesting = false }

        do {
            var req = URLRequest(url: try baseURL())
            req.httpMethod = "PROPFIND"
            req.setValue("0", forHTTPHeaderField: "Depth")
            addAuth(&req)

            let (_, resp) = try await session.data(for: req)
            let code = (resp as? HTTPURLResponse)?.statusCode ?? 0

            switch code {
            case 200...299, 207, 404:
                connectionStatus = .ok
            case 401, 403:
                backupError  = "Authentication failed — check username and password."
                connectionStatus = .error("Auth failed")
            default:
                backupError  = "Server returned HTTP \(code)."
                connectionStatus = .error("HTTP \(code)")
            }
        } catch {
            backupError  = error.localizedDescription
            connectionStatus = .error(error.localizedDescription)
        }
    }

    // MARK: - Backup

    /// Exports all SwiftData records to the NAS as timestamped JSON bundles, then every patient
    /// document's file (documents/ + documents.json). A document upload that fails part-way leaves
    /// the backup marked incomplete (backupError, documents.json `complete: false`).
    /// Safe to call from a `Task {}` in a SwiftUI view; all state updates run on MainActor.
    func backup(context: ModelContext) async {
        guard isConfigured else { return }
        isBackingUp = true
        backupError = nil
        defer { isBackingUp = false }

        do {
            let timestamp = ISO8601DateFormatter().string(from: .now)
                .replacingOccurrences(of: ":", with: "")
                .replacingOccurrences(of: ".", with: "")
            let base    = NASDocumentBackup.backupsBase
            let dirPath = "\(base)/\(timestamp)"

            try await ensureDirectory(path: base)
            try await ensureDirectory(path: dirPath)

            let patients      = try context.fetch(FetchDescriptor<Patient>())
            let notes         = try context.fetch(FetchDescriptor<ClinicalNote>())
            let prescriptions = try context.fetch(FetchDescriptor<Prescription>())
            let vitals        = try context.fetch(FetchDescriptor<VitalsEntry>())

            let encoder = JSONEncoder()
            encoder.outputFormatting   = [.prettyPrinted, .sortedKeys]
            encoder.dateEncodingStrategy = .iso8601

            var totalBytes = 0

            func upload(_ name: String, _ data: Data) async throws {
                totalBytes += try await put(path: "\(dirPath)/\(name)", data: data)
            }

            try await upload("patients.json",      try encoder.encode(patients.map(PatientBackup.init)))
            try await upload("notes.json",          try encoder.encode(notes.map(ClinicalNoteBackup.init)))
            try await upload("prescriptions.json", try encoder.encode(prescriptions.map(PrescriptionBackup.init)))
            try await upload("vitals.json",         try encoder.encode(vitals.map(VitalsBackup.init)))

            let manifest = BackupManifest(
                createdAt:    .now,
                appVersion:   Bundle.main.infoDictionary?["CFBundleShortVersionString"] as? String ?? "—",
                recordCounts: [
                    "patients":      patients.count,
                    "notes":         notes.count,
                    "prescriptions": prescriptions.count,
                    "vitals":        vitals.count
                ]
            )
            try await upload("manifest.json", try encoder.encode(manifest))

            // Complete chart records (peer-sync formats) for real restores, then read them back
            // to prove the backup is usable — a backup that can't be read is not a backup.
            let full = try await uploadFullRecords(context: context, dirPath: dirPath, upload: upload)
            let readBack = try await downloadFullBundle(dirPath: dirPath)
            guard readBack.patients.count == full.patients.count,
                  readBack.notes.count == full.notes.count else {
                throw NASBackupError.httpError(0, "Backup verification failed: read-back counts differ")
            }
            UserDefaults.standard.set(Date.now, forKey: Self.lastVerifiedKey)
            AuditLog.record("export", "document", details: ["kind": "nas_backup",
                                                            "patients": "\(full.patients.count)"])

            // Patient documents and photos, one file at a time. Never throws: a failure part-way
            // is recorded in documents.json and the summary as incomplete.
            let docs = await backupDocuments(context: context, dirPath: dirPath)
            totalBytes += docs.uploadedBytes

            let total = patients.count + notes.count + prescriptions.count + vitals.count
            connectionStatus = .ok

            let event: NASBackupEvent
            if docs.complete {
                lastBackupAt    = .now
                lastBackupCount = total
                event = NASBackupEvent(at: .now, recordCount: total, sizeBytes: totalBytes, success: true, errorMessage: nil)
            } else {
                // Records are on the NAS; documents are not all there. Not counted as a
                // successful backup, and Verify reports it as incomplete.
                let message = "Backup incomplete: records saved, but only \(docs.documentCount) of "
                    + "\(docs.expectedCount) documents (\(docs.failureMessage ?? "unknown error")). Tap Backup Now to retry."
                backupError = message
                event = NASBackupEvent(at: .now, recordCount: total, sizeBytes: totalBytes, success: false, errorMessage: message)
            }
            recentEvents.insert(event, at: 0)
            if recentEvents.count > 10 { recentEvents = Array(recentEvents.prefix(10)) }

        } catch {
            backupError  = error.localizedDescription
            connectionStatus = .error(error.localizedDescription)
            let event = NASBackupEvent(at: .now, recordCount: 0, sizeBytes: 0, success: false, errorMessage: error.localizedDescription)
            recentEvents.insert(event, at: 0)
        }
    }

}
