import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Practice Question — OliverLehmann.com',
  description: 'Embeddable practice question widget',
};

export default function PracticeLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
