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
        practicePhone: String = PracticeProfile.current.primaryPhone
    ) -> String {
        let profile = PracticeProfile.current
        let dateStr = DateFormatter.ectLong.string(from: date)
        return """
        Dear \(patientName),

        This is a confirmation of your appointment with \(profile.displayShortClinicianName) at \(profile.practiceName).

        Appointment: \(type)
        Date & Time: \(dateStr) (Eastern Caribbean Time)

        Please arrive 10 minutes early and bring any relevant medical records or test results.

        To reschedule or cancel, contact us at \(practicePhone).

        Regards,
        \(profile.practiceName)
        """
    }

    static func smsBody(patientName: String, date: Date, type: String) -> String {
        let profile = PracticeProfile.current
        let dateStr = DateFormatter.ectShort.string(from: date)
        return "\(profile.displayShortPracticeName): Appt confirmed for \(patientName) — \(type) on \(dateStr) ECT. Call \(profile.primaryPhoneCompact) to reschedule."
    }

    static func preConsultEmailBody(patientName: String, date: Date) -> String {
        let profile = PracticeProfile.current
        let dateStr = DateFormatter.ectLong.string(from: date)
        return """
        Dear \(patientName),

        You have an upcoming appointment with \(profile.displayShortClinicianName) on \(dateStr) (ECT).

        To help us prepare for your visit, please complete a brief pre-consultation questionnaire when you arrive at the front desk, or ask our staff for assistance.

        We look forward to seeing you.

        \(profile.practiceName)
        \(profile.primaryPhone)
        """
    }

    /// Pre-visit questionnaire SMS sent from the front-desk pad.
    static func preConsultSMSBody() -> String {
        let profile = PracticeProfile.current
        return "\(profile.displayShortPracticeName): Please complete your pre-visit questionnaire with our front desk staff. Call \(profile.primaryPhoneCompact) for info."
    }
}
