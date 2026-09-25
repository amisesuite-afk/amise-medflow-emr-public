// PatientScoreAutoPopulator+Perioperative.swift
// Perioperative / Surgical risk auto-populate functions
// No AI, no network — HIPAA-safe. Surgeon retains full authority.

import Foundation

extension PatientScoreAutoPopulator {

    static func cfs(patient: Patient) -> (ClinicalFrailtyInput, ScoreAutoFill) {
        var i = ClinicalFrailtyInput()
        var f = ScoreAutoFill()
        let allText = ScoreText([patient.chiefComplaint, patient.hpi, patient.assessmentText,
                       patient.examGeneral, patient.pmhNotes, patient.notes])

        // Try to infer frailty level from clinical text keywords
        if allText.contains("terminally ill") || allText.contains("terminal") ||
           allText.contains("end of life") || allText.contains("prognosis <6") {
            i.level = 9
            f.addAutoFilled(key: "level", label: "Terminal illness suspected from clinical text (CFS 9) — verify", source: "Clinical text")
        } else if allText.contains("very severely frail") || allText.contains("completely dependent") {
            i.level = 8
            f.addAutoFilled(key: "level", label: "Very severe frailty suggested from clinical text (CFS 8) — verify", source: "Clinical text")
        } else if allText.contains("severely frail") || allText.contains("severe frail") {
            i.level = 7
            f.addAutoFilled(key: "level", label: "Severe frailty suggested from clinical text (CFS 7) — verify", source: "Clinical text")
        } else if allText.contains("moderately frail") || allText.contains("moderate frail") {
            i.level = 6
            f.addAutoFilled(key: "level", label: "Moderate frailty suggested from clinical text (CFS 6) — verify", source: "Clinical text")
        } else if allText.contains("mildly frail") || allText.contains("mild frail") || allText.contains("frail") {
            i.level = 5
            f.addAutoFilled(key: "level", label: "Mild frailty suggested from clinical text (CFS 5) — verify", source: "Clinical text")
        } else {
            f.addPending(key: "level", label: "CFS level (1–9) — requires direct functional assessment; assess ADLs, mobility, energy", source: "Clinical assessment")
        }
        return (i, f)
    }

    // MARK: - Mallampati Airway Classification

    static func mallampati(patient: Patient) -> (MallampatiInput, ScoreAutoFill) {
        var i = MallampatiInput()
        var f = ScoreAutoFill()
        let allText = ScoreText([patient.chiefComplaint, patient.hpi, patient.assessmentText,
                       patient.examGeneral, patient.pmhNotes, patient.notes])

        // Obesity predictor from clinical text or BMI
        if allText.contains("obese") || allText.contains("obesity") ||
           allText.contains("bmi ≥30") || allText.contains("bmi >30") ||
           allText.contains("bmi>30") || allText.contains("morbid") ||
           allText.contains("neck circumference") {
            i.obesity = true
            f.addAutoFilled(key: "obesity", label: "Obesity / large neck detected in clinical text", source: "Clinical text")
        }

        // Retrognathia from clinical text
        if allText.contains("retrognath") || allText.contains("micrognath") ||
           allText.contains("receding jaw") || allText.contains("small mandible") {
            i.retrognathia = true
            f.addAutoFilled(key: "retrognathia", label: "Retrognathia / micrognathia noted in clinical text", source: "Clinical text")
        }

        // Mallampati class requires direct examination — mark pending
        f.addPending(key: "mallampatiClass", label: "Mallampati class (I–IV) — requires direct oropharyngeal examination", source: "Physical examination")
        f.addPending(key: "mouthOpening", label: "Mouth opening — requires physical measurement", source: "Physical examination")
        f.addPending(key: "neckMobility", label: "Neck extension — requires physical assessment", source: "Physical examination")
        f.addPending(key: "thyromental", label: "Thyromental distance — requires physical measurement", source: "Physical examination")
        return (i, f)
    }

    // MARK: - HEART Score

