"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { parentsApi, schoolsApi, ApiError, type School } from "@/lib/api";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const navItems = [
  { href: "/parent", label: "Dashboard" },
  { href: "/parent/children", label: "My Children" },
  { href: "/parent/shop", label: "Shop" },
  { href: "/parent/cart", label: "Cart" },
  { href: "/parent/wallet", label: "Wallet" },
  { href: "/parent/activities", label: "Funkies" },
  { href: "/parent/settings", label: "Settings" },
];

const relationships = [
  { value: "MOTHER", label: "Mother" },
  { value: "FATHER", label: "Father" },
  { value: "GUARDIAN", label: "Guardian" },
  { value: "OTHER", label: "Other" },
];

export default function LinkChildPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [schools, setSchools] = useState<School[]>([]);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    schoolId: "",
    studentNumber: "",
    classTeacherName: "",
    relationship: "MOTHER",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.push("/login");
    schoolsApi.list().then((res) => setSchools(res.schools)).catch(() => {});
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await parentsApi.linkChild(form);
      setSuccess(true);
      setTimeout(() => router.push("/parent/children"), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to link child");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || !user) return null;

  return (
    <PortalLayout title="Parent Portal" navItems={navItems}>
      <div className="mx-auto max-w-lg">
        <Card>
          <CardHeader>
            <CardTitle>Link a Child</CardTitle>
            <CardDescription>
              Provide your child&apos;s name, school, admission number, and class teacher.
              The school will approve the link before you can order and track deliveries.
            </CardDescription>
          </CardHeader>
          {success ? (
            <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700">
              Link request submitted! Waiting for school approval.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Child first name"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  required
                />
                <Input
                  label="Child last name"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  required
                />
              </div>
              <Select
                label="School"
                value={form.schoolId}
                onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
                options={[{ value: "", label: "Select a school" }, ...schools.map((s) => ({ value: s.id, label: `${s.name} (${s.town})` }))]}
                required
              />
              <Input
                label="Admission number"
                value={form.studentNumber}
                onChange={(e) => setForm({ ...form, studentNumber: e.target.value })}
                placeholder="As shown on school records"
                required
              />
              <Input
                label="Class teacher name"
                value={form.classTeacherName}
                onChange={(e) => setForm({ ...form, classTeacherName: e.target.value })}
                required
              />
              <Select
                label="Relationship"
                value={form.relationship}
                onChange={(e) => setForm({ ...form, relationship: e.target.value })}
                options={relationships}
              />
              <div className="flex gap-3">
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Submitting..." : "Request Link"}
                </Button>
                <Button variant="secondary" href="/parent/children">Cancel</Button>
              </div>
            </form>
          )}
        </Card>
      </div>
    </PortalLayout>
  );
}
