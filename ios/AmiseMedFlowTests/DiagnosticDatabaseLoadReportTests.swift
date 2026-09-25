import XCTest
@testable import AmiseMedFlow

/// Reports (does not assert) whether the bundled DiagnosticDatabase.json decodes for both
/// Bayesian engines. The clinical-content review found it probably doesn't, so the differential
/// silently runs on the built-in fallback lists. CI log lines start with "DBLOAD|".
/// Turn this into an assertion once the surgeon has decided whether to enable the database.
final class DiagnosticDatabaseLoadReportTests: XCTestCase {

    func testReportWhetherDatabaseDecodes() throws {
        guard let url = Bundle.main.url(forResource: "DiagnosticDatabase", withExtension: "json") else {
            print("DBLOAD|file|missing from app bundle")
            return
        }
        let data = try Data(contentsOf: url)
        print("DBLOAD|file|\(data.count) bytes")

        do {
            let db = try JSONDecoder().decode(BayesianDiagnosisEngine.CandidateDatabase.self, from: data)
            print("DBLOAD|BayesianDiagnosisEngine|ok|\(db.pools.count) pools")
        } catch {
            print("DBLOAD|BayesianDiagnosisEngine|FAILED|\(DiagnosticDatabaseInfo.describe(error))")
        }
        do {
            let db = try JSONDecoder().decode(BayesianDecisionEngine.CandidateDatabase.self, from: data)
            print("DBLOAD|BayesianDecisionEngine|ok|\(db.pools.count) pools")
        } catch {
            print("DBLOAD|BayesianDecisionEngine|FAILED|\(DiagnosticDatabaseInfo.describe(error))")
        }
        print("DBLOAD|runtime|BayesianDiagnosisEngine.externalDatabase \(BayesianDiagnosisEngine.externalDatabase == nil ? "nil (fallback lists)" : "loaded")")
        print("DBLOAD|runtime|BayesianDecisionEngine.externalDatabase \(BayesianDecisionEngine.externalDatabase == nil ? "nil (fallback lists)" : "loaded")")
    }
}
