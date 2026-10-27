import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader, MarketingFooter } from "@/components/layout/marketing-header";

export const metadata: Metadata = {
  title: "Delivery Partner Terms | SchoolMart",
  description: "Terms for SchoolMart last-mile delivery partners in Kenya.",
};

const sections = [
  {
    title: "1. Role",
    body: "As a delivery partner you collect packed orders from approved vendors and deliver them to school collection points for SchoolMart. You are an independent contractor, not an employee.",
  },
  {
    title: "2. Licensing and vehicle",
    body: "You must hold a valid driving licence and operate a roadworthy vehicle matching the type registered on your profile. Logbook or ownership evidence may be required for approval.",
  },
  {
    title: "3. Jobs and conduct",
    body: "Accept only jobs you can complete on time. Confirm pickup and school handover in the driver app. Capture GPS when available. Treat school staff and students respectfully. Do not open sealed packages unless instructed by SchoolMart support for an exception.",
  },
  {
    title: "4. Failed delivery",
    body: "If a school cannot receive parcels, report the failure in-app with a clear reason. Do not leave parcels unattended. Follow SchoolMart instructions for return or reattempt.",
  },
  {
    title: "5. Earnings and settlement",
    body: "Delivery fees and settlement schedules are set by SchoolMart and may vary by school and distance. You are responsible for your own taxes and statutory contributions.",
  },
  {
    title: "6. Data and privacy",
    body: "You may see limited order and school contact data solely to fulfil deliveries. Do not copy, share or retain personal data beyond the job. See the platform Privacy notice.",
  },
  {
    title: "7. Suspension",
    body: "SchoolMart may suspend or terminate partners for unsafe driving, fraud, data misuse, or repeated failed handovers.",
  },
];

export default function DeliveryTermsPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-teal">Legal</p>
        <h1 className="mb-2 text-4xl font-bold tracking-tight text-brand-ink">Delivery partner terms</h1>
        <p className="mb-8 text-sm text-brand-muted">Last updated: October 2026 · Kenya</p>
        <div className="space-y-6">
          {sections.map((s) => (
            <section key={s.title} className="card">
              <h2 className="mb-2 font-semibold text-brand-ink">{s.title}</h2>
              <p className="text-sm leading-relaxed text-brand-muted">{s.body}</p>
            </section>
          ))}
        </div>
        <p className="mt-8 text-sm text-brand-muted">
          Related:{" "}
          <Link href="/terms" className="text-brand-teal hover:underline">
            platform terms
          </Link>{" "}
          ·{" "}
          <Link href="/privacy" className="text-brand-teal hover:underline">
            privacy
          </Link>{" "}
          ·{" "}
          <Link href="/deliveries/register" className="text-brand-teal hover:underline">
            register as a partner
          </Link>
          .
        </p>
      </main>
      <MarketingFooter />
    </>
  );
}
