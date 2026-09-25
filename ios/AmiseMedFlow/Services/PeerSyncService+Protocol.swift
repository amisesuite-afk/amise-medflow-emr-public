// PeerSyncService+Protocol.swift
// Peer message protocol and transfer data structs.

import Foundation

// MARK: - Message protocol

indirect enum PeerMessage: Codable {
    case manifest(PeerManifest)
    case patients([PeerPatient])
    case notes([PeerNote])
    case prescriptions([PeerPrescription])
    case vitals([PeerVitals])
    case billingItems([PeerBillingItem])

    private enum TypeKey: String, Codable {
        case manifest, patients, notes, prescriptions, vitals, billingItems
    }
    private enum CodingKeys: String, CodingKey { case type, payload }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .manifest(let v):      try c.encode(TypeKey.manifest, forKey: .type);      try c.encode(v, forKey: .payload)
        case .patients(let v):      try c.encode(TypeKey.patients, forKey: .type);      try c.encode(v, forKey: .payload)
        case .notes(let v):         try c.encode(TypeKey.notes, forKey: .type);         try c.encode(v, forKey: .payload)
        case .prescriptions(let v): try c.encode(TypeKey.prescriptions, forKey: .type); try c.encode(v, forKey: .payload)
        case .vitals(let v):        try c.encode(TypeKey.vitals, forKey: .type);        try c.encode(v, forKey: .payload)
        case .billingItems(let v):  try c.encode(TypeKey.billingItems, forKey: .type);  try c.encode(v, forKey: .payload)
        }
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let type = try c.decode(TypeKey.self, forKey: .type)
        switch type {
        case .manifest:      self = .manifest(try c.decode(PeerManifest.self, forKey: .payload))
        case .patients:      self = .patients(try c.decode([PeerPatient].self, forKey: .payload))
        case .notes:         self = .notes(try c.decode([PeerNote].self, forKey: .payload))
        case .prescriptions: self = .prescriptions(try c.decode([PeerPrescription].self, forKey: .payload))
        case .vitals:        self = .vitals(try c.decode([PeerVitals].self, forKey: .payload))
        case .billingItems:  self = .billingItems(try c.decode([PeerBillingItem].self, forKey: .payload))
        }
    }
}

// MARK: - Transfer data structs

struct PeerManifest: Codable {
    // Unused and sent empty: admission is the pairing handshake (PeerSyncService+Pairing.swift).
    // Kept so the manifest shape is unchanged.
    let emailHash:     String
    // syncCode → syncedAt epoch seconds (what older builds compare).
    let patients:      [String: Double]
    let notes:         [String: Double]
    let prescriptions: [String: Double]
    let vitals:        [String: Double]
    let billingItems:  [String: Double]
    // syncCode → stamp, max(updatedAt, syncedAt) (PeerVersion). nil from older builds, which
    // ignore these keys when they decode this build's manifest.
    let patientStamps:      [String: Double]?
    let noteStamps:         [String: Double]?
    let prescriptionStamps: [String: Double]?
    let vitalsStamps:       [String: Double]?
    let billingStamps:      [String: Double]?
}

struct PeerPatient: Codable {
    let syncCode: String       // stable offline sync ID
    let remoteId: String?      // Supabase ID if cloud-synced
    let fullName: String
    let sex, dob, phone, email, address, mrn: String?
    let nokName, nokRelation, nokPhone: String?
    let pmhNotes, familyHistoryNotes: String?
    let insuranceProvider, policyNumber: String?
    let setting, location, acuity: String?
    let visitType: String?
    let mallampatiScore: Int?
    let operationDate: String?
    let chiefComplaint, hpi, assessmentText, managementPlan: String?
    let workingDiagnosis, workingDiagnosisICD: String?
    let allergiesJson, investigationsJson, pmhEntriesJson, pshxEntriesJson: String?
    let socialHistory, surgicalHistory: String?
    let heightCm: Double?
    let ward, bedNumber: String?
    let examGeneral, examCVS, examResp, examAbdo: String?
    let examNeuro, examMSK, examSkin, examOther: String?
    let syncedAt: Double
    // Procedure form JSON blobs
    let traumaDataJson: String?
    let ogdDataJson: String?
    let colonoscopyDataJson: String?
    let surgeryDataJson: String?
    let ercpDataJson: String?
    let bronchoscopyDataJson: String?
    let dischargeSummaryDataJson: String?
    let postOpReviewDataJson: String?
    let referralLetterDataJson: String?
    let consentFormDataJson: String?
    let preOpChecklistDataJson: String?
    let patientInstructionsDataJson: String?
    // Consultation pathway forms (burns, wellness, ward review). Optional so payloads from
    // devices on an older build still decode.
    let pathwayDataJson: String?
    // NEWS2 SpO₂ Scale 2 opt-in (confirmed hypercapnic respiratory failure). Optional so payloads
    // and backups from older builds still decode; nil means "not sent" and never changes the flag.
    let news2UseSpO2Scale2: Bool?
    // The sender's pendingSync: true when its copy holds a change it has not uploaded to the
    // cloud yet. The receiver then keeps the change pending too (PeerApplyPending). Optional so
    // payloads and backups from older builds still decode (nil = unknown, treated as false).
    let pendingSync: Bool?
    // The sender's updatedAt (epoch seconds): with syncedAt, the copy's stamp (PeerVersion).
    // Optional so payloads and backups from older builds still decode (nil = merged by syncedAt).
    let updatedAt: Double?

