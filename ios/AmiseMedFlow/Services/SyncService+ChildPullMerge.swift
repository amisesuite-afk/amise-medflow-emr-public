// SyncService+ChildPullMerge.swift
// When a cloud pull of prescriptions, vitals or billing items may overwrite a local row.
//
// These pulls used to insert new rows only, so an edit made on another device or on the web to a
// row this device already had never arrived. They now update an existing local row (matched by
// remoteId) with the server's values when:
//   • the local row has no unsent changes (pendingSync false: the pull-protection rule; a record
//     the server refused stays pending, so it is never overwritten either),
//   • the server's values differ from the local ones, and
//   • the server row is newer, when the table has an `updated_at` column.
//
// Server schema (checked against the migrations the runner applies):
//   • prescriptions: `updated_at timestamptz not null default now()`, kept current by the
//     trg_updated_at BEFORE UPDATE trigger (supabase-emr-enhancement-migration.sql, Migration 32).
//     The local row's updatedAt is set to the server's updated_at when a pull applies it, so the
//     next comparison is server time against server time.
//   • patient_vitals, patient_billing_items: no updated_at (supabase-patient-vitals-migration.sql,
//     supabase-patient-billing-migration.sql; only created_at, plus Migration 87's deleted_at).
//     For these, a non-pending local row takes the server's values whenever they differ: without
//     unsent changes the local copy is at best what the server already has.
// Rows deleted on the server (deleted_at) keep the existing soft-delete handling in each pull.

import Foundation

enum ChildPullMerge {
    enum Action: Equatable {
        /// No local row has this remoteId: insert it (the pull's existing path).
        case insert
        /// Overwrite the local row with the server's values.
        case update
        /// Leave the local row as it is.
        case keepLocal
    }

    /// - serverUpdatedAt: the row's `updated_at`, or nil when the table has none (vitals, billing)
    ///   or the value could not be read: the field comparison alone decides.
    /// - localUpdatedAt: the local row's last change (nil: from before the attribute existed).
    static func action(hasLocal: Bool, localPending: Bool, fieldsDiffer: Bool,
                       serverUpdatedAt: Date?, localUpdatedAt: Date?) -> Action {
        guard hasLocal else { return .insert }
        // Pull protection: unsent local changes are never overwritten.
        guard !localPending, fieldsDiffer else { return .keepLocal }
        guard let serverUpdatedAt, let localUpdatedAt else { return .update }
        return serverUpdatedAt > localUpdatedAt ? .update : .keepLocal
    }

    /// Timestamps sent as ISO 8601 without fractions come back truncated to the second.
    static func sameInstant(_ a: Date, _ b: Date) -> Bool {
        abs(a.timeIntervalSince(b)) < 1
    }

    /// Numeric columns are NUMERIC(4,1) / NUMERIC(10,2) on the server.
    static func same(_ a: Double?, _ b: Double?) -> Bool {
        switch (a, b) {
        case (nil, nil):              return true
        case let (x?, y?):            return abs(x - y) < 0.000_1
        default:                      return false
        }
    }

    /// Optional text where nil and "" mean the same (the pushes send either).
    static func same(_ a: String?, _ b: String?) -> Bool {
        (a ?? "") == (b ?? "")
    }
}

/// Postgres `timestamptz` as PostgREST returns it: "2026-09-24T19:41:59+00:00", or with a
/// fraction of up to six digits ("…:59.123456+00:00"), which ISO8601DateFormatter's default
/// options do not accept.
enum SyncTimestamp {
    private static let plain = ISO8601DateFormatter()
    private static let fractional: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f
    }()

    static func parse(_ value: String?) -> Date? {
        guard let value, !value.isEmpty else { return nil }
        if let date = plain.date(from: value) { return date }
        if let date = fractional.date(from: value) { return date }
        // More fractional digits than the formatter takes: drop the fraction.
        guard let dot = value.firstIndex(of: ".") else { return nil }
        let afterDot = value.index(after: dot)
        let zone = value[afterDot...].firstIndex(where: { !$0.isNumber }) ?? value.endIndex
        return plain.date(from: String(value[..<dot]) + String(value[zone...]))
    }
}
