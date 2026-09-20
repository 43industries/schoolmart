import { MarketingHeader, MarketingFooter } from "@/components/layout/marketing-header";

const faqs = [
  {
    q: "What is SchoolMart?",
    a: "SchoolMart is seamless infrastructure that lets parents purchase anything and deliver it to their children at school through trusted ecommerce and last man delivery. Vendors aggregate and deliver. Parents order, pay and track. Students collect securely.",
  },
  {
    q: "How does payment work?",
    a: "Parents can pay with the child wallet or pay the order directly via M-PESA, card, or bank. Wallet and direct payments are processed by SchoolMart — not sent straight to a vendor’s till. Vendors are settled according to platform terms after orders are fulfilled.",
  },
  {
    q: "What is the Student Wallet?",
    a: "A parent-funded wallet linked to your child. You top it up through SchoolMart, set spending limits and category rules, and your child cannot spend beyond what you allow. When a purchase uses the wallet, payment is made through SchoolMart.",
  },
  {
    q: "Do vendors get paid into their own payment systems?",
    a: "Parents pay SchoolMart (wallet or direct rails). SchoolMart records the order and settles vendors under the platform agreement — including future links into vendor payout systems. Checkout is not a peer-to-peer payment into each vendor’s separate app.",
  },
  {
    q: "How does my child collect their order?",
    a: "After last man delivery to the school collection point, your child verifies identity using PIN, QR code, or student ID and collects securely. You can track confirmation as a parent.",
  },
  {
    q: "How do vendors join?",
    a: "Visit the vendors homepage and start registration. You will share what you sell, your location, and accept vendor terms and the platform agreement. Approved vendors aggregate orders and deliver to schools.",
  },
  {
    q: "Is my child's data safe?",
    a: "We collect only what's needed for parent-funded and tracked deliveries. Student data is minimized, sensitive actions are audited, and collection is identity-verified.",
  },
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
