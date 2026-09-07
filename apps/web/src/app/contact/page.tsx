import { MarketingHeader, MarketingFooter } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mail, MapPin, Phone } from "lucide-react";

export default function ContactPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-teal">Get in touch</p>
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-brand-ink">Contact Us</h1>
        <p className="mb-10 text-lg text-brand-muted">
          Questions about partnering, onboarding, or parent accounts? We&apos;d love to hear from you.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="text-center">
            <Mail className="mx-auto mb-3 h-6 w-6 text-brand-teal" />
            <p className="text-sm font-medium text-brand-ink">Email</p>
            <p className="mt-1 text-sm text-brand-muted">hello@schoolmart.co.ke</p>
          </Card>
          <Card className="text-center">
            <Phone className="mx-auto mb-3 h-6 w-6 text-brand-teal" />
            <p className="text-sm font-medium text-brand-ink">Phone</p>
            <p className="mt-1 text-sm text-brand-muted">+254 700 000 000</p>
          </Card>
          <Card className="text-center">
            <MapPin className="mx-auto mb-3 h-6 w-6 text-brand-teal" />
            <p className="text-sm font-medium text-brand-ink">Office</p>
            <p className="mt-1 text-sm text-brand-muted">Nairobi, Kenya</p>
          </Card>
        </div>
        <div className="mt-10 text-center">
          <Button href="/register">Create an account</Button>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
