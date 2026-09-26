// PageSizedSheet.swift
// A long form opened as a sheet on iPad (e.g. Record Vitals) was a small form sheet: with the
// keyboard up only a few fields showed and the rest needed scrolling. On iOS 18+ the sheet uses
// the page size (nearly full screen on iPad); iPhone sheets are unchanged; iOS 17 keeps the default.

import SwiftUI

extension View {
    @ViewBuilder
    func pageSizedSheet() -> some View {
        if #available(iOS 18.0, *) {
            self.presentationSizing(.page)
        } else {
            self
        }
    }
}