    static func surgicalApgar(patient: Patient) -> (SurgicalApgarInput, ScoreAutoFill) {
        let i = SurgicalApgarInput()
        var f = ScoreAutoFill()
        // All three variables (EBL, lowest MAP, lowest HR) are intraoperative measurements
        // that require the anaesthetic or operative record — cannot be auto-populated from
        // pre-operative or administrative fields.
        f.addPending(key: "estimatedBloodLoss",
            label: "Estimated blood loss (mL) — requires operative/anaesthetic record",
            source: "Operative record")
        f.addPending(key: "lowestMAP",
            label: "Lowest intraoperative MAP (mmHg) — requires anaesthetic record",
            source: "Anaesthetic record")
        f.addPending(key: "lowestHeartRate",
            label: "Lowest intraoperative heart rate (bpm) — requires anaesthetic record",
            source: "Anaesthetic record")
        return (i, f)
    }

    // MARK: - Waterlow Pressure Ulcer Risk

    static func waterlow(patient: Patient) -> (WaterlowInput, ScoreAutoFill) {
        var i = WaterlowInput()
        var f = ScoreAutoFill()
        let allText = ScoreText([patient.chiefComplaint, patient.hpi, patient.assessmentText,
                       patient.examGeneral, patient.examSkin, patient.pmhNotes,
                       patient.notes, patient.workingDiagnosis])

        // Sex and age combined score
        if let dob = patient.dateOfBirth {
            let age = Calendar.current.dateComponents([.year], from: dob, to: Date()).year ?? 0
            let isMale = patient.sex == .male
            let sexAge: Int = switch age {
            case 81...:     5
            case 75...80:   isMale ? 3 : 4
            case 65...74:   isMale ? 2 : 3
            case 50...64:   isMale ? 1 : 2
            default:        isMale ? 0 : 1
            }
            i.sexAge = sexAge
            f.addAutoFilled(key: "sexAge", label: "Sex/age band \(sexAge) (from DOB + sex)", source: "Demographics")
        } else {
            f.addPending(key: "sexAge", label: "Sex/age combination — requires DOB", source: "Demographics")
        }

        // Obesity from clinical text
        if allText.contains("obese") || allText.contains("obesity") ||
           allText.contains("morbid") || allText.contains("bmi >30") ||
           allText.contains("bmi>30") || allText.contains("bmi ≥30") {
            i.buildWeight = 2
            f.addAutoFilled(key: "buildWeight", label: "Obesity detected in clinical text — verify weight category", source: "Clinical text")
        }

        // Tissue malnutrition risk factors
        if allText.contains("cachex") || allText.contains("terminal") ||
           allText.contains("cardiac failure") || allText.contains("heart failure") ||
           allText.contains("peripheral vascular") || allText.contains("anaemia") ||
           allText.contains("anemia") || allText.contains("smok") {
            i.tissuemalnutrition = true
            f.addAutoFilled(key: "tissuemalnutrition", label: "Tissue malnutrition risk factor detected — verify", source: "Clinical text / PMH")
        }

        // Neurological deficit
        if allText.contains("diabet") || allText.contains("paraplegia") ||
           allText.contains("paraplegi") || allText.contains("motor deficit") ||
           allText.contains("sensory deficit") || allText.contains("neuropath") {
            i.neurologicalDeficit = true
            f.addAutoFilled(key: "neurologicalDeficit", label: "Neurological deficit risk factor detected — verify", source: "Clinical text / PMH")
        }

        // Major surgery — orthopaedic / spinal / prolonged table
        if allText.contains("orthopaedic") || allText.contains("orthopedic") ||
           allText.contains("hip replacement") || allText.contains("knee replacement") ||
           allText.contains("spinal surgery") || allText.contains("spinal operation") ||
           allText.contains("laminect") || allText.contains("discectomy") {
            i.majorSurgery = true
            f.addAutoFilled(key: "majorSurgery", label: "Major orthopaedic/spinal surgery risk factor detected — verify", source: "Clinical text / surgical history")
        }

        // Skin type, continence, mobility, appetite require bedside assessment
        f.addPending(key: "skinType", label: "Skin type / visual risk area — requires bedside inspection", source: "Nursing assessment")
        f.addPending(key: "continence", label: "Continence status — requires nursing assessment", source: "Nursing assessment")
        f.addPending(key: "mobility", label: "Mobility level — requires clinical or nursing assessment", source: "Nursing assessment")
        f.addPending(key: "appetite", label: "Appetite / nutritional intake — requires dietary or nursing assessment", source: "Nursing assessment")
        return (i, f)
    }

