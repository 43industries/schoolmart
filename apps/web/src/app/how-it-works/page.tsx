import { MarketingHeader, MarketingFooter } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HowItWorksPage() {
  const steps = [
    { num: "1", title: "Parent creates an account", desc: "Register and link your children so you can order, pay and track deliveries to school." },
    { num: "2", title: "Browse & order", desc: "Choose meals, essentials, care packages and more from vendors serving your child's campus." },
    { num: "3", title: "Pay securely", desc: "Pay via M-PESA, card, or parent-controlled student wallet. Payments are verified by the platform." },
    { num: "4", title: "Vendors aggregate", desc: "Vendors group orders and prepare fulfilment for efficient last man delivery to school." },
    { num: "5", title: "Last man delivery", desc: "Orders are delivered to the school collection point — tracked for the parent the whole way." },
    { num: "6", title: "Student collects securely", desc: "Your child verifies identity with PIN, QR code, or student ID and collects their order." },
    { num: "7", title: "Parent tracks confirmation", desc: "You see collection confirmation so tracked deliveries close the loop." },
  ];

  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-4xl px-4 py-16">
        <div className="mb-12 max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-teal">The journey</p>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-brand-ink">How it works</h1>
          <p className="text-lg text-brand-muted">
            Vendors aggregate and deliver. Parents order, pay and track. Students collect securely —
            parent-funded and tracked deliveries to schools.
          </p>
        </div>
        <div className="space-y-4">
          {steps.map((step) => (
            <Card key={step.num} className="flex gap-5">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-teal text-sm font-bold text-white shadow-sm">
                {step.num}
              </div>
              <div>
                <h3 className="font-semibold text-brand-ink">{step.title}</h3>
                <p className="mt-1 text-sm text-brand-muted">{step.desc}</p>
              </div>
            </Card>
          ))}
        </div>
        <div className="mt-12 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button href="/register">Get started as a parent</Button>
          <Button variant="secondary" href="/vendors">Become a vendor</Button>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
