import Foundation
import Security
import SwiftData

// MARK: - Keychain helpers (private to this file)

private enum KCHelper {
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
    @Published private(set) var backupError: String?     = nil
    @Published private(set) var connectionStatus: NASConnectionStatus = .unconfigured
    @Published private(set) var recentEvents: [NASBackupEvent] = []

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

    private lazy var session: URLSession = {
        let cfg = URLSessionConfiguration.default
        cfg.requestCachePolicy    = .reloadIgnoringLocalCacheData
        cfg.timeoutIntervalForRequest  = 30
        cfg.timeoutIntervalForResource = 120
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

    /// Exports all SwiftData records to the NAS as timestamped JSON bundles.
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
            let base    = "medflow-backups"
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

            let total = patients.count + notes.count + prescriptions.count + vitals.count
            lastBackupAt    = .now
            lastBackupCount = total
            connectionStatus = .ok

            let event = NASBackupEvent(at: .now, recordCount: total, sizeBytes: totalBytes, success: true, errorMessage: nil)
            recentEvents.insert(event, at: 0)
            if recentEvents.count > 10 { recentEvents = Array(recentEvents.prefix(10)) }

        } catch {
            backupError  = error.localizedDescription
            connectionStatus = .error(error.localizedDescription)
            let event = NASBackupEvent(at: .now, recordCount: 0, sizeBytes: 0, success: false, errorMessage: error.localizedDescription)
            recentEvents.insert(event, at: 0)
        }
    }

    // MARK: - WebDAV primitives

    private func ensureDirectory(path: String) async throws {
        var req = URLRequest(url: try urlFor(path: path))
        req.httpMethod = "MKCOL"
        addAuth(&req)
        let (_, resp) = try await session.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        // 201 Created  · 405 Already exists  · 301/302 redirect — all fine
        guard [200, 201, 204, 301, 302, 405, 207].contains(code) else {
            throw NASBackupError.httpError(code, "MKCOL \(path)")
        }
    }

    private func put(path: String, data: Data) async throws -> Int {
        var req = URLRequest(url: try urlFor(path: path))
        req.httpMethod = "PUT"
        req.httpBody   = data
        req.setValue("application/json",    forHTTPHeaderField: "Content-Type")
        req.setValue("\(data.count)",        forHTTPHeaderField: "Content-Length")
        addAuth(&req)
        let (_, resp) = try await session.data(for: req)
        let code = (resp as? HTTPURLResponse)?.statusCode ?? 0
        guard (200...299).contains(code) || code == 201 else {
            throw NASBackupError.httpError(code, "PUT \(path)")
        }
        return data.count
    }

    // MARK: - URL helpers

    private func baseURL() throws -> URL {
        let raw = serverURL.trimmingCharacters(in: .whitespaces)
        guard let url = URL(string: raw) else { throw NASBackupError.invalidURL(raw) }
        return url
    }

    private func urlFor(path: String) throws -> URL {
        try baseURL().appendingPathComponent(path)
    }

    private func addAuth(_ request: inout URLRequest) {
        guard !username.isEmpty else { return }
        let token = Data("\(username):\(password)".utf8).base64EncodedString()
        request.setValue("Basic \(token)", forHTTPHeaderField: "Authorization")
    }

    // MARK: - Clear credentials

    func clearCredentials() {
        serverURL = ""
        username  = ""
        password  = ""
        KCHelper.delete(key: "nas_username")
        KCHelper.delete(key: "nas_password")
        UserDefaults.standard.removeObject(forKey: "nas_webdav_url")
        connectionStatus = .unconfigured
        backupError = nil
    }
}

// MARK: - Backup manifest

private struct BackupManifest: Codable {
    let createdAt: Date
    let appVersion: String
    let recordCounts: [String: Int]
}

// MARK: - Backup DTOs
// Codable snapshots of SwiftData models. Fields chosen for disaster recovery.
// Never embed the @Model classes themselves — SwiftData objects are not Codable.

