// ScorePersistence.swift
// Where each calculator's saved result is stored on the Patient (the fields the Bayesian engine,
// the decision layer and the Exam step read). Moved out of ClinicalScoresView.persistScoreToPatient
// unchanged, so the clinical-validation runner (ClinValIOSRunner) stores a recorded calculator result
// exactly as the app does before the differential runs. Called only on an explicit save.

import Foundation

enum ScorePersistence {

    static func store(_ score: ActiveScore, _ r: ClinicalScore, on patient: Patient) {
        guard r.score.isFinite else { return }
        let intScore = Int(r.score)
        switch score {
        case .alvarado:     patient.alvaradoScore            = intScore
        case .glasgow:      patient.glasgowPancreatitisScore = intScore
        case .ranson:       patient.ransonScore              = intScore
        case .tokyoChole:   patient.tokyoCholecystitisGrade  = intScore
        case .tokyoCholang: patient.tokyoCholangitisGrade    = intScore
        case .rockall:      patient.rockallScore             = intScore
        case .blatchford:   patient.blatchfordScore          = intScore
        case .wellsDVT:     patient.wellsDVTScore            = r.score
        case .wellsPE:      patient.wellsPEScore             = r.score
        case .abcd2:        patient.abcd2Score               = intScore
        case .lrinec:       patient.lrinecScore              = intScore
        case .qsofa:        patient.qsofaScore               = intScore
        case .psiPort:
            patient.psiScore = Int(r.abbreviation.components(separatedBy: "Class ").last ?? "") ?? 0
        case .bisap:        patient.bisapScore  = intScore
        case .aims65:       patient.aims65Score = intScore
        case .sofa:         patient.sofaScore   = intScore
        case .fib4:         patient.fib4Score   = r.score
        case .curb65:       patient.curb65Score   = intScore
        case .padua:        patient.paduaScore    = intScore
        case .apacheII:     patient.apacheIIScore    = intScore
        case .ppossum:      patient.ppossumMortPct10 = Int(r.score * 10)
        case .mpi:          patient.mpiScore = intScore
        case .ctsi:         patient.ctsiScore = intScore
        case .nrs2002:      patient.nrs2002Score = intScore
        case .forrest:      patient.forrestGrade = intScore
        case .heart:        patient.heartScore = intScore
        case .mallampati:   patient.mallampatiScore = intScore
        case .cfs:          patient.cfsScore = intScore
        case .timi:         patient.timiScore = intScore
        case .waterlow:     patient.waterlowScore = intScore
        case .surgicalApgar: patient.surgicalApgarScore = intScore
        case .grace:         patient.graceScore = intScore
        case .dasi:          patient.dasiScore = intScore
        case .barthel:       patient.barthelScore = intScore
        case .euroScoreII:   patient.euroScoreII = Int((r.score * 10).rounded())
        case .nihss:         patient.nihssScore = intScore
        case .mrs:           patient.mrsScore = intScore
        case .must:          patient.mustScore = intScore
        case .clavienDindo:  patient.clavienDindoScore = intScore
        case .aldrete:       patient.aldreteScore = intScore
        case .fourT:         patient.fourTScore = intScore
        case .oakland:       patient.oaklandScore = intScore
        case .kingsCriteria: patient.kingsCriteriaScore = intScore
        case .childPugh:     patient.childPughScore = intScore
        case .meld:          patient.meldScore = intScore
        case .asa:           patient.asaScore = intScore
        case .ecog:          patient.ecogScore = intScore
        case .rts:           patient.rtsScore = Int((r.score * 100).rounded())
        case .kdigo:         patient.kdigoStage = intScore
        case .baux:          patient.bauxScore = intScore
        case .iss:           patient.issScore = intScore
        case .nutric:        patient.nutricScore = intScore
        case .spesi:         patient.spesiScore = intScore
        case .decaf:         patient.decafScore = intScore
        case .hinchey:       patient.hincheyGrade = intScore
        case .airScore:      patient.airScore = intScore
        case .perc:          patient.percViolations = intScore
        case .shockIndex:    patient.shockIndex = Int((r.score * 100).rounded())
        case .caprini:       patient.capriniScore = intScore
        case .parkland:      patient.parklandVolume = intScore
        case .pas:           patient.pasScore = intScore
        case .revisedGeneva: patient.revisedGenevaScore = intScore
        case .cci:           patient.cciScore = intScore
        case .mfi5:          patient.mfi5Score = intScore
        case .haps:          patient.hapsScore = intScore
        case .glasgowImrie:  patient.glasgowImrieScore = intScore
        case .albi:          patient.albiScore    = r.score
        case .auditC:        patient.auditCScore  = intScore
        case .phq9:          patient.phq9Score    = intScore
        case .sapsII:        patient.sapsIIScore    = intScore
        case .stone:         patient.stoneScore     = intScore
        case .losAngeles:    patient.losAngelesGrade = intScore
        case .meld3:         patient.meld3Score     = r.score
        case .braden:        patient.bradenScore         = intScore
        case .centor:        patient.centorScore         = intScore
        case .ipss:          patient.ipssScore           = intScore
        case .trueloveWitts: patient.trueloveWittsScore  = intScore
        case .harveyBradshaw:patient.harveyBradshawScore = intScore
        case .maddrey:       patient.maddreyScore  = r.score
        case .manning:       patient.manningScore  = intScore
        case .lace:          patient.laceScore     = intScore
        case .findRisc:      patient.findRiscScore = intScore
        case .mirels:        patient.mirelsScore   = intScore
        case .ckdEpi:        patient.ckdEpiEgfr    = r.score
        case .ariscat:       patient.ariscatScore  = intScore
        case .fongCrs:       patient.fongCrsScore  = intScore
        case .berlinARDS:    patient.berlinPFRatio  = r.score
        case .cage:          patient.cageScore      = intScore
        case .dukeIE:        patient.dukeIEScore    = r.score
        case .mmrc:          patient.mmrcGrade      = intScore
        case .pts:           patient.ptsScore       = intScore
        case .ripasa:        patient.ripasaScore    = r.score
        case .fgsi:          patient.fgsiScore      = intScore
        case .sirs:          patient.sirsScore          = intScore
        case .mews:          patient.mewsScore          = intScore
        case .news2:         patient.independentNews2   = intScore
        case .gcs:           patient.gcsScore           = intScore
        case .rcri:          patient.rcriScore          = intScore
        case .stopBang:      patient.stopBangScore      = intScore
        case .cha2ds2vasc:   patient.cha2ds2vascScore   = intScore
        case .hasBled:       patient.hasBledScore       = intScore
        case .stoneUreteric:  patient.stoneUretericScore  = intScore
        case .ottawaAnkle:    patient.ottawaAnkleScore    = intScore
        case .ottawaKnee:     patient.ottawaKneeScore     = intScore
        case .canadianCTHead: patient.canadianCTHeadScore = intScore
        case .nexus:          patient.nexusScore          = intScore
        case .canadianCSpine: patient.canadianCSpineScore = intScore
        case .sfSyncope:      patient.sfSyncopeScore      = intScore
        case .canadianSyncope: patient.canadianSyncopeScore = intScore
        }
    }
}
