import Image from "next/image";
import { MarketingHeader, MarketingFooter } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Check, Truck, MapPin, School } from "lucide-react";

const vehicles = ["Canters", "PickUps", "Vans", "Bodas"];

const benefits = [
  "Register based on towns and locations closest to schools you can serve",
  "Accept deliveries by Canters, PickUps, Vans, and Bodas",
  "Work with vendors aggregating parent orders for campus drop-off",
  "Support secure last-mile delivery so students collect safely at school",
];

export default function DeliveriesHomePage() {
  return (
    <>
      <MarketingHeader />
      <main>
        <section className="px-4 py-16">
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2">
            <div>
              <p className="mb-3 text-sm font-semibold tracking-wide text-brand-teal">For deliveries</p>
              <h1 className="mb-4 text-4xl font-bold tracking-tight text-brand-ink md:text-5xl">
                Last-mile delivery to schools. Register by town and vehicle type.
              </h1>
              <p className="mb-6 text-lg text-brand-muted">
                SchoolMart’s last-mile delivery agents move aggregated orders from vendors to campus collection
                points. Tell us the towns nearest the schools you serve and how you deliver — Canters, PickUps,
                Vans, or Bodas.
              </p>
              <div className="mb-8 flex flex-col gap-3 sm:flex-row">
                <Button href="/deliveries/register">Register as a delivery agent</Button>
                <Button variant="secondary" href="/how-it-works">See how it works</Button>
              </div>
            </div>
            <div className="overflow-hidden rounded-[2rem] shadow-xl shadow-brand-teal/10">
              <Image
                src="/graphics/hero.png"
                alt="Delivery to school campus"
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
            <h2 className="mb-3 text-center text-3xl font-bold text-brand-ink">Vehicle types we accept</h2>
            <p className="mx-auto mb-10 max-w-xl text-center text-brand-muted">
              Choose the vehicles you operate when you apply.
            </p>
            <div className="mb-12 flex flex-wrap justify-center gap-3">
              {vehicles.map((v) => (
                <span
                  key={v}
                  className="rounded-full border border-brand-teal/20 bg-brand-teal/5 px-4 py-2 text-sm font-medium text-brand-ink"
                >
                  {v}
                </span>
              ))}
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                { icon: MapPin, title: "Towns near schools", desc: "Serve locations closest to campuses so parents get reliable last-mile coverage." },
                { icon: Truck, title: "Flexible fleets", desc: "Canters, PickUps, Vans, and Bodas — pick what fits your routes." },
                { icon: School, title: "Campus drop-off", desc: "Deliver to school collection points so students collect safely." },
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
            <h2 className="mb-8 text-center text-3xl font-bold text-brand-ink">Why join SchoolMart deliveries</h2>
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
            <div className="mt-10 text-center">
              <Button href="/deliveries/register">Start delivery registration</Button>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
