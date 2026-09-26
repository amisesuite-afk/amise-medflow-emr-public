import XCTest
@testable import AmiseMedFlow

/// The bundled DiagnosticDatabase.json must decode for both Bayesian engines: when it does not,
/// the differential silently runs on the built-in fallback lists (1.0.0 never decoded; 2.0.0
/// does). CI log lines still start with "DBLOAD|". The JSON is also checked without Xcode by
/// scripts/src/diagnostic-database-schema.ts (lint:guideline-registry).
final class DiagnosticDatabaseLoadReportTests: XCTestCase {

    func testDatabaseDecodesForBothEngines() throws {
        let url = try XCTUnwrap(Bundle.main.url(forResource: "DiagnosticDatabase", withExtension: "json"),
                                "DiagnosticDatabase.json missing from the app bundle")
        let data = try Data(contentsOf: url)
        print("DBLOAD|file|\(data.count) bytes")

        do {
            let db = try JSONDecoder().decode(BayesianDiagnosisEngine.CandidateDatabase.self, from: data)
            print("DBLOAD|BayesianDiagnosisEngine|ok|\(db.pools.count) pools")
        } catch {
            print("DBLOAD|BayesianDiagnosisEngine|FAILED|\(DiagnosticDatabaseInfo.describe(error))")
            XCTFail("BayesianDiagnosisEngine cannot decode DiagnosticDatabase.json: \(DiagnosticDatabaseInfo.describe(error))")
        }
        do {
            let db = try JSONDecoder().decode(BayesianDecisionEngine.CandidateDatabase.self, from: data)
            print("DBLOAD|BayesianDecisionEngine|ok|\(db.pools.count) pools")
        } catch {
            print("DBLOAD|BayesianDecisionEngine|FAILED|\(DiagnosticDatabaseInfo.describe(error))")
            XCTFail("BayesianDecisionEngine cannot decode DiagnosticDatabase.json: \(DiagnosticDatabaseInfo.describe(error))")
        }
        print("DBLOAD|runtime|BayesianDiagnosisEngine.externalDatabase \(BayesianDiagnosisEngine.externalDatabase == nil ? "nil (fallback lists)" : "loaded")")
        print("DBLOAD|runtime|BayesianDecisionEngine.externalDatabase \(BayesianDecisionEngine.externalDatabase == nil ? "nil (fallback lists)" : "loaded")")
        XCTAssertNotNil(BayesianDiagnosisEngine.externalDatabase)
        XCTAssertNotNil(BayesianDecisionEngine.externalDatabase)
    }
}
