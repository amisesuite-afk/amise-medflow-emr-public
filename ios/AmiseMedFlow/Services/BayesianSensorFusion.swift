import Foundation

// MARK: - Bayesian Sensor Fusion
// Combines observations from multiple input modalities (voice, typing, camera, PDF,
// lab, imaging, device) into a single confidence-weighted evidence stream.
//
// Model:
//   Each source has a reliability σ ∈ [0,1] (prior from literature + empirical calibration).
//   For categorical features:
//     fused_logLR = σ × raw_logLR       (attenuate uncertain sources)
//   For continuous measurements (two sources reporting the same quantity):
//     Inverse-variance weighted mean (Kalman-style):
//     x̂ = (σ₁² × x₂ + σ₂² × x₁) / (σ₁² + σ₂²)
//     σ̂² = (σ₁² × σ₂²) / (σ₁² + σ₂²)
//   Multiple (>2) measurements: sequential pairwise fusion.
//
// Output is a normalised PatientStateVector with fused FusedValue<T> fields.

// MARK: - Reliability coefficients (σ) per source modality

private enum SourceReliability {
    static func coefficient(for source: DataSource) -> Double {
        switch source {
        case .typed:   return 0.97   // clinician-typed text: high fidelity
        case .voice:   return 0.88   // ASR transcription error ~12%
        case .camera:  return 0.80   // image quality & OCR variance
        case .pdf:     return 0.93   // OCR on printed lab report
        case .lab:     return 0.99   // quantitative assay: near-ground-truth
        case .imaging: return 0.92   // structured report extraction
        case .device:  return 0.95   // calibrated monitor / wearable
        case .derived: return 0.99   // computed from validated inputs
        }
    }
}

// MARK: - Raw sensor observation before fusion

struct SensorObservation {
    let source: DataSource
    let timestamp: Date
    // Feature key + value (for categorical) or nil (for continuous)
    let featureKey: String?
    let featureValue: String?
    // Continuous measurement, if applicable
    let measurement: Double?
    let measurementUnit: String?
    // Confidence in this observation from the source's own quality signals
    // (e.g., ASR confidence score, image sharpness, lab QC flag)
    let sourceConfidence: Double    // [0,1], default 1.0
}

// MARK: - Fuser

enum BayesianSensorFusion {

    // MARK: - Main entry point
    // Takes a PatientStateVector (partially populated from one source) and a
    // stream of additional sensor observations, then returns a fully fused PSV.

    static func fuse(
        base psv: PatientStateVector,
        with observations: [SensorObservation]
    ) -> PatientStateVector {
        var result = psv
        result.inputSources.formUnion(observations.map(\.source))

        // Group observations by feature key
        let grouped = Dictionary(grouping: observations.filter { $0.featureKey != nil }, by: \.featureKey!)

        // Fuse categorical evidence into SOCRATES selections
        for (key, obs) in grouped {
            let fusedValues = fuse(categoricalKey: key, observations: obs)
            for (value, _) in fusedValues {
                result.socratesSelections[key, default: []].insert(value)
            }
        }

        // Fuse continuous lab measurements
        result.labs = fuseLabs(base: result.labs, observations: observations)

        // Fuse vitals measurements
        result.vitals = fuseVitals(base: result.vitals, observations: observations)

        // Re-derive exam flags from any new typed/voice narrative arriving
        let narratives = observations
            .filter { [.typed, .voice, .camera, .pdf].contains($0.source) && $0.featureKey == nil }
            .compactMap { $0.featureValue }
            .joined(separator: " ")
        if !narratives.isEmpty {
            let newExam = ExamFindings.parse(from: narratives)
            result.exam = mergeExamFindings(result.exam, newExam)
        }

        result.assembledAt = .now
        return result
    }

    // MARK: - Categorical fusion
    // For each (key, value) pair, compute the fused confidence as the
    // weighted average of source reliabilities × source confidence.
    // Returns (value, fusedConfidence) pairs above threshold 0.50.

