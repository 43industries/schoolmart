import Link from "next/link";
import { MarketingHeader, MarketingFooter } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function DeliveryRegisterSuccessPage() {
  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-lg px-4 py-16">
        <Card className="text-center">
          <h1 className="text-2xl font-bold text-brand-ink">Application received</h1>
          <p className="mt-3 text-brand-muted">
            Your last-mile delivery partner account is pending approval. Once approved, you can log in and
            serve towns closest to schools with Canters, PickUps, Vans, or Bodas.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button href="/login">Log in</Button>
            <Button variant="secondary" href="/deliveries">Back to deliveries</Button>
          </div>
          <p className="mt-6 text-sm text-brand-muted">
            Questions? <Link href="/contact" className="font-semibold text-brand-teal hover:underline">Contact us</Link>
          </p>
        </Card>
      </main>
      <MarketingFooter />
    </>
  );
}
