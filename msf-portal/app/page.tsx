import Link from "next/link";

const pillars = [
  {
    title: "Find each other",
    body: "Discover Project customers and contractors whose scope, capabilities, and values actually fit — before the RFP gets written.",
  },
  {
    title: "Build the relationship",
    body: "Move past transactional bidding. Share context, references, and intent so trust can form before the work starts.",
  },
  {
    title: "Complete over compete",
    body: "Align on what mission success means for the project, then optimize together — not against each other.",
  },
];

const audiences = [
  {
    who: "Project customers",
    href: "/customers",
    blurb:
      "Asset owners, programme directors, and operations leaders who need contractors that finish what they start.",
  },
  {
    who: "Project contractors",
    href: "/contractors",
    blurb:
      "EPCs, integrators, and specialists who want customers that partner — not ones who only price-shop.",
  },
];

export default function Home() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20">
        <p className="text-sm uppercase tracking-[0.2em] text-msf-gold">
          The partnership portal for Project Business
        </p>
        <h1 className="display mt-4 max-w-4xl text-5xl font-semibold leading-tight md:text-6xl">
          Turn project parties into <span className="text-msf-gold">project partners.</span>
        </h1>
        <p className="mt-6 max-w-3xl text-lg text-msf-slate">
          MSF — Mission Success First — is where Project customers and contractors find each other,
          build the Project Business relationship, and put completing over competing.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/customers"
            className="rounded-md bg-msf-navy px-5 py-3 text-white hover:bg-msf-steel"
          >
            I'm a customer
          </Link>
          <Link
            href="/contractors"
            className="rounded-md border border-msf-navy px-5 py-3 text-msf-navy hover:bg-msf-navy hover:text-white"
          >
            I'm a contractor
          </Link>
        </div>
      </section>

      <section className="border-y border-msf-navy/10 bg-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-16 md:grid-cols-3">
          {pillars.map((p) => (
            <div key={p.title}>
              <h3 className="display text-xl font-semibold text-msf-navy">{p.title}</h3>
              <p className="mt-2 text-msf-slate">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="join" className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="display text-3xl font-semibold">Who's on the portal</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {audiences.map((a) => (
            <Link
              key={a.who}
              href={a.href}
              className="group rounded-lg border border-msf-navy/10 bg-white p-6 transition hover:border-msf-gold hover:shadow"
            >
              <h3 className="display text-xl font-semibold text-msf-navy group-hover:text-msf-gold">
                {a.who}
              </h3>
              <p className="mt-2 text-msf-slate">{a.blurb}</p>
              <p className="mt-4 text-sm text-msf-gold">Browse profiles →</p>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