    static func fuse(
        categoricalKey key: String,
        observations: [SensorObservation]
    ) -> [(String, Double)] {
        let byValue = Dictionary(grouping: observations.filter { $0.featureValue != nil }, by: \.featureValue!)
        var results: [(String, Double)] = []
        for (value, obs) in byValue {
            // Bayesian combination: product of reliability × sourceConfidence, normalised
            // For a binary feature, P(feature=true | obs₁, obs₂, …) via Naive-Bayes on sensors
            let confidences = obs.map { SourceReliability.coefficient(for: $0.source) * $0.sourceConfidence }
            // log-combination: log P(value confirmed) = Σ log(σ_i) (under independence assumption)
            let logFused = confidences.reduce(0.0) { $0 + log(max(1e-6, $1)) }
            let fused = exp(logFused / Double(confidences.count))   // geometric mean
            if fused >= 0.50 { results.append((value, fused)) }
        }
        return results
    }

    // MARK: - Continuous fusion (inverse-variance weighting)

    static func fuseDouble(_ a: FusedValue<Double>?, _ b: FusedValue<Double>?, source: DataSource) -> FusedValue<Double>? {
        switch (a, b) {
        case (nil, let v):   return v
        case (let v, nil):   return v
        case (let a?, let b?):
            let va = 1.0 - a.confidence    // treat (1 - confidence) as noise variance
            let vb = 1.0 - b.confidence
            guard (va + vb) > 0 else { return a }
            let w_a = vb / (va + vb)
            let w_b = va / (va + vb)
            let fusedVal = w_a * a.value + w_b * b.value
            let fusedConf = 1.0 - (va * vb) / (va + vb)
            return FusedValue(value: fusedVal, confidence: min(0.999, fusedConf), source: .derived, timestamp: max(a.timestamp, b.timestamp))
        }
    }

    static func fuseInt(_ a: FusedValue<Int>?, _ b: FusedValue<Int>?, source: DataSource) -> FusedValue<Int>? {
        guard let fused = fuseDouble(
            a.map { FusedValue(value: Double($0.value), confidence: $0.confidence, source: $0.source, timestamp: $0.timestamp) },
            b.map { FusedValue(value: Double($0.value), confidence: $0.confidence, source: $0.source, timestamp: $0.timestamp) },
            source: source
        ) else { return nil }
        return FusedValue(value: Int(fused.value.rounded()), confidence: fused.confidence, source: fused.source, timestamp: fused.timestamp)
    }

    // MARK: - Lab panel fusion

    private static func fuseLabs(base: LabPanel, observations: [SensorObservation]) -> LabPanel {
        var lab = base
        for obs in observations where obs.measurement != nil {
            guard let unit = obs.measurementUnit, let val = obs.measurement else { continue }
            let σ = SourceReliability.coefficient(for: obs.source) * obs.sourceConfidence
            let fv = FusedValue(value: val, confidence: σ, source: obs.source, timestamp: obs.timestamp)
            switch (obs.featureKey ?? "").lowercased() {
            case "wbc":            lab.wbc            = fuseDouble(lab.wbc, fv, source: obs.source)
            case "haemoglobin", "hemoglobin", "hb": lab.haemoglobin = fuseDouble(lab.haemoglobin, fv, source: obs.source)
            case "platelets":      lab.platelets       = fuseDouble(lab.platelets, fv, source: obs.source)
            case "crp":            lab.crp             = fuseDouble(lab.crp, fv, source: obs.source)
            case "sodium":         lab.sodium          = fuseDouble(lab.sodium, fv, source: obs.source)
            case "potassium":      lab.potassium       = fuseDouble(lab.potassium, fv, source: obs.source)
            case "creatinine":     lab.creatinine      = fuseDouble(lab.creatinine, fv, source: obs.source)
            case "urea":           lab.urea            = fuseDouble(lab.urea, fv, source: obs.source)
            case "bilirubin":      lab.bilirubin       = fuseDouble(lab.bilirubin, fv, source: obs.source)
            case "alt", "alat":    lab.alt             = fuseDouble(lab.alt, fv, source: obs.source)
            case "alp":            lab.alp             = fuseDouble(lab.alp, fv, source: obs.source)
            case "albumin":        lab.albumin         = fuseDouble(lab.albumin, fv, source: obs.source)
            case "amylase":        lab.amylase         = fuseDouble(lab.amylase, fv, source: obs.source)
            case "lipase":         lab.lipase          = fuseDouble(lab.lipase, fv, source: obs.source)
            case "lactate":        lab.lactate         = fuseDouble(lab.lactate, fv, source: obs.source)
            case "d-dimer", "ddimer": lab.dDimer       = fuseDouble(lab.dDimer, fv, source: obs.source)
            case "troponin":       lab.troponin        = fuseDouble(lab.troponin, fv, source: obs.source)
            case "inr":            lab.inr             = fuseDouble(lab.inr, fv, source: obs.source)
            case "glucose":        lab.glucose         = fuseDouble(lab.glucose, fv, source: obs.source)
            case "hba1c":          lab.hba1c           = fuseDouble(lab.hba1c, fv, source: obs.source)
            default: _ = unit  // keep linter happy
            }
        }
        return lab
    }

