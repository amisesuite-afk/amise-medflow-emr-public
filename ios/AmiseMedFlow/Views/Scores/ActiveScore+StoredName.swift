// ActiveScore+StoredName.swift
// Maps a saved score's stored name back to its ActiveScore.

import Foundation

extension ActiveScore {

    /// The score a saved `ScoreHistoryEntry.scoreName` belongs to.
    ///
    /// Saves store the engine's display name (`ClinicalScore.systemName`, e.g. "Alvarado Score"),
    /// not `rawValue` ("Alvarado (Appendicitis)"), and those entries are synced to other devices,
    /// so the stored value stays as it is. This accepts either form: the rawValue first, then the
    /// engine name.
    init?(storedScoreName name: String) {
        if let score = ActiveScore(rawValue: name) {
            self = score
        } else if let score = ActiveScore.bySystemName[name] {
            self = score
        } else {
            return nil
        }
    }

    /// Engine display name(s) (`ClinicalScore.systemName`) → score, taken from the engine's
    /// `ClinicalScore(systemName:…)` / `ClinicalScore(name:…)` calls for the function
    /// `ClinicalScoresView.recalculate()` uses for each score. Keep in step if a name changes.
    static let bySystemName: [String: ActiveScore] = [
        "Alvarado Score":                                  .alvarado,
        "Acute Cholecystitis Severity":                    .tokyoChole,
        "Acute Cholangitis Severity":                      .tokyoCholang,
        "Ranson Criteria":                                 .ranson,
        "Glasgow Pancreatitis Score":                      .glasgow,
        "Rockall Score":                                   .rockall,
        "Glasgow-Blatchford Score":                        .blatchford,
        "SIRS Criteria":                                   .sirs,
        "qSOFA Score":                                     .qsofa,
        "Modified Early Warning Score":                    .mews,
        "Wells DVT Score":                                 .wellsDVT,
        "Wells PE Score":                                  .wellsPE,
        "ABCD2 Score":                                     .abcd2,
        "Glasgow Coma Scale":                              .gcs,
        "LRINEC Score":                                    .lrinec,
        "Revised Cardiac Risk Index":                      .rcri,
        "ASA Physical Status Classification":              .asa,
        "Caprini VTE Risk Score":                          .caprini,
        "Child-Pugh Score":                                .childPugh,
        "MELD-Na Score":                                   .meld,
        "CHA₂DS₂-VASc Score":                              .cha2ds2vasc,
        "HAS-BLED Bleeding Risk Score":                    .hasBled,
        "STOP-BANG Questionnaire":                         .stopBang,
        "National Early Warning Score 2":                  .news2,
        "Pneumonia Severity Index":                        .psiPort,
        "BISAP Score":                                     .bisap,
        "AIMS65 Score":                                    .aims65,
        "Sequential Organ Failure Assessment":             .sofa,
        "FIB-4 Liver Fibrosis Index":                      .fib4,
        "CURB-65":                                         .curb65,
        "Padua Prediction Score":                          .padua,
        "APACHE II Score":                                 .apacheII,
        "P-POSSUM":                                        .ppossum,
        "Mannheim Peritonitis Index":                      .mpi,
        "CT Severity Index":                               .ctsi,
        "NRS-2002":                                        .nrs2002,
        "Forrest Classification":                          .forrest,
        "HEART Score":                                     .heart,
        "Mallampati Airway Classification":                .mallampati,
        "Clinical Frailty Scale":                          .cfs,
        "TIMI Risk Score (UA/NSTEMI)":                     .timi,
        "Waterlow Pressure Ulcer Risk":                    .waterlow,
        "Surgical Apgar Score":                            .surgicalApgar,
        "GRACE Score":                                     .grace,
        "Duke Activity Status Index":                      .dasi,
        "Barthel Index":                                   .barthel,
        "EuroSCORE II":                                    .euroScoreII,
        "NIH Stroke Scale":                                .nihss,
        "modified Rankin Scale":                           .mrs,
        "Malnutrition Universal Screening Tool":           .must,
        "Clavien-Dindo Classification":                    .clavienDindo,
        "Modified Aldrete Recovery Score":                 .aldrete,
        "4T Score":                                        .fourT,
        "Oakland Score (LGIB)":                            .oakland,
        "King's College Criteria (ALF)":                   .kingsCriteria,
        "ECOG Performance Status":                         .ecog,
        "Revised Trauma Score":                            .rts,
        "KDIGO AKI Staging":                               .kdigo,
        "Baux Score (Revised)":                            .baux,
        "Injury Severity Score":                           .iss,
        "NUTRIC Score":                                    .nutric,
        "Simplified PESI":                                 .spesi,
        "DECAF Score":                                     .decaf,
        "Hinchey Classification":                          .hinchey,
        "AIR Score (Appendicitis Inflammatory Response)":  .airScore,
        "PERC Rule (PE Rule-out Criteria)":                .perc,
        "Shock Index":                                     .shockIndex,
        "Parkland Formula (Burns Fluid)":                  .parkland,
        "Paediatric Appendicitis Score (PAS)":             .pas,
        "Revised Geneva Score (PE)":                       .revisedGeneva,
        "Charlson Comorbidity Index":                      .cci,
        "Modified Frailty Index-5 (mFI-5)":                .mfi5,
        "Harmless Acute Pancreatitis Score (HAPS)":        .haps,
        "Glasgow-Imrie Pancreatitis Score":                .glasgowImrie,
        "ALBI Score":                                      .albi,
        "AUDIT-C":                                         .auditC,
        "PHQ-9":                                           .phq9,
        "SAPS II":                                         .sapsII,
        // Entries saved before the relabel carry "STONE Score": they are the local CT features score.
        "STONE Score":                                     .stone,
        "Stone CT Features Score (not STONE)":             .stone,
        "STONE Score (Moore 2014)":                        .stoneUreteric,
        "Ottawa Ankle and Foot Rules":                     .ottawaAnkle,
        "Ottawa Knee Rule":                                .ottawaKnee,
        "Canadian CT Head Rule":                           .canadianCTHead,
        "NEXUS Cervical Spine Criteria":                   .nexus,
        "Canadian C-Spine Rule":                           .canadianCSpine,
        "San Francisco Syncope Rule":                      .sfSyncope,
        "Canadian Syncope Risk Score":                     .canadianSyncope,
        "LA Classification":                               .losAngeles,
        "MELD 3.0":                                        .meld3,
        "Braden Scale":                                    .braden,
        "Centor / McIsaac":                                .centor,
        "IPSS":                                            .ipss,
        "Truelove-Witts":                                  .trueloveWitts,
        "Harvey-Bradshaw Index":                           .harveyBradshaw,
        "Maddrey Discriminant Function":                   .maddrey,
        "Manning Criteria for IBS":                        .manning,
        "LACE Index":                                      .lace,
        "FINDRISC":                                        .findRisc,
        "Mirels Criteria":                                 .mirels,
        "CKD-EPI eGFR":                                    .ckdEpi,
        "CKD-EPI (2021)":                                  .ckdEpi,
        "ARISCAT Score":                                   .ariscat,
        "Fong Clinical Risk Score":                        .fongCrs,
        "Berlin ARDS Criteria":                            .berlinARDS,
        "CAGE Questionnaire":                              .cage,
        "Duke Criteria for IE":                            .dukeIE,
        "mMRC Dyspnoea Scale":                             .mmrc,
        "Paediatric Trauma Score (PTS)":                   .pts,
        "RIPASA Score":                                    .ripasa,
        "Fournier Gangrene Severity Index (FGSI)":         .fgsi,
    ]
}