    /// Sync bookkeeping, not record content: left out when comparing a patient before and after
    /// a peer's copy is applied (PeerSyncService.contentFingerprint, PeerFingerprint).
    static let bookkeepingKeys: Set<String> = ["syncCode", "remoteId", "syncedAt", "pendingSync",
                                               "updatedAt"]

    init(_ p: Patient) {
        let iso = ISO8601DateFormatter()
        syncCode        = p.syncCode.isEmpty ? p.id.uuidString : p.syncCode
        remoteId        = p.remoteId
        fullName        = p.fullName
        sex             = p.sex.rawValue.lowercased()
        dob             = p.dateOfBirth.map { iso.string(from: $0) }
        phone           = p.phone; email = p.email; address = p.address; mrn = p.mrn
        nokName         = p.nokName; nokRelation = p.nokRelation; nokPhone = p.nokPhone
        pmhNotes        = p.pmhNotes; familyHistoryNotes = p.familyHistoryNotes
        insuranceProvider = p.insuranceProvider; policyNumber = p.policyNumber
        setting         = p.setting.rawValue.lowercased()
        location        = p.location.rawValue
        acuity          = p.acuity.label.lowercased()
        visitType       = p.visitType?.rawValue
        mallampatiScore = p.mallampatiScore
        operationDate   = p.operationDate.map { iso.string(from: $0) }
        chiefComplaint  = p.chiefComplaint; hpi = p.hpi
        assessmentText  = p.assessmentText; managementPlan = p.managementPlan
        workingDiagnosis = p.workingDiagnosis; workingDiagnosisICD = p.workingDiagnosisICD
        allergiesJson   = p.allergiesJson; investigationsJson = p.investigationsJson
        pmhEntriesJson  = p.pmhEntriesJson; pshxEntriesJson = p.pshxEntriesJson
        socialHistory   = p.socialHistory; surgicalHistory = p.surgicalHistory
        heightCm        = p.heightCm; ward = p.ward; bedNumber = p.bedNumber
        examGeneral     = p.examGeneral; examCVS = p.examCVS; examResp = p.examResp
        examAbdo        = p.examAbdo; examNeuro = p.examNeuro; examMSK = p.examMSK
        examSkin        = p.examSkin; examOther = p.examOther
        syncedAt        = (p.syncedAt ?? .distantPast).timeIntervalSince1970
        traumaDataJson              = p.traumaDataJson
        ogdDataJson                 = p.ogdDataJson
        colonoscopyDataJson         = p.colonoscopyDataJson
        surgeryDataJson             = p.surgeryDataJson
        ercpDataJson                = p.ercpDataJson
        bronchoscopyDataJson        = p.bronchoscopyDataJson
        dischargeSummaryDataJson    = p.dischargeSummaryDataJson
        postOpReviewDataJson        = p.postOpReviewDataJson
        referralLetterDataJson      = p.referralLetterDataJson
        consentFormDataJson         = p.consentFormDataJson
        preOpChecklistDataJson      = p.preOpChecklistDataJson
        patientInstructionsDataJson = p.patientInstructionsDataJson
        pathwayDataJson             = p.pathwayDataJson
        news2UseSpO2Scale2          = p.news2UseSpO2Scale2
        pendingSync                 = p.pendingSync
        updatedAt                   = p.updatedAt.timeIntervalSince1970
    }
}

struct PeerNote: Codable {
    let syncCode, patientSyncCode: String
    let remoteId: String?
    let noteType, status, content: String
    let syncedAt: Double
    let pendingSync: Bool?   // sender's unsent-change flag; nil from older builds
    let updatedAt: Double?   // sender's updatedAt (PeerVersion stamp); nil from older builds

