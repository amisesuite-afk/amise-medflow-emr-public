// ClinicalScoresView+Recalculate.swift
// Score recalculation and persist computed score to Bayesian fields.

import SwiftUI
import SwiftData

extension ClinicalScoresView {

    // MARK: - Recalculate

    func recalculate() {
        // Runs on every input change: write @State only when it actually changes.
        if scoreSaved { scoreSaved = false }
        guard let score = selectedScore else {
            if result != nil { result = nil }
            return
        }
        result = switch score {
        case .alvarado:     ClinicalScoringEngine.alvarado(alv)
        case .tokyoChole:   ClinicalScoringEngine.tokyoCholecystitis(tkyC)
        case .tokyoCholang: ClinicalScoringEngine.tokyoCholangitis(tkyG)
        case .ranson:       ClinicalScoringEngine.ranson(ran)
        case .glasgow:      ClinicalScoringEngine.glasgowPancreatitis(glas)
        case .rockall:      ClinicalScoringEngine.rockall(rock)
        case .blatchford:   ClinicalScoringEngine.blatchford(blatchI)
        case .sirs:         ClinicalScoringEngine.sirs(sirsI)
        case .qsofa:        ClinicalScoringEngine.qsofa(qsofaI)
        case .mews:         ClinicalScoringEngine.mews(mewsI)
        case .wellsDVT:     ClinicalScoringEngine.wellsDVT(wDVT)
        case .wellsPE:      ClinicalScoringEngine.wellsPE(wPE)
        case .abcd2:        ClinicalScoringEngine.abcd2(abcd)
        case .gcs:          ClinicalScoringEngine.gcs(gcsI)
        case .lrinec:       ClinicalScoringEngine.lrinec(lrin)
        case .rcri:         ClinicalScoringEngine.rcri(rcriI)
        case .asa:          ClinicalScoringEngine.asa(asaI)
        case .caprini:      ClinicalScoringEngine.caprini(cap)
        case .childPugh:    ClinicalScoringEngine.childPugh(cp)
        case .meld:         ClinicalScoringEngine.meld(meldI)
        case .cha2ds2vasc:  ClinicalScoringEngine.cha2ds2vasc(cha2I)
        case .hasBled:      ClinicalScoringEngine.hasBled(hblI)
        case .stopBang:     ClinicalScoringEngine.stopBang(sbangI)
        case .news2:        ClinicalScoringEngine.news2(news2I)
        case .psiPort:      ClinicalScoringEngine.psiPort(psiI)
        case .bisap:        ClinicalScoringEngine.bisap(bisapI)
        case .aims65:       ClinicalScoringEngine.aims65(aims65I)
        case .sofa:         ClinicalScoringEngine.sofa(sofaI)
        case .fib4:         ClinicalScoringEngine.fib4(fib4I)
        case .curb65:       ClinicalScoringEngine.curb65(curb65I)
        case .padua:        ClinicalScoringEngine.padua(paduaI)
        case .apacheII:     ClinicalScoringEngine.apacheII(apacheIII)
        case .ppossum:      ClinicalScoringEngine.ppossum(ppossumI)
        case .mpi:          ClinicalScoringEngine.mpi(mpiI)
        case .ctsi:         ClinicalScoringEngine.ctsi(ctsiI)
        case .nrs2002:      ClinicalScoringEngine.nrs2002(nrsI)
        case .forrest:      ClinicalScoringEngine.forrest(forrestI)
        case .heart:        ClinicalScoringEngine.heart(heartI)
        case .mallampati:   ClinicalScoringEngine.mallampati(mallampatiI)
        case .cfs:          ClinicalScoringEngine.clinicalFrailty(cfsI)
        case .timi:         ClinicalScoringEngine.timi(timiI)
        case .waterlow:     ClinicalScoringEngine.waterlow(waterlowI)
        case .surgicalApgar: ClinicalScoringEngine.surgicalApgar(surgApgarI)
        case .grace:         ClinicalScoringEngine.grace(graceI)
        case .dasi:          ClinicalScoringEngine.dasi(dasiI)
        case .barthel:       ClinicalScoringEngine.barthel(barthelI)
        case .euroScoreII:   ClinicalScoringEngine.euroScoreII(euroScI)
        case .nihss:         ClinicalScoringEngine.nihss(nihssI)
        case .mrs:           ClinicalScoringEngine.mRS(mrsI)
        case .must:          ClinicalScoringEngine.must(mustI)
        case .clavienDindo:  ClinicalScoringEngine.clavienDindo(cdI)
        case .aldrete:       ClinicalScoringEngine.aldrete(aldreteI)
        case .fourT:         ClinicalScoringEngine.fourT(fourTI)
        case .oakland:       ClinicalScoringEngine.oakland(oaklandI)
        case .kingsCriteria: ClinicalScoringEngine.kingsCriteria(kingsI)
        case .ecog:          ClinicalScoringEngine.ecog(ecogI)
        case .rts:           ClinicalScoringEngine.rts(rtsI)
        case .kdigo:         ClinicalScoringEngine.kdigo(kdigoI)
        case .baux:          ClinicalScoringEngine.baux(bauxI)
        case .iss:           ClinicalScoringEngine.iss(issI)
        case .nutric:        ClinicalScoringEngine.nutric(nutricI)
        case .spesi:         ClinicalScoringEngine.spesi(spesiI)
        case .decaf:         ClinicalScoringEngine.decaf(decafI)
        case .hinchey:       ClinicalScoringEngine.hinchey(hincheyI)
        case .airScore:      ClinicalScoringEngine.air(airI)
        case .perc:          ClinicalScoringEngine.perc(percI)
        case .shockIndex:    ClinicalScoringEngine.shockIndex(siI)
        case .parkland:      ClinicalScoringEngine.parkland(parklandI)
        case .pas:           ClinicalScoringEngine.pas(pasI)
        case .revisedGeneva: ClinicalScoringEngine.revisedGeneva(rgI)
        case .cci:           ClinicalScoringEngine.cci(cciI)
        case .mfi5:          ClinicalScoringEngine.mfi5(mfi5I)
        case .haps:          ClinicalScoringEngine.haps(hapsI)
        case .glasgowImrie:  ClinicalScoringEngine.glasgowImrie(glasgowImrieI)
        case .albi:          ClinicalScoringEngine.albi(albiI)
        case .auditC:        ClinicalScoringEngine.auditC(auditCI)
        case .phq9:          ClinicalScoringEngine.phq9(phq9I)
        case .sapsII:        ClinicalScoringEngine.sapsII(sapsIII)
        case .stone:         ClinicalScoringEngine.stone(stoneI)
        case .losAngeles:    ClinicalScoringEngine.losAngeles(losAngelesI)
        case .meld3:         ClinicalScoringEngine.meld3(meld3I)
        case .braden:        ClinicalScoringEngine.braden(bradenI)
        case .centor:        ClinicalScoringEngine.centor(centorI)
        case .ipss:          ClinicalScoringEngine.ipss(ipssI)
        case .trueloveWitts: ClinicalScoringEngine.truelovewItts(trueloveI)
        case .harveyBradshaw:ClinicalScoringEngine.harveyBradshaw(harveyI)
        case .maddrey:       ClinicalScoringEngine.maddrey(maddreyI)
        case .manning:       ClinicalScoringEngine.manning(manningI)
        case .lace:          ClinicalScoringEngine.lace(laceI)
        case .findRisc:      ClinicalScoringEngine.findrisc(findRiscI)
        case .mirels:        ClinicalScoringEngine.mirels(mirelsI)
        case .ckdEpi:        ClinicalScoringEngine.ckdEpi(ckdEpiI)
        case .ariscat:       ClinicalScoringEngine.ariscat(ariscatI)
        case .fongCrs:       ClinicalScoringEngine.fongCRS(fongI)
        case .berlinARDS:    ClinicalScoringEngine.berlinARDS(berlinI)
        case .cage:          ClinicalScoringEngine.cage(cageI)
        case .dukeIE:        ClinicalScoringEngine.dukeIE(dukeI)
        case .mmrc:          ClinicalScoringEngine.mmrc(mmrcI)
        case .pts:           ClinicalScoringEngine.pts(ptsI)
        case .ripasa:        ClinicalScoringEngine.ripasa(ripasaI)
        case .fgsi:          ClinicalScoringEngine.fgsi(fgsiI)
        }
        // NOTE: patient fields are written only on explicit save (saveScoreToAssessment),
        // NOT here, to prevent @Bindable mutation on every form input change which caused
        // continuous re-renders, score value corruption (browsed-but-unsaved scores
        // overwriting previously recorded scores with 0), and crash on navigation away.
    }

    // MARK: - Persist computed score to patient Bayesian fields (called only on explicit save)

    func persistScoreToPatient(_ score: ActiveScore, _ r: ClinicalScore) {
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
        }
    }


}
