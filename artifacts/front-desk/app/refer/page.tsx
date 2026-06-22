import type { Metadata } from 'next';
import ReferralForm from './ReferralForm';

export const metadata: Metadata = {
  title: 'Refer a Patient — Amise Medical Services',
  description:
    'Secure GP and specialist referral portal for Amise Medical Services, Saint Lucia. Routine, priority, and urgent referral tracks with HL7 FHIR R4 support.',
  openGraph: {
    title: 'Refer a Patient — Amise Medical Services',
    description: 'Secure GP and specialist referral portal for Amise Medical Services, Saint Lucia. Submit routine, priority, or urgent referrals online.',
  },
  twitter: {
    title: 'Refer a Patient — Amise Medical Services',
    description: 'Secure referral portal for Amise Medical Services, Saint Lucia.',
  },
};

export default function ReferPage() {
  return <ReferralForm />;
}
