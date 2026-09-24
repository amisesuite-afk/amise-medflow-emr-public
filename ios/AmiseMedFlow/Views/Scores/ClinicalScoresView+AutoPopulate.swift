// ClinicalScoresView+AutoPopulate.swift
// Auto-populate score fields from patient clinical data.

import SwiftUI
import SwiftData

extension ClinicalScoresView {

    // MARK: - Auto-populate from patient data

    func autoPopulate(for score: ActiveScore) {
        guard patient.isLive else { return }
        if mewsSaved  { mewsSaved = false }
        if news2Saved { news2Saved = false }
        if scoreSaved { scoreSaved = false }
        switch score {
        case .alvarado:
            let (input, fill) = PatientScoreAutoPopulator.alvarado(patient: patient)
            alv = input; autoFill = fill
        case .tokyoChole:
            let (input, fill) = PatientScoreAutoPopulator.tokyoCholecystitis(patient: patient)
            tkyC = input; autoFill = fill
        case .tokyoCholang:
            let (input, fill) = PatientScoreAutoPopulator.tokyoCholangitis(patient: patient)
            tkyG = input; autoFill = fill
        case .blatchford:
            let (input, fill) = PatientScoreAutoPopulator.blatchford(patient: patient)
            blatchI = input; autoFill = fill
        case .rockall:
            let (input, fill) = PatientScoreAutoPopulator.rockall(patient: patient)
            rock = input; autoFill = fill
        case .asa:
            let (input, fill) = PatientScoreAutoPopulator.asa(patient: patient)
            asaI = input; autoFill = fill
        case .mrs:
            let (input, fill) = PatientScoreAutoPopulator.mRS(patient: patient)
            mrsI = input; autoFill = fill
        case .clavienDindo:
            let (input, fill) = PatientScoreAutoPopulator.clavienDindo(patient: patient)
            cdI = input; autoFill = fill
        case .aldrete:
            let (input, fill) = PatientScoreAutoPopulator.aldrete(patient: patient)
            aldreteI = input; autoFill = fill
        case .news2:
            let (input, fill) = PatientScoreAutoPopulator.news2(patient: patient)
            news2I = input; autoFill = fill
        case .caprini:
            let (input, fill) = PatientScoreAutoPopulator.caprini(patient: patient)
            cap = input; autoFill = fill
        case .wellsDVT:
            let (input, fill) = PatientScoreAutoPopulator.wellsDVT(patient: patient)
            wDVT = input; autoFill = fill
        case .wellsPE:
            let (input, fill) = PatientScoreAutoPopulator.wellsPE(patient: patient)
            wPE = input; autoFill = fill
        case .rcri:
            let (input, fill) = PatientScoreAutoPopulator.rcri(patient: patient)
            rcriI = input; autoFill = fill
        case .stopBang:
            let (input, fill) = PatientScoreAutoPopulator.stopBang(patient: patient)
            sbangI = input; autoFill = fill
        case .psiPort:
            let (input, fill) = PatientScoreAutoPopulator.psiPort(patient: patient)
            psiI = input; autoFill = fill
        case .bisap:
            let (input, fill) = PatientScoreAutoPopulator.bisap(patient: patient)
            bisapI = input; autoFill = fill
        case .aims65:
            let (input, fill) = PatientScoreAutoPopulator.aims65(patient: patient)
            aims65I = input; autoFill = fill
        case .sofa:
            let (input, fill) = PatientScoreAutoPopulator.sofa(patient: patient)
            sofaI = input; autoFill = fill
        case .fib4:
            let (input, fill) = PatientScoreAutoPopulator.fib4(patient: patient)
            fib4I = input; autoFill = fill
        case .cha2ds2vasc:
            let (input, fill) = PatientScoreAutoPopulator.cha2ds2vasc(patient: patient)
            cha2I = input; autoFill = fill
        case .hasBled:
            let (input, fill) = PatientScoreAutoPopulator.hasBled(patient: patient)
            hblI = input; autoFill = fill
        case .abcd2:
            let (input, fill) = PatientScoreAutoPopulator.abcd2(patient: patient)
            abcd = input; autoFill = fill
        case .mews:
            let (input, fill) = PatientScoreAutoPopulator.mews(patient: patient)
            mewsI = input; autoFill = fill
        case .meld:
            let (input, fill) = PatientScoreAutoPopulator.meld(patient: patient)
            meldI = input; autoFill = fill
        case .sirs:
            let (input, fill) = PatientScoreAutoPopulator.sirs(patient: patient)
            sirsI = input; autoFill = fill
        case .qsofa:
            let (input, fill) = PatientScoreAutoPopulator.qsofa(patient: patient)
            qsofaI = input; autoFill = fill
        case .childPugh:
            let (input, fill) = PatientScoreAutoPopulator.childPugh(patient: patient)
            cp = input; autoFill = fill
        case .gcs:
            let (input, fill) = PatientScoreAutoPopulator.gcs(patient: patient)
            gcsI = input; autoFill = fill
        case .lrinec:
            let (input, fill) = PatientScoreAutoPopulator.lrinec(patient: patient)
            lrin = input; autoFill = fill
        case .ranson:
            let (input, fill) = PatientScoreAutoPopulator.ranson(patient: patient)
            ran = input; autoFill = fill
        case .glasgow:
            let (input, fill) = PatientScoreAutoPopulator.glasgowPancreatitis(patient: patient)
            glas = input; autoFill = fill
        case .curb65:
            let (input, fill) = PatientScoreAutoPopulator.curb65(patient: patient)
            curb65I = input; autoFill = fill
        case .padua:
            let (input, fill) = PatientScoreAutoPopulator.padua(patient: patient)
            paduaI = input; autoFill = fill
        case .apacheII:
            let (input, fill) = PatientScoreAutoPopulator.apacheII(patient: patient)
            apacheIII = input; autoFill = fill
        case .ppossum:
            let (input, fill) = PatientScoreAutoPopulator.ppossum(patient: patient)
            ppossumI = input; autoFill = fill
        case .mpi:
            let (input, fill) = PatientScoreAutoPopulator.mpi(patient: patient)
            mpiI = input; autoFill = fill
        case .ctsi:
            let (input, fill) = PatientScoreAutoPopulator.ctsi(patient: patient)
            ctsiI = input; autoFill = fill
        case .nrs2002:
            let (input, fill) = PatientScoreAutoPopulator.nrs2002(patient: patient)
            nrsI = input; autoFill = fill
        case .forrest:
            let (input, fill) = PatientScoreAutoPopulator.forrest(patient: patient)
            forrestI = input; autoFill = fill
        case .heart:
            let (input, fill) = PatientScoreAutoPopulator.heart(patient: patient)
            heartI = input; autoFill = fill
        case .mallampati:
            let (input, fill) = PatientScoreAutoPopulator.mallampati(patient: patient)
            mallampatiI = input; autoFill = fill
        case .cfs:
            let (input, fill) = PatientScoreAutoPopulator.cfs(patient: patient)
            cfsI = input; autoFill = fill
        case .timi:
            let (input, fill) = PatientScoreAutoPopulator.timi(patient: patient)
            timiI = input; autoFill = fill
        case .waterlow:
            let (input, fill) = PatientScoreAutoPopulator.waterlow(patient: patient)
            waterlowI = input; autoFill = fill
        case .surgicalApgar:
            let (input, fill) = PatientScoreAutoPopulator.surgicalApgar(patient: patient)
            surgApgarI = input; autoFill = fill
        case .grace:
            let (input, fill) = PatientScoreAutoPopulator.grace(patient: patient)
            graceI = input; autoFill = fill
        case .dasi:
            let (input, fill) = PatientScoreAutoPopulator.dasi(patient: patient)
            dasiI = input; autoFill = fill
        case .barthel:
            let (input, fill) = PatientScoreAutoPopulator.barthel(patient: patient)
            barthelI = input; autoFill = fill
        case .euroScoreII:
            let (input, fill) = PatientScoreAutoPopulator.euroScoreII(patient: patient)
            euroScI = input; autoFill = fill
        case .nihss:
            let (input, fill) = PatientScoreAutoPopulator.nihss(patient: patient)
            nihssI = input; autoFill = fill
        case .must:
            let (input, fill) = PatientScoreAutoPopulator.must(patient: patient)
            mustI = input; autoFill = fill
        case .fourT:
            let (input, fill) = PatientScoreAutoPopulator.fourT(patient: patient)
            fourTI = input; autoFill = fill
        case .oakland:
            let (input, fill) = PatientScoreAutoPopulator.oakland(patient: patient)
            oaklandI = input; autoFill = fill
        case .kingsCriteria:
            let (input, fill) = PatientScoreAutoPopulator.kingsCriteria(patient: patient)
            kingsI = input; autoFill = fill
        case .ecog:
            let (input, fill) = PatientScoreAutoPopulator.ecog(patient: patient)
            ecogI = input; autoFill = fill
        case .rts:
            let (input, fill) = PatientScoreAutoPopulator.rts(patient: patient)
            rtsI = input; autoFill = fill
        case .kdigo:
            let (input, fill) = PatientScoreAutoPopulator.kdigo(patient: patient)
            kdigoI = input; autoFill = fill
        case .baux:
            let (input, fill) = PatientScoreAutoPopulator.baux(patient: patient)
            bauxI = input; autoFill = fill
        case .iss:
            let (input, fill) = PatientScoreAutoPopulator.iss(patient: patient)
            issI = input; autoFill = fill
        case .nutric:
            let (input, fill) = PatientScoreAutoPopulator.nutric(patient: patient)
            nutricI = input; autoFill = fill
        case .spesi:
            let (input, fill) = PatientScoreAutoPopulator.spesi(patient: patient)
            spesiI = input; autoFill = fill
        case .decaf:
            let (input, fill) = PatientScoreAutoPopulator.decaf(patient: patient)
            decafI = input; autoFill = fill
        case .hinchey:
            let (input, fill) = PatientScoreAutoPopulator.hinchey(patient: patient)
            hincheyI = input; autoFill = fill
        case .airScore:
            let (input, fill) = PatientScoreAutoPopulator.airScore(patient: patient)
            airI = input; autoFill = fill
        case .perc:
            let (input, fill) = PatientScoreAutoPopulator.perc(patient: patient)
            percI = input; autoFill = fill
        case .shockIndex:
            let (input, fill) = PatientScoreAutoPopulator.shockIndex(patient: patient)
            siI = input; autoFill = fill
        case .parkland:
            let (input, fill) = PatientScoreAutoPopulator.parkland(patient: patient)
            parklandI = input; autoFill = fill
        case .pas:
            let (input, fill) = PatientScoreAutoPopulator.pas(patient: patient)
            pasI = input; autoFill = fill
        case .revisedGeneva:
            let (input, fill) = PatientScoreAutoPopulator.revisedGeneva(patient: patient)
            rgI = input; autoFill = fill
        case .cci:
            let (input, fill) = PatientScoreAutoPopulator.cci(patient: patient)
            cciI = input; autoFill = fill
        case .mfi5:
            let (input, fill) = PatientScoreAutoPopulator.mfi5(patient: patient)
            mfi5I = input; autoFill = fill
        case .haps:
            let (input, fill) = PatientScoreAutoPopulator.haps(patient: patient)
            hapsI = input; autoFill = fill
        case .glasgowImrie:
            let (input, fill) = PatientScoreAutoPopulator.glasgowImrie(patient: patient)
            glasgowImrieI = input; autoFill = fill
        case .albi:
            let (input, fill) = PatientScoreAutoPopulator.albi(patient: patient)
            albiI = input; autoFill = fill
        case .auditC:
            let (input, fill) = PatientScoreAutoPopulator.auditC(patient: patient)
            auditCI = input; autoFill = fill
        case .phq9:
            let (input, fill) = PatientScoreAutoPopulator.phq9(patient: patient)
            phq9I = input; autoFill = fill
        case .sapsII:
            let (input, fill) = PatientScoreAutoPopulator.sapsII(patient: patient)
            sapsIII = input; autoFill = fill
        case .stone:
            let (input, fill) = PatientScoreAutoPopulator.stone(patient: patient)
            stoneI = input; autoFill = fill
        case .losAngeles:
            let (input, fill) = PatientScoreAutoPopulator.losAngeles(patient: patient)
            losAngelesI = input; autoFill = fill
        case .meld3:
            let (input, fill) = PatientScoreAutoPopulator.meld3(patient: patient)
            meld3I = input; autoFill = fill
        case .braden:
            let (input, fill) = PatientScoreAutoPopulator.braden(patient: patient)
            bradenI = input; autoFill = fill
        case .centor:
            let (input, fill) = PatientScoreAutoPopulator.centor(patient: patient)
            centorI = input; autoFill = fill
        case .ipss:
            let (input, fill) = PatientScoreAutoPopulator.ipss(patient: patient)
            ipssI = input; autoFill = fill
        case .trueloveWitts:
            let (input, fill) = PatientScoreAutoPopulator.trueloveWitts(patient: patient)
            trueloveI = input; autoFill = fill
        case .harveyBradshaw:
            let (input, fill) = PatientScoreAutoPopulator.harveyBradshaw(patient: patient)
            harveyI = input; autoFill = fill
        case .maddrey:
            let (input, fill) = PatientScoreAutoPopulator.maddrey(patient: patient)
            maddreyI = input; autoFill = fill
        case .manning:
            let (input, fill) = PatientScoreAutoPopulator.manning(patient: patient)
            manningI = input; autoFill = fill
        case .lace:
            let (input, fill) = PatientScoreAutoPopulator.lace(patient: patient)
            laceI = input; autoFill = fill
        case .findRisc:
            let (input, fill) = PatientScoreAutoPopulator.findRisc(patient: patient)
            findRiscI = input; autoFill = fill
        case .mirels:
            let (input, fill) = PatientScoreAutoPopulator.mirels(patient: patient)
            mirelsI = input; autoFill = fill
        case .ckdEpi:
            let (input, fill) = PatientScoreAutoPopulator.ckdEpi(patient: patient)
            ckdEpiI = input; autoFill = fill
        case .ariscat:
            let (input, fill) = PatientScoreAutoPopulator.ariscat(patient: patient)
            ariscatI = input; autoFill = fill
        case .fongCrs:
            let (input, fill) = PatientScoreAutoPopulator.fongCrs(patient: patient)
            fongI = input; autoFill = fill
        case .berlinARDS:
            let (input, fill) = PatientScoreAutoPopulator.berlinARDS(patient: patient)
            berlinI = input; autoFill = fill
        case .cage:
            let (input, fill) = PatientScoreAutoPopulator.cage(patient: patient)
            cageI = input; autoFill = fill
        case .dukeIE:
            let (input, fill) = PatientScoreAutoPopulator.dukeIE(patient: patient)
            dukeI = input; autoFill = fill
        case .mmrc:
            let (input, fill) = PatientScoreAutoPopulator.mmrc(patient: patient)
            mmrcI = input; autoFill = fill
        case .pts:
            let (input, fill) = PatientScoreAutoPopulator.pts(patient: patient)
            ptsI = input; autoFill = fill
        case .ripasa:
            let (input, fill) = PatientScoreAutoPopulator.ripasa(patient: patient)
            ripasaI = input; autoFill = fill
        case .fgsi:
            let (input, fill) = PatientScoreAutoPopulator.fgsi(patient: patient)
            fgsiI = input; autoFill = fill
        }
    }


}
