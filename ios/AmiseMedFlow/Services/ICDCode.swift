// ICDCode.swift
// ICD-10 code type and the surgical/GI code database.

import Foundation

struct ICDCode: Identifiable, Equatable, Hashable {
    let id = UUID()
    let code: String
    let description: String
    let category: String

    static func search(_ query: String) -> [ICDCode] {
        guard query.count >= 2 else { return [] }
        let q = query.lowercased()
        return allCodes.filter {
            $0.code.lowercased().hasPrefix(q) ||
            $0.description.lowercased().contains(q) ||
            $0.category.lowercased().contains(q)
        }.prefix(20).map { $0 }
    }

    // MARK: Surgical + GI ICD-10 — General & Endoscopic Surgery practice

    static let allCodes: [ICDCode] = [
        // Appendix
        .init(code: "K35.2", description: "Acute appendicitis with generalised peritonitis", category: "Appendix"),
        .init(code: "K35.3", description: "Acute appendicitis with localised peritonitis", category: "Appendix"),
        .init(code: "K36",   description: "Other appendicitis", category: "Appendix"),
        .init(code: "K37",   description: "Unspecified appendicitis", category: "Appendix"),

        // Biliary
        .init(code: "K80.00", description: "Gallstones with acute cholecystitis, without obstruction", category: "Biliary"),
        .init(code: "K80.10", description: "Gallstones with chronic cholecystitis, without obstruction", category: "Biliary"),
        .init(code: "K80.20", description: "Gallstones without cholecystitis, without obstruction", category: "Biliary"),
        .init(code: "K80.30", description: "Gallstones with acute cholangitis", category: "Biliary"),
        .init(code: "K80.50", description: "Gallstones with cholangitis, unspecified", category: "Biliary"),
        .init(code: "K80.60", description: "Gallstones with biliary obstruction", category: "Biliary"),
        .init(code: "K81.0",  description: "Acute cholecystitis", category: "Biliary"),
        .init(code: "K81.1",  description: "Chronic cholecystitis", category: "Biliary"),
        .init(code: "K83.0",  description: "Cholangitis", category: "Biliary"),
        .init(code: "K83.1",  description: "Obstruction of bile duct", category: "Biliary"),
        .init(code: "K87",    description: "Disorders of gallbladder, bile duct in other diseases", category: "Biliary"),

        // Hernia
        .init(code: "K40.30", description: "Unilateral inguinal hernia with obstruction, without gangrene", category: "Hernia"),
        .init(code: "K40.40", description: "Unilateral inguinal hernia with gangrene", category: "Hernia"),
        .init(code: "K40.90", description: "Unilateral inguinal hernia without obstruction or gangrene", category: "Hernia"),
        .init(code: "K40.20", description: "Bilateral inguinal hernia without obstruction or gangrene", category: "Hernia"),
        .init(code: "K41.90", description: "Unilateral femoral hernia without obstruction or gangrene", category: "Hernia"),
        .init(code: "K42.0",  description: "Umbilical hernia with obstruction, without gangrene", category: "Hernia"),
        .init(code: "K42.9",  description: "Umbilical hernia without obstruction or gangrene", category: "Hernia"),
        .init(code: "K43.0",  description: "Incisional hernia with obstruction, without gangrene", category: "Hernia"),
        .init(code: "K43.2",  description: "Incisional hernia without obstruction or gangrene", category: "Hernia"),
        .init(code: "K44.9",  description: "Diaphragmatic (hiatus) hernia without obstruction or gangrene", category: "Hernia"),
        .init(code: "K45.0",  description: "Other specified abdominal hernia with obstruction", category: "Hernia"),
        .init(code: "K46.9",  description: "Unspecified abdominal hernia without obstruction or gangrene", category: "Hernia"),

        // Colorectal
        .init(code: "K57.20", description: "Diverticulitis of large intestine with perforation/abscess, without bleeding", category: "Colorectal"),
        .init(code: "K57.30", description: "Diverticulosis of large intestine without perforation, without bleeding", category: "Colorectal"),
        .init(code: "K57.32", description: "Diverticulosis of large intestine without perforation, with bleeding", category: "Colorectal"),
        .init(code: "K56.0",  description: "Paralytic ileus", category: "Colorectal"),
        .init(code: "K56.2",  description: "Volvulus", category: "Colorectal"),
        .init(code: "K56.50", description: "Intestinal adhesions with partial obstruction", category: "Colorectal"),
        .init(code: "K56.60", description: "Unspecified intestinal obstruction, partial", category: "Colorectal"),
        .init(code: "K63.1",  description: "Perforation of intestine (nontraumatic)", category: "Colorectal"),
        .init(code: "K60.0",  description: "Acute anal fissure", category: "Colorectal"),
        .init(code: "K60.1",  description: "Chronic anal fissure", category: "Colorectal"),
        .init(code: "K60.3",  description: "Anal fistula", category: "Colorectal"),
        .init(code: "K61.0",  description: "Anal abscess", category: "Colorectal"),
        .init(code: "K61.1",  description: "Rectal abscess", category: "Colorectal"),
        .init(code: "K64.0",  description: "First degree haemorrhoids", category: "Colorectal"),
        .init(code: "K64.1",  description: "Second degree haemorrhoids", category: "Colorectal"),
        .init(code: "K64.2",  description: "Third degree haemorrhoids", category: "Colorectal"),
        .init(code: "K64.3",  description: "Fourth degree haemorrhoids", category: "Colorectal"),
        .init(code: "K92.0",  description: "Haematemesis", category: "Colorectal"),
        .init(code: "K92.1",  description: "Melaena", category: "Colorectal"),
        .init(code: "K92.2",  description: "Gastrointestinal haemorrhage, unspecified", category: "Colorectal"),

        // Colorectal Cancer
        .init(code: "C18.0",  description: "Malignant neoplasm of caecum", category: "Colorectal Cancer"),
        .init(code: "C18.2",  description: "Malignant neoplasm of ascending colon", category: "Colorectal Cancer"),
        .init(code: "C18.4",  description: "Malignant neoplasm of transverse colon", category: "Colorectal Cancer"),
        .init(code: "C18.6",  description: "Malignant neoplasm of descending colon", category: "Colorectal Cancer"),
        .init(code: "C18.7",  description: "Malignant neoplasm of sigmoid colon", category: "Colorectal Cancer"),
        .init(code: "C19",    description: "Malignant neoplasm of rectosigmoid junction", category: "Colorectal Cancer"),
        .init(code: "C20",    description: "Malignant neoplasm of rectum", category: "Colorectal Cancer"),
        .init(code: "C21.0",  description: "Malignant neoplasm of anus, unspecified", category: "Colorectal Cancer"),
        .init(code: "K63.5",  description: "Polyp of colon", category: "Colorectal Cancer"),

        // Upper GI
        .init(code: "K21.0",  description: "GORD with oesophagitis", category: "Upper GI"),
        .init(code: "K21.9",  description: "GORD without oesophagitis", category: "Upper GI"),
        .init(code: "K22.0",  description: "Achalasia of cardia", category: "Upper GI"),
        .init(code: "K22.1",  description: "Ulcer of oesophagus", category: "Upper GI"),
        .init(code: "K22.6",  description: "Mallory-Weiss syndrome", category: "Upper GI"),
        .init(code: "K25.0",  description: "Gastric ulcer, acute with haemorrhage", category: "Upper GI"),
        .init(code: "K25.4",  description: "Gastric ulcer, chronic with haemorrhage", category: "Upper GI"),
        .init(code: "K25.9",  description: "Gastric ulcer, unspecified", category: "Upper GI"),
        .init(code: "K26.0",  description: "Duodenal ulcer, acute with haemorrhage", category: "Upper GI"),
        .init(code: "K26.9",  description: "Duodenal ulcer, unspecified", category: "Upper GI"),
        .init(code: "K29.0",  description: "Acute haemorrhagic gastritis", category: "Upper GI"),
        .init(code: "K31.1",  description: "Adult hypertrophic pyloric stenosis", category: "Upper GI"),
        .init(code: "K31.5",  description: "Obstruction of duodenum", category: "Upper GI"),
        .init(code: "K31.7",  description: "Polyp of stomach and duodenum", category: "Upper GI"),
        .init(code: "C15.5",  description: "Malignant neoplasm of lower oesophagus", category: "Upper GI"),
        .init(code: "C16.0",  description: "Malignant neoplasm of cardia of stomach", category: "Upper GI"),
        .init(code: "C16.2",  description: "Malignant neoplasm of body of stomach", category: "Upper GI"),

        // Pancreas
        .init(code: "K85.10", description: "Biliary acute pancreatitis without necrosis or infection", category: "Pancreas"),
        .init(code: "K85.20", description: "Alcohol-induced acute pancreatitis without necrosis", category: "Pancreas"),
        .init(code: "K85.90", description: "Acute pancreatitis, unspecified", category: "Pancreas"),
        .init(code: "K86.1",  description: "Other chronic pancreatitis", category: "Pancreas"),
        .init(code: "C25.0",  description: "Malignant neoplasm of head of pancreas", category: "Pancreas"),
        .init(code: "C25.1",  description: "Malignant neoplasm of body of pancreas", category: "Pancreas"),

        // Liver
        .init(code: "K70.1",  description: "Alcoholic hepatitis", category: "Liver"),
        .init(code: "K74.60", description: "Unspecified cirrhosis of liver", category: "Liver"),
        .init(code: "K75.0",  description: "Abscess of liver", category: "Liver"),
        .init(code: "C22.0",  description: "Liver cell carcinoma", category: "Liver"),
        .init(code: "C78.7",  description: "Secondary malignant neoplasm of liver and intrahepatic bile duct", category: "Liver"),

        // Breast
        .init(code: "C50.919", description: "Malignant neoplasm of breast, unspecified, unspecified side", category: "Breast"),
        .init(code: "N60.01",  description: "Solitary cyst of right breast", category: "Breast"),
        .init(code: "N60.09",  description: "Solitary cyst of breast, unspecified", category: "Breast"),
        .init(code: "N61.0",   description: "Mastitis without abscess", category: "Breast"),
        .init(code: "N61.1",   description: "Abscess of the breast and nipple", category: "Breast"),
        .init(code: "N63.0",   description: "Unspecified lump in unspecified breast", category: "Breast"),

        // Thyroid / Parathyroid
        .init(code: "E04.0",  description: "Nontoxic diffuse goitre", category: "Thyroid"),
        .init(code: "E04.1",  description: "Nontoxic single thyroid nodule", category: "Thyroid"),
        .init(code: "E04.2",  description: "Nontoxic multinodular goitre", category: "Thyroid"),
        .init(code: "E05.00", description: "Thyrotoxicosis with diffuse goitre (Graves') without crisis", category: "Thyroid"),
        .init(code: "E06.1",  description: "Subacute thyroiditis", category: "Thyroid"),
        .init(code: "C73",    description: "Malignant neoplasm of thyroid gland", category: "Thyroid"),
        .init(code: "E21.0",  description: "Primary hyperparathyroidism", category: "Thyroid"),

        // Peritoneum
        .init(code: "K65.0",  description: "Generalised (acute) peritonitis", category: "Peritoneum"),
        .init(code: "K65.1",  description: "Peritoneal abscess", category: "Peritoneum"),
        .init(code: "K65.9",  description: "Peritonitis, unspecified", category: "Peritoneum"),

        // Skin / Soft Tissue
        .init(code: "L02.211", description: "Cutaneous abscess of abdominal wall", category: "Skin/Soft Tissue"),
        .init(code: "L02.31",  description: "Cutaneous abscess of buttock", category: "Skin/Soft Tissue"),
        .init(code: "L02.411", description: "Cutaneous abscess of right axilla", category: "Skin/Soft Tissue"),
        .init(code: "L03.011", description: "Cellulitis of right finger", category: "Skin/Soft Tissue"),
        .init(code: "L03.119", description: "Cellulitis of unspecified part of limb", category: "Skin/Soft Tissue"),
        .init(code: "L05.01",  description: "Pilonidal cyst with abscess", category: "Skin/Soft Tissue"),
        .init(code: "L05.91",  description: "Pilonidal cyst without abscess", category: "Skin/Soft Tissue"),

        // Trauma
        .init(code: "S36.00XA", description: "Unspecified injury of spleen, initial encounter", category: "Trauma"),
        .init(code: "S36.112A", description: "Minor laceration of liver, initial encounter", category: "Trauma"),
        .init(code: "S36.30XA", description: "Unspecified injury of stomach, initial encounter", category: "Trauma"),
        .init(code: "S36.400A", description: "Unspecified injury of duodenum, initial encounter", category: "Trauma"),

        // Post-op complications
        .init(code: "T81.30XA", description: "Disruption of wound, unspecified, initial encounter", category: "Post-op"),
        .init(code: "T81.40XA", description: "Infection following a procedure, initial encounter", category: "Post-op"),
        .init(code: "T81.500A", description: "Unspecified complication of foreign body, initial encounter", category: "Post-op"),
        .init(code: "K91.1",    description: "Postgastric surgery syndromes", category: "Post-op"),
        .init(code: "K91.89",   description: "Other postprocedural complications of digestive system", category: "Post-op"),
    ]
}

