"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { studentsApi, schoolsApi, ApiError, type School } from "@/lib/api";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

export default function StudentActivatePage() {
  const router = useRouter();
  const [schools, setSchools] = useState<School[]>([]);
  const [form, setForm] = useState({
    schoolId: "",
    studentNumber: "",
    collectionPin: "",
    email: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    schoolsApi.list().then((res) => setSchools(res.schools)).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await studentsApi.activate({
        schoolId: form.schoolId,
        studentNumber: form.studentNumber,
        collectionPin: form.collectionPin,
        email: form.email || undefined,
        phone: form.phone || undefined,
        password: form.password,
      });
      router.push("/login?activated=1");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Activation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 overflow-hidden bg-brand-surface lg:block">
        <Image
          src="/graphics/auth.png"
          alt="Student collecting a delivery at school"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <p className="text-2xl font-bold">Campus student access</p>
          <p className="mt-2 text-white/80">
            Activate with your school, admission number, and collection PIN — then track and collect securely.
          </p>
        </div>
      </div>
      <div className="flex w-full flex-col items-center justify-center px-4 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <Logo size="lg" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Activate student account</CardTitle>
              <CardDescription>
                Not open signup — your school record and collection PIN unlock access.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <Select
                label="School"
                value={form.schoolId}
                onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
                options={[{ value: "", label: "Select your school" }, ...schools.map((s) => ({ value: s.id, label: `${s.name} (${s.town})` }))]}
                required
              />
              <Input
                label="Admission number"
                value={form.studentNumber}
                onChange={(e) => setForm({ ...form, studentNumber: e.target.value })}
                placeholder="e.g. GF-2024-001"
                required
              />
              <Input
                label="Collection PIN"
                type="password"
                inputMode="numeric"
                value={form.collectionPin}
                onChange={(e) => setForm({ ...form, collectionPin: e.target.value })}
                required
              />
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <Input
                label="Phone (Kenya)"
                type="tel"
                placeholder="0712345678"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
              <p className="text-xs text-brand-muted">Provide email or phone (at least one)</p>
              <Input
                label="Create password"
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
              />
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Activating..." : "Activate account"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-brand-muted">
              Already activated?{" "}
              <Link href="/login" className="font-semibold text-brand-teal hover:underline">Log in</Link>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