    // MARK: - Vitals fusion

    private static func fuseVitals(base: VitalsSnapshot, observations: [SensorObservation]) -> VitalsSnapshot {
        var v = base
        for obs in observations where obs.measurement != nil {
            guard let val = obs.measurement else { continue }
            let σ = SourceReliability.coefficient(for: obs.source) * obs.sourceConfidence
            let fvD = FusedValue(value: val, confidence: σ, source: obs.source, timestamp: obs.timestamp)
            let fvI = FusedValue(value: Int(val.rounded()), confidence: σ, source: obs.source, timestamp: obs.timestamp)
            switch (obs.featureKey ?? "").lowercased() {
            case "hr", "heart_rate":          v.heartRate         = fuseInt(v.heartRate, fvI, source: obs.source)
            case "sbp", "systolic":           v.systolicBP        = fuseInt(v.systolicBP, fvI, source: obs.source)
            case "dbp", "diastolic":          v.diastolicBP       = fuseInt(v.diastolicBP, fvI, source: obs.source)
            case "rr", "resp_rate":           v.respiratoryRate   = fuseInt(v.respiratoryRate, fvI, source: obs.source)
            case "temp", "temperature":       v.temperatureCelsius = fuseDouble(v.temperatureCelsius, fvD, source: obs.source)
            case "spo2", "o2sat":             v.spo2              = fuseInt(v.spo2, fvI, source: obs.source)
            case "gcs":                       v.gcs               = fuseInt(v.gcs, fvI, source: obs.source)
            default: break
            }
        }
        return v
    }

    // MARK: - Exam merge (OR logic — any source confirming a flag sets it)

    private static func mergeExamFindings(_ a: ExamFindings, _ b: ExamFindings) -> ExamFindings {
        ExamFindings(
            abdominalTenderness: a.abdominalTenderness || b.abdominalTenderness,
            rigidity:            a.rigidity            || b.rigidity,
            guarding:            a.guarding            || b.guarding,
            reboundTenderness:   a.reboundTenderness   || b.reboundTenderness,
            murphysSign:         a.murphysSign         || b.murphysSign,
            rovsingsSign:        a.rovsingsSign        || b.rovsingsSign,
            distension:          a.distension          || b.distension,
            palpableMass:        a.palpableMass        || b.palpableMass,
            bowelSoundsAbsent:   a.bowelSoundsAbsent   || b.bowelSoundsAbsent,
            bowelSoundsIncreased: a.bowelSoundsIncreased || b.bowelSoundsIncreased,
            herniaPresent:       a.herniaPresent       || b.herniaPresent,
            herniaTender:        a.herniaTender        || b.herniaTender,
            herniaIrreducible:   a.herniaIrreducible   || b.herniaIrreducible,
            jaundice:            a.jaundice            || b.jaundice,
            pallor:              a.pallor              || b.pallor,
            cyanosis:            a.cyanosis            || b.cyanosis,
            oedema:              a.oedema              || b.oedema,
            lymphadenopathy:     a.lymphadenopathy     || b.lymphadenopathy,
            limbPulsesAbsent:    a.limbPulsesAbsent    || b.limbPulsesAbsent,
            limbCold:            a.limbCold            || b.limbCold,
            limbPallor:          a.limbPallor          || b.limbPallor,
            limbMottled:         a.limbMottled         || b.limbMottled,
            crepitus:            a.crepitus            || b.crepitus,
            skinBullae:          a.skinBullae          || b.skinBullae,
            skinNecrosis:        a.skinNecrosis        || b.skinNecrosis,
            reducedAirEntry:     a.reducedAirEntry     || b.reducedAirEntry,
            pleuralRub:          a.pleuralRub          || b.pleuralRub,
            wheeze:              a.wheeze              || b.wheeze
        )
    }
}
