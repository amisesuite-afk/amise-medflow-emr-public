import SwiftUI
import MessageUI

// MARK: - Email composer (wraps MFMailComposeViewController)

struct MailComposer: UIViewControllerRepresentable {
    let to: [String]
    let subject: String
    let body: String
    var isHTML = false
    @Binding var isPresented: Bool

    static var canSendMail: Bool { MFMailComposeViewController.canSendMail() }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIViewController(context: Context) -> MFMailComposeViewController {
        let vc = MFMailComposeViewController()
        vc.mailComposeDelegate = context.coordinator
        vc.setToRecipients(to)
        vc.setSubject(subject)
        vc.setMessageBody(body, isHTML: isHTML)
        return vc
    }

    func updateUIViewController(_ uiViewController: MFMailComposeViewController, context: Context) {}

    class Coordinator: NSObject, MFMailComposeViewControllerDelegate {
        let parent: MailComposer
        init(_ parent: MailComposer) { self.parent = parent }

        func mailComposeController(_ controller: MFMailComposeViewController,
                                   didFinishWith result: MFMailComposeResult, error: Error?) {
            parent.isPresented = false
        }
    }
}

// MARK: - SMS composer (wraps MFMessageComposeViewController)

struct SMSComposer: UIViewControllerRepresentable {
    let recipients: [String]
    let body: String
    @Binding var isPresented: Bool

    static var canSendText: Bool { MFMessageComposeViewController.canSendText() }

    func makeCoordinator() -> Coordinator { Coordinator(self) }

    func makeUIViewController(context: Context) -> MFMessageComposeViewController {
        let vc = MFMessageComposeViewController()
        vc.messageComposeDelegate = context.coordinator
        vc.recipients = recipients
        vc.body = body
        return vc
    }

    func updateUIViewController(_ uiViewController: MFMessageComposeViewController, context: Context) {}

    class Coordinator: NSObject, MFMessageComposeViewControllerDelegate {
        let parent: SMSComposer
        init(_ parent: SMSComposer) { self.parent = parent }

        func messageComposeViewController(_ controller: MFMessageComposeViewController,
                                         didFinishWith result: MessageComposeResult) {
            parent.isPresented = false
        }
    }
}

// MARK: - Appointment message templates

enum AppointmentMessage {
    static func emailBody(
        patientName: String,
        date: Date,
        type: String,
        practicePhone: String = "+1 (758) 284-0557"
    ) -> String {
        let dateStr = DateFormatter.ectLong.string(from: date)
        return """
        Dear \(patientName),

        This is a confirmation of your appointment with Dr. Dawit Kabiye at Amise Medical Services.

        Appointment: \(type)
        Date & Time: \(dateStr) (Eastern Caribbean Time)

        Please arrive 10 minutes early and bring any relevant medical records or test results.

        To reschedule or cancel, contact us at \(practicePhone).

        Regards,
        Amise Medical Services
        """
    }

    static func smsBody(patientName: String, date: Date, type: String) -> String {
        let dateStr = DateFormatter.ectShort.string(from: date)
        return "Amise Medical: Appt confirmed for \(patientName) — \(type) on \(dateStr) ECT. Call +1(758)284-0557 to reschedule."
    }

    static func preConsultEmailBody(patientName: String, date: Date) -> String {
        let dateStr = DateFormatter.ectLong.string(from: date)
        return """
        Dear \(patientName),

        You have an upcoming appointment with Dr. Dawit Kabiye on \(dateStr) (ECT).

        To help us prepare for your visit, please complete a brief pre-consultation questionnaire when you arrive at the front desk, or ask our staff for assistance.

        We look forward to seeing you.

        Amise Medical Services
        +1 (758) 284-0557
        """
    }
}
