import type { Metadata } from 'next';
import ReferralForm from './ReferralForm';

export const metadata: Metadata = {
  title: 'Refer a Patient — Amise Medical Services',
  description:
    'Secure GP and specialist referral portal for Amise Medical Services, Saint Lucia.',
};

export default function ReferPage() {
  return <ReferralForm />;
}
