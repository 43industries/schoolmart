import { MarketingHeader, MarketingFooter } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-4xl px-4 py-16">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-teal">About us</p>
        <h1 className="mb-6 text-4xl font-bold tracking-tight text-brand-ink">About SchoolMart</h1>
        <div className="space-y-6 text-lg text-brand-muted">
          <p>
            SchoolMart is seamless infrastructure that allows parents to purchase anything and deliver it to their
            children in schools — enabling trusted ecommerce and last man delivery.
          </p>
          <p>
            Vendors aggregate and deliver. Parents order, pay and track. Students collect securely.
            That is parent-funded and tracked deliveries to schools.
          </p>
          <p>
            We are building the commerce layer between home and campus — from meals and essentials to care packages —
            so parents stay connected without WhatsApp juggling or uncertain handovers.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Vendors", desc: "Aggregate and deliver" },
            { label: "Parents", desc: "Order, pay and track" },
            { label: "Students", desc: "Collect securely" },
          ].map((item) => (
            <Card key={item.label} className="text-center">
              <p className="font-semibold text-brand-teal">{item.label}</p>
              <p className="mt-1 text-sm text-brand-muted">{item.desc}</p>
            </Card>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button href="/register">Get started as a parent</Button>
          <Button variant="secondary" href="/vendors">Become a vendor</Button>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