    init?(_ n: ClinicalNote) {
        guard let pid = n.patient?.syncCode, !pid.isEmpty else { return nil }
        syncCode        = n.syncCode.isEmpty ? n.id.uuidString : n.syncCode
        patientSyncCode = pid
        remoteId        = n.remoteId
        noteType        = n.noteType.rawValue
        status          = n.status.rawValue
        content         = n.contentForSync
        syncedAt        = (n.syncedAt ?? .distantPast).timeIntervalSince1970
        pendingSync     = n.pendingSync
        updatedAt       = n.updatedAt.timeIntervalSince1970
    }
}

struct PeerPrescription: Codable {
    let syncCode, patientSyncCode, drug: String
    let remoteId: String?
    let dose, route, frequency, duration, indication, instructions: String?
    let prescribedAt, syncedAt: Double
    let pendingSync: Bool?   // sender's unsent-change flag; nil from older builds
    let updatedAt: Double?   // sender's updatedAt; nil from older builds or a record never edited

    init(_ rx: Prescription) {
        syncCode        = rx.syncCode.isEmpty ? rx.id.uuidString : rx.syncCode
        patientSyncCode = rx.patient?.syncCode.isEmpty == false
                          ? rx.patient!.syncCode : rx.patient?.id.uuidString ?? ""
        remoteId        = rx.remoteId
        drug            = rx.drug
        dose            = rx.dose.isEmpty ? nil : rx.dose
        route           = rx.route.isEmpty ? nil : rx.route
        frequency       = rx.frequency.isEmpty ? nil : rx.frequency
        duration        = rx.duration.isEmpty ? nil : rx.duration
        indication      = rx.indication.isEmpty ? nil : rx.indication
        instructions    = rx.instructions
        prescribedAt    = rx.prescribedAt.timeIntervalSince1970
        syncedAt        = (rx.syncedAt ?? .distantPast).timeIntervalSince1970
        pendingSync     = rx.pendingSync
        updatedAt       = rx.updatedAt?.timeIntervalSince1970
    }
}

struct PeerVitals: Codable {
    let syncCode, patientSyncCode: String
    let remoteId: String?
    let recordedAt: Double
    let bpSystolic, bpDiastolic, heartRate, respiratoryRate: Int?
    let temperatureCelsius: Double?
    let spo2: Int?
    let weightKg, glucoseMmol: Double?
    let avpu: String
    let onSupplementalO2: Bool
    let notes: String?
    let syncedAt: Double
    let pendingSync: Bool?   // sender's unsent-change flag; nil from older builds
    let updatedAt: Double?   // sender's updatedAt; nil from older builds or a record never edited

    init(_ v: VitalsEntry) {
        syncCode           = v.syncCode.isEmpty ? v.id.uuidString : v.syncCode
        patientSyncCode    = v.patient?.syncCode.isEmpty == false
                             ? v.patient!.syncCode : v.patient?.id.uuidString ?? ""
        remoteId           = v.remoteId
        recordedAt         = v.recordedAt.timeIntervalSince1970
        bpSystolic         = v.bpSystolic; bpDiastolic = v.bpDiastolic
        heartRate          = v.heartRate; respiratoryRate = v.respiratoryRate
        temperatureCelsius = v.temperatureCelsius
        spo2               = v.spo2; weightKg = v.weightKg; glucoseMmol = v.glucoseMmol
        avpu               = v.avpu.rawValue; onSupplementalO2 = v.onSupplementalO2
        notes              = v.notes
        syncedAt           = (v.syncedAt ?? .distantPast).timeIntervalSince1970
        pendingSync        = v.pendingSync
        updatedAt          = v.updatedAt?.timeIntervalSince1970
    }
}

struct PeerBillingItem: Codable {
    let syncCode, patientSyncCode: String
    let remoteId: String?
    let cptCode, cptDescription, cptCategory: String
    let units: Int; let amountXCD: Double
    let modifier, note: String
    let addedAt, syncedAt: Double
    let pendingSync: Bool?   // sender's unsent-change flag; nil from older builds
    let updatedAt: Double?   // sender's updatedAt; nil from older builds or a record never edited

    init(_ b: BillingLineItem) {
        syncCode           = b.syncCode.isEmpty ? b.id.uuidString : b.syncCode
        patientSyncCode    = b.patient?.syncCode.isEmpty == false
                             ? b.patient!.syncCode : b.patient?.id.uuidString ?? ""
        remoteId           = b.remoteId
        cptCode            = b.cptCode; cptDescription = b.cptDescription; cptCategory = b.cptCategory
        units              = b.units; amountXCD = b.amountXCD
        modifier           = b.modifier; note = b.note
        addedAt            = b.addedAt.timeIntervalSince1970
        syncedAt           = (b.syncedAt ?? .distantPast).timeIntervalSince1970
        pendingSync        = b.pendingSync
        updatedAt          = b.updatedAt?.timeIntervalSince1970
    }
}
