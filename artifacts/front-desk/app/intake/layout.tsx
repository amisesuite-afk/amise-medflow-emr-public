import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Patient Intake — Amise Medical Services',
  description: 'Start your intake with Amise Medical Services, Saint Lucia',
};

export default function IntakeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
