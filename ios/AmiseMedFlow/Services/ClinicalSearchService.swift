// ClinicalSearchService.swift
// Search facade — thin wrappers over ICDCode.search() and SurgicalDrug.search().

import Foundation

// MARK: - Search service facade

enum ClinicalSearchService {
    static func searchICD(_ query: String) -> [ICDCode] { ICDCode.search(query) }
    static func searchDrugs(_ query: String) -> [SurgicalDrug] { SurgicalDrug.search(query) }
}
