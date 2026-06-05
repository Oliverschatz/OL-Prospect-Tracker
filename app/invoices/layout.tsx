import type { Metadata } from 'next';
import '../globals.css';

export const metadata: Metadata = {
  title: 'Invoices — OliverLehmann.com',
  description: 'Create digital invoices (ZUGFeRD) with SEPA payment QR codes',
  icons: { icon: '/icon.svg' },
};

export default function InvoicesLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
