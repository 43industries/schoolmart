import Image from "next/image";
import Link from "next/link";
import { MarketingHeader, MarketingFooter } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowRight, Shield, Wallet, Package, School, Truck, Users } from "lucide-react";

export default function HomePage() {
  return (
    <>
      <MarketingHeader />
      <main>
        {/* Hero — two-column */}
        <section className="px-4 py-14 md:py-20">
          <div className="mx-auto grid max-w-6xl items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <div>
              <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-brand-teal">
                Parent-funded student commerce
              </p>
              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-brand-ink md:text-5xl lg:text-[3.25rem]">
                The{" "}
                <span className="text-brand-teal">easy way</span>{" "}
                to send meals, essentials &amp; care packages to your child at school
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-brand-muted">
                Parents order and pay. Schools manage. Vendors fulfil. Students collect securely — no WhatsApp juggling required.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button href="/register">Get Started as a Parent</Button>
                <Button variant="secondary" href="/for-schools">
                  Partner with SchoolMart
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

        {/* Flow */}
        <section className="bg-brand-surface px-4 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-3 text-center text-3xl font-bold text-brand-ink">How SchoolMart works</h2>
            <p className="mx-auto mb-12 max-w-xl text-center text-brand-muted">
              One trusted path from order to collection — built for Kenyan schools.
            </p>
            <div className="grid gap-4 md:grid-cols-5">
              {[
                { icon: Users, label: "Parent", desc: "Orders & pays" },
                { icon: ArrowRight, label: "", desc: "", className: "hidden md:flex items-center justify-center" },
                { icon: School, label: "School", desc: "Receives & stores" },
                { icon: ArrowRight, label: "", desc: "", className: "hidden md:flex items-center justify-center" },
                { icon: Package, label: "Student", desc: "Collects securely" },
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

        {/* Features */}
        <section className="px-4 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="mb-3 text-center text-3xl font-bold text-brand-ink">Built for Kenyan schools</h2>
            <p className="mx-auto mb-12 max-w-xl text-center text-brand-muted">
              Tools every party loves — parents, schools, vendors, and students.
            </p>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                { icon: Wallet, title: "Student Wallet", desc: "Fund your child's wallet with spending limits and category controls. Parent-controlled, always." },
                { icon: Package, title: "Care Packages", desc: "Birthday, exam survival, term starter — send love and essentials directly to school." },
                { icon: Shield, title: "Secure Collection", desc: "PIN, QR code, or student ID verification. Schools confirm every handover." },
                { icon: Truck, title: "School-Centric Delivery", desc: "Orders aggregated and delivered in batches to approved collection points." },
                { icon: School, title: "School Dashboard", desc: "Schools manage students, approve parent links, and track deliveries." },
                { icon: Users, title: "Multi-Vendor Marketplace", desc: "Meals, supplies, personal care, and services from approved vendors." },
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

        {/* CTA */}
        <section className="px-4 pb-16">
          <div className="mx-auto max-w-3xl rounded-[2rem] bg-brand-teal px-8 py-12 text-center text-white shadow-lg shadow-brand-teal/20">
            <h2 className="text-3xl font-bold">Ready to connect with your child at school?</h2>
            <p className="mt-4 text-white/90">Join SchoolMart and order with confidence.</p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <Button href="/register" className="!bg-white !text-brand-teal hover:!bg-white/90">
                Create Parent Account
              </Button>
              <Link href="/contact" className="text-sm text-white/80 underline hover:text-white">Contact us</Link>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
