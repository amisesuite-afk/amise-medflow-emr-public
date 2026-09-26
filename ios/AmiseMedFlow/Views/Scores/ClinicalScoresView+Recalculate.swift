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
        case .stoneUreteric:  ClinicalScoringEngine.stoneUreteric(stoneUretericI)
        case .ottawaAnkle:    ClinicalScoringEngine.ottawaAnkle(ottawaAnkleI)
        case .ottawaKnee:     ClinicalScoringEngine.ottawaKnee(ottawaKneeI)
        case .canadianCTHead: ClinicalScoringEngine.canadianCTHead(canadianCTHeadI)
        case .nexus:          ClinicalScoringEngine.nexus(nexusI)
        case .canadianCSpine: ClinicalScoringEngine.canadianCSpine(canadianCSpineI)
        case .sfSyncope:      ClinicalScoringEngine.sanFranciscoSyncope(sfSyncopeI)
        case .canadianSyncope: ClinicalScoringEngine.canadianSyncope(canadianSyncopeI)
        }
        // NOTE: patient fields are written only on explicit save (saveScoreToAssessment),
        // NOT here, to prevent @Bindable mutation on every form input change which caused
        // continuous re-renders, score value corruption (browsed-but-unsaved scores
        // overwriting previously recorded scores with 0), and crash on navigation away.
    }

    // MARK: - Persist computed score to patient Bayesian fields (called only on explicit save)

    func persistScoreToPatient(_ score: ActiveScore, _ r: ClinicalScore) {
        ScorePersistence.store(score, r, on: patient)
    }


}
