import Foundation
import SwiftData

@Model
final class OperativePlan {
    var id: UUID
    var updatedAt: Date
    var patient: Patient?

    // Consent
    var consentProcedure: String
    var consentSigned: Bool

    // Anaesthesia & prep
    var anaesthesiaType: String
    var positioning: String
    var antibioticProphylaxis: String
    var vteProphy: String
    var specialEquipment: String
    var surgicalTeamNote: String

    // WHO Sign In
    var whoIdentityConfirmed: Bool
    var whoSiteMarked: Bool
    var whoAnaesthesiaCheckDone: Bool
    var whoPulseOxOk: Bool
    var whoAllergiesReviewed: Bool
    var whoAspirationRisk: Bool
    var whoAirwayRisk: Bool

    // WHO Time Out
    var whoTeamIntroduced: Bool
    var whoProcedureConfirmed: Bool
    var whoAntibioticGiven: Bool
    var whoCriticalStepsDiscussed: Bool
    var whoImagingDisplayed: Bool
    var whoSterilityConfirmed: Bool

    // WHO Sign Out
    var whoSwabsCounted: Bool
    var whoSpecimenLabelled: Bool
    var whoEquipmentIssues: Bool
    var whoRecoveryConcerns: Bool

    init() {
        self.id = UUID()
        self.updatedAt = .now
        self.consentProcedure = ""
        self.consentSigned = false
        self.anaesthesiaType = "General"
        self.positioning = "Supine"
        self.antibioticProphylaxis = "Co-amoxiclav 1.2 g IV at induction"
        self.vteProphy = "TED stockings + LMWH"
        self.specialEquipment = ""
        self.surgicalTeamNote = ""
        self.whoIdentityConfirmed = false
        self.whoSiteMarked = false
        self.whoAnaesthesiaCheckDone = false
        self.whoPulseOxOk = false
        self.whoAllergiesReviewed = false
        self.whoAspirationRisk = false
        self.whoAirwayRisk = false
        self.whoTeamIntroduced = false
        self.whoProcedureConfirmed = false
        self.whoAntibioticGiven = false
        self.whoCriticalStepsDiscussed = false
        self.whoImagingDisplayed = false
        self.whoSterilityConfirmed = false
        self.whoSwabsCounted = false
        self.whoSpecimenLabelled = false
        self.whoEquipmentIssues = false
        self.whoRecoveryConcerns = false
    }

    var whoCompletedCount: Int {
        [whoIdentityConfirmed, whoSiteMarked, whoAnaesthesiaCheckDone, whoPulseOxOk,
         whoAllergiesReviewed, whoAspirationRisk, whoAirwayRisk,
         whoTeamIntroduced, whoProcedureConfirmed, whoAntibioticGiven,
         whoCriticalStepsDiscussed, whoImagingDisplayed, whoSterilityConfirmed,
         whoSwabsCounted, whoSpecimenLabelled, whoEquipmentIssues, whoRecoveryConcerns
        ].filter { $0 }.count
    }

    var whoTotalCount: Int { 17 }
}
