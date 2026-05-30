import type { Metadata } from 'next';
import BookingForm from './BookingForm';

export const metadata: Metadata = {
  title: 'Book an Appointment — Amise Medical Services',
  description: 'Arrange an appointment with Dr Dawit Daniel Kabiye, general and endoscopic surgeon, Saint Lucia.',
};

export default function BookPage() {
  return <BookingForm />;
}
