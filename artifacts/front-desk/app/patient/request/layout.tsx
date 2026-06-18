import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'New Patient Request — Amise Medical Services',
  description:
    'Tell us what you need and our team will guide you to the right care. Surgical consultations, endoscopy, and specialist appointments in Saint Lucia.',
  robots: 'index, follow',
  openGraph: {
    title: 'New Patient Request — Amise Medical Services',
    description: 'Tell us what you need and our team will guide you to the right care at Amise Medical Services, Saint Lucia.',
  },
  twitter: {
    title: 'New Patient Request — Amise Medical Services',
    description: 'Tell us what you need and our team will guide you to the right care in Saint Lucia.',
  },
};

export default function RequestLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