    // MARK: - EuroSCORE II (Cardiac Surgery Operative Mortality)

    // MARK: - Charlson Comorbidity Index (#76)
    static func cci(patient: Patient) -> (ClinicalScoringEngine.CCIInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.CCIInput()
        var f = ScoreAutoFill()
        let text = ScoreText([patient.chiefComplaint, patient.workingDiagnosis, patient.hpi,
                    patient.assessmentText, patient.managementPlan, patient.pmhNotes])

        // Age from DOB
        if let dob = patient.dateOfBirth {
            i.age = Calendar.current.dateComponents([.year], from: dob, to: .now).year ?? 60
        }

        let kw: [(String, [String], String)] = [
            ("myocardialInfarction",       ["myocardial infarction", "heart attack", "mi ", "stemi", "nstemi", "previous mi"], "MI / myocardial infarction — confirm from PMH"),
            ("congestiveHeartFailure",     ["heart failure", "congestive heart failure", "chf", "cardiomyopathy", "lv dysfunction"], "Congestive heart failure — confirm from PMH"),
            ("peripheralVascularDisease",  ["peripheral vascular", "pvd", "pad ", "peripheral arterial", "claudication", "aortic aneurysm"], "Peripheral vascular disease — confirm from PMH"),
            ("cerebrovascularDisease",     ["cerebrovascular", "stroke", "tia", "transient ischaemic", "cva "], "Cerebrovascular disease — confirm from PMH"),
            ("dementia",                   ["dementia", "alzheimer", "vascular dementia", "cognitive impairment"], "Dementia — confirm from PMH"),
            ("chronicPulmonaryDisease",    ["copd", "emphysema", "chronic obstructive", "chronic bronchitis", "asthma", "bronchiectasis"], "Chronic pulmonary disease — confirm from PMH"),
            ("connectiveTissueDisease",    ["rheumatoid arthritis", "sle", "lupus", "connective tissue", "systemic sclerosis", "polymyalgia", "vasculitis"], "Connective tissue disease — confirm from PMH"),
            ("pepticulcer",                ["peptic ulcer", "gastric ulcer", "duodenal ulcer", "pud "], "Peptic ulcer disease — confirm from PMH"),
            ("mildLiverDisease",           ["mild liver disease", "hepatitis", "fatty liver", "nafld", "nash", "cirrhosis without portal"], "Mild liver disease — confirm from PMH"),
            ("diabetesUncomplicated",      ["diabetes mellitus", "type 1 diabetes", "type 2 diabetes", "t2dm", "t1dm", "dm type"], "Diabetes (uncomplicated) — confirm from PMH"),
            ("diabetesWithEndOrganDamage", ["diabetic nephropathy", "diabetic retinopathy", "diabetic neuropathy", "diabetes with complications"], "Diabetes with end-organ damage — confirm from PMH"),
            ("hemiplecia",                 ["hemiplegia", "paraplegia", "hemiparesis", "spinal cord injury"], "Hemiplegia / paraplegia — confirm from PMH"),
            ("moderateOrSevereCKD",        ["chronic kidney disease stage 3", "ckd stage 4", "ckd stage 5", "dialysis", "haemodialysis", "renal failure", "esrd"], "Moderate/severe CKD — confirm from PMH"),
            ("solidTumour",                ["solid tumour", "carcinoma", "adenocarcinoma", "sarcoma", "cancer of", "tumour of"], "Solid tumour (≤5yr, no mets) — confirm from PMH"),
            ("leukaemia",                  ["leukaemia", "leukemia", "aml", "cml", "all ", "cll "], "Leukaemia — confirm from PMH"),
            ("lymphoma",                   ["lymphoma", "multiple myeloma", "waldenstrom", "hodgkin", "non-hodgkin"], "Lymphoma / multiple myeloma — confirm from PMH"),
            ("moderateOrSevereLiverDisease", ["cirrhosis", "portal hypertension", "oesophageal varices", "hepatic encephalopathy", "ascites", "end-stage liver"], "Moderate/severe liver disease — confirm from PMH"),
            ("metastaticSolidTumour",      ["metastatic", "metastasis", "stage 4", "advanced cancer", "disseminated"], "Metastatic solid tumour — confirm from PMH"),
            ("aids",                       ["aids", "acquired immunodeficiency", "hiv with aids", "cd4 < 200"], "AIDS — confirm from PMH"),
        ]

        for (fieldKey, keywords, pendingLabel) in kw {
            if keywords.contains(where: { text.contains($0) }) {
                f.addAutoFilled(key: fieldKey, label: "\(keywords[0].capitalized) keyword detected in PMH", source: "PMH")
                switch fieldKey {
                case "myocardialInfarction":         i.myocardialInfarction = true
                case "congestiveHeartFailure":       i.congestiveHeartFailure = true
                case "peripheralVascularDisease":    i.peripheralVascularDisease = true
                case "cerebrovascularDisease":       i.cerebrovascularDisease = true
                case "dementia":                     i.dementia = true
                case "chronicPulmonaryDisease":      i.chronicPulmonaryDisease = true
                case "connectiveTissueDisease":      i.connectiveTissueDisease = true
                case "pepticulcer":                  i.pepticulcer = true
                case "mildLiverDisease":             i.mildLiverDisease = true
                case "diabetesUncomplicated":        i.diabetesUncomplicated = true
                case "diabetesWithEndOrganDamage":   i.diabetesWithEndOrganDamage = true
                case "hemiplecia":                   i.hemiplecia = true
                case "moderateOrSevereCKD":          i.moderateOrSevereCKD = true
                case "solidTumour":                  i.solidTumour = true
                case "leukaemia":                    i.leukaemia = true
                case "lymphoma":                     i.lymphoma = true
                case "moderateOrSevereLiverDisease": i.moderateOrSevereLiverDisease = true
                case "metastaticSolidTumour":        i.metastaticSolidTumour = true
                case "aids":                         i.aids = true
                default: break
                }
            } else {
                f.addPending(key: fieldKey, label: pendingLabel, source: "PMH")
            }
        }

        return (i, f)
    }

