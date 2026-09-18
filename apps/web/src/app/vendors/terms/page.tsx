import Link from "next/link";
import { MarketingHeader, MarketingFooter } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { VENDOR_TERMS_VERSION } from "@schoolmart/shared";

export default function VendorTermsPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="mb-3 text-sm font-semibold tracking-wide text-brand-teal">For vendors</p>
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-brand-ink">
          Vendor Terms, Conditions &amp; Platform Agreement
        </h1>
        <p className="mb-10 text-sm text-brand-muted">Version {VENDOR_TERMS_VERSION}</p>

        <div className="space-y-6">
          <Card className="space-y-3">
            <h2 className="font-semibold text-brand-ink">1. Platform role</h2>
            <p className="text-sm text-brand-muted">
              SchoolMart provides ecommerce and last-mile delivery infrastructure connecting vendors with parents
              who order for children at school. You remain responsible for product quality, accurate listings, and
              fulfilment readiness.
            </p>
          </Card>
          <Card className="space-y-3">
            <h2 className="font-semibold text-brand-ink">2. Orders &amp; aggregation</h2>
            <p className="text-sm text-brand-muted">
              You agree to receive parent orders through SchoolMart, aggregate them efficiently, and coordinate
              delivery to designated school collection points, including handoff to SchoolMart last-mile agents
              where applicable.
            </p>
          </Card>
          <Card className="space-y-3">
            <h2 className="font-semibold text-brand-ink">3. Pricing &amp; settlement</h2>
            <p className="text-sm text-brand-muted">
              Listed prices must be accurate. Platform fees and settlement timing are communicated during
              onboarding and may be updated with notice. Disputes are handled through SchoolMart support channels.
            </p>
          </Card>
          <Card className="space-y-3">
            <h2 className="font-semibold text-brand-ink">4. Conduct &amp; compliance</h2>
            <p className="text-sm text-brand-muted">
              You must comply with applicable Kenyan law, school access rules, and SchoolMart policies. Prohibited
              or unsafe items must not be listed. Accounts may be suspended for material breaches.
            </p>
          </Card>
          <Card className="space-y-3">
            <h2 className="font-semibold text-brand-ink">5. Acceptance</h2>
            <p className="text-sm text-brand-muted">
              Completing vendor registration, including accepting these terms (version {VENDOR_TERMS_VERSION}),
              constitutes agreement to this Vendor Terms &amp; Platform Agreement.
            </p>
          </Card>
        </div>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Button href="/vendors/register">Start vendor registration</Button>
          <Button href="/vendors" variant="secondary">
            Back to vendors
          </Button>
        </div>
        <p className="mt-6 text-sm text-brand-muted">
          Questions?{" "}
          <Link href="/contact" className="font-semibold text-brand-teal hover:underline">
            Contact us
          </Link>
          .
        </p>
      </main>
      <MarketingFooter />
    </>
  );
}
