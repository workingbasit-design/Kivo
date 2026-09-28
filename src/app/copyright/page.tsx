import LegalLayout from '@/components/LegalLayout';
import { COPYRIGHT } from '@/lib/legal';

export const metadata = { title: 'Copyright & Takedown Policy | EveryJob' };

export default function CopyrightPage() {
  return <LegalLayout page={COPYRIGHT} />;
}
