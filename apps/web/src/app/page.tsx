import Image from "next/image";
import Link from "next/link";
import { MarketingHeader, MarketingFooter } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Shield, Wallet, Package, Truck, Store, MapPin } from "lucide-react";

export default function HomePage() {
  return (
    <>
      <MarketingHeader />
      <main>
        <section className="px-4 py-14 md:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-brand-teal">
                Parent-funded and tracked deliveries to schools
              </p>
              <h1 className="text-3xl font-bold leading-[1.15] tracking-tight text-brand-ink md:text-4xl lg:text-[2.75rem]">
                The{" "}
                <span className="text-brand-teal">easiest way</span>{" "}
                to buy and send school items, essentials, meals, and special packages to your child at school
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-brand-muted">
                SchoolMart provides seamless infrastructure that enables parents to purchase anything and deliver it fast and safely to their children at school.
              </p>
              <p className="mt-4 max-w-lg text-base font-medium text-brand-ink">
                Parents pay, order, and track. Vendors aggregate and deliver. Students collect safely at school.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button href="/register">Get Started as a Parent</Button>
                <Button variant="secondary" href="/vendors">
                  Become a vendor
                </Button>
              </div>
            </div>
            <div className="relative">
              <div className="overflow-hidden rounded-[2rem] shadow-xl shadow-brand-teal/10">
                <Image
                  src="/graphics/hero.png"
                  alt="Parent packing a care package for school delivery"
                  width={800}
                  height={600}
                  className="h-auto w-full object-cover"
                  priority
                />
              </div>
            </div>
          </div>
        </section>

        <section className="bg-brand-surface px-4 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-3 text-center text-3xl font-bold text-brand-ink">How SchoolMart works</h2>
            <p className="mx-auto mb-12 max-w-xl text-center text-brand-muted">
              Parents pay, order, and track. Vendors aggregate and deliver. Students collect safely at school.
            </p>
            <div className="grid gap-4 md:grid-cols-5">
              {[
                { icon: MapPin, label: "Parents", desc: "Pay, Order, and Track" },
                { icon: ArrowRight, label: "", desc: "", className: "hidden md:flex items-center justify-center" },
                { icon: Store, label: "Vendors", desc: "Aggregate & Deliver" },
                { icon: ArrowRight, label: "", desc: "", className: "hidden md:flex items-center justify-center" },
                { icon: Package, label: "Students", desc: "Collect Safely At School" },
              ].filter((s) => s.label !== "" || s.className).map((step, i) => (
                step.className ? (
                  <div key={i} className={step.className}>
                    <ArrowRight className="h-6 w-6 text-brand-teal" />
                  </div>
                ) : (
                  <Card key={i} className="text-center">
                    <step.icon className="mx-auto mb-3 h-8 w-8 text-brand-teal" />
                    <h3 className="font-semibold text-brand-ink">{step.label}</h3>
                    <p className="text-sm text-brand-muted">{step.desc}</p>
                  </Card>
                )
              ))}
            </div>
            <p className="mt-8 text-center">
              <Link href="/how-it-works" className="text-sm font-semibold text-brand-teal hover:underline">
                See the full journey →
              </Link>
            </p>
          </div>
        </section>

        <section className="px-4 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-3 text-center text-3xl font-bold text-brand-ink">Trusted ecommerce to the school gate</h2>
            <p className="mx-auto mb-12 max-w-xl text-center text-brand-muted">
              Purchase what your child needs. Track every step. Deliver with last man delivery.
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                { icon: Wallet, title: "Parent-controlled wallet", desc: "Fund your child's wallet with spending limits and category controls — you stay in charge." },
                { icon: Package, title: "Anything to school", desc: "Meals, essentials, care packages and more — ordered online, delivered to campus." },
                { icon: Shield, title: "Secure collection", desc: "PIN, QR code, or student ID verification so only your child collects." },
                { icon: Truck, title: "Last man delivery", desc: "Vendors aggregate orders and complete delivery to the school collection point." },
                { icon: MapPin, title: "Full order tracking", desc: "Parents order, pay and track from checkout to collection confirmation." },
                { icon: Store, title: "Multi-vendor marketplace", desc: "A range of vendors selling meals, supplies, personal care and campus essentials." },
              ].map((f) => (
                <Card key={f.title} className="transition hover:shadow-md">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-teal/10">
                    <f.icon className="h-5 w-5 text-brand-teal" />
                  </div>
                  <h3 className="mb-2 font-semibold text-brand-ink">{f.title}</h3>
                  <p className="text-sm text-brand-muted">{f.desc}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-16">
          <div className="mx-auto max-w-3xl rounded-[2rem] bg-brand-teal px-8 py-12 text-center text-white shadow-lg shadow-brand-teal/20">
            <h2 className="text-3xl font-bold">Ready to deliver to your child at school?</h2>
            <p className="mt-4 text-white/90">
              Parents pay, order, and track. Vendors aggregate and deliver. Students collect safely at school.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button href="/register" className="!bg-white !text-brand-teal hover:!bg-white/90">
                Create Parent Account
              </Button>
              <Button href="/vendors" variant="secondary" className="!border-white/40 !bg-transparent !text-white hover:!bg-white/10">
                Become a vendor
              </Button>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
