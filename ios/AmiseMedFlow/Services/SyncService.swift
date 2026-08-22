import Foundation
import Network
import Combine

@MainActor
final class SyncService: ObservableObject {
    @Published var isConnected: Bool = false
    @Published var pendingCount: Int = 0
    @Published var lastSyncedAt: Date?

    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "com.amise.sync")

    init() {
        monitor.pathUpdateHandler = { [weak self] path in
            Task { @MainActor in
                let connected = path.status == .satisfied
                self?.isConnected = connected
                if connected { await self?.flushPending() }
            }
        }
        monitor.start(queue: queue)
    }

    func enqueue(entityType: String, entityId: String, payload: [String: Any]) {
        pendingCount += 1
    }

    private func flushPending() async {
        guard pendingCount > 0 else { return }
        pendingCount = 0
        lastSyncedAt = .now
    }
}
