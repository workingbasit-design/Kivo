import LegalLayout from '@/components/LegalLayout';
import { PRIVACY } from '@/lib/legal';

export const metadata = { title: 'Privacy Policy | EveryJob' };

export default function PrivacyPage() {
  return <LegalLayout page={PRIVACY} />;
}
