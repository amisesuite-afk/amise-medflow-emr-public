// UXRecorder.swift
// Drives one walkthrough flow and records what it costs the user: every tap, every text entry
// (and its keystrokes), every scroll gesture, and every distinct screen, with a screenshot
// (XCTAttachment, kept always) at each step. At the end it writes ux-metrics JSON as an
// attachment and, when UX_METRICS_DIR is set (xcodebuild: TEST_RUNNER_UX_METRICS_DIR), as a file.
//
// Counting rules (kept simple so iPhone and iPad numbers compare):
//   taps         — every tap on a control, including a tap into a text field
//   textEntries  — each block of typed text (one per field)
//   interactions — taps + textEntries (what the engineering gate calls "clicks")
//   keystrokes   — characters typed
//   scrolls      — swipes/drags needed to bring a control on screen
//   screens      — distinct screens (a consultation step counts as its own screen)
// Verification steps (`uncounted { }`) and probes (`probeTap`) check behaviour for the report
// and are not counted.

import XCTest
import UIKit

enum UXError: Error, CustomStringConvertible {
    case missing(String)
    case unexpected(String)

    var description: String {
        switch self {
        case .missing(let what):    return "not found: \(what)"
        case .unexpected(let what): return "unexpected: \(what)"
        }
    }
}

/// Thrown when a flow cannot be reached on this device (recorded as "not-reachable", no failure).
struct UXSkip: Error {
    let reason: String
}

@MainActor
final class UXRecorder {

    let app: XCUIApplication
    let flow: String
    let title: String
    private unowned let testCase: XCTestCase

    private(set) var taps = 0
    private(set) var textEntries = 0
    private(set) var keystrokes = 0
    private(set) var scrolls = 0
    private(set) var screenNames: [String] = []
    private var steps: [[String: String]] = []
    private var notes: [String] = []
    private var shotIndex = 0
    /// False inside `uncounted { }`.
    private var counting = true

    /// True once the metrics are written.
    private var finished = false

    init(app: XCUIApplication, flow: String, title: String, testCase: XCTestCase) {
        self.app = app
        self.flow = flow
        self.title = title
        self.testCase = testCase
        // If XCTest ends the test outside `run` (an internal failure that stops the test), the
        // metrics are still written, marked "interrupted", so every flow appears in ux-metrics.
        testCase.addTeardownBlock { [weak self] in
            MainActor.assumeIsolated {
                guard let self, !self.finished else { return }
                self.note("Interrupted by XCTest before the flow finished")
                self.finish(outcome: "interrupted")
            }
        }
    }

    // MARK: - Device

    static var deviceName: String {
        ProcessInfo.processInfo.environment["SIMULATOR_DEVICE_NAME"] ?? UIDevice.current.name
    }

    static var isPad: Bool {
        let env = ProcessInfo.processInfo.environment
        if let model = env["SIMULATOR_MODEL_IDENTIFIER"], !model.isEmpty { return model.hasPrefix("iPad") }
        if let name = env["SIMULATOR_DEVICE_NAME"], !name.isEmpty { return name.contains("iPad") }
        return UIDevice.current.userInterfaceIdiom == .pad
    }

    static var deviceSlug: String { slug(deviceName) }

    static func slug(_ s: String) -> String {
        let allowed = CharacterSet.alphanumerics
        let mapped = s.unicodeScalars.map { allowed.contains($0) ? String($0) : "-" }.joined()
        return mapped.split(separator: "-").joined(separator: "-")
    }

    // MARK: - Run a flow

    /// Runs `body`; whatever happens, the metrics are written. A thrown UXError fails the test
    /// after a "FAILED" screenshot; a UXSkip records the flow as not reachable on this device.
    func run(_ body: () throws -> Void) {
        do {
            try body()
            finish(outcome: "completed")
        } catch let skip as UXSkip {
            note(skip.reason)
            finish(outcome: "not-reachable")
        } catch {
            snapshot("FAILED - \(error)")
            note("Failed: \(error)")
            note("On screen at failure: \(screenInventory())")
            finish(outcome: "failed")
            XCTFail("\(flow) on \(Self.deviceName): \(error)")
        }
    }

    /// Compact description of what was on screen when a flow failed, for the job log (the
    /// screenshots are in an artifact that is not always reachable): navigation titles, whether
    /// an alert or sheet is up, and every accessibility identifier present. Demo data only.
    private func screenInventory() -> String {
        guard let root = try? app.snapshot() else { return "(no snapshot)" }
        var ids: [String] = []
        var titles: [String] = []
        var alerts = 0
        func walk(_ node: XCUIElementSnapshot) {
            if !node.identifier.isEmpty, !ids.contains(node.identifier) { ids.append(node.identifier) }
            if node.elementType == .navigationBar, !node.identifier.isEmpty { titles.append(node.identifier) }
            if node.elementType == .alert { alerts += 1 }
            node.children.forEach(walk)
        }
        walk(root)
        let shown = ids.prefix(60).joined(separator: ", ")
        return "nav bars [\(titles.joined(separator: " | "))]; alerts \(alerts); "
            + "\(ids.count) identifiers: \(shown)\(ids.count > 60 ? ", …" : "")"
    }

