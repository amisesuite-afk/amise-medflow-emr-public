import Foundation

// MARK: - CUSUM Change-Point Detector
// Detects physiological deterioration in vital sign trends using the
// Cumulative Sum (CUSUM) control-chart algorithm.
//
// S⁺(t) = max(0, S⁺(t-1) + (x_t − μ − k))   — detects upward shift
// S⁻(t) = max(0, S⁻(t-1) + (−x_t + μ − k))  — detects downward shift
// Alert when S⁺ > h  or  S⁻ > h
//
// μ  = baseline mean for the patient (or population normal)
// k  = allowance (half the expected shift size to detect)
// h  = decision threshold (number of allowances before alarm)

// MARK: - Output types

struct ChangePointAlert: Identifiable {
    let id = UUID()
    let metric: VitalMetric
    let direction: ShiftDirection
    let cusumValue: Double        // S⁺ or S⁻ at the alert point
    let detectedAt: Date
    let magnitude: Double         // |x_t − μ| at detection
    let news2AtDetection: Int?
    let recommendations: [String]

    enum ShiftDirection: String {
        case rising  = "Rising"
        case falling = "Falling"
    }
}

enum VitalMetric: String, CaseIterable {
    case heartRate        = "Heart Rate"
    case respiratoryRate  = "Respiratory Rate"
    case systolicBP       = "Systolic BP"
    case spo2             = "SpO₂"
    case temperature      = "Temperature"
    case news2            = "NEWS2 Score"

    var normalMean: Double {
        switch self {
        case .heartRate:       return 75
        case .respiratoryRate: return 15
        case .systolicBP:      return 120.0
        case .spo2:            return 97
        case .temperature:     return 37.0
        case .news2:           return 1
        }
    }

    // CUSUM allowance k = half the clinically significant shift size
    var allowance: Double {
        switch self {
        case .heartRate:       return 10   // detect ≥20 bpm shift
        case .respiratoryRate: return 3    // detect ≥6/min shift
        case .systolicBP:      return 10   // detect ≥20 mmHg shift
        case .spo2:            return 1.5  // detect ≥3% drop
        case .temperature:     return 0.5  // detect ≥1°C shift
        case .news2:           return 1    // detect ≥2 point rise
        }
    }

    // Decision threshold h — number of allowances before alarm
    var threshold: Double {
        switch self {
        case .heartRate:       return 40
        case .respiratoryRate: return 12
        case .systolicBP:      return 30
        case .spo2:            return 6
        case .temperature:     return 2.0
        case .news2:           return 4
        }
    }

    // Clinical deterioration direction (true = rising is abnormal, false = falling is abnormal)
    var deterioratesWhenRising: Bool {
        switch self {
        case .heartRate, .respiratoryRate, .temperature, .news2: return true
        case .systolicBP, .spo2: return false
        }
    }

    var unit: String {
        switch self {
        case .heartRate:       return "bpm"
        case .respiratoryRate: return "/min"
        case .systolicBP:      return "mmHg"
        case .spo2:            return "%"
        case .temperature:     return "°C"
        case .news2:           return "pts"
        }
    }
}

// MARK: - Per-metric CUSUM state

private struct CUSUMState {
    var sPlus: Double = 0      // upward CUSUM accumulator
    var sMinus: Double = 0     // downward CUSUM accumulator
    var baseline: Double       // μ — set from first value or population normal
    var baselineFixed: Bool = false

    mutating func update(value: Double, allowance k: Double) -> (alertPlus: Bool, alertMinus: Bool, threshold: Double) {
        if !baselineFixed {
            baseline = value
            baselineFixed = true
        }
        let deviation = value - baseline
        sPlus  = max(0, sPlus  + deviation - k)
        sMinus = max(0, sMinus - deviation - k)
        return (false, false, 0)   // actual threshold check done by caller
    }

    mutating func reset() {
        sPlus = 0; sMinus = 0
    }
}

// MARK: - Detector

enum ClinicalChangePointDetector {

    // Returns all CUSUM alerts generated from the vitals time-series.
    // Entries must be sorted chronologically (oldest first).
    static func detect(vitals: [VitalsEntry]) -> [ChangePointAlert] {
        guard vitals.count >= 3 else { return [] }
        let sorted = vitals.sorted { $0.recordedAt < $1.recordedAt }
        var alerts: [ChangePointAlert] = []

        for metric in VitalMetric.allCases {
            alerts += cusumScan(metric: metric, sorted: sorted)
        }

        return alerts.sorted { $0.detectedAt < $1.detectedAt }
    }

    // MARK: - CUSUM scan for one metric

