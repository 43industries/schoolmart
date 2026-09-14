import Image from "next/image";
import { MarketingHeader, MarketingFooter } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Store, MapPin, Package, FileText } from "lucide-react";

const benefits = [
  "List a wide range of products — meals, snacks, stationery, care packages and more",
  "Set your service location and reach parents whose children are on campus",
  "Aggregate orders and complete last man delivery to school collection points",
  "Parents order, pay and track — you fulfil with clear demand",
  "Accept vendor terms and grow with a trusted ecommerce channel",
];

const categories = [
  "Meals & snacks",
  "School supplies",
  "Personal care",
  "Care packages",
  "Exam essentials",
  "Everyday campus needs",
];

export default function VendorsHomePage() {
  return (
    <>
      <MarketingHeader />
      <main>
        <section className="px-4 py-16">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-teal">For Vendors</p>
              <h1 className="mb-4 text-4xl font-bold tracking-tight text-brand-ink md:text-5xl">
                Aggregate demand. Deliver to school. Grow with SchoolMart.
              </h1>
              <p className="mb-6 text-lg text-brand-muted">
                SchoolMart connects you to parents who need trusted ecommerce and last man delivery to campus.
                You aggregate orders and deliver. Parents order, pay and track. Students collect securely.
              </p>
              <div className="mb-8 flex flex-col gap-3 sm:flex-row">
                <Button href="/vendors/register">Become a vendor</Button>
                <Button variant="secondary" href="/how-it-works">See how it works</Button>
              </div>
            </div>
            <div className="overflow-hidden rounded-[2rem] shadow-xl shadow-brand-teal/10">
              <Image
                src="/graphics/vendors.png"
                alt="Vendor preparing orders for school delivery"
                width={800}
                height={600}
                className="h-auto w-full object-cover"
                priority
              />
            </div>
          </div>
        </section>

        <section className="bg-brand-surface px-4 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-3 text-center text-3xl font-bold text-brand-ink">Your role on SchoolMart</h2>
            <p className="mx-auto mb-12 max-w-2xl text-center text-brand-muted">
              Vendors aggregate and deliver — the supply engine behind parent-funded and tracked deliveries to schools.
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                { icon: Store, title: "Sell a range of goods", desc: "Offer multiple categories like a modern marketplace — not a single product line." },
                { icon: MapPin, title: "Serve by location", desc: "Share where you operate so parents near your delivery catchments can find you." },
                { icon: Package, title: "Last man delivery", desc: "Batch and deliver to school collection points. Students collect securely on campus." },
              ].map((item) => (
                <Card key={item.title}>
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-teal/10">
                    <item.icon className="h-5 w-5 text-brand-teal" />
                  </div>
                  <h3 className="mb-2 font-semibold text-brand-ink">{item.title}</h3>
                  <p className="text-sm text-brand-muted">{item.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-8 text-center text-3xl font-bold text-brand-ink">What vendors sell</h2>
            <div className="mb-12 flex flex-wrap justify-center gap-3">
              {categories.map((c) => (
                <span
                  key={c}
                  className="rounded-full border border-brand-teal/20 bg-brand-teal/5 px-4 py-2 text-sm font-medium text-brand-ink"
                >
                  {c}
                </span>
              ))}
            </div>
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
          </div>
        </section>

        <section className="bg-brand-surface px-4 py-16">
          <div className="mx-auto max-w-3xl text-center">
            <FileText className="mx-auto mb-4 h-10 w-10 text-brand-teal" />
            <h2 className="mb-3 text-2xl font-bold text-brand-ink">Vendor terms &amp; platform agreement</h2>
            <p className="mb-8 text-brand-muted">
              Onboarding includes clear vendor terms and a platform agreement so everyone operates with trust —
              parents, vendors, and students on campus.
            </p>
            <Button href="/vendors/register">Start vendor registration</Button>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