    // MARK: - Modified Frailty Index-5 (#77)
    // MARK: - Modified Frailty Index-5 (#77)
    static func mfi5(patient: Patient) -> (ClinicalScoringEngine.MFI5Input, ScoreAutoFill) {
        var i = ClinicalScoringEngine.MFI5Input()
        var f = ScoreAutoFill()
        let text = ScoreText([patient.chiefComplaint, patient.workingDiagnosis, patient.hpi,
                    patient.assessmentText, patient.managementPlan, patient.pmhNotes])

        if ["diabetes", "t2dm", "t1dm", "insulin", "metformin", "hypoglycaemic"].contains(where: { text.contains($0) }) {
            i.diabetes = true
            f.addAutoFilled(key: "diabetes", label: "Diabetes keyword detected in PMH", source: "PMH")
        } else { f.addPending(key: "diabetes", label: "Diabetes mellitus (requiring medication) — confirm from PMH", source: "PMH") }

        if ["dependent", "functional dependence", "activities of daily living", "adl", "limited independence",
            "nursing home", "residential care", "carer required"].contains(where: { text.contains($0) }) {
            i.functionalDependence = true
            f.addAutoFilled(key: "functionalDependence", label: "Functional dependence keyword detected", source: "PMH/Social Hx")
        } else { f.addPending(key: "functionalDependence", label: "Functional dependence (ADL) — confirm from history", source: "Social Hx") }

        if ["copd", "chronic obstructive", "emphysema", "chronic bronchitis", "pneumonia admission",
            "hospitalised for chest", "admitted for chest"].contains(where: { text.contains($0) }) {
            i.COPD = true
            f.addAutoFilled(key: "COPD", label: "COPD/pneumonia hospitalisation keyword detected", source: "PMH")
        } else { f.addPending(key: "COPD", label: "COPD or pneumonia requiring hospitalisation — confirm from PMH", source: "PMH") }

        if ["heart failure", "congestive heart failure", "chf", "cardiac failure", "lv failure"].contains(where: { text.contains($0) }) {
            i.congestiveHeartFailure = true
            f.addAutoFilled(key: "congestiveHeartFailure", label: "CHF keyword detected in PMH", source: "PMH")
        } else { f.addPending(key: "congestiveHeartFailure", label: "Congestive heart failure — confirm from PMH", source: "PMH") }

        if ["hypertension", "high blood pressure", "antihypertensive", "amlodipine", "ramipril",
            "lisinopril", "atenolol", "bisoprolol", "on bp tablet"].contains(where: { text.contains($0) }) {
            i.hypertension = true
            f.addAutoFilled(key: "hypertension", label: "Hypertension keyword detected", source: "PMH")
        } else { f.addPending(key: "hypertension", label: "Hypertension requiring medication — confirm from PMH", source: "PMH") }

        return (i, f)
    }

