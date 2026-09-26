// ClinicalNote+EmptyDraft.swift
// A note is created (and saved) the moment "New note" is tapped. One closed without typing
// anything used to stay on the device for ever and count as "pending" in Settings although it
// has nothing to send (Settings → Sync → Pending: "Empty: nothing to send").

import Foundation
import SwiftData

extension ClinicalNote {

    /// An unsigned note with no content that never reached the server: safe to discard.
    var isEmptyUnsentDraft: Bool {
        isLive && isEmpty && status == .draft && SyncRemoteId.kind(remoteId) == .notInserted
    }

    /// Deletes this note if it is an empty unsent draft. Returns true when it was deleted.
    @discardableResult
    func discardIfEmptyDraft(in context: ModelContext) -> Bool {
        guard isEmptyUnsentDraft else { return false }
        context.delete(self)
        try? context.save()
        return true
    }
}
