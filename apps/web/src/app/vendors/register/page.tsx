"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { MarketingHeader, MarketingFooter } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, vendorsApi } from "@/lib/api";
import {
  VENDOR_SELL_CATEGORIES,
  VENDOR_TERMS_VERSION,
  PLATFORM_AGREEMENT_VERSION,
  type VendorSellCategory,
} from "@schoolmart/shared";

const CATEGORY_LABELS: Record<VendorSellCategory, string> = {
  MEALS_SNACKS: "Meals & snacks",
  SCHOOL_SUPPLIES: "School supplies",
  PERSONAL_CARE: "Personal care",
  CARE_PACKAGES: "Care packages",
  EXAM_ESSENTIALS: "Exam essentials",
  CAMPUS_ESSENTIALS: "Campus essentials",
};

export default function VendorRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    businessName: "",
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    description: "",
    county: "",
    town: "",
    addressLine: "",
  });
  const [categories, setCategories] = useState<VendorSellCategory[]>([]);
  const [acceptVendorTerms, setAcceptVendorTerms] = useState(false);
  const [acceptPlatformAgreement, setAcceptPlatformAgreement] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const toggleCategory = (c: VendorSellCategory) => {
    setCategories((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!acceptVendorTerms || !acceptPlatformAgreement) {
        setError("You must accept the vendor terms and platform agreement");
        return;
      }
      if (categories.length === 0) {
        setError("Select at least one category you sell");
        return;
      }
      await vendorsApi.register({
        ...form,
        email: form.email || undefined,
        phone: form.phone || undefined,
        description: form.description || undefined,
        addressLine: form.addressLine || undefined,
        sellCategories: categories,
        acceptVendorTerms,
        acceptPlatformAgreement,
      });
      router.push("/vendors/register/success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <MarketingHeader />
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-brand-teal">Vendors</p>
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-brand-ink">Become a vendor</h1>
        <p className="mb-8 text-brand-muted">
          Tell us what you sell and where you deliver. Accept the terms, then we review your application.
          Vendors aggregate and deliver — parents order, pay and track.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Vendor registration</CardTitle>
            <CardDescription>Email or phone required. Applications start as pending approval.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            <Input
              label="Business name"
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="First name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
              <Input label="Last name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </div>
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <Input label="Phone (Kenya)" type="tel" placeholder="0712345678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <Input label="Short description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="County" value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} required />
              <Input label="Town" value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} required />
            </div>
            <Input label="Address / landmark (optional)" value={form.addressLine} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} />

            <div>
              <p className="label">What do you sell?</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {VENDOR_SELL_CATEGORIES.map((c) => {
                  const active = categories.includes(c);
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCategory(c)}
                      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                        active
                          ? "border-brand-teal bg-brand-teal text-white"
                          : "border-gray-200 bg-white text-brand-muted hover:border-brand-teal/40"
                      }`}
                    >
                      {CATEGORY_LABELS[c]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 rounded-2xl border border-gray-100 bg-brand-surface p-4 text-sm">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={acceptVendorTerms}
                  onChange={(e) => setAcceptVendorTerms(e.target.checked)}
                  required
                />
                <span>
                  I accept the <strong>Vendor Terms</strong> (version {VENDOR_TERMS_VERSION}), including fulfilment,
                  last man delivery standards, and accurate catalog listings.
                </span>
              </label>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={acceptPlatformAgreement}
                  onChange={(e) => setAcceptPlatformAgreement(e.target.checked)}
                  required
                />
                <span>
                  I accept the <strong>Platform Agreement</strong> (version {PLATFORM_AGREEMENT_VERSION}) governing
                  fees, payouts, and use of SchoolMart.
                </span>
              </label>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !acceptVendorTerms || !acceptPlatformAgreement || categories.length === 0}
            >
              {loading ? "Submitting..." : "Submit vendor application"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-brand-muted">
            Already registered?{" "}
            <Link href="/login" className="font-semibold text-brand-teal hover:underline">Log in</Link>
          </p>
        </Card>
      </main>
      <MarketingFooter />
    </>
  );
}