struct PatientBackup: Codable {
    let id:               UUID
    let syncCode:         String
    let fullName:         String
    let dateOfBirth:      Date?
    let sex:              String
    let mrn:              String?
    let setting:          String
    let location:         String
    let acuity:           String
    let chiefComplaint:   String?
    let workingDiagnosis: String?
    let managementPlan:   String?
    let hpi:              String?
    let assessmentText:   String?
    let pmhNotes:         String?
    let ward:             String?
    let bedNumber:        String?
    let admittedAt:       Date?
    let createdAt:        Date
    let updatedAt:        Date

    init(_ p: Patient) {
        id               = p.id
        syncCode         = p.syncCode
        fullName         = p.fullName
        dateOfBirth      = p.dateOfBirth
        sex              = p.sex.rawValue
        mrn              = p.mrn
        setting          = p.setting.rawValue
        location         = p.location.rawValue
        acuity           = p.acuity.rawValue
        chiefComplaint   = p.chiefComplaint
        workingDiagnosis = p.workingDiagnosis
        managementPlan   = p.managementPlan
        hpi              = p.hpi
        assessmentText   = p.assessmentText
        pmhNotes         = p.pmhNotes
        ward             = p.ward
        bedNumber        = p.bedNumber
        admittedAt       = p.admittedAt
        createdAt        = p.createdAt
        updatedAt        = p.updatedAt
    }
}

struct ClinicalNoteBackup: Codable {
    let id:              UUID
    let syncCode:        String
    let patientSyncCode: String
    let noteType:        String
    let status:          String
    let subjective:      String?
    let objective:       String?
    let assessment:      String?
    let plan:            String?
    let freeText:        String?
    let updatedAt:       Date

    init(_ n: ClinicalNote) {
        id              = n.id
        syncCode        = n.syncCode
        patientSyncCode = n.patient?.syncCode ?? ""
        noteType        = n.noteType.rawValue
        status          = n.status.rawValue
        subjective      = n.subjective
        objective       = n.objective
        assessment      = n.assessment
        plan            = n.plan
        freeText        = n.freeText
        updatedAt       = n.updatedAt
    }
}

struct PrescriptionBackup: Codable {
    let id:              UUID
    let syncCode:        String
    let patientSyncCode: String
    let drug:            String
    let dose:            String
    let route:           String
    let frequency:       String
    let duration:        String
    let indication:      String
    let prescribedAt:    Date

    init(_ rx: Prescription) {
        id              = rx.id
        syncCode        = rx.syncCode
        patientSyncCode = rx.patient?.syncCode ?? ""
        drug            = rx.drug
        dose            = rx.dose
        route           = rx.route
        frequency       = rx.frequency
        duration        = rx.duration
        indication      = rx.indication
        prescribedAt    = rx.prescribedAt
    }
}

struct VitalsBackup: Codable {
    let id:                 UUID
    let syncCode:           String
    let patientSyncCode:    String
    let recordedAt:         Date
    let heartRate:          Int?
    let bpSystolic:         Int?
    let bpDiastolic:        Int?
    let respiratoryRate:    Int?
    let temperatureCelsius: Double?
    let spo2:               Int?
    let weightKg:           Double?
    let glucoseMmol:        Double?

    init(_ v: VitalsEntry) {
        id                 = v.id
        syncCode           = v.syncCode
        patientSyncCode    = v.patient?.syncCode ?? ""
        recordedAt         = v.recordedAt
        heartRate          = v.heartRate
        bpSystolic         = v.bpSystolic
        bpDiastolic        = v.bpDiastolic
        respiratoryRate    = v.respiratoryRate
        temperatureCelsius = v.temperatureCelsius
        spo2               = v.spo2
        weightKg           = v.weightKg
        glucoseMmol        = v.glucoseMmol
    }
}
