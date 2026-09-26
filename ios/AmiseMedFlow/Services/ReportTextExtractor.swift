// ReportTextExtractor.swift
// Reads the text of an imported report PDF on the device: PDFKit's text layer first, and, only
// when the clinician asks for it on a scanned PDF with no text layer, Vision text recognition
// (VNRecognizeTextRequest), which runs entirely on the device. Nothing is sent anywhere; AIService
// is never used.

import Foundation
import PDFKit
import Vision
import UIKit

enum ReportTextOrigin: String, Equatable {
    case pdfText      // PDF text layer
    case ocr          // on-device text recognition of a scanned PDF
    case pasted       // typed or pasted by staff
    case none         // manual entry, no text
}

enum ReportTextExtractor {

    enum PDFTextResult: Equatable {
        case text(String, pageCount: Int)
        case noTextLayer(pageCount: Int)
        case locked
        case unreadable
    }

    /// Pages are separated by a form feed ("\u{000C}") so the parsers can tell pages apart.
    static func extractText(from data: Data) -> PDFTextResult {
        guard let doc = PDFDocument(data: data) else { return .unreadable }
        if doc.isLocked, !doc.unlock(withPassword: "") { return .locked }
        var pages: [String] = []
        for i in 0..<doc.pageCount {
            pages.append(doc.page(at: i)?.string ?? "")
        }
        let text = pages.joined(separator: "\n\u{000C}\n")
        return hasUsableText(text) ? .text(text, pageCount: doc.pageCount) : .noTextLayer(pageCount: doc.pageCount)
    }

    /// At least 20 letters or digits: a scanned page often yields only a few stray characters.
    static func hasUsableText(_ text: String) -> Bool {
        text.unicodeScalars.filter { CharacterSet.alphanumerics.contains($0) }.count >= 20
    }

    /// On-device OCR of up to `maxPages` pages. Returns nil when nothing could be read.
    static func recognizeText(in data: Data, maxPages: Int = 10) async -> String? {
        await Task.detached(priority: .userInitiated) { () -> String? in
            guard let doc = PDFDocument(data: data) else { return nil }
            if doc.isLocked, !doc.unlock(withPassword: "") { return nil }
            var pages: [String] = []
            for i in 0..<min(doc.pageCount, maxPages) {
                guard let page = doc.page(at: i) else { continue }
                let bounds = page.bounds(for: .mediaBox)
                let scale: CGFloat = 2.5
                let size = CGSize(width: max(1, bounds.width * scale), height: max(1, bounds.height * scale))
                let image = page.thumbnail(of: size, for: .mediaBox)
                guard let cgImage = image.cgImage else { continue }

                let request = VNRecognizeTextRequest()
                request.recognitionLevel = .accurate
                request.usesLanguageCorrection = false     // lab values and units, not prose
                request.recognitionLanguages = ["en-US"]
                let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
                do { try handler.perform([request]) } catch { continue }
                let fragments: [OCRFragment] = (request.results ?? []).compactMap { obs in
                    guard let top = obs.topCandidates(1).first else { return nil }
                    return OCRFragment(text: top.string, box: obs.boundingBox)
                }
                pages.append(OCRLineAssembler.lines(from: fragments).joined(separator: "\n"))
            }
            let text = pages.joined(separator: "\n\u{000C}\n")
            return hasUsableText(text) ? text : nil
        }.value
    }
}

/// One recognised text run with its Vision bounding box (normalised, origin bottom-left).
struct OCRFragment: Equatable {
    let text: String
    let box: CGRect
}

enum OCRLineAssembler {
    /// Rebuilds reading-order lines from OCR fragments: fragments whose vertical centres are
    /// within half a line height form one line, left to right, separated by two spaces.
    static func lines(from fragments: [OCRFragment]) -> [String] {
        let sorted = fragments.sorted { $0.box.midY > $1.box.midY }
        var groups: [[OCRFragment]] = []
        for f in sorted {
            if let last = groups.last, let anchor = last.first {
                let tolerance = max(0.004, min(anchor.box.height, f.box.height) * 0.5)
                if abs(anchor.box.midY - f.box.midY) <= tolerance {
                    groups[groups.count - 1].append(f)
                    continue
                }
            }
            groups.append([f])
        }
        return groups.map { g in
            g.sorted { $0.box.minX < $1.box.minX }.map(\.text).joined(separator: "  ")
        }
    }
}
