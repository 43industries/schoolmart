import type { Metadata } from "next";
import { MarketingHeader, MarketingFooter } from "@/components/layout/marketing-header";

export const metadata: Metadata = {
  title: "Privacy & Data Protection | SchoolMart",
  description:
    "How SchoolMart collects, uses and protects parent and student data under Kenya's Data Protection Act, 2019.",
};

const sections: Array<{ title: string; body: React.ReactNode }> = [
  {
    title: "1. Who we are",
    body: (
      <p>
        SchoolMart operates a platform that lets parents and guardians buy items for their children and have them
        delivered to the child&apos;s school for secure collection. For personal data processed on the platform,
        SchoolMart acts as a data controller under the Kenya Data Protection Act, 2019 (&quot;DPA&quot;) and the
        Data Protection (General) Regulations, 2021. Partner schools, vendors and delivery agents process limited data
        on our instructions to fulfil orders.
      </p>
    ),
  },
  {
    title: "2. Children's data and parental consent",
    body: (
      <>
        <p>
          SchoolMart does not let children open accounts on their own. A student profile is created by the school or
          linked by a parent or guardian, and every parent link must be approved by the school before ordering is
          possible. By linking a child, the parent or guardian confirms they have parental responsibility and consents
          to the processing described here on the child&apos;s behalf, as required by section 33 of the DPA.
        </p>
        <p>
          We process children&apos;s data only where it is necessary to deliver and hand over orders, and only in
          the child&apos;s best interests. We never use children&apos;s data for advertising, profiling or sale.
        </p>
      </>
    ),
  },
  {
    title: "3. What we collect (data minimisation)",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>Parents and guardians:</strong> name, phone number, email, the children you link, orders, wallet
          top-ups and payment references.
        </li>
        <li>
          <strong>Students:</strong> first and last name, school, admission number, class/grade and a hashed
          collection PIN. We do not collect students&apos; home addresses, photos, health or biometric data.
        </li>
        <li>
          <strong>Vendors and delivery agents:</strong> business and contact details, service areas, payout details
          and records of orders and deliveries handled.
        </li>
        <li>
          <strong>Payments:</strong> the M-PESA number used and the provider receipt. Card and bank details are
          handled by the payment provider and are not stored by SchoolMart.
        </li>
        <li>
          <strong>Security records:</strong> sign-in events and an audit log of sensitive actions (approvals,
          refunds, collections).
        </li>
      </ul>
    ),
  },
  {
    title: "4. Why we use it",
    body: (
      <ul className="list-disc space-y-2 pl-5">
        <li>To take, pay for, deliver and hand over orders (performance of a contract).</li>
        <li>To verify that the right child collects the right parcel (legitimate interest and child safety).</li>
        <li>To keep financial and tax records and prevent fraud (legal obligation).</li>
        <li>To send you order, payment and delivery notifications (performance of a contract).</li>
      </ul>
    ),
  },
  {
    title: "5. Who can see it (role-based access)",
    body: (
      <>
        <p>Access is limited by role and to the minimum needed:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Parents see only the children they are approved for.</li>
          <li>School staff see only students and parcels at their own school.</li>
          <li>
            Vendors see the student name, admission number, class and school for their own orders, enough to label a
            parcel, and never parent contact details or wallet balances.
          </li>
          <li>Delivery agents see school names, parcel counts and order numbers for the runs they accept.</li>
          <li>A small number of SchoolMart staff can access data for support, finance and safety, and every sensitive action is logged.</li>
        </ul>
      </>
    ),
  },
  {
    title: "6. Retention and deletion",
    body: (
      <p>
        Order and payment records are kept for as long as Kenyan tax and accounting law requires (generally seven
        years). Student profiles are deactivated when a parent unlinks a child or a school removes the student, and
        identifiable student details are deleted or anonymised once no open orders, refunds or disputes remain.
        Audit logs are kept for security and accountability for up to seven years. You can ask us to delete your
        account at any time, subject to these legal retention needs.
      </p>
    ),
  },
  {
    title: "7. Your rights",
    body: (
      <p>
        Under section 26 of the DPA you may ask to be informed about how your data is used, access it, correct it,
        object to processing, and request deletion or data portability, for yourself and for children in your care.
        Email{" "}
        <a href="mailto:privacy@schoolmart.co.ke" className="font-semibold text-brand-teal hover:underline">
          privacy@schoolmart.co.ke
        </a>
        . We respond within the timelines set by the DPA. You may also complain to the Office of the Data Protection
        Commissioner (ODPC).
      </p>
    ),
  },
  {
    title: "8. Security and breach handling",
    body: (
      <p>
        Data is encrypted in transit, passwords and collection PINs are stored as one-way hashes, payment callbacks
        are authenticated, and staff access is role-restricted and audited. If a personal data breach poses a real
        risk to you or your child, we will notify the Data Protection Commissioner within 72 hours of becoming aware
        of it, as required by section 43 of the DPA, and we will tell affected users without undue delay what happened
        and what to do.
      </p>
    ),
  },
  {
    title: "9. Transfers and processors",
    body: (
      <p>
        We use carefully selected service providers for hosting, messaging and payments (for example Safaricom
        M-PESA). Where data is stored or processed outside Kenya, we do so only with appropriate safeguards as
        required by section 48 of the DPA.
      </p>
    ),
  },
  {
    title: "10. Changes",
    body: (
      <p>
        We will post any update to this notice here and, for material changes, notify you in the app before they take
        effect.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-teal">Legal</p>
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-brand-ink">Privacy &amp; Data Protection</h1>
        <p className="mb-10 text-brand-muted">
          SchoolMart handles information about children, so we hold ourselves to a high standard. This notice explains
          what we collect, why, who can see it and how long we keep it.
        </p>
        <div className="space-y-8 text-brand-muted">
          {sections.map((s) => (
            <section key={s.title} className="space-y-3">
              <h2 className="text-xl font-semibold text-brand-ink">{s.title}</h2>
              {s.body}
            </section>
          ))}
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
