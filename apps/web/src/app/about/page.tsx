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
            SchoolMart is a parent-funded student commerce and delivery platform designed for the Kenyan education market.
          </p>
          <p>
            We connect parents, schools, vendors, and students through a trusted platform that handles ordering,
            payments, delivery coordination, and secure student collection.
          </p>
          <p>
            Our long-term vision is to build the financial and commerce infrastructure connecting parents to their
            children while they are at school — starting with meals and expanding to school supplies, care packages,
            and student wallet services.
          </p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {[
            { label: "Parents", desc: "Order with confidence" },
            { label: "Schools", desc: "Operate with control" },
            { label: "Vendors", desc: "Fulfil with clarity" },
          ].map((item) => (
            <Card key={item.label} className="text-center">
              <p className="font-semibold text-brand-teal">{item.label}</p>
              <p className="mt-1 text-sm text-brand-muted">{item.desc}</p>
            </Card>
          ))}
        </div>
        <div className="mt-10">
          <Button href="/register">Get started</Button>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
