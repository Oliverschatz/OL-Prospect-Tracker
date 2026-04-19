import Link from "next/link";
import { contractors } from "@/lib/directory";

export const metadata = { title: "Contractors — MSF" };

export default function ContractorsPage() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16">
      <p className="text-sm uppercase tracking-[0.2em] text-msf-gold">Project contractors</p>
      <h1 className="display mt-4 text-4xl font-semibold">
        Contractors who want partners, not just purchase orders
      </h1>
      <p className="mt-4 max-w-3xl text-msf-slate">
        These contractors are on MSF because they know projects succeed when both sides invest in
        the relationship. Browse the stubs below, or{" "}
        <Link href="/#join" className="text-msf-gold underline">
          list your firm
        </Link>
        .
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {contractors.map((c) => (
          <article
            key={c.slug}
            className="rounded-lg border border-msf-navy/10 bg-white p-6 shadow-sm"
          >
            <h2 className="display text-lg font-semibold text-msf-navy">{c.name}</h2>
            <dl className="mt-3 space-y-1 text-sm text-msf-slate">
              <div>
                <dt className="inline font-medium text-msf-navy">Region: </dt>
                <dd className="inline">{c.region}</dd>
              </div>
              <div>
                <dt className="inline font-medium text-msf-navy">Projects completed: </dt>
                <dd className="inline">{c.completedProjects}</dd>
              </div>
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.disciplines.map((d) => (
                <span
                  key={d}
                  className="rounded-full bg-msf-navy/5 px-2.5 py-1 text-xs text-msf-navy"
                >
                  {d}
                </span>
              ))}
            </div>
            <p className="mt-4 text-sm text-msf-slate">
              <span className="font-medium text-msf-navy">Offers: </span>
              {c.offers}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
