// ClinicalPathwayEngine.swift
// Bayesian triage result types and clinical pathway engine.

import Foundation

// MARK: - Bayesian Triage / Pathway Engine

struct DifferentialDx {
    let name: String
    let probability: Int  // estimated pre-test probability (0–100), not summing to 100
}

struct TriageResult {
    let suggestedAcuity: Acuity
    let redFlags: [String]
    let pathway: String
    let confidencePercent: Int
    let differentials: [DifferentialDx]
}

enum ClinicalPathwayEngine {
    static func assess(chiefComplaint: String, pmh: String = "") -> TriageResult {
        let cc = chiefComplaint.lowercased()
        let history = pmh.lowercased()

        var redFlags: [String] = []
        var suggestedAcuity: Acuity = .routine
        var pathway = "General Surgery Outpatient"
        var confidence = 60
        var differentials: [DifferentialDx] = []

        // --- Red flag detection ---
        let emergencyKeywords = ["rigidity", "peritonitis", "septic shock", "haemodynamic instability",
                                  "perforation", "massive haemorrhage", "ruptured", "acute abdomen",
                                  "strangulated", "ischemia", "bowel necrosis"]
        let urgentKeywords = ["acute", "severe pain", "vomiting blood", "haematemesis", "melaena",
                               "unable to open bowels", "complete obstruction", "high fever", "jaundice",
                               "cholangitis", "pancreatitis", "perforated"]

        for kw in emergencyKeywords where cc.contains(kw) || history.contains(kw) {
            redFlags.append("⚠️ \(kw.capitalized)")
            suggestedAcuity = .emergency
        }

        if suggestedAcuity != .emergency {
            for kw in urgentKeywords where cc.contains(kw) {
                suggestedAcuity = .urgent
                break
            }
        }

        // --- Pathway assignment ---
        if cc.contains("append") || cc.contains("right iliac fossa") || cc.contains("rif pain") {
            pathway = "Appendicitis Pathway"
            differentials = [.init(name: "Acute appendicitis", probability: 68),
                             .init(name: "Mesenteric adenitis", probability: 45),
                             .init(name: "Ovarian cyst / torsion", probability: 30),
                             .init(name: "Ectopic pregnancy", probability: 22)]
            if suggestedAcuity == .routine { suggestedAcuity = .urgent }
            confidence = 72
            if cc.contains("peritonitis") || cc.contains("perforation") {
                redFlags.append("⚠️ Possible perforated appendicitis")
                suggestedAcuity = .emergency
            }
        } else if cc.contains("gall") || cc.contains("biliary") || cc.contains("cholecyst") || cc.contains("ruc pain") || cc.contains("right upper") {
            pathway = "Biliary Pathway"
            differentials = [.init(name: "Biliary colic", probability: 65),
                             .init(name: "Acute cholecystitis", probability: 55),
                             .init(name: "Choledocholithiasis", probability: 38),
                             .init(name: "Cholangitis", probability: 18)]
            confidence = 75
            if cc.contains("cholangitis") || cc.contains("jaundice") {
                redFlags.append("⚠️ Possible Charcot's triad — exclude cholangitis")
                suggestedAcuity = .urgent
            }
        } else if cc.contains("hernia") {
            pathway = "Hernia Pathway"
            differentials = [.init(name: "Inguinal hernia", probability: 72),
                             .init(name: "Femoral hernia", probability: 38),
                             .init(name: "Umbilical hernia", probability: 30),
                             .init(name: "Incisional hernia", probability: 22)]
            confidence = 85
            if cc.contains("obstruct") || cc.contains("strangulat") || cc.contains("can't reduce") {
                redFlags.append("⚠️ Possible strangulated/obstructed hernia")
                suggestedAcuity = .emergency
            }
        } else if cc.contains("rectal bleed") || cc.contains("pr bleed") || cc.contains("melaena") || cc.contains("haematemesis") {
            pathway = "GI Haemorrhage Pathway"
            differentials = [.init(name: "Haemorrhoids", probability: 58),
                             .init(name: "Diverticular bleed", probability: 42),
                             .init(name: "Colorectal cancer", probability: 32),
                             .init(name: "Peptic ulcer disease", probability: 28),
                             .init(name: "Angiodysplasia", probability: 18)]
            confidence = 70
            if cc.contains("massive") || cc.contains("shocked") {
                redFlags.append("⚠️ Massive GI haemorrhage — resuscitate urgently")
                suggestedAcuity = .emergency
            } else {
                suggestedAcuity = .urgent
            }
        } else if cc.contains("obstruct") || cc.contains("distension") || cc.contains("vomiting") && cc.contains("not open bowels") {
            pathway = "Bowel Obstruction Pathway"
            differentials = [.init(name: "Adhesional obstruction", probability: 55),
                             .init(name: "Colorectal cancer", probability: 38),
                             .init(name: "Hernia", probability: 30),
                             .init(name: "Volvulus", probability: 22),
                             .init(name: "Diverticular disease", probability: 18)]
            confidence = 65
            suggestedAcuity = .urgent
            if cc.contains("volvulus") || cc.contains("ischaemia") {
                redFlags.append("⚠️ Possible closed-loop obstruction")
                suggestedAcuity = .emergency
            }
        } else if cc.contains("breast") || cc.contains("lump") && (cc.contains("axilla") || cc.contains("nipple")) {
            pathway = "Breast Surgery Pathway"
            differentials = [.init(name: "Fibroadenoma", probability: 45),
                             .init(name: "Breast cyst", probability: 38),
                             .init(name: "Breast carcinoma", probability: 30),
                             .init(name: "Mastitis / abscess", probability: 22),
                             .init(name: "Gynaecomastia", probability: 12)]
            confidence = 60
            if cc.contains("skin tether") || cc.contains("nipple retract") || cc.contains("peau d'orange") {
                redFlags.append("⚠️ Signs suspicious for malignancy — urgent triple assessment")
                suggestedAcuity = .priority
            }
        } else if cc.contains("thyroid") || cc.contains("goitre") || cc.contains("neck swelling") {
            pathway = "Thyroid Pathway"
            differentials = [.init(name: "Multinodular goitre", probability: 55),
                             .init(name: "Solitary thyroid nodule", probability: 45),
                             .init(name: "Thyroid carcinoma", probability: 28),
                             .init(name: "Thyroiditis", probability: 22)]
            confidence = 70
            if cc.contains("stridor") || cc.contains("dysphagia") || cc.contains("rapidly growing") {
                redFlags.append("⚠️ Compressive/invasive — urgent assessment")
                suggestedAcuity = .priority
            }
        } else if cc.contains("pancreatit") || cc.contains("epigastric") && (cc.contains("severe") || cc.contains("radiating to back")) {
            pathway = "Pancreatitis Pathway"
            differentials = [.init(name: "Acute pancreatitis", probability: 65),
                             .init(name: "Peptic ulcer disease", probability: 32),
                             .init(name: "Aortic aneurysm", probability: 18),
                             .init(name: "Myocardial infarction", probability: 14)]
            confidence = 68
            suggestedAcuity = .urgent
        } else if cc.contains("colorectal") || cc.contains("change in bowel habit") || cc.contains("rectal mass") || cc.contains("weight loss") {
            pathway = "Colorectal Screening Pathway"
            differentials = [.init(name: "Diverticular disease", probability: 52),
                             .init(name: "IBS", probability: 48),
                             .init(name: "Colorectal carcinoma", probability: 38),
                             .init(name: "Polyps", probability: 35),
                             .init(name: "IBD", probability: 28)]
            confidence = 60
            if cc.contains("weight loss") || cc.contains("iron deficiency") {
                redFlags.append("⚠️ Red flag symptoms — urgent colonoscopy")
                suggestedAcuity = .priority
            }
        } else if cc.contains("abscess") || cc.contains("perianal") || cc.contains("fistula") || cc.contains("fissure") {
            pathway = "Anorectal Pathway"
            differentials = [.init(name: "Haemorrhoids", probability: 60),
                             .init(name: "Anal fissure", probability: 50),
                             .init(name: "Perianal abscess", probability: 42),
                             .init(name: "Anal fistula", probability: 35),
                             .init(name: "Pilonidal disease", probability: 28)]
            confidence = 78
            if cc.contains("sepsis") || cc.contains("necrotising") {
                redFlags.append("⚠️ Possible necrotising infection — urgent surgical review")
                suggestedAcuity = .emergency
            }
        } else if cc.contains("ercp") || cc.contains("common bile duct") || cc.contains("cbd stone") {
            pathway = "ERCP / Biliary Endoscopy Pathway"
            differentials = [.init(name: "Choledocholithiasis", probability: 72),
                             .init(name: "Biliary stricture", probability: 38),
                             .init(name: "Cholangiocarcinoma", probability: 22),
                             .init(name: "Post-ERCP pancreatitis", probability: 15)]
            confidence = 80
        } else if cc.contains("reflux") || cc.contains("heartburn") || cc.contains("gerd") ||
                  cc.contains("gord") || cc.contains("regurgitat") || cc.contains("indigestion") ||
                  cc.contains("dyspepsia") || cc.contains("bloating") || cc.contains("oesophag") {
            pathway = "Upper GI / Reflux Pathway"
            differentials = [.init(name: "GERD / Oesophagitis", probability: 75),
                             .init(name: "Hiatus Hernia", probability: 55),
                             .init(name: "Peptic Ulcer Disease", probability: 38),
                             .init(name: "Functional Dyspepsia", probability: 30),
                             .init(name: "Barrett's Oesophagus", probability: 18),
                             .init(name: "Oesophageal Carcinoma", probability: 10)]
            confidence = 78
            if cc.contains("dysphagia") || cc.contains("weight loss") || cc.contains("anaemia") ||
               cc.contains("vomiting blood") || cc.contains("melaena") {
                redFlags.append("⚠️ Red flag — urgent OGD within 2 weeks")
                suggestedAcuity = .priority
            }
        } else if cc.contains("dysphagia") || cc.contains("difficulty swallow") {
            pathway = "Upper GI / Dysphagia Pathway"
            differentials = [.init(name: "Oesophageal Carcinoma", probability: 45),
                             .init(name: "GERD / Oesophagitis", probability: 40),
                             .init(name: "Oesophageal Stricture", probability: 35),
                             .init(name: "Achalasia", probability: 28),
                             .init(name: "Eosinophilic Oesophagitis", probability: 20)]
            confidence = 70
            if cc.contains("weight loss") || cc.contains("progressive") || cc.contains("solid") {
                redFlags.append("⚠️ Progressive dysphagia + weight loss — urgent OGD")
                suggestedAcuity = .priority
            }
        }

        // Undifferentiated abdominal pain default
        if differentials.isEmpty {
            differentials = [.init(name: "Biliary disease", probability: 38),
                             .init(name: "Appendicitis", probability: 28),
                             .init(name: "Diverticular disease", probability: 25),
                             .init(name: "IBD", probability: 18),
                             .init(name: "Gynaecological cause", probability: 15)]
            pathway = "Undifferentiated Abdominal Pain — Further Assessment Required"
            confidence = 40
        }

        return TriageResult(
            suggestedAcuity: suggestedAcuity,
            redFlags: redFlags,
            pathway: pathway,
            confidencePercent: confidence,
            differentials: differentials
        )
    }
}

