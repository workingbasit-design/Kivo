import LegalLayout from '@/components/LegalLayout';
import { TERMS } from '@/lib/legal';

export const metadata = { title: 'Terms of Service | EveryJob' };

export default function TermsPage() {
  return <LegalLayout page={TERMS} />;
}