    /// Verification steps that are not part of the user's task: not counted.
    func uncounted(_ body: () throws -> Void) rethrows {
        let previous = counting
        counting = false
        defer { counting = previous }
        try body()
    }

    // MARK: - Screens and screenshots

    /// A new screen the user sees (counted once per name) plus its screenshot.
    func screen(_ name: String) {
        if counting && !screenNames.contains(name) { screenNames.append(name) }
        snapshot(name)
    }

    /// Screenshot only (not a new screen).
    func snapshot(_ name: String) {
        shotIndex += 1
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        let index = shotIndex < 10 ? "0\(shotIndex)" : "\(shotIndex)"
        attachment.name = "\(Self.deviceSlug)__\(flow)__\(index)_\(Self.slug(name))"
        attachment.lifetime = .keepAlways
        testCase.add(attachment)
    }

    func note(_ text: String) {
        notes.append(text)
    }

    // MARK: - Element lookup

    func element(_ identifier: String) -> XCUIElement {
        app.descendants(matching: .any).matching(identifier: identifier).firstMatch
    }

    /// First element with this identifier whose label contains `text` (case-insensitive).
    func element(_ identifier: String, labelContains text: String) -> XCUIElement {
        let predicate = NSPredicate(format: "identifier == %@ AND label CONTAINS[c] %@", identifier, text)
        return app.descendants(matching: .any).matching(predicate).firstMatch
    }

    func element(identifierPrefix prefix: String) -> XCUIElement {
        let predicate = NSPredicate(format: "identifier BEGINSWITH %@", prefix)
        return app.descendants(matching: .any).matching(predicate).firstMatch
    }

    /// First element matching either the identifier or the exact label.
    func element(identifier: String, orLabel label: String) -> XCUIElement {
        let predicate = NSPredicate(format: "identifier == %@ OR label == %@", identifier, label)
        return app.descendants(matching: .any).matching(predicate).firstMatch
    }

    func button(labeled label: String) -> XCUIElement {
        app.buttons.matching(NSPredicate(format: "label == %@", label)).firstMatch
    }

    @discardableResult
    func waitFor(_ element: XCUIElement, _ what: String, timeout: TimeInterval = 10) throws -> XCUIElement {
        guard element.waitForExistence(timeout: timeout) else { throw UXError.missing(what) }
        return element
    }

    /// Waits until `element` reports the selected trait (e.g. the active consultation step).
    func isSelectedSoon(_ element: XCUIElement, timeout: TimeInterval = 4) -> Bool {
        let deadline = Date().addingTimeInterval(timeout)
        while Date() < deadline {
            if element.exists && element.isSelected { return true }
            RunLoop.current.run(until: Date().addingTimeInterval(0.2))
        }
        return false
    }

    /// `isHittable` without the XCTest failure. Asking an element that is outside the screen
    /// (a section-bar item scrolled off to the right) for `isHittable` can record "Failed to
    /// determine hittability … Activation point invalid" as a test failure that ends the test
    /// before the metrics are written (run 36181523764, iPad a_consultation: why that flow was
    /// missing from the metrics). Off-screen or zero-size means "not hittable" here.
    func isHittableSafely(_ element: XCUIElement) -> Bool {
        guard element.exists else { return false }
        let f = element.frame
        guard !f.isEmpty, f.width > 0, f.height > 0 else { return false }
        let screen = app.frame
        guard screen.contains(CGPoint(x: f.midX, y: f.midY)) else { return false }
        return element.isHittable
    }

    // MARK: - Actions (counted)

    /// Puts the software keyboard away with its Return key (one tap), as a user would before
    /// reaching a control the keyboard covers. No-op when no keyboard is shown.
    func dismissKeyboard(_ what: String = "Keyboard: Return") {
        let keyboard = app.keyboards.firstMatch
        guard keyboard.exists else { return }
        for label in ["Return", "return", "Done", "done"] {
            let key = keyboard.buttons[label]
            if isHittableSafely(key) {
                key.tap()
                record(["action": "tap", "target": what]) { taps += 1 }
                return
            }
        }
    }

