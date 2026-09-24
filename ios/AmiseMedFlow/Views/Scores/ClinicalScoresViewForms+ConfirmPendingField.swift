// ClinicalScoresViewForms+ConfirmPendingField.swift
// Pending-variable confirmation logic for every score type.

import SwiftUI

extension ClinicalScoresView {

    func confirmPendingField(_ field: PendingScoreField) {
        guard let score = selectedScore, patient.isLive else { return }
        CrashReporting.breadcrumb("Confirmed a pending score variable", category: "scores")

        // Append a dated audit line to PMH notes
        let fmt = DateFormatter(); fmt.dateStyle = .medium
        let line = "[\(fmt.string(from: .now))] \(field.label) — confirmed (\(score.rawValue))"
        if let existing = patient.pmhNotes, !existing.isEmpty {
            patient.pmhNotes = existing + "\n" + line
        } else {
            patient.pmhNotes = line
        }
        // Local edit to the record — mark it so sync pushes it.
        patient.updatedAt   = .now
        patient.pendingSync = true

        // Set the matching boolean toggle on the current score input
        switch score {
        case .caprini:
            switch field.id {
            case "priorVTE":            cap.priorVTE = true
            case "thrombophilia":       cap.thrombophilia = true
            case "familyHistoryVTE":    cap.familyHistoryVTE = true
            case "centralVenousAccess": cap.centralVenousAccess = true
            case "immobilityBedridden": cap.immobilityBedridden = true
            case "sepsis30d":           cap.sepsis30d = true
            default: break
            }
        case .wellsDVT:
            switch field.id {
            case "localizedTendernessDeepVein": wDVT.localizedTendernessDeepVein = true
            case "entireLegSwollen":            wDVT.entireLegSwollen = true
            case "calfSwellingOver3cm":         wDVT.calfSwellingOver3cm = true
            case "pittingOedema":               wDVT.pittingOedema = true
            case "collateralSuperficialVeins":  wDVT.collateralSuperficialVeins = true
            case "paralysisParesisPlastercast": wDVT.paralysisParesisPlastercast = true
            default: break
            }
        case .wellsPE:
            switch field.id {
            case "clinicalSignsDVT":        wPE.clinicalSignsDVT = true
            case "hrOver100":               wPE.hrOver100 = true
            case "haemoptysis":             wPE.haemoptysis = true
            case "alternativeDxLessLikely": wPE.alternativeDxLessLikely = true
            default: break
            }
        case .rcri:
            switch field.id {
            case "insulinDependentDiabetes": rcriI.insulinDependentDiabetes = true
            case "preopCreatinineOver2":     rcriI.preopCreatinineOver2 = true
            default: break
            }
        case .stopBang:
            switch field.id {
            case "snoring":      sbangI.snoring = true
            case "tired":        sbangI.tired = true
            case "observed":     sbangI.observed = true
            case "neckOver40cm": sbangI.neckOver40cm = true
            default: break
            }
        case .cha2ds2vasc:
            switch field.id {
            case "congestiveHeartFailure": cha2I.congestiveHeartFailure = true
            case "vascularDisease":        cha2I.vascularDisease = true
            default: break
            }
        case .hasBled:
            switch field.id {
            case "hypertensionUncontrolled": hblI.hypertensionUncontrolled = true
            case "renalDysfunction":         hblI.renalDysfunction = true
            case "liverDysfunction":         hblI.liverDysfunction = true
            case "priorBleeding":            hblI.priorBleeding = true
            case "labileINR":                hblI.labileINR = true
            case "alcoholUse":              hblI.alcoholUse = true
            default: break
            }
        case .abcd2:
            switch field.id {
            case "bpOver140_90":          abcd.bpOver140_90 = true
            case "unilateralWeakness":    abcd.unilateralWeakness = true
            case "speechWithoutWeakness": abcd.speechWithoutWeakness = true
            case "durationOver60min":     abcd.durationOver60min = true;  abcdDuration = 2
            case "duration10to59min":     abcd.duration10to59min = true;  abcdDuration = 1
            default: break
            }
        case .sirs:
            switch field.id {
            case "suspectedInfection":              sirsI.suspectedInfection = true
            case "wbcOver12kOrBelow4kOr10PctBands": sirsI.wbcOver12kOrBelow4kOr10PctBands = true
            default: break
            }
        case .qsofa:
            switch field.id {
            case "suspectedInfection": qsofaI.suspectedInfection = true
            case "alteredMentation":   qsofaI.alteredMentation = true
            case "rrOver22":           qsofaI.rrOver22 = true
            case "sbpUnder100":        qsofaI.sbpUnder100 = true
            default: break
            }
        case .ranson:
            switch field.id {
            case "hctFallOver10": ran.hctFallOver10 = true
            case "bunRiseOver5":  ran.bunRiseOver5 = true
            case "calciumBelow8": ran.calciumBelow8 = true
            case "pao2Below60":   ran.pao2Below60 = true
            default: break
            }
        case .glasgow:
            switch field.id {
            case "pao2Below60": glas.pao2Below60 = true
            default: break
            }
        case .aims65:
            switch field.id {
            case "albuminUnder3":       aims65I.albuminUnder3       = true
            case "inrOver1point5":      aims65I.inrOver1point5      = true
            case "alteredMentalStatus": aims65I.alteredMentalStatus = true
            case "systolicBPUnder90":   aims65I.systolicBPUnder90   = true
            default: break
            }
        case .bisap:
            switch field.id {
            case "bunOver9mmolL":       bisapI.bunOver9mmolL       = true
            case "impairedMentalStatus": bisapI.impairedMentalStatus = true
            case "sirs":                bisapI.sirs                 = true
            case "pleuralEffusion":     bisapI.pleuralEffusion      = true
            default: break
            }
        case .psiPort:
            switch field.id {
            case "alteredMentalStatus":      psiI.alteredMentalStatus      = true
            case "arterialPHUnder735":       psiI.arterialPHUnder735       = true
            case "bunOver11mmoL":            psiI.bunOver11mmoL            = true
            case "sodiumUnder130":           psiI.sodiumUnder130           = true
            case "glucoseOver14":            psiI.glucoseOver14            = true
            case "haematocritUnder30":       psiI.haematocritUnder30       = true
            case "pao2Under60orSpO2Under90": psiI.pao2Under60orSpO2Under90 = true
            case "pleuralEffusion":          psiI.pleuralEffusion          = true
            case "nursingHomeResident":      psiI.nursingHomeResident      = true
            default: break
            }
        case .sofa:
            // SOFA domain levels are adjusted via pickers; pending fields flag component elevations
            switch field.id {
            case "respirationElevated":   if sofaI.respiration < 1 { sofaI.respiration = 1 }
            case "coagulationElevated":   if sofaI.coagulation < 1 { sofaI.coagulation = 1 }
            case "liverElevated":         if sofaI.liver < 1       { sofaI.liver = 1 }
            case "cnsElevated":           if sofaI.cns < 1         { sofaI.cns = 1 }
            case "renalElevated":         if sofaI.renal < 1       { sofaI.renal = 1 }
            default: break
            }
        case .fib4:
            // FIB-4 inputs are continuous sliders; no boolean pending fields
            break
        case .curb65:
            switch field.id {
            case "confusion":              curb65I.confusion              = true
            case "ureaDOver7":             curb65I.ureaDOver7             = true
            case "respiratoryRateOver30":  curb65I.respiratoryRateOver30  = true
            case "lowBP":                  curb65I.lowBP                  = true
            case "ageOver65":              curb65I.ageOver65              = true
            default: break
            }
        case .padua:
            switch field.id {
            case "activeOrRecentCancer":         paduaI.activeOrRecentCancer         = true
            case "previousVTE":                  paduaI.previousVTE                  = true
            case "reducedMobility":              paduaI.reducedMobility              = true
            case "thrombophilia":                paduaI.thrombophilia                = true
            case "recentTraumaOrSurgery":        paduaI.recentTraumaOrSurgery        = true
            case "ageOver70":                    paduaI.ageOver70                    = true
            case "heartOrRespiratoryFailure":    paduaI.heartOrRespiratoryFailure    = true
            case "acuteMIOrIschaemicStroke":     paduaI.acuteMIOrIschaemicStroke     = true
            case "acuteInfectionOrInflammatory": paduaI.acuteInfectionOrInflammatory = true
            case "obese":                        paduaI.obese                        = true
            case "ongoingHormonalTreatment":     paduaI.ongoingHormonalTreatment     = true
            default: break
            }
        case .apacheII:
            // APACHE II fields are numeric selectors, not toggles — no pending-confirm action
            break
        case .ppossum:
            // P-POSSUM fields are numeric selectors — no boolean toggle confirm
            break
        case .mpi:
            switch field.id {
            case "ageOver50":            mpiI.ageOver50            = true
            case "femaleSex":            mpiI.femaleSex            = true
            case "organFailure":         mpiI.organFailure         = true
            case "malignancy":           mpiI.malignancy           = true
            case "durationOver24h":      mpiI.durationOver24h      = true
            case "nonColonicOrigin":     mpiI.nonColonicOrigin     = true
            case "generalizedPeritonitis": mpiI.generalizedPeritonitis = true
            default: break
            }
        case .ctsi:
            // CTSI fields are numeric selectors — no boolean toggle confirm
            break
        case .nrs2002:
            switch field.id {
            case "ageOver70": nrsI.ageOver70 = true
            default: break
            }
        case .forrest:
            // Forrest grade is a single numeric picker — no boolean toggle confirm
            break
        case .heart:
            // HEART domain scores are numeric pickers — no boolean toggle confirm
            break
        case .timi:
            switch field.id {
            case "ageOver65":                   timiI.ageOver65 = true
            case "threeOrMoreRiskFactors":      timiI.threeOrMoreRiskFactors = true
            case "priorCoronaryArteryStenosis": timiI.priorCoronaryArteryStenosis = true
            case "stDeviationOnECG":            timiI.stDeviationOnECG = true
            case "twoOrMoreAnginalEvents":      timiI.twoOrMoreAnginalEvents = true
            case "aspirinUseInLast7Days":       timiI.aspirinUseInLast7Days = true
            case "elevatedCardiacMarkers":      timiI.elevatedCardiacMarkers = true
            default: break
            }
        case .cfs:
            // CFS is a single ordinal picker — no boolean toggle confirm
            break
        case .mallampati:
            switch field.id {
            case "mouthOpening":   mallampatiI.mouthOpening   = true
            case "neckMobility":   mallampatiI.neckMobility   = true
            case "thyromental":    mallampatiI.thyromental    = true
            case "retrognathia":   mallampatiI.retrognathia   = true
            case "obesity":        mallampatiI.obesity        = true
            case "beardOrDentures": mallampatiI.beardOrDentures = true
            default: break
            }
        case .waterlow:
            switch field.id {
            case "tissuemalnutrition": waterlowI.tissuemalnutrition = true
            case "neurologicalDeficit": waterlowI.neurologicalDeficit = true
            case "majorSurgery":       waterlowI.majorSurgery = true
            case "onCytotoxics":       waterlowI.onCytotoxics = true
            default: break
            }
        case .surgicalApgar:
            // All fields are numeric pickers — no boolean toggle confirm
            break
        case .grace:
            switch field.id {
            case "cardiacArrest":    graceI.cardiacArrest = true
            case "elevatedMarkers":  graceI.elevatedMarkers = true
            case "stDeviation":      graceI.stDeviation = true
            default: break
            }
        case .barthel:
            // All fields are numeric pickers — no boolean toggle confirm
            break
        case .euroScoreII:
            switch field.id {
            case "female":                    euroScI.female = true
            case "extracardiacArteriopathy":  euroScI.extracardiacArteriopathy = true
            case "poorMobility":              euroScI.poorMobility = true
            case "previousCardiacSurgery":    euroScI.previousCardiacSurgery = true
            case "chronicLungDisease":        euroScI.chronicLungDisease = true
            case "activeEndocarditis":        euroScI.activeEndocarditis = true
            case "criticalPreoperativeState": euroScI.criticalPreoperativeState = true
            case "diabetesOnInsulin":         euroScI.diabetesOnInsulin = true
            case "ccsClass4Angina":           euroScI.ccsClass4Angina = true
            case "recentMI":                  euroScI.recentMI = true
            case "surgeryOnThoracicAorta":    euroScI.surgeryOnThoracicAorta = true
            case "postInfarctSeptalRupture":  euroScI.postInfarctSeptalRupture = true
            default: break
            }
        case .dasi:
            // All fields are boolean toggles; auto-confirmed from patient-reported keywords
            switch field.id {
            case "takeCareOfSelf":           dasiI.takeCareOfSelf = true
            case "walkIndoors":              dasiI.walkIndoors = true
            case "walkOneOrTwoBlocks":       dasiI.walkOneOrTwoBlocks = true
            case "climbStairs":              dasiI.climbStairs = true
            case "runShortDistance":         dasiI.runShortDistance = true
            case "doLightWork":              dasiI.doLightWork = true
            case "doModerateWork":           dasiI.doModerateWork = true
            case "doHeavyWork":              dasiI.doHeavyWork = true
            case "doYardWork":               dasiI.doYardWork = true
            case "haveSexualActivity":       dasiI.haveSexualActivity = true
            case "participateInModerateRecreation": dasiI.participateInModerateRecreation = true
            case "participateInStrenuous":   dasiI.participateInStrenuous = true
            default: break
            }
        case .nihss:
            // NIHSS fields are numeric pickers — auto-fill applies only consciousness level from text
            break
        case .must:
            // MUST fields are categorical pickers confirmed directly in the form
            break
        case .clavienDindo:
            break
        case .aldrete:
            break
        case .fourT:
            break
        case .oakland:
            break
        case .kingsCriteria:
            break
        case .childPugh, .meld, .asa:
            break
        case .ecog, .rts, .kdigo, .baux, .iss, .nutric:
            break
        case .spesi:
            switch field.id {
            case "cancer":                  spesiI.cancer = true
            case "cardiopulmonaryDisease":  spesiI.cardiopulmonaryDisease = true
            case "heartRateAbove109":       spesiI.heartRateAbove109 = true
            case "sbpBelow100":             spesiI.sbpBelow100 = true
            case "spo2Below90":             spesiI.spo2Below90 = true
            default: break
            }
        case .decaf:
            switch field.id {
            case "eosinopenia":          decafI.eosinopenia = true
            case "consolidation":        decafI.consolidation = true
            case "acidaemia":            decafI.acidaemia = true
            case "atrialFibrillation":   decafI.atrialFibrillation = true
            default: break
            }
        case .hinchey:
            // Grade is a numeric picker — no boolean toggle confirm
            break
        case .airScore:
            switch field.id {
            case "vomiting":          airI.vomiting = true
            case "painRIF":           airI.painRIF = true
            case "tempAbove38point5": airI.tempAbove38point5 = true
            default: break
            }
        case .perc:
            switch field.id {
            case "hrAbove99":           percI.hrAbove99 = true
            case "spo2Below95":         percI.spo2Below95 = true
            case "legSwelling":         percI.legSwelling = true
            case "haemoptysis":         percI.haemoptysis = true
            case "exogenousEstrogen":   percI.exogenousEstrogen = true
            case "priorDVTorPE":        percI.priorDVTorPE = true
            case "recentSurgeryOrTrauma": percI.recentSurgeryOrTrauma = true
            default: break
            }
        case .shockIndex:
            // Shock Index is computed from vitals — no boolean confirm
            break
        case .parkland:
            // Parkland formula inputs are numeric sliders — inhalation injury can be pending-confirmed
            if field.id == "hasInhalationInjury" { parklandI.hasInhalationInjury = true }
        case .pas:
            switch field.id {
            case "anorexia":               pasI.anorexia = true
            case "nausea":                 pasI.nausea = true
            case "migration":              pasI.migration = true
            case "tendernessRIF":          pasI.tendernessRIF = true
            case "coughPercussionHop":     pasI.coughPercussionHop = true
            case "pyrexia":                pasI.pyrexia = true
            case "leukocytosis":           pasI.leukocytosis = true
            case "polymorphonuclearShift": pasI.polymorphonuclearShift = true
            default: break
            }
        case .revisedGeneva:
            switch field.id {
            case "priorDVTorPE":                 rgI.priorDVTorPE = true
            case "surgeryOrFractureInMonth":     rgI.surgeryOrFractureInMonth = true
            case "activeMalignancy":             rgI.activeMalignancy = true
            case "unilateralLimbPain":           rgI.unilateralLimbPain = true
            case "haemoptysis":                  rgI.haemoptysis = true
            case "heartRateAbove74":             rgI.heartRateAbove74 = true
            case "heartRateAbove94":             rgI.heartRateAbove94 = true
            case "painOnPalpationLimbAndEdema":  rgI.painOnPalpationLimbAndEdema = true
            default: break
            }
        case .cci:
            switch field.id {
            case "myocardialInfarction":         cciI.myocardialInfarction = true
            case "congestiveHeartFailure":       cciI.congestiveHeartFailure = true
            case "peripheralVascularDisease":    cciI.peripheralVascularDisease = true
            case "cerebrovascularDisease":       cciI.cerebrovascularDisease = true
            case "dementia":                     cciI.dementia = true
            case "chronicPulmonaryDisease":      cciI.chronicPulmonaryDisease = true
            case "connectiveTissueDisease":      cciI.connectiveTissueDisease = true
            case "pepticulcer":                  cciI.pepticulcer = true
            case "mildLiverDisease":             cciI.mildLiverDisease = true
            case "diabetesUncomplicated":        cciI.diabetesUncomplicated = true
            case "diabetesWithEndOrganDamage":   cciI.diabetesWithEndOrganDamage = true
            case "hemiplecia":                   cciI.hemiplecia = true
            case "moderateOrSevereCKD":          cciI.moderateOrSevereCKD = true
            case "solidTumour":                  cciI.solidTumour = true
            case "leukaemia":                    cciI.leukaemia = true
            case "lymphoma":                     cciI.lymphoma = true
            case "moderateOrSevereLiverDisease": cciI.moderateOrSevereLiverDisease = true
            case "metastaticSolidTumour":        cciI.metastaticSolidTumour = true
            case "aids":                         cciI.aids = true
            default: break
            }
        case .mfi5:
            switch field.id {
            case "diabetes":               mfi5I.diabetes = true
            case "functionalDependence":   mfi5I.functionalDependence = true
            case "COPD":                   mfi5I.COPD = true
            case "congestiveHeartFailure": mfi5I.congestiveHeartFailure = true
            case "hypertension":           mfi5I.hypertension = true
            default: break
            }
        case .haps:
            switch field.id {
            case "peritonismAbsent":   hapsI.peritonismAbsent = true
            case "creatinineNormal":   hapsI.creatinineNormal = true
            case "haematocritNormal":  hapsI.haematocritNormal = true
            default: break
            }
        case .glasgowImrie:
            switch field.id {
            case "pao2Below59":      glasgowImrieI.pao2Below59 = true
            case "ageAbove55":       glasgowImrieI.ageAbove55 = true
            case "wbcAbove15":       glasgowImrieI.wbcAbove15 = true
            case "calciumBelow2":    glasgowImrieI.calciumBelow2 = true
            case "albuminBelow32":   glasgowImrieI.albuminBelow32 = true
            case "ldh180":           glasgowImrieI.ldh180 = true
            case "ast100":           glasgowImrieI.ast100 = true
            case "glucoseAbove10":   glasgowImrieI.glucoseAbove10 = true
            default: break
            }
        case .albi:
            // ALBI uses continuous numeric inputs — pending fields prompt the clinician
            // to enter values; confirmPendingField is a no-op for numeric steppers
            break
        case .auditC:
            break
        case .phq9:
            break
        case .sapsII:
            break
        case .stone:
            break
        case .losAngeles:
            break
        case .meld3:
            break
        case .braden:
            break
        case .centor:
            switch field.id {
            case "tonsillarExudate":          centorI.tonsillarExudate = true
            case "tenderAnteriorCervical":    centorI.tenderAnteriorCervical = true
            case "feverHistory":              centorI.feverHistory = true
            case "noCough":                   centorI.noCough = true
            default: break
            }
        case .trueloveWitts:
            switch field.id {
            case "macroscopicBlood":  trueloveI.macroscopicBlood = true
            case "hrAbove90":         trueloveI.hrAbove90 = true
            case "tempAbove375":      trueloveI.tempAbove375 = true
            case "hbBelow105":        trueloveI.hbBelow105 = true
            case "esrAbove30":        trueloveI.esrAbove30 = true
            default: break
            }
        default: break
        }

        // Promote field from pending to auto-confirmed (teal badge)
        autoFill.autoFieldKeys.insert(field.id)
        autoFill.pendingFields.removeAll { $0.id == field.id }
        recalculate()
    }

}
