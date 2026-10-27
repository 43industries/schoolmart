"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { MarketingHeader, MarketingFooter } from "@/components/layout/marketing-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, deliveriesApi } from "@/lib/api";
import { VEHICLE_TYPES, type VehicleType } from "@schoolmart/shared";

const VEHICLE_LABELS: Record<VehicleType, string> = {
  CANTER: "Canter",
  PICKUP: "PickUp",
  VAN: "Van",
  BODA: "Boda",
};

export default function DeliveryRegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    password: "",
    county: "",
    town: "",
    serviceTowns: "",
  });
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [primaryVehicleType, setPrimaryVehicleType] = useState<VehicleType | "">("");
  const [plateNumber, setPlateNumber] = useState("");
  const [logbook, setLogbook] = useState<File | null>(null);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageSrc, setImageSrc] = useState("/graphics/deliveries.png");

  const toggleVehicle = (v: VehicleType) => {
    setVehicleTypes((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (!acceptTerms) {
        setError("You must accept the delivery partner terms");
        return;
      }
      if (vehicleTypes.length === 0) {
        setError("Select at least one vehicle type");
        return;
      }
      if (!primaryVehicleType) {
        setError("Select your primary vehicle type");
        return;
      }
      if (!plateNumber.trim()) {
        setError("Enter the vehicle registration / plate number");
        return;
      }
      if (!logbook) {
        setError("Attach a copy of the vehicle logbook");
        return;
      }
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => data.append(k, v));
      vehicleTypes.forEach((v) => data.append("vehicleTypes", v));
      data.append("primaryVehicleType", primaryVehicleType);
      data.append("vehiclePlateNumber", plateNumber);
      data.append("acceptTerms", String(acceptTerms));
      data.append("logbook", logbook);
      await deliveriesApi.register(data);
      router.push("/deliveries/register/success");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <MarketingHeader />
      <main className="px-4 py-12">
        <div className="mx-auto grid max-w-6xl items-stretch gap-10 lg:grid-cols-2">
          <div className="relative hidden min-h-[28rem] overflow-hidden rounded-[2rem] shadow-xl shadow-brand-teal/10 lg:sticky lg:top-24 lg:block lg:self-start lg:h-[calc(100vh-8rem)]">
            <Image
              src={imageSrc}
              alt="Delivery van making school deliveries"
              fill
              className="object-cover object-center"
              priority
              sizes="50vw"
              onError={() => setImageSrc("/graphics/hero.png")}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-10 left-10 right-10 max-w-md text-white">
              <p className="text-2xl font-bold">Making Deliveries</p>
              <p className="mt-2 text-white/80">
                Move aggregated orders from vendors to campus collection points — Canters, PickUps, Vans, or Bodas.
              </p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold tracking-wide text-brand-teal">For deliveries</p>
            <h1 className="mb-2 text-3xl font-bold tracking-tight text-brand-ink">Delivery agent registration</h1>
            <p className="mb-8 text-brand-muted">
              Register your details, towns or locations closest to schools you serve, and vehicle types
              (Canters, PickUps, Vans, Bodas). We review your application before you go live.
            </p>

            <Card>
              <CardHeader>
                <CardTitle>Last-mile delivery application</CardTitle>
                <CardDescription>Email and telephone are required. Applications start as pending approval.</CardDescription>
              </CardHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="First Name" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} required />
                  <Input label="Last Name" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} required />
                </div>
                <Input label="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                <Input label="Telephone (Kenya)" type="tel" placeholder="0712345678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                <Input label="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />

                <div className="grid gap-3 sm:grid-cols-2">
                  <Input label="County" value={form.county} onChange={(e) => setForm({ ...form, county: e.target.value })} required />
                  <Input label="Home / Base Town" value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} required />
                </div>

                <div>
                  <label className="label" htmlFor="service-towns">Towns / Locations Closest to Schools</label>
                  <textarea
                    id="service-towns"
                    className="input min-h-[100px]"
                    value={form.serviceTowns}
                    onChange={(e) => setForm({ ...form, serviceTowns: e.target.value })}
                    placeholder="List towns or areas near schools you can deliver to"
                    required
                  />
                </div>

                <div>
                  <p className="label">Vehicle Types</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {VEHICLE_TYPES.map((v) => {
                      const active = vehicleTypes.includes(v);
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => toggleVehicle(v)}
                          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                            active
                              ? "border-brand-teal bg-brand-teal text-white"
                              : "border-gray-200 bg-white text-brand-muted hover:border-brand-teal/40"
                          }`}
                        >
                          {VEHICLE_LABELS[v]}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="label" htmlFor="primary-vehicle">Primary Vehicle (means of transport)</label>
                  <select
                    id="primary-vehicle"
                    className="input"
                    value={primaryVehicleType}
                    onChange={(e) => {
                      const v = e.target.value as VehicleType;
                      setPrimaryVehicleType(v);
                      if (v) setVehicleTypes((prev) => (prev.includes(v) ? prev : [...prev, v]));
                    }}
                    required
                  >
                    <option value="">Select primary vehicle</option>
                    {VEHICLE_TYPES.map((v) => (
                      <option key={v} value={v}>{VEHICLE_LABELS[v]}</option>
                    ))}
                  </select>
                </div>

                <Input
                  label="Vehicle Registration / Plate Number"
                  value={plateNumber}
                  onChange={(e) => setPlateNumber(e.target.value.toUpperCase())}
                  placeholder="e.g. KCX 123A"
                  required
                />

                <div>
                  <label className="label" htmlFor="logbook">Vehicle Logbook Copy</label>
                  <input
                    id="logbook"
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    className="input"
                    onChange={(e) => setLogbook(e.target.files?.[0] ?? null)}
                    required
                  />
                  <p className="mt-1 text-xs text-brand-muted">
                    Attach a copy of the logbook (PDF or photo, up to 10MB). Reviewed by our team before approval.
                    {logbook ? ` Selected: ${logbook.name}` : ""}
                  </p>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-brand-surface p-4 text-sm">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={acceptTerms}
                      onChange={(e) => setAcceptTerms(e.target.checked)}
                      required
                    />
                    <span>
                      I accept SchoolMart’s{" "}
                      <a href="/deliveries/terms" className="font-medium text-brand-teal hover:underline" target="_blank" rel="noreferrer">
                        last-mile delivery partner terms
                      </a>
                      , including safe campus drop-off and accurate service area information.
                    </span>
                  </label>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !acceptTerms || vehicleTypes.length === 0 || !primaryVehicleType || !plateNumber.trim() || !logbook}
                >
                  {loading ? "Submitting..." : "Submit delivery application"}
                </Button>
              </form>
              <p className="mt-4 text-center text-sm text-brand-muted">
                Already registered?{" "}
                <Link href="/login" className="font-semibold text-brand-teal hover:underline">Log in</Link>
              </p>
            </Card>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