    func tap(_ element: XCUIElement, _ what: String, timeout: TimeInterval = 10) throws {
        try waitFor(element, what, timeout: timeout)
        var target = element
        // The same identifier can exist twice, e.g. the visit-pathway cards in a sheet and in the
        // consultation underneath it: prefer a copy the user can actually tap.
        if !isHittableSafely(target), !element.identifier.isEmpty,
           let visible = app.descendants(matching: .any).matching(identifier: element.identifier)
               .allElementsBoundByIndex.first(where: { isHittableSafely($0) }) {
            target = visible
        }
        if !isHittableSafely(target) { bringOnScreen(target) }
        guard isHittableSafely(target) else { throw UXError.unexpected("\(what) is not tappable") }
        target.tap()
        record(["action": "tap", "target": what]) { taps += 1 }
    }

    /// Taps into a field and types `text` (one tap + one text entry).
    func type(_ text: String, into element: XCUIElement, _ what: String) throws {
        // A field further down a form (a lazily built list, e.g. the iPad Record Vitals popover)
        // does not exist until the form scrolls to it.
        if !element.waitForExistence(timeout: 2) { bringOnScreen(element) }
        try tap(element, what)
        element.typeText(text)
        record(["action": "type", "target": what, "characters": "\(text.count)"]) {
            textEntries += 1
            keystrokes += text.count
        }
    }

    /// Not counted: used only to check a behaviour for the report.
    func probeTap(_ element: XCUIElement) -> Bool {
        guard element.waitForExistence(timeout: 5) else { return false }
        if !isHittableSafely(element) { bringOnScreen(element, counted: false) }
        guard isHittableSafely(element) else { return false }
        element.tap()
        return true
    }

    /// Opens a root tab (iPhone tab bar, iPad top tab bar or a sheet's tab bar).
    func openTab(_ label: String) throws {
        let inTabBar = app.tabBars.buttons[label]
        if inTabBar.waitForExistence(timeout: 3) {
            try tap(inTabBar, "Tab: \(label)")
            return
        }
        try tap(button(labeled: label), "Tab: \(label)")
    }

    /// Taps a button in a confirmation dialog / alert / action sheet.
    func tapDialogButton(_ label: String) throws {
        let deadline = Date().addingTimeInterval(8)
        while Date() < deadline {
            for candidate in [app.sheets.buttons[label], app.alerts.buttons[label],
                              app.popovers.buttons[label]] where isHittableSafely(candidate) {
                try tap(candidate, "Dialog: \(label)")
                return
            }
            let matches = app.buttons.matching(NSPredicate(format: "label == %@", label)).allElementsBoundByIndex
            if let last = matches.last(where: { isHittableSafely($0) }) {
                try tap(last, "Dialog: \(label)")
                return
            }
            RunLoop.current.run(until: Date().addingTimeInterval(0.25))
        }
        throw UXError.missing("dialog button '\(label)'")
    }

    /// Navigation back from a pushed screen: the back button (labelled with the previous title,
    /// "Back" or "BackButton"), otherwise the edge-swipe gesture.
    func goBack(previousTitle: String) throws {
        for candidate in [app.navigationBars.buttons[previousTitle], app.navigationBars.buttons["BackButton"],
                          app.navigationBars.buttons["Back"]] where candidate.waitForExistence(timeout: 1) {
            if isHittableSafely(candidate) {
                try tap(candidate, "Back to \(previousTitle)")
                return
            }
        }
        let start = app.coordinate(withNormalizedOffset: CGVector(dx: 0.01, dy: 0.5))
        let end = app.coordinate(withNormalizedOffset: CGVector(dx: 0.85, dy: 0.5))
        start.press(forDuration: 0.05, thenDragTo: end)
        record(["action": "swipe", "target": "Edge swipe back to \(previousTitle)"]) { scrolls += 1 }
    }

    // MARK: - Scrolling

    /// Scrolls until `element` is on screen: horizontally when it exists beside the screen
    /// (horizontal bars), otherwise vertically. Each swipe/drag is counted as a scroll.
    func bringOnScreen(_ element: XCUIElement, maxGestures: Int = 10, counted: Bool = true,
                       searchUpwards: Bool = false) {
        let screen = app.frame
        var gestures = 0
        while gestures < maxGestures {
            if isHittableSafely(element) { break }
            if element.exists {
                let f = element.frame
                let verticallyVisible = f.midY > screen.minY + 40 && f.midY < screen.maxY - 40
                if verticallyVisible && (f.maxX > screen.maxX || f.minX < screen.minX) {
                    let leftwards = f.maxX > screen.maxX
                    drag(atY: f.midY, fromX: screen.width * (leftwards ? 0.8 : 0.2),
                         toX: screen.width * (leftwards ? 0.25 : 0.75))
                } else if f.midY <= screen.minY + 40 {
                    app.swipeDown()
                } else if app.keyboards.firstMatch.exists {
                    // Covered by the keyboard: a centred swipe would land on the keys and not
                    // scroll, so drag the form from its visible upper part instead.
                    dragVertically(fromY: screen.height * 0.45, toY: screen.height * 0.15)
                } else {
                    app.swipeUp()   // below the screen, or on screen but covered (footer)
                }
            } else {
                // Lazily built rows appear only as the list scrolls. Short, slow drags: a swipe can
                // fling a small form (an iPad sheet) past the row, which is then unloaded again.
                // Half the attempts go one way, then the other.
                let upwards = searchUpwards != (gestures >= maxGestures / 2)
                dragWithin(scrollContainer, upwards: upwards)
            }
            gestures += 1
        }
        if counted && gestures > 0 {
            record(["action": "scroll", "target": "\(gestures) gesture(s)"]) { scrolls += gestures }
        }
    }

