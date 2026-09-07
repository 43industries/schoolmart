import { MarketingHeader, MarketingFooter } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HowItWorksPage() {
  const steps = [
    { num: "1", title: "Parent creates account", desc: "Register, verify your account, and link your children to their schools." },
    { num: "2", title: "Browse & order", desc: "Browse meals, school supplies, care packages, and services available at your child's school." },
    { num: "3", title: "Pay securely", desc: "Pay via M-PESA, card, or student wallet. Every payment is verified by the backend." },
    { num: "4", title: "Orders aggregated", desc: "Orders for the same school are grouped into delivery batches for efficient school-centric delivery." },
    { num: "5", title: "Vendor prepares", desc: "Approved vendors prepare and package orders according to school delivery schedules." },
    { num: "6", title: "Delivered to school", desc: "Logistics delivers batches to approved collection points at the school." },
    { num: "7", title: "Student collects", desc: "Your child verifies identity with PIN, QR code, or student ID and collects their order." },
    { num: "8", title: "Parent notified", desc: "You receive confirmation when your child collects their order." },
  ];

  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-4xl px-4 py-16">
        <div className="mb-12 max-w-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-teal">The journey</p>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-brand-ink">How it works</h1>
          <p className="text-lg text-brand-muted">
            SchoolMart coordinates the full path from parent order to student collection — for every party involved.
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
        <div className="mt-12 text-center">
          <Button href="/register">Get started</Button>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
