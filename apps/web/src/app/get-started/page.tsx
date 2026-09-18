"use client";

import { useState } from "react";
import { MarketingHeader, MarketingFooter } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Tab = "parent" | "vendor";

export default function GetStartedPage() {
  const [tab, setTab] = useState<Tab>("parent");

  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <div className="mb-10 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-brand-ink md:text-4xl">Get started</h1>
          <p className="mt-3 text-brand-muted">
            Choose how you want to join SchoolMart — as a parent or as a vendor.
          </p>
        </div>

        <div
          className="mb-8 flex rounded-2xl border border-gray-100 bg-brand-surface p-1"
          role="tablist"
          aria-label="Get started options"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "parent"}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
              tab === "parent"
                ? "bg-white text-brand-ink shadow-sm"
                : "text-brand-muted hover:text-brand-ink"
            }`}
            onClick={() => setTab("parent")}
          >
            Get Started As a Parent
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "vendor"}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold transition ${
              tab === "vendor"
                ? "bg-white text-brand-ink shadow-sm"
                : "text-brand-muted hover:text-brand-ink"
            }`}
            onClick={() => setTab("vendor")}
          >
            Become A Vendor
          </button>
        </div>

        {tab === "parent" ? (
          <Card className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-brand-ink">Parent account</h2>
              <p className="mt-2 text-brand-muted">
                Create an account, link your child, fund their wallet, and order meals, essentials, and care
                packages delivered to school — then track every step.
              </p>
            </div>
            <ul className="space-y-2 text-sm text-brand-muted">
              <li>Link children with school approval</li>
              <li>Fund wallets via M-PESA, card, bank, or other rails</li>
              <li>Shop, pay, and track deliveries to campus</li>
            </ul>
            <Button href="/register">Continue as parent</Button>
          </Card>
        ) : (
          <Card className="space-y-6">
            <div>
              <h2 className="text-xl font-bold text-brand-ink">Vendor account</h2>
              <p className="mt-2 text-brand-muted">
                List your products, receive and aggregate parent orders, and coordinate delivery to schools
                with SchoolMart last-mile agents.
              </p>
            </div>
            <ul className="space-y-2 text-sm text-brand-muted">
              <li>Sell meals, supplies, care packages, and more</li>
              <li>Aggregate orders for efficient school delivery</li>
              <li>Grow sales through a trusted parent channel</li>
            </ul>
            <Button href="/vendors/register">Continue as vendor</Button>
          </Card>
        )}
      </main>
      <MarketingFooter />
    </>
  );
}
