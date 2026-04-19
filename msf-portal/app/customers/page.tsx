import Link from "next/link";
import { customers } from "@/lib/directory";

export const metadata = { title: "Customers — MSF" };

export default function CustomersPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <p className="text-sm uppercase tracking-[0.2em] text-msf-gold">Project customers</p>
      <h1 className="display mt-4 text-4xl font-semibold">
        Owners and programmes looking for partners
      </h1>
      <p className="mt-4 max-w-3xl text-msf-slate">
        These customers come to MSF to find contractors who will help them complete the mission —
        not just win the bid. Browse the stubs below, or{" "}
        <Link href="/#join" className="text-msf-gold underline">
          add your organization
        </Link>
        .
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {customers.map((c) => (
          <article
            key={c.slug}
            className="rounded-lg border border-msf-navy/10 bg-white p-6 shadow-sm"
          >
            <h2 className="display text-lg font-semibold text-msf-navy">{c.name}</h2>
            <dl className="mt-3 space-y-1 text-sm text-msf-slate">
              <div>
                <dt className="inline font-medium text-msf-navy">Sector: </dt>
                <dd className="inline">{c.sector}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-msf-navy">Region: </dt>
                <dd className="inline">{c.region}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-msf-navy">Active projects: </dt>
                <dd className="inline">{c.activeProjects}</dd>
              </div>
            </dl>
            <p className="mt-4 text-sm text-msf-slate">
              <span className="font-medium text-msf-navy">Looking for: </span>
              {c.looksFor}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
