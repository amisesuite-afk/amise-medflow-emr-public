import Foundation
import SwiftData

@Model
final class OperativePlan {
    var id: UUID = UUID()
    var updatedAt: Date = .now
    var patient: Patient?

    // Consent
    var consentProcedure: String = ""
    var consentSigned: Bool = false

    // Anaesthesia & prep
    var anaesthesiaType: String = "General"
    var positioning: String = "Supine"
    var antibioticProphylaxis: String = "Co-amoxiclav 1.2 g IV at induction"
    var vteProphy: String = "TED stockings + LMWH"
    var specialEquipment: String = ""
    var surgicalTeamNote: String = ""

    // WHO Sign In
    var whoIdentityConfirmed: Bool = false
    var whoSiteMarked: Bool = false
    var whoAnaesthesiaCheckDone: Bool = false
    var whoPulseOxOk: Bool = false
    var whoAllergiesReviewed: Bool = false
    var whoAspirationRisk: Bool = false
    var whoAirwayRisk: Bool = false

    // WHO Time Out
    var whoTeamIntroduced: Bool = false
    var whoProcedureConfirmed: Bool = false
    var whoAntibioticGiven: Bool = false
    var whoCriticalStepsDiscussed: Bool = false
    var whoImagingDisplayed: Bool = false
    var whoSterilityConfirmed: Bool = false

    // WHO Sign Out
    var whoSwabsCounted: Bool = false
    var whoSpecimenLabelled: Bool = false
    var whoEquipmentIssues: Bool = false
    var whoRecoveryConcerns: Bool = false

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
