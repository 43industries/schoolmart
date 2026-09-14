import Image from "next/image";
import { MarketingHeader, MarketingFooter } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check } from "lucide-react";

const benefits = [
  "Order meals, essentials and care packages for your child at school",
  "Pay securely and track every delivery to campus",
  "Fund a parent-controlled student wallet with spending rules",
  "Get confirmation when your child collects securely",
  "Shop from vendors who aggregate and complete last man delivery",
  "One place for parent-funded and tracked deliveries to schools",
];

export default function ForParentsPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-6xl px-4 py-16">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-teal">For Parents</p>
            <h1 className="mb-4 text-4xl font-bold tracking-tight text-brand-ink">
              Order, pay and track — all the way to collection
            </h1>
            <p className="mb-8 text-lg text-brand-muted">
              SchoolMart lets you purchase anything and deliver it to your child at school through trusted ecommerce
              and last man delivery. Vendors aggregate and deliver. You order, pay and track. Your child collects securely.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {benefits.map((item) => (
                <Card key={item} className="flex gap-3 !p-4">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-teal/10">
                    <Check className="h-3.5 w-3.5 text-brand-teal" />
                  </span>
                  <p className="text-sm text-brand-ink">{item}</p>
                </Card>
              ))}
            </div>
            <div className="mt-8">
              <Button href="/register">Create Parent Account</Button>
            </div>
          </div>
          <div className="overflow-hidden rounded-[2rem] shadow-xl shadow-brand-teal/10">
            <Image
              src="/graphics/parents.png"
              alt="Parent ordering school supplies on a phone"
              width={800}
              height={600}
              className="h-auto w-full object-cover"
            />
          </div>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
