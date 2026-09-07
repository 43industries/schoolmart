import { MarketingHeader, MarketingFooter } from "@/components/layout/marketing-header";

const faqs = [
  { q: "What is SchoolMart?", a: "SchoolMart is a platform that lets parents order and pay for meals, school supplies, and care packages delivered to their children at school." },
  { q: "How does payment work?", a: "You can pay via M-PESA, card, or student wallet. All payments are verified by our backend — we never mark an order as paid based on frontend confirmation alone." },
  { q: "What is the Student Wallet?", a: "A parent-funded wallet linked to your child. You set spending limits and category rules. Your child cannot spend beyond what you allow." },
  { q: "How does my child collect their order?", a: "After delivery to the school, your child verifies identity using PIN, QR code, or student ID. School staff confirm the handover." },
  { q: "Which schools are supported?", a: "We are launching with partner private schools in Kenya. Check the schools list during registration." },
  { q: "Is my child's data safe?", a: "We collect only what's needed for the service. Student data is minimized, parent links require school approval, and all actions are audited." },
];

export default function FAQPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-teal">Help</p>
        <h1 className="mb-8 text-4xl font-bold tracking-tight text-brand-ink">FAQ</h1>
        <div className="space-y-4">
          {faqs.map((faq) => (
            <div key={faq.q} className="card">
              <h3 className="mb-2 font-semibold text-brand-ink">{faq.q}</h3>
              <p className="text-sm leading-relaxed text-brand-muted">{faq.a}</p>
            </div>
          ))}
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
