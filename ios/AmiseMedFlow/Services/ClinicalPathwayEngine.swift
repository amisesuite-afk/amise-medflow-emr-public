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
        // Negation-aware keyword matching (NegationMatcher): "no jaundice", "No history of
        // perforation", "no weight loss" do not count as the finding.
        let ccText = NegationMatcher.Source(chiefComplaint)
        let historyText = NegationMatcher.Source(pmh)
        func has(_ kw: String) -> Bool { ccText.contains(kw) }

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

        for kw in emergencyKeywords where has(kw) || historyText.contains(kw) {
            redFlags.append("⚠️ \(kw.capitalized)")
            suggestedAcuity = .emergency
        }

        if suggestedAcuity != .emergency {
            for kw in urgentKeywords where has(kw) {
                suggestedAcuity = .urgent
                break
            }
        }

        // --- Pathway assignment ---
        if has("append") || has("right iliac fossa") || has("rif pain") {
            pathway = "Appendicitis Pathway"
            differentials = [.init(name: "Acute appendicitis", probability: 68),
                             .init(name: "Mesenteric adenitis", probability: 45),
                             .init(name: "Ovarian cyst / torsion", probability: 30),
                             .init(name: "Ectopic pregnancy", probability: 22)]
            if suggestedAcuity == .routine { suggestedAcuity = .urgent }
            confidence = 72
            if has("peritonitis") || has("perforation") {
                redFlags.append("⚠️ Possible perforated appendicitis")
                suggestedAcuity = .emergency
            }
        } else if has("gall") || has("biliary") || has("cholecyst") || has("ruc pain") || has("right upper") {
            pathway = "Biliary Pathway"
            differentials = [.init(name: "Biliary colic", probability: 65),
                             .init(name: "Acute cholecystitis", probability: 55),
                             .init(name: "Choledocholithiasis", probability: 38),
                             .init(name: "Cholangitis", probability: 18)]
            confidence = 75
            if has("cholangitis") || has("jaundice") {
                redFlags.append("⚠️ Possible Charcot's triad — exclude cholangitis")
                suggestedAcuity = .urgent
            }
        } else if has("hernia") {
            pathway = "Hernia Pathway"
            differentials = [.init(name: "Inguinal hernia", probability: 72),
                             .init(name: "Femoral hernia", probability: 38),
                             .init(name: "Umbilical hernia", probability: 30),
                             .init(name: "Incisional hernia", probability: 22)]
            confidence = 85
            if has("obstruct") || has("strangulat") || has("can't reduce") {
                redFlags.append("⚠️ Possible strangulated/obstructed hernia")
                suggestedAcuity = .emergency
            }
        } else if has("rectal bleed") || has("pr bleed") || has("melaena") || has("haematemesis") {
            pathway = "GI Haemorrhage Pathway"
            differentials = [.init(name: "Haemorrhoids", probability: 58),
                             .init(name: "Diverticular bleed", probability: 42),
                             .init(name: "Colorectal cancer", probability: 32),
                             .init(name: "Peptic ulcer disease", probability: 28),
                             .init(name: "Angiodysplasia", probability: 18)]
            confidence = 70
            if has("massive") || has("shocked") {
                redFlags.append("⚠️ Massive GI haemorrhage — resuscitate urgently")
                suggestedAcuity = .emergency
            } else {
                suggestedAcuity = .urgent
            }
        } else if has("obstruct") || has("distension") || has("vomiting") && has("not open bowels") {
            pathway = "Bowel Obstruction Pathway"
            differentials = [.init(name: "Adhesional obstruction", probability: 55),
                             .init(name: "Colorectal cancer", probability: 38),
                             .init(name: "Hernia", probability: 30),
                             .init(name: "Volvulus", probability: 22),
                             .init(name: "Diverticular disease", probability: 18)]
            confidence = 65
            suggestedAcuity = .urgent
            if has("volvulus") || has("ischaemia") {
                redFlags.append("⚠️ Possible closed-loop obstruction")
                suggestedAcuity = .emergency
            }
        } else if has("breast") || has("lump") && (has("axilla") || has("nipple")) {
            pathway = "Breast Surgery Pathway"
            differentials = [.init(name: "Fibroadenoma", probability: 45),
                             .init(name: "Breast cyst", probability: 38),
                             .init(name: "Breast carcinoma", probability: 30),
                             .init(name: "Mastitis / abscess", probability: 22),
                             .init(name: "Gynaecomastia", probability: 12)]
            confidence = 60
            if has("skin tether") || has("nipple retract") || has("peau d'orange") {
                redFlags.append("⚠️ Signs suspicious for malignancy — urgent triple assessment")
                suggestedAcuity = .priority
            }
        } else if has("thyroid") || has("goitre") || has("neck swelling") {
            pathway = "Thyroid Pathway"
            differentials = [.init(name: "Multinodular goitre", probability: 55),
                             .init(name: "Solitary thyroid nodule", probability: 45),
                             .init(name: "Thyroid carcinoma", probability: 28),
                             .init(name: "Thyroiditis", probability: 22)]
            confidence = 70
            if has("stridor") || has("dysphagia") || has("rapidly growing") {
                redFlags.append("⚠️ Compressive/invasive — urgent assessment")
                suggestedAcuity = .priority
            }
        } else if has("pancreatit") || has("epigastric") && (has("severe") || has("radiating to back")) {
            pathway = "Pancreatitis Pathway"
            differentials = [.init(name: "Acute pancreatitis", probability: 65),
                             .init(name: "Peptic ulcer disease", probability: 32),
                             .init(name: "Aortic aneurysm", probability: 18),
                             .init(name: "Myocardial infarction", probability: 14)]
            confidence = 68
            suggestedAcuity = .urgent
        } else if has("colorectal") || has("change in bowel habit") || has("rectal mass") || has("weight loss") {
            pathway = "Colorectal Screening Pathway"
            differentials = [.init(name: "Diverticular disease", probability: 52),
                             .init(name: "IBS", probability: 48),
                             .init(name: "Colorectal carcinoma", probability: 38),
                             .init(name: "Polyps", probability: 35),
                             .init(name: "IBD", probability: 28)]
            confidence = 60
            if has("weight loss") || has("iron deficiency") {
                redFlags.append("⚠️ Red flag symptoms — urgent colonoscopy")
                suggestedAcuity = .priority
            }
        } else if has("abscess") || has("perianal") || has("fistula") || has("fissure") {
            pathway = "Anorectal Pathway"
            differentials = [.init(name: "Haemorrhoids", probability: 60),
                             .init(name: "Anal fissure", probability: 50),
                             .init(name: "Perianal abscess", probability: 42),
                             .init(name: "Anal fistula", probability: 35),
                             .init(name: "Pilonidal disease", probability: 28)]
            confidence = 78
            if has("sepsis") || has("necrotising") {
                redFlags.append("⚠️ Possible necrotising infection — urgent surgical review")
                suggestedAcuity = .emergency
            }
        } else if has("ercp") || has("common bile duct") || has("cbd stone") {
            pathway = "ERCP / Biliary Endoscopy Pathway"
            differentials = [.init(name: "Choledocholithiasis", probability: 72),
                             .init(name: "Biliary stricture", probability: 38),
                             .init(name: "Cholangiocarcinoma", probability: 22),
                             .init(name: "Post-ERCP pancreatitis", probability: 15)]
            confidence = 80
        } else if has("reflux") || has("heartburn") || has("gerd") ||
                  has("gord") || has("regurgitat") || has("indigestion") ||
                  has("dyspepsia") || has("bloating") || has("oesophag") {
            pathway = "Upper GI / Reflux Pathway"
            differentials = [.init(name: "GERD / Oesophagitis", probability: 75),
                             .init(name: "Hiatus Hernia", probability: 55),
                             .init(name: "Peptic Ulcer Disease", probability: 38),
                             .init(name: "Functional Dyspepsia", probability: 30),
                             .init(name: "Barrett's Oesophagus", probability: 18),
                             .init(name: "Oesophageal Carcinoma", probability: 10)]
            confidence = 78
            if has("dysphagia") || has("weight loss") || has("anaemia") ||
               has("vomiting blood") || has("melaena") {
                redFlags.append("⚠️ Red flag — urgent OGD within 2 weeks")
                suggestedAcuity = .priority
            }
        } else if has("dysphagia") || has("difficulty swallow") {
            pathway = "Upper GI / Dysphagia Pathway"
            differentials = [.init(name: "Oesophageal Carcinoma", probability: 45),
                             .init(name: "GERD / Oesophagitis", probability: 40),
                             .init(name: "Oesophageal Stricture", probability: 35),
                             .init(name: "Achalasia", probability: 28),
                             .init(name: "Eosinophilic Oesophagitis", probability: 20)]
            confidence = 70
            if has("weight loss") || has("progressive") || has("solid") {
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