    // MARK: - Harmless Acute Pancreatitis Score (#78)
    // MARK: - Braden Scale
    static func braden(patient: Patient) -> (ClinicalScoringEngine.BradenInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.BradenInput()
        var f = ScoreAutoFill(); f.isAttempted = true
        let text = ScoreText([patient.chiefComplaint, patient.hpi, patient.assessmentText, patient.pmhNotes])
        // Bedfast keyword
        let bedfastKw = ["bedbound", "bed-bound", "bedfast", "immobile", "paralysis", "paraplegia", "quadriplegia"]
        if bedfastKw.contains(where: { text.contains($0) }) {
            i.activity = 1
            f.addAutoFilled(key: "activity", label: "Bedfast/immobile documented — Activity set to 1", source: "History/Notes")
        }
        // Nutritional risk keyword
        let malnutKw = ["malnourished", "malnutrition", "nutritional deficit", "cachexia", "nil by mouth", "npo"]
        if malnutKw.contains(where: { text.contains($0) }) {
            i.nutrition = 2
            f.addAutoFilled(key: "nutrition", label: "Malnutrition/NBM documented — Nutrition set to 2", source: "History/Notes")
        }
        // Braden requires bedside assessment for most subscales
        f.addPending(key: "sensoryPerception", label: "Sensory Perception — bedside assessment required", source: "Clinical")
        f.addPending(key: "moisture",          label: "Moisture level — bedside assessment required",      source: "Clinical")
        f.addPending(key: "mobility",          label: "Mobility — bedside assessment required",            source: "Clinical")
        f.addPending(key: "frictionShear",     label: "Friction/Shear — bedside assessment required",      source: "Clinical")
        return (i, f)
    }

    // MARK: - Centor / McIsaac Score

    static func lace(patient: Patient) -> (ClinicalScoringEngine.LACEInput, ScoreAutoFill) {
        var i = ClinicalScoringEngine.LACEInput(
            lengthOfStayDays: 1, acuteAdmission: false, charlsonIndex: 0, edVisitsLast6Months: 0
        )
        var f = ScoreAutoFill()

        // Length of stay from admittedAt
        if let admitted = patient.admittedAt {
            let days = Calendar.current.dateComponents([.day], from: admitted, to: Date()).day ?? 0
            i.lengthOfStayDays = max(1, days)
            f.addAutoFilled(key: "lengthOfStayDays", label: "LOS \(max(1, days)) days from admission date", source: "Admission")
        } else {
            f.addPending(key: "lengthOfStayDays", label: "Length of current admission (days)", source: "Admission")
        }

        // Acute vs elective from setting
        if patient.setting == .emergency {
            i.acuteAdmission = true
            f.addAutoFilled(key: "acuteAdmission", label: "Emergency/acute admission detected", source: "Setting")
        } else {
            f.addPending(key: "acuteAdmission", label: "Confirm if acute (unplanned) admission", source: "Setting")
        }

        // CCI — use stored value if available
        if let cci = patient.cciScore {
            i.charlsonIndex = cci
            f.addAutoFilled(key: "charlsonIndex", label: "CCI \(cci) — from calculated CCI score", source: "Score")
        } else {
            f.addPending(key: "charlsonIndex", label: "Charlson Comorbidity Index — calculate first", source: "Score")
        }

        // ED visits — pending (no structured field)
        f.addPending(key: "edVisitsLast6Months", label: "ED visits in last 6 months — review records", source: "Records")
        return (i, f)
    }

}
