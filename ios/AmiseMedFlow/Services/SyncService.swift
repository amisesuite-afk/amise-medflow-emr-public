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
    @Published var currentUserRole: UserRole = .frontDesk
    @Published var isSyncing: Bool = false
    @Published var syncError: String?

    private let monitor = NWPathMonitor()
    private let networkQueue = DispatchQueue(label: "com.amise.network")
    private var modelContext: ModelContext?
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
            let changes = await channel.postgresChange(AnyAction.self, schema: "public", table: "patients")
            await channel.subscribe()
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
            await fetchUserRole(userId: session.user.id)
        } catch {
            currentUserEmail = nil
        }
    }

    func signIn(email: String, password: String) async throws {
        let session = try await SupabaseConfig.client.auth.signIn(email: email, password: password)
        currentUserEmail = session.user.email
        await fetchUserRole(userId: session.user.id)
        await syncIfAuthenticated()
        startRealtime()
    }

    func signOut() async throws {
        try await SupabaseConfig.client.auth.signOut()
        currentUserEmail = nil
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
        let chief_complaint: String?
        let hpi: String?
        let assessment_text: String?
        let management_plan: String?
        let working_diagnosis: String?
        let working_diagnosis_icd: String?
        let allergies_json: String?
        let social_history: String?
        let height_cm: Double?
        let ward: String?
        let bed_number: String?
        let exam_general: String?
        let exam_cvs: String?
        let exam_resp: String?
        let exam_abdo: String?
        let exam_neuro: String?
        let exam_msk: String?
        let exam_skin: String?
        let exam_other: String?
        let encounter_status: String?
        let check_in_time: String?
        let created_at: String
    }

    private func pullPatients(context: ModelContext) async throws {
        let rows: [RemotePatient] = try await SupabaseConfig.client
            .from("patients")
            .select("id, full_name, sex, date_of_birth, phone, email, address, mrn, nok_name, nok_relation, nok_phone, pmh_notes, family_history_notes, insurance_provider, policy_number, setting, location, acuity, chief_complaint, hpi, assessment_text, management_plan, working_diagnosis, working_diagnosis_icd, allergies_json, social_history, height_cm, ward, bed_number, exam_general, exam_cvs, exam_resp, exam_abdo, exam_neuro, exam_msk, exam_skin, exam_other, encounter_status, check_in_time, created_at")
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
            // Clinical fields — only update from remote if local is still empty
            // (prefer local edits; remote is the source of truth only on first pull)
            if let cc = row.chief_complaint, (patient.chiefComplaint ?? "").isEmpty {
                patient.chiefComplaint = cc
            }
            if let hpi = row.hpi, (patient.hpi ?? "").isEmpty {
                patient.hpi = hpi
            }
            if let at = row.assessment_text, (patient.assessmentText ?? "").isEmpty {
                patient.assessmentText = at
            }
            if let mp = row.management_plan, (patient.managementPlan ?? "").isEmpty {
                patient.managementPlan = mp
            }
            if let wd = row.working_diagnosis, (patient.workingDiagnosis ?? "").isEmpty {
                patient.workingDiagnosis = wd
                patient.workingDiagnosisICD = row.working_diagnosis_icd
            }
            if let aj = row.allergies_json, (patient.allergiesJson ?? "").isEmpty {
                patient.allergiesJson = aj
            }
            if let sh = row.social_history, (patient.socialHistory ?? "").isEmpty {
                patient.socialHistory = sh
            }
            if let h = row.height_cm, patient.heightCm == nil { patient.heightCm = h }
            if let w = row.ward,   (patient.ward ?? "").isEmpty   { patient.ward = w }
            if let b = row.bed_number, (patient.bedNumber ?? "").isEmpty { patient.bedNumber = b }
            if let eg = row.exam_general, (patient.examGeneral ?? "").isEmpty { patient.examGeneral = eg }
            if let ec = row.exam_cvs,    (patient.examCVS ?? "").isEmpty     { patient.examCVS     = ec }
            if let er = row.exam_resp,   (patient.examResp ?? "").isEmpty    { patient.examResp    = er }
            if let ea = row.exam_abdo,   (patient.examAbdo ?? "").isEmpty    { patient.examAbdo    = ea }
            if let en = row.exam_neuro,  (patient.examNeuro ?? "").isEmpty   { patient.examNeuro   = en }
            if let em = row.exam_msk,    (patient.examMSK ?? "").isEmpty     { patient.examMSK     = em }
            if let es = row.exam_skin,   (patient.examSkin ?? "").isEmpty    { patient.examSkin    = es }
            if let eo = row.exam_other,  (patient.examOther ?? "").isEmpty   { patient.examOther   = eo }

            if let es = row.encounter_status {
                patient.encounterStatus = EncounterStatus(rawValue: es) ?? .notCheckedIn
            }
            if let ct = row.check_in_time {
                patient.checkInTime = iso.date(from: ct)
            }
            patient.syncedAt = .now
            // Only mark clean for patients created from this pull.
            // Existing dirty patients keep pendingSync=true so pushPatientEdits
            // can still flush their local edits in the same sync cycle.
            if existing == nil {
                patient.pendingSync = false
            }
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
                let date_of_birth: String?
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
                let chief_complaint: String?
                let hpi: String?
                let assessment_text: String?
                let management_plan: String?
                let allergies_json: String?
                let social_history: String?
                let height_cm: Double?
                let ward: String?
                let bed_number: String?
                let exam_general: String?
                let exam_cvs: String?
                let exam_resp: String?
                let exam_abdo: String?
                let exam_neuro: String?
                let exam_msk: String?
                let exam_skin: String?
                let exam_other: String?
                let encounter_status: String
                let check_in_time: String?
            }
            let isoFmt = ISO8601DateFormatter()
            let row = InsertRow(
                full_name: patient.fullName,
                sex: patient.sex.rawValue.lowercased(),
                date_of_birth: patient.dateOfBirth.map { isoFmt.string(from: $0) },
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
                acuity: patient.acuity.label.lowercased(),
                chief_complaint: patient.chiefComplaint,
                hpi: patient.hpi,
                assessment_text: patient.assessmentText,
                management_plan: patient.managementPlan,
                allergies_json: patient.allergiesJson,
                social_history: patient.socialHistory,
                height_cm: patient.heightCm,
                ward: patient.ward,
                bed_number: patient.bedNumber,
                exam_general: patient.examGeneral,
                exam_cvs: patient.examCVS,
                exam_resp: patient.examResp,
                exam_abdo: patient.examAbdo,
                exam_neuro: patient.examNeuro,
                exam_msk: patient.examMSK,
                exam_skin: patient.examSkin,
                exam_other: patient.examOther,
                encounter_status: patient.encounterStatus.rawValue,
                check_in_time: patient.checkInTime.map { isoFmt.string(from: $0) }
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
        let rows: [RemoteAppointment]
        do {
            rows = try await SupabaseConfig.client
                .from("appointment_requests")
                .select("id, patient_name, patient_phone, patient_email, reason, preferred_slot, status, created_at")
                .in("status", values: ["staff_confirmed", "patient_confirmed"])
                .gte("created_at", value: oneWeekAgo)
                .order("created_at", ascending: false)
                .limit(200)
                .execute()
                .value
        } catch {
            // appointment_requests schema varies across deployments — skip without failing the whole sync
            return
        }

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
                let chief_complaint: String?
                let hpi: String?
                let assessment_text: String?
                let management_plan: String?
                let allergies_json: String?
                let social_history: String?
                let height_cm: Double?
                let ward: String?
                let bed_number: String?
                let exam_general: String?
                let exam_cvs: String?
                let exam_resp: String?
                let exam_abdo: String?
                let exam_neuro: String?
                let exam_msk: String?
                let exam_skin: String?
                let exam_other: String?
                let encounter_status: String
                let check_in_time: String?
                let updated_at: String
            }
            let iso = ISO8601DateFormatter()
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
                acuity: patient.acuity.label.lowercased(),
                chief_complaint: patient.chiefComplaint,
                hpi: patient.hpi,
                assessment_text: patient.assessmentText,
                management_plan: patient.managementPlan,
                allergies_json: patient.allergiesJson,
                social_history: patient.socialHistory,
                height_cm: patient.heightCm,
                ward: patient.ward,
                bed_number: patient.bedNumber,
                exam_general: patient.examGeneral,
                exam_cvs: patient.examCVS,
                exam_resp: patient.examResp,
                exam_abdo: patient.examAbdo,
                exam_neuro: patient.examNeuro,
                exam_msk: patient.examMSK,
                exam_skin: patient.examSkin,
                exam_other: patient.examOther,
                encounter_status: patient.encounterStatus.rawValue,
                check_in_time: patient.checkInTime.map { iso.string(from: $0) },
                updated_at: iso.string(from: patient.updatedAt)
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
                ai_assisted: note.isAIAssisted
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

    // MARK: - Prescription sync

    private func pushPendingPrescriptions(context: ModelContext) async throws {
        let pending = try context.fetch(FetchDescriptor<Prescription>())
            .filter { $0.pendingSync && $0.remoteId == nil }
        guard !pending.isEmpty else { return }

        let iso = ISO8601DateFormatter()

        for rx in pending {
            guard let patientId = rx.patient?.remoteId else { continue }

            struct RxRow: Encodable {
                let patient_id: String
                let drug: String
                let dose: String?
                let route: String?
                let frequency: String?
                let duration: String?
                let indication: String?
                let instructions: String?
                let prescribed_at: String
            }
            let row = RxRow(
                patient_id: patientId,
                drug: rx.drug,
                dose: rx.dose.isEmpty ? nil : rx.dose,
                route: rx.route.isEmpty ? nil : rx.route,
                frequency: rx.frequency.isEmpty ? nil : rx.frequency,
                duration: rx.duration.isEmpty ? nil : rx.duration,
                indication: rx.indication.isEmpty ? nil : rx.indication,
                instructions: rx.instructions,
                prescribed_at: iso.string(from: rx.prescribedAt)
            )
            struct RxResponse: Decodable { let id: String }
            let response: [RxResponse] = try await SupabaseConfig.client
                .from("prescriptions")
                .insert(row)
                .select("id")
                .execute()
                .value
            if let first = response.first {
                rx.remoteId = first.id
                rx.pendingSync = false
                rx.syncedAt = .now
            }
        }
        try context.save()
    }

    private struct RemotePrescription: Decodable {
        let id: String
        let patient_id: String
        let drug: String
        let dose: String?
        let route: String?
        let frequency: String?
        let duration: String?
        let indication: String?
        let instructions: String?
        let prescribed_at: String
    }

    private func pullPrescriptions(context: ModelContext) async throws {
        let rows: [RemotePrescription] = try await SupabaseConfig.client
            .from("prescriptions")
            .select("id, patient_id, drug, dose, route, frequency, duration, indication, instructions, prescribed_at")
            .order("prescribed_at", ascending: false)
            .limit(500)
            .execute()
            .value

        let allLocal = try context.fetch(FetchDescriptor<Prescription>())
        let allPatients = try context.fetch(FetchDescriptor<Patient>())
        let iso = ISO8601DateFormatter()

        for row in rows {
            guard allLocal.first(where: { $0.remoteId == row.id }) == nil else { continue }
            guard let patient = allPatients.first(where: { $0.remoteId == row.patient_id }) else { continue }

            let rx = Prescription(drug: row.drug,
                                  dose: row.dose ?? "",
                                  route: row.route ?? "Oral",
                                  frequency: row.frequency ?? "",
                                  duration: row.duration ?? "",
                                  indication: row.indication ?? "")
            rx.instructions = row.instructions
            rx.prescribedAt = iso.date(from: row.prescribed_at) ?? .now
            rx.patient = patient
            rx.remoteId = row.id
            rx.pendingSync = false
            rx.syncedAt = .now
            context.insert(rx)
        }
        try context.save()
    }

    // MARK: - Vitals sync

    private func pushPendingVitals(context: ModelContext) async throws {
        let pending = try context.fetch(FetchDescriptor<VitalsEntry>())
            .filter { $0.pendingSync && $0.remoteId == nil && $0.hasAnyValue }
        guard !pending.isEmpty else { return }

        let iso = ISO8601DateFormatter()

        for v in pending {
            guard let patientId = v.patient?.remoteId else { continue }

            struct VRow: Encodable {
                let patient_id: String
                let recorded_at: String
                let bp_systolic: Int?
                let bp_diastolic: Int?
                let heart_rate: Int?
                let respiratory_rate: Int?
                let temperature_c: Double?
                let spo2: Int?
                let weight_kg: Double?
                let glucose_mmol: Double?
                let avpu: String
                let on_supplemental_o2: Bool
                let notes: String?
            }
            let row = VRow(
                patient_id: patientId,
                recorded_at: iso.string(from: v.recordedAt),
                bp_systolic: v.bpSystolic,
                bp_diastolic: v.bpDiastolic,
                heart_rate: v.heartRate,
                respiratory_rate: v.respiratoryRate,
                temperature_c: v.temperatureCelsius,
                spo2: v.spo2,
                weight_kg: v.weightKg,
                glucose_mmol: v.glucoseMmol,
                avpu: v.avpu.rawValue,
                on_supplemental_o2: v.onSupplementalO2,
                notes: v.notes
            )
            struct VResponse: Decodable { let id: String }
            let response: [VResponse] = try await SupabaseConfig.client
                .from("patient_vitals")
                .insert(row)
                .select("id")
                .execute()
                .value
            if let first = response.first {
                v.remoteId = first.id
                v.pendingSync = false
                v.syncedAt = .now
            }
        }
        try context.save()
    }

    private struct RemoteVitals: Decodable {
        let id: String
        let patient_id: String
        let recorded_at: String
        let bp_systolic: Int?
        let bp_diastolic: Int?
        let heart_rate: Int?
        let respiratory_rate: Int?
        let temperature_c: Double?
        let spo2: Int?
        let weight_kg: Double?
        let glucose_mmol: Double?
        let avpu: String?
        let on_supplemental_o2: Bool?
        let notes: String?
    }

    private func pullVitals(context: ModelContext) async throws {
        let rows: [RemoteVitals] = try await SupabaseConfig.client
            .from("patient_vitals")
            .select("id, patient_id, recorded_at, bp_systolic, bp_diastolic, heart_rate, respiratory_rate, temperature_c, spo2, weight_kg, glucose_mmol, avpu, on_supplemental_o2, notes")
            .order("recorded_at", ascending: false)
            .limit(1000)
            .execute()
            .value

        let allLocal = try context.fetch(FetchDescriptor<VitalsEntry>())
        let allPatients = try context.fetch(FetchDescriptor<Patient>())
        let iso = ISO8601DateFormatter()

        for row in rows {
            guard allLocal.first(where: { $0.remoteId == row.id }) == nil else { continue }
            guard let patient = allPatients.first(where: { $0.remoteId == row.patient_id }) else { continue }

            let entry = VitalsEntry(patient: patient,
                                   recordedAt: iso.date(from: row.recorded_at) ?? .now)
            entry.bpSystolic       = row.bp_systolic
            entry.bpDiastolic      = row.bp_diastolic
            entry.heartRate        = row.heart_rate
            entry.respiratoryRate  = row.respiratory_rate
            entry.temperatureCelsius = row.temperature_c
            entry.spo2             = row.spo2
            entry.weightKg         = row.weight_kg
            entry.glucoseMmol      = row.glucose_mmol
            entry.avpu             = AVPU(rawValue: row.avpu ?? "A") ?? .alert
            entry.onSupplementalO2 = row.on_supplemental_o2 ?? false
            entry.notes            = row.notes
            entry.remoteId         = row.id
            entry.pendingSync      = false
            entry.syncedAt         = .now
            context.insert(entry)
        }
        try context.save()
    }

    // MARK: - Document metadata pull (re-hydrates the doc list after reinstall)

    private struct RemoteDocument: Decodable {
        let id: String
        let patient_id: String
        let file_name: String
        let mime_type: String
        let storage_url: String?
        let ai_summary: String?
        let extracted_text: String?
        let category: String?
    }

    private func pullDocumentMetadata(context: ModelContext) async throws {
        let rows: [RemoteDocument] = try await SupabaseConfig.client
            .from("patient_documents")
            .select("id, patient_id, file_name, mime_type, storage_url, ai_summary, extracted_text, category")
            .order("uploaded_at", ascending: false)
            .limit(500)
            .execute()
            .value

        let allLocalDocs = try context.fetch(FetchDescriptor<PatientDocument>())
        let allPatients  = try context.fetch(FetchDescriptor<Patient>())

        for row in rows {
            guard allLocalDocs.first(where: { $0.remoteId == row.id }) == nil else { continue }
            guard let patient = allPatients.first(where: { $0.remoteId == row.patient_id }) else { continue }

            let doc = PatientDocument(fileName: row.file_name,
                                     mimeType: row.mime_type,
                                     category: row.category)
            doc.storageUrl    = row.storage_url
            doc.aiSummary     = row.ai_summary
            doc.extractedText = row.extracted_text
            doc.remoteId      = row.id
            doc.patient       = patient
            context.insert(doc)
        }
        try context.save()
    }

    // MARK: - Operative plan sync (push-only; plan is per-patient and upserted)

    private func pushPendingOperativePlans(context: ModelContext) async throws {
        let pending = try context.fetch(FetchDescriptor<OperativePlan>())
            .filter { $0.pendingSync }
        guard !pending.isEmpty else { return }

        let iso = ISO8601DateFormatter()

        for plan in pending {
            guard let patientId = plan.patient?.remoteId else { continue }

            let whoDict: [String: Bool] = [
                "identity":           plan.whoIdentityConfirmed,
                "site_marked":        plan.whoSiteMarked,
                "anaesthesia_check":  plan.whoAnaesthesiaCheckDone,
                "pulse_ox":           plan.whoPulseOxOk,
                "allergies":          plan.whoAllergiesReviewed,
                "aspiration_risk":    plan.whoAspirationRisk,
                "airway_risk":        plan.whoAirwayRisk,
                "team_introduced":    plan.whoTeamIntroduced,
                "procedure_confirmed":plan.whoProcedureConfirmed,
                "antibiotic_given":   plan.whoAntibioticGiven,
                "critical_steps":     plan.whoCriticalStepsDiscussed,
                "imaging_displayed":  plan.whoImagingDisplayed,
                "sterility":          plan.whoSterilityConfirmed,
                "swabs_counted":      plan.whoSwabsCounted,
                "specimen_labelled":  plan.whoSpecimenLabelled,
                "equipment_issues":   plan.whoEquipmentIssues,
                "recovery_concerns":  plan.whoRecoveryConcerns,
            ]
            let whoJSON = (try? JSONSerialization.data(withJSONObject: whoDict))
                .flatMap { String(data: $0, encoding: .utf8) } ?? "{}"

            struct PlanRow: Encodable {
                let patient_id: String
                let updated_at: String
                let consent_procedure: String
                let consent_signed: Bool
                let anaesthesia_type: String
                let positioning: String
                let antibiotic_prophylaxis: String
                let vte_prophy: String
                let special_equipment: String
                let surgical_team_note: String
                let who_checklist: String   // raw JSON string; Supabase coerces to JSONB
            }
            let row = PlanRow(
                patient_id: patientId,
                updated_at: iso.string(from: plan.updatedAt),
                consent_procedure: plan.consentProcedure,
                consent_signed: plan.consentSigned,
                anaesthesia_type: plan.anaesthesiaType,
                positioning: plan.positioning,
                antibiotic_prophylaxis: plan.antibioticProphylaxis,
                vte_prophy: plan.vteProphy,
                special_equipment: plan.specialEquipment,
                surgical_team_note: plan.surgicalTeamNote,
                who_checklist: whoJSON
            )

            if let remoteId = plan.remoteId {
                // Update existing row
                try await SupabaseConfig.client
                    .from("patient_operative_plans")
                    .update(row)
                    .eq("id", value: remoteId)
                    .execute()
            } else {
                // Insert new row
                struct PlanResponse: Decodable { let id: String }
                let response: [PlanResponse] = try await SupabaseConfig.client
                    .from("patient_operative_plans")
                    .insert(row)
                    .select("id")
                    .execute()
                    .value
                if let first = response.first { plan.remoteId = first.id }
            }
            plan.pendingSync = false
        }
        try context.save()
    }

    private struct RemoteOperativePlan: Decodable {
        let id: String
        let patient_id: String
        let consent_procedure: String
        let consent_signed: Bool
        let anaesthesia_type: String
        let positioning: String
        let antibiotic_prophylaxis: String
        let vte_prophy: String
        let special_equipment: String
        let surgical_team_note: String
        let who_checklist: String?   // JSONB arrives as a JSON string
        let updated_at: String
    }

    private func pullOperativePlans(context: ModelContext) async throws {
        let rows: [RemoteOperativePlan] = try await SupabaseConfig.client
            .from("patient_operative_plans")
            .select("id, patient_id, consent_procedure, consent_signed, anaesthesia_type, positioning, antibiotic_prophylaxis, vte_prophy, special_equipment, surgical_team_note, who_checklist, updated_at")
            .order("updated_at", ascending: false)
            .limit(500)
            .execute()
            .value

        let allLocal = try context.fetch(FetchDescriptor<OperativePlan>())
        let allPatients = try context.fetch(FetchDescriptor<Patient>())
        let iso = ISO8601DateFormatter()

        for row in rows {
            guard let patient = allPatients.first(where: { $0.remoteId == row.patient_id }) else { continue }

            let plan: OperativePlan
            if let existing = allLocal.first(where: { $0.remoteId == row.id }) {
                plan = existing
            } else if let existing = allLocal.first(where: { $0.patient?.remoteId == row.patient_id }) {
                // Match by patient when remoteId not yet set locally
                plan = existing
            } else {
                plan = OperativePlan()
                plan.patient = patient
                context.insert(plan)
            }

            plan.remoteId = row.id
            if (plan.consentProcedure).isEmpty     { plan.consentProcedure      = row.consent_procedure }
            plan.consentSigned                     = row.consent_signed
            if (plan.anaesthesiaType).isEmpty      { plan.anaesthesiaType       = row.anaesthesia_type }
            if (plan.positioning).isEmpty          { plan.positioning            = row.positioning }
            if (plan.antibioticProphylaxis).isEmpty { plan.antibioticProphylaxis = row.antibiotic_prophylaxis }
            if (plan.vteProphy).isEmpty            { plan.vteProphy             = row.vte_prophy }
            if (plan.specialEquipment).isEmpty     { plan.specialEquipment      = row.special_equipment }
            if (plan.surgicalTeamNote).isEmpty     { plan.surgicalTeamNote      = row.surgical_team_note }
            plan.updatedAt = iso.date(from: row.updated_at) ?? .now

            // Restore WHO checklist booleans from JSONB
            if let jsonStr = row.who_checklist,
               let data = jsonStr.data(using: .utf8),
               let dict = try? JSONSerialization.jsonObject(with: data) as? [String: Bool] {
                plan.whoIdentityConfirmed         = dict["identity"] ?? plan.whoIdentityConfirmed
                plan.whoSiteMarked                = dict["site_marked"] ?? plan.whoSiteMarked
                plan.whoAnaesthesiaCheckDone      = dict["anaesthesia_check"] ?? plan.whoAnaesthesiaCheckDone
                plan.whoPulseOxOk                 = dict["pulse_ox"] ?? plan.whoPulseOxOk
                plan.whoAllergiesReviewed         = dict["allergies"] ?? plan.whoAllergiesReviewed
                plan.whoAspirationRisk            = dict["aspiration_risk"] ?? plan.whoAspirationRisk
                plan.whoAirwayRisk                = dict["airway_risk"] ?? plan.whoAirwayRisk
                plan.whoTeamIntroduced            = dict["team_introduced"] ?? plan.whoTeamIntroduced
                plan.whoProcedureConfirmed        = dict["procedure_confirmed"] ?? plan.whoProcedureConfirmed
                plan.whoAntibioticGiven           = dict["antibiotic_given"] ?? plan.whoAntibioticGiven
                plan.whoCriticalStepsDiscussed    = dict["critical_steps"] ?? plan.whoCriticalStepsDiscussed
                plan.whoImagingDisplayed          = dict["imaging_displayed"] ?? plan.whoImagingDisplayed
                plan.whoSterilityConfirmed        = dict["sterility"] ?? plan.whoSterilityConfirmed
                plan.whoSwabsCounted              = dict["swabs_counted"] ?? plan.whoSwabsCounted
                plan.whoSpecimenLabelled          = dict["specimen_labelled"] ?? plan.whoSpecimenLabelled
                plan.whoEquipmentIssues           = dict["equipment_issues"] ?? plan.whoEquipmentIssues
                plan.whoRecoveryConcerns          = dict["recovery_concerns"] ?? plan.whoRecoveryConcerns
            }
            plan.pendingSync = false
        }
        try context.save()
    }

    // MARK: - Billing item sync

    private func pushPendingBillingItems(context: ModelContext) async throws {
        let pending = try context.fetch(FetchDescriptor<BillingLineItem>())
            .filter { $0.pendingSync && $0.remoteId == nil }
        guard !pending.isEmpty else { return }

        let iso = ISO8601DateFormatter()

        for item in pending {
            guard let patientId = item.patient?.remoteId else { continue }

            struct BilRow: Encodable {
                let patient_id: String
                let cpt_code: String
                let cpt_description: String
                let cpt_category: String
                let units: Int
                let amount_xcd: Double
                let modifier: String
                let note: String
                let added_at: String
            }
            let row = BilRow(
                patient_id: patientId,
                cpt_code: item.cptCode,
                cpt_description: item.cptDescription,
                cpt_category: item.cptCategory,
                units: item.units,
                amount_xcd: item.amountXCD,
                modifier: item.modifier,
                note: item.note,
                added_at: iso.string(from: item.addedAt)
            )
            struct BilResponse: Decodable { let id: String }
            let response: [BilResponse] = try await SupabaseConfig.client
                .from("patient_billing_items")
                .insert(row)
                .select("id")
                .execute()
                .value
            if let first = response.first {
                item.remoteId = first.id
                item.pendingSync = false
                item.syncedAt = .now
            }
        }
        try context.save()
    }

    private struct RemoteBillingItem: Decodable {
        let id: String
        let patient_id: String
        let cpt_code: String
        let cpt_description: String
        let cpt_category: String
        let units: Int
        let amount_xcd: Double
        let modifier: String
        let note: String
        let added_at: String
    }

    private func pullBillingItems(context: ModelContext) async throws {
        let rows: [RemoteBillingItem] = try await SupabaseConfig.client
            .from("patient_billing_items")
            .select("id, patient_id, cpt_code, cpt_description, cpt_category, units, amount_xcd, modifier, note, added_at")
            .order("added_at", ascending: false)
            .limit(1000)
            .execute()
            .value

        let allLocal = try context.fetch(FetchDescriptor<BillingLineItem>())
        let allPatients = try context.fetch(FetchDescriptor<Patient>())
        let iso = ISO8601DateFormatter()

        for row in rows {
            guard allLocal.first(where: { $0.remoteId == row.id }) == nil else { continue }
            guard let patient = allPatients.first(where: { $0.remoteId == row.patient_id }) else { continue }

            let item = BillingLineItem(code: row.cpt_code,
                                      description: row.cpt_description,
                                      category: row.cpt_category)
            item.units      = row.units
            item.amountXCD  = row.amount_xcd
            item.modifier   = row.modifier
            item.note       = row.note
            item.addedAt    = iso.date(from: row.added_at) ?? .now
            item.patient    = patient
            item.remoteId   = row.id
            item.pendingSync = false
            item.syncedAt   = .now
            context.insert(item)
        }
        try context.save()
    }

    // MARK: - Pending count

    private func recountPending(context: ModelContext) {
        let pCount = (try? context.fetch(FetchDescriptor<Patient>()))?.filter { $0.pendingSync }.count ?? 0
        let nCount = (try? context.fetch(FetchDescriptor<ClinicalNote>()))?.filter { $0.pendingSync }.count ?? 0
        let rxCount = (try? context.fetch(FetchDescriptor<Prescription>()))?.filter { $0.pendingSync }.count ?? 0
        let vCount  = (try? context.fetch(FetchDescriptor<VitalsEntry>()))?.filter { $0.pendingSync }.count ?? 0
        let opCount  = (try? context.fetch(FetchDescriptor<OperativePlan>()))?.filter { $0.pendingSync }.count ?? 0
        let bilCount = (try? context.fetch(FetchDescriptor<BillingLineItem>()))?.filter { $0.pendingSync }.count ?? 0
        pendingCount = pCount + nCount + rxCount + vCount + opCount + bilCount
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
        let entries = loadOutbox()
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
                case "prescription":
                    let all = try ctx.fetch(FetchDescriptor<Prescription>())
                    if let rx = all.first(where: { $0.id.uuidString == entry.entityId }) {
                        rx.pendingSync = true
                    }
                case "vitals":
                    let all = try ctx.fetch(FetchDescriptor<VitalsEntry>())
                    if let v = all.first(where: { $0.id.uuidString == entry.entityId }) {
                        v.pendingSync = true
                    }
                case "operative_plan":
                    let all = try ctx.fetch(FetchDescriptor<OperativePlan>())
                    if let op = all.first(where: { $0.id.uuidString == entry.entityId }) {
                        op.pendingSync = true
                    }
                case "billing_item":
                    let all = try ctx.fetch(FetchDescriptor<BillingLineItem>())
                    if let bil = all.first(where: { $0.id.uuidString == entry.entityId }) {
                        bil.pendingSync = true
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
            try? await pushPendingPrescriptions(context: ctx)
            try? await pushPendingVitals(context: ctx)
            try? await pushPendingOperativePlans(context: ctx)
            try? await pullOperativePlans(context: ctx)
            try? await pushPendingBillingItems(context: ctx)
            try? await pullBillingItems(context: ctx)
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
