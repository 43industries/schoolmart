import Image from "next/image";
import { MarketingHeader, MarketingFooter } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Store, MapPin, Package, FileText } from "lucide-react";

const benefits = [
  "List a wide range of school items — meals, snacks, stationery, care packages and more",
  "Confirm your branch network across the country so parents can find you",
  "Receive and aggregate parent orders, then coordinate delivery to schools",
  "Work with SchoolMart’s last-mile delivery agents for campus drop-off",
  "Accept vendor terms and grow sales with a trusted ecommerce channel",
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
          <div className="mx-auto grid max-w-6xl items-stretch gap-12 lg:grid-cols-2">
            <div className="flex flex-col">
              <p className="mb-3 text-sm font-semibold tracking-wide text-brand-teal">For vendors</p>
              <h1 className="mb-4 text-2xl font-bold tracking-tight text-brand-ink md:text-3xl">
                Receive and Aggregate Orders, Coordinate Delivery to Schools, Grow Your Sales with SchoolMart.
              </h1>
              <p className="mb-6 text-lg text-brand-muted">
                SchoolMart connects you to parents who need trusted infrastructure to order, track and deliver
                school supplies to their children in school. Parents pay through SchoolMart (wallet or direct
                rails); you receive and aggregate orders, then deliver to schools with SchoolMart’s last-mile
                agents — settlement follows platform terms.
              </p>
              <div className="mt-auto flex flex-col gap-3 sm:flex-row">
                <Button href="/vendors/register">Become a vendor</Button>
                <Button variant="secondary" href="/how-it-works">See how it works</Button>
              </div>
            </div>
            <div className="min-h-[20rem] overflow-hidden rounded-[2rem] shadow-xl shadow-brand-teal/10 lg:min-h-0 lg:translate-x-2">
              <Image
                src="/graphics/vendors.png"
                alt="Vendor preparing orders for school delivery"
                width={800}
                height={900}
                className="h-full w-full object-cover object-right"
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
                { icon: MapPin, title: "Branch network", desc: "Share branches and towns nationwide so parents near your catchments can find you." },
                { icon: Package, title: "Aggregate & deliver", desc: "Receive orders, batch them, and hand off to last-mile agents for school collection points." },
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
              To read Vendor Terms, Conditions and Platform Agreements before you register.
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button href="/vendors/terms" variant="secondary">Read vendor terms</Button>
              <Button href="/vendors/register">Start vendor registration</Button>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
