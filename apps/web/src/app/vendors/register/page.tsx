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
    branchNetwork: "",
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
      if (!form.email.trim() || !form.phone.trim()) {
        setError("Both email and telephone are required");
        return;
      }
      await vendorsApi.register({
        ...form,
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
        <p className="mb-3 text-sm font-semibold tracking-wide text-brand-teal">For vendors</p>
        <h1 className="mb-2 text-3xl font-bold tracking-tight text-brand-ink">Become a vendor</h1>
        <p className="mb-8 text-brand-muted">
          Register Your Vendor Details, Confirm Categories of School Items You Sell, Your Branch Network Across
          the Country &amp; Contacts, Accept Terms &amp; Conditions. We review and accept your application.
          You’re ready to receive and process orders from parents across the country.
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Vendor Registration</CardTitle>
            <CardDescription>Both email and telephone are required. Applications start as pending approval.</CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

            <Input
              label="Business Name"
              value={form.businessName}
              onChange={(e) => setForm({ ...form, businessName: e.target.value })}
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
              <Input label="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
            </div>
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <Input label="Telephone (Kenya)" type="tel" placeholder="0712345678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
            <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
            <Input label="Short Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

            <div>
              <label className="label" htmlFor="branch-network">Branch Network</label>
              <textarea
                id="branch-network"
                className="input min-h-[100px]"
                value={form.branchNetwork}
                onChange={(e) => setForm({ ...form, branchNetwork: e.target.value })}
                placeholder="List your branches, towns, or regions across the country"
                required
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Input label="County" value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} required />
              <Input label="Town" value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} required />
            </div>
            <Input label="Address / Landmark (optional)" value={form.addressLine} onChange={(e) => setForm({ ...form, addressLine: e.target.value })} />

            <div>
              <p className="label">Categories of School Items You Sell</p>
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
                  I accept the{" "}
                  <Link href="/vendors/terms" className="font-semibold text-brand-teal hover:underline" target="_blank">
                    Vendor Terms
                  </Link>{" "}
                  (version {VENDOR_TERMS_VERSION}), including fulfilment, delivery standards, and accurate catalog
                  listings.
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
                  I accept the{" "}
                  <Link href="/vendors/terms" className="font-semibold text-brand-teal hover:underline" target="_blank">
                    Platform Agreement
                  </Link>{" "}
                  (version {PLATFORM_AGREEMENT_VERSION}) governing fees, payouts, and use of SchoolMart.
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
