import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Prospect Tracker — OliverLehmann.com',
  description: 'CRM and sales pipeline tracker for PBP prospects',
  icons: {
    icon: 'https://oliverlehmann.com/wp-content/uploads/Portrait-02-2021-512-2.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;600;700&family=Source+Serif+4:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