    private static func cusumScan(metric: VitalMetric, sorted: [VitalsEntry]) -> [ChangePointAlert] {
        var state = CUSUMState(baseline: metric.normalMean)
        var alerts: [ChangePointAlert] = []
        var alertFired = false  // suppress repeat alerts until CUSUM resets

        for entry in sorted {
            guard let value = extract(metric: metric, from: entry) else { continue }

            let k = metric.allowance
            let h = metric.threshold
            let deviation = value - state.baseline

            state.sPlus  = max(0, state.sPlus  + deviation - k)
            state.sMinus = max(0, state.sMinus - deviation - k)

            let plusTriggered  = state.sPlus  > h
            let minusTriggered = state.sMinus > h

            guard !alertFired else {
                // Reset accumulators once values return to normal band
                if state.sPlus <= 0 && state.sMinus <= 0 { alertFired = false }
                continue
            }

            if plusTriggered || minusTriggered {
                let direction: ChangePointAlert.ShiftDirection = plusTriggered ? .rising : .falling
                let cusumVal = plusTriggered ? state.sPlus : state.sMinus
                let isClinicallySignificant = (metric.deterioratesWhenRising && plusTriggered)
                                           || (!metric.deterioratesWhenRising && minusTriggered)

                guard isClinicallySignificant else { continue }

                let news2 = entry.hasAnyValue ? entry.news2Score : nil
                alerts.append(ChangePointAlert(
                    metric: metric,
                    direction: direction,
                    cusumValue: cusumVal,
                    detectedAt: entry.recordedAt,
                    magnitude: abs(deviation),
                    news2AtDetection: news2,
                    recommendations: recommendations(metric: metric, direction: direction, value: value, news2: news2)
                ))
                alertFired = true
                state.sPlus  = 0
                state.sMinus = 0
            }
        }
        return alerts
    }

    // MARK: - Value extraction

    private static func extract(metric: VitalMetric, from entry: VitalsEntry) -> Double? {
        switch metric {
        case .heartRate:       return entry.heartRate.map(Double.init)
        case .respiratoryRate: return entry.respiratoryRate.map(Double.init)
        case .systolicBP:      return entry.bpSystolic.map(Double.init)
        case .spo2:            return entry.spo2.map(Double.init)
        case .temperature:     return entry.temperatureCelsius
        case .news2:           return Double(entry.news2Score)
        }
    }

    // MARK: - Clinical recommendations per alert

    private static func recommendations(
        metric: VitalMetric,
        direction: ChangePointAlert.ShiftDirection,
        value: Double,
        news2: Int?
    ) -> [String] {
        var recs: [String] = []

        if let n2 = news2 {
            if n2 >= 7 {
                recs.append("NEWS2 ≥7: activate rapid response / emergency team immediately")
            } else if n2 >= 5 {
                recs.append("NEWS2 5–6: urgent clinical review within 30 minutes")
            } else if n2 >= 3 {
                recs.append("NEWS2 3–4: increase monitoring frequency; senior clinician review")
            }
        }

        switch metric {
        case .heartRate:
            if direction == .rising {
                if value >= 130 { recs.append("HR ≥130: assess for shock, haemorrhage, sepsis, AF with RVR") }
                else if value >= 111 { recs.append("HR ≥111: check volume status, pain score, sepsis signs") }
                else { recs.append("HR rising trend: reassess fluid balance, temperature, pain") }
            } else {
                if value <= 40 { recs.append("HR ≤40: urgent ECG; consider cardiac cause, beta-blocker toxicity") }
                else { recs.append("HR falling trend: check medication doses, cardiac rhythm") }
            }

        case .respiratoryRate:
            if direction == .rising {
                if value >= 25 { recs.append("RR ≥25: urgent assessment — sepsis, PE, pneumonia, pain, anxiety") }
                else { recs.append("RR rising trend: assess work of breathing; check SpO₂, auscultate chest") }
            } else {
                recs.append("RR falling trend: assess conscious level; check opioid use")
            }

        case .systolicBP:
            if direction == .falling {
                if value < 90 { recs.append("SBP <90: HYPOTENSION — IV access, fluid challenge, assess for shock") }
                else if value < 100 { recs.append("SBP <100: borderline — reassess fluid status, lie flat, recheck") }
                else { recs.append("BP falling trend: check fluid balance, medications, occult bleeding") }
            } else {
                if value > 180 { recs.append("SBP >180: hypertensive — exclude pain; consider antihypertensive") }
            }

        case .spo2:
            if direction == .falling {
                if value < 90 { recs.append("SpO₂ <90: HYPOXIA — high-flow oxygen, escalate urgently") }
                else if value < 94 { recs.append("SpO₂ 90–93%: titrate supplemental oxygen; investigate cause") }
                else { recs.append("SpO₂ falling trend: check probe position; auscultate; CXR if persists") }
            }

        case .temperature:
            if direction == .rising {
                if value >= 39.0 { recs.append("Temp ≥39°C: blood cultures × 2; sepsis workup; antipyretics") }
                else { recs.append("Temp rising trend: assess for infection source; monitor closely") }
            } else {
                if value < 35.0 { recs.append("Temp <35°C: hypothermia — active warming; check TSH, sepsis") }
                else { recs.append("Temp falling: note if post-antipyretic; recheck in 4 h") }
            }

        case .news2:
            recs.append("NEWS2 rising trend: escalate to senior clinician; increase obs frequency")
            if value >= 5 {
                recs.append("Consider ITU/HDU referral and critical care review")
            }
        }

        return recs
    }
}
