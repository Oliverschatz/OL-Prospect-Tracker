import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "MSF — Mission Success First",
  description:
    "A partnership portal where Project customers and contractors find each other, build the Project Business relationship, and turn project parties into project partners that put completing over competing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="border-b border-msf-navy/10 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-msf-navy text-msf-gold display text-lg font-semibold">
                M
              </span>
              <span className="display text-xl font-semibold">
                MSF <span className="text-msf-slate font-normal">— Mission Success First</span>
              </span>
            </Link>
            <nav className="flex items-center gap-6 text-sm">
              <Link href="/customers" className="hover:text-msf-gold">For Customers</Link>
              <Link href="/contractors" className="hover:text-msf-gold">For Contractors</Link>
              <Link
                href="/#join"
                className="rounded-md bg-msf-navy px-4 py-2 text-white hover:bg-msf-steel"
              >
                Join the portal
              </Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="mt-20 border-t border-msf-navy/10 bg-white">
          <div className="mx-auto max-w-6xl px-6 py-8 text-sm text-msf-slate">
            <p className="display text-msf-navy">Completing over competing.</p>
            <p className="mt-1">© {new Date().getFullYear()} MSF — Mission Success First.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
