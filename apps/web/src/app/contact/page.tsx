import { MarketingHeader, MarketingFooter } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mail, MapPin, Phone } from "lucide-react";

export default function ContactPage() {
  const contactPhone = process.env.NEXT_PUBLIC_CONTACT_PHONE?.trim();
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-teal">Get in touch</p>
        <h1 className="mb-4 text-4xl font-bold tracking-tight text-brand-ink">Contact Us</h1>
        <p className="mb-10 text-lg text-brand-muted">
          Questions about parent accounts, vendor onboarding, or last-mile delivery to schools? We&apos;d love to hear from you.
        </p>
        <div className={`grid gap-4 ${contactPhone ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          <Card className="text-center">
            <Mail className="mx-auto mb-3 h-6 w-6 text-brand-teal" />
            <p className="text-sm font-medium text-brand-ink">Email</p>
            <a href="mailto:hello@schoolmart.co.ke" className="mt-1 block text-sm text-brand-muted hover:text-brand-teal">
              hello@schoolmart.co.ke
            </a>
          </Card>
          {contactPhone && (
            <Card className="text-center">
              <Phone className="mx-auto mb-3 h-6 w-6 text-brand-teal" />
              <p className="text-sm font-medium text-brand-ink">Phone</p>
              <a
                href={`tel:${contactPhone.replace(/\s+/g, "")}`}
                className="mt-1 block text-sm text-brand-muted hover:text-brand-teal"
              >
                {contactPhone}
              </a>
            </Card>
          )}
          <Card className="text-center">
            <MapPin className="mx-auto mb-3 h-6 w-6 text-brand-teal" />
            <p className="text-sm font-medium text-brand-ink">Office</p>
            <p className="mt-1 text-sm text-brand-muted">Nairobi, Kenya</p>
          </Card>
        </div>
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Button href="/register">Create parent account</Button>
          <Button variant="secondary" href="/vendors/register">Become a vendor</Button>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