    /// The form or list to scroll when the element is not built yet: the front-most collection
    /// view or table (a sheet or popover form), else the whole app.
    private var scrollContainer: XCUIElement {
        let keyboard = app.keyboards.firstMatch
        let keyboardFrame = keyboard.exists ? keyboard.frame : .null
        let lists = (app.collectionViews.allElementsBoundByIndex + app.tables.allElementsBoundByIndex)
            .filter { isHittableSafely($0) }
            // The keyboard has its own collection views (suggestions, emoji): never scroll those.
            .filter { keyboardFrame.isNull || !keyboardFrame.contains($0.frame) }
        // The largest list on screen is the form or page, not a chip strip inside it.
        return lists.max(by: { $0.frame.width * $0.frame.height < $1.frame.width * $1.frame.height }) ?? app
    }

    /// Scrolls until `element` is visible (for fields low in long forms, or above with `upwards`).
    func scrollTo(_ element: XCUIElement, _ what: String, upwards: Bool = false) throws {
        if isHittableSafely(element) { return }
        bringOnScreen(element, searchUpwards: upwards)
        guard element.exists else { throw UXError.missing(what) }
    }

    /// A short drag (about a third of the container) inside `container`: reveals rows below when
    /// `upwards` is false (content moves up), rows above when true.
    private func dragWithin(_ container: XCUIElement, upwards: Bool) {
        let from = container.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: upwards ? 0.35 : 0.65))
        let to = container.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: upwards ? 0.65 : 0.35))
        from.press(forDuration: 0.1, thenDragTo: to, withVelocity: .slow, thenHoldForDuration: 0.1)
    }

    private func dragVertically(fromY: CGFloat, toY: CGFloat) {
        let origin = app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))
        let x = app.frame.width * 0.5
        origin.withOffset(CGVector(dx: x, dy: fromY))
            .press(forDuration: 0.05, thenDragTo: origin.withOffset(CGVector(dx: x, dy: toY)))
    }

    private func drag(atY y: CGFloat, fromX: CGFloat, toX: CGFloat) {
        let origin = app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))
        let from = origin.withOffset(CGVector(dx: fromX, dy: y))
        let to = origin.withOffset(CGVector(dx: toX, dy: y))
        from.press(forDuration: 0.05, thenDragTo: to)
    }

    private func record(_ step: [String: String], _ count: () -> Void) {
        guard counting else { return }
        count()
        steps.append(step)
    }

    // MARK: - Metrics

    private func finish(outcome: String) {
        guard !finished else { return }
        finished = true
        let metrics: [String: Any] = [
            "device": Self.deviceName,
            "idiom": Self.isPad ? "pad" : "phone",
            "flow": flow,
            "title": title,
            "outcome": outcome,
            "taps": taps,
            "textEntries": textEntries,
            "interactions": taps + textEntries,
            "keystrokes": keystrokes,
            "scrolls": scrolls,
            "screens": screenNames.count,
            "screenNames": screenNames,
            "screenshots": shotIndex,
            "steps": steps,
            "notes": notes,
        ]
        guard let data = try? JSONSerialization.data(withJSONObject: metrics,
                                                     options: [.prettyPrinted, .sortedKeys]) else { return }
        let fileName = "ux-metrics__\(Self.deviceSlug)__\(flow).json"
        let attachment = XCTAttachment(data: data, uniformTypeIdentifier: "public.json")
        attachment.name = fileName
        attachment.lifetime = .keepAlways
        testCase.add(attachment)

        if let dir = ProcessInfo.processInfo.environment["UX_METRICS_DIR"], !dir.isEmpty {
            let url = URL(fileURLWithPath: dir, isDirectory: true)
            try? FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
            try? data.write(to: url.appendingPathComponent(fileName))
        }
    }
}
