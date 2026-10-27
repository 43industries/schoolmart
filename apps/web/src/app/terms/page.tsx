import type { Metadata } from "next";
import Link from "next/link";
import { MarketingHeader, MarketingFooter } from "@/components/layout/marketing-header";

export const metadata: Metadata = {
  title: "Terms of Service | SchoolMart",
  description: "Parent and general platform terms for using SchoolMart in Kenya.",
};

const sections = [
  {
    title: "1. Agreement",
    body: "By creating a SchoolMart parent account or placing an order, you agree to these Terms of Service and our Privacy & Data Protection notice. If you do not agree, do not use the platform.",
  },
  {
    title: "2. Who may use SchoolMart",
    body: "Parents and guardians must be 18 or older. Student accounts are activated only with school verification (admission number and collection credentials). You must provide accurate information and keep login details confidential.",
  },
  {
    title: "3. Orders and payments",
    body: "Orders are placed through SchoolMart. Payment may be made from a parent-funded student wallet or via supported rails such as M-PESA. Card and bank rails may be offered later. Prices are in Kenya Shillings. Successful payment creates one or more vendor orders; mixed-vendor carts may split into separate vendor orders while charging once.",
  },
  {
    title: "4. Refunds",
    body: "Eligible refunds are processed according to platform policy: typically as a credit to the student wallet, or via M-PESA reversal when a provider receipt exists and reversal is configured. Partial refunds may apply. Vendor cancellations and unfulfilled stock issues are handled by SchoolMart operations.",
  },
  {
    title: "5. Delivery and collection",
    body: "Goods are delivered to the school collection point, not to a home address, unless a school has separately arranged otherwise. Collection requires the student’s PIN and/or collection QR at the desk or in the student app. Uncollected parcels may be held for a limited period set by the school.",
  },
  {
    title: "6. Acceptable use",
    body: "You may not misuse collection credentials, attempt unauthorized access, scrape the platform, or place orders for prohibited items as defined by a school’s catalog policy. We may suspend accounts that breach these terms or applicable law.",
  },
  {
    title: "7. Liability",
    body: "SchoolMart provides marketplace and logistics coordination. Vendors are responsible for product quality and packing; delivery partners for transit; schools for desk handover policies. To the extent permitted by Kenyan law, SchoolMart’s liability for any single order is limited to the amount paid for that order.",
  },
  {
    title: "8. Changes",
    body: "We may update these terms. Material changes will be posted on this page with an updated date. Continued use after posting constitutes acceptance.",
  },
  {
    title: "9. Contact",
    body: "Questions: hello@schoolmart.co.ke. Privacy questions: privacy@schoolmart.co.ke.",
  },
];

export default function TermsPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-teal">Legal</p>
        <h1 className="mb-2 text-4xl font-bold tracking-tight text-brand-ink">Terms of Service</h1>
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
          See also{" "}
          <Link href="/privacy" className="text-brand-teal hover:underline">
            Privacy &amp; data protection
          </Link>{" "}
          and{" "}
          <Link href="/deliveries/terms" className="text-brand-teal hover:underline">
            delivery partner terms
          </Link>
          .
        </p>
      </main>
      <MarketingFooter />
    </>
  );
}
