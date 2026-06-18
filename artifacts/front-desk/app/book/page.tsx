import type { Metadata } from 'next';
import BookingForm from './BookingForm';

export const metadata: Metadata = {
  title: 'Book an Appointment',
  description: 'Arrange an appointment with Dr Dawit Daniel Kabiye, general and endoscopic surgeon, Saint Lucia. Routine visits, referrals, and urgent triage.',
  openGraph: {
    title: 'Book an Appointment — Amise Medical Services',
    description: 'Routine visits, GP referrals, and urgent triage. Book online or message us on WhatsApp.',
  },
  twitter: {
    title: 'Book an Appointment — Amise Medical Services',
    description: 'Routine visits, GP referrals, and urgent triage. Book online or via WhatsApp.',
  },
};

export default function BookPage() {
  return <BookingForm />;
}
