"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { schoolAdminApi, ApiError } from "@/lib/api";
import { PortalLayout } from "@/components/layout/portal-layout";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const navItems = [
  { href: "/school", label: "Dashboard" },
  { href: "/school/deliveries", label: "Deliveries" },
  { href: "/school/students", label: "Students" },
  { href: "/school/parent-links", label: "Parent Links" },
  { href: "/school/activities", label: "Funkies" },
  { href: "/school/catalog", label: "Catalog" },
  { href: "/school/settings", label: "Settings" },
];

interface Student {
  id: string;
  studentNumber: string;
  firstName: string;
  middleName?: string | null;
  lastName: string;
  grade: string;
  className?: string;
  boardingStatus: string;
  status: string;
}

const emptyForm = {
  studentNumber: "",
  firstName: "",
  middleName: "",
  lastName: "",
  grade: "",
  className: "",
  boardingStatus: "DAY" as "BOARDING" | "DAY",
  collectionPin: "",
};

export default function SchoolStudentsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [fetching, setFetching] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [resetFor, setResetFor] = useState<Student | null>(null);
  const [newPin, setNewPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const schoolId = user?.roles.find((r) => r.role === "SCHOOL_ADMIN")?.scopeId;

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  const load = useCallback(async () => {
    if (!schoolId) return;
    const res = await schoolAdminApi.students(schoolId);
    setStudents(res.students as Student[]);
    setFetching(false);
  }, [schoolId]);

  useEffect(() => {
    if (schoolId) load().catch(() => setFetching(false));
  }, [schoolId, load]);

  const create = async () => {
    if (!schoolId) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await schoolAdminApi.createStudent(schoolId, {
        studentNumber: form.studentNumber,
        firstName: form.firstName,
        middleName: form.middleName || undefined,
        lastName: form.lastName,
        grade: form.grade,
        className: form.className || undefined,
        boardingStatus: form.boardingStatus,
        collectionPin: form.collectionPin || undefined,
      });
      setForm(emptyForm);
      setShowForm(false);
      setMessage("Student enrolled");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not create student");
    } finally {
      setBusy(false);
    }
  };

  const resetPin = async () => {
    if (!schoolId || !resetFor) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await schoolAdminApi.resetStudentPin(schoolId, resetFor.id, newPin);
      setMessage(
        `PIN and collection QR reset for ${resetFor.firstName}. Share the new PIN securely with the parent/student.`,
      );
      setResetFor(null);
      setNewPin("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not reset PIN");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) return null;

  return (
    <PortalLayout title="School Admin Portal" navItems={navItems}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-brand-ink">Students</h2>
          <p className="text-brand-muted">{students.length} students enrolled</p>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Close form" : "Add student"}</Button>
      </div>

      {error && <div className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="mb-4 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-700">{message}</div>}

      {showForm && (
        <Card className="mb-6 max-w-2xl">
          <CardHeader>
            <CardTitle>Enrol student</CardTitle>
            <CardDescription>Set an admission number and optional collection PIN (4–6 digits).</CardDescription>
          </CardHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Admission number"
              value={form.studentNumber}
              onChange={(e) => setForm({ ...form, studentNumber: e.target.value })}
            />
            <Input
              label="Grade / form"
              value={form.grade}
              onChange={(e) => setForm({ ...form, grade: e.target.value })}
            />
            <Input
              label="First name"
              value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            />
            <Input
              label="Last name"
              value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            />
            <Input
              label="Middle name"
              value={form.middleName}
              onChange={(e) => setForm({ ...form, middleName: e.target.value })}
            />
            <Input
              label="Class"
              value={form.className}
              onChange={(e) => setForm({ ...form, className: e.target.value })}
            />
            <label className="text-sm">
              <span className="mb-1 block font-medium text-brand-ink">Boarding</span>
              <select
                className="w-full rounded-xl border border-gray-200 px-3 py-2"
                value={form.boardingStatus}
                onChange={(e) =>
                  setForm({ ...form, boardingStatus: e.target.value as "BOARDING" | "DAY" })
                }
              >
                <option value="DAY">Day</option>
                <option value="BOARDING">Boarding</option>
              </select>
            </label>
            <Input
              label="Collection PIN (optional)"
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={form.collectionPin}
              onChange={(e) => setForm({ ...form, collectionPin: e.target.value })}
            />
          </div>
          <div className="mt-4">
            <Button
              disabled={
                busy || !form.studentNumber || !form.firstName || !form.lastName || !form.grade
              }
              onClick={create}
            >
              Create student
            </Button>
          </div>
        </Card>
      )}

      {resetFor && (
        <Card className="mb-6 max-w-md">
          <CardHeader>
            <CardTitle>Reset collection credentials</CardTitle>
            <CardDescription>
              {resetFor.firstName} {resetFor.lastName} · #{resetFor.studentNumber}. This also rotates their
              collection QR.
            </CardDescription>
          </CardHeader>
          <Input
            label="New PIN (4–6 digits)"
            type="password"
            inputMode="numeric"
            maxLength={6}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value)}
          />
          <div className="mt-3 flex gap-2">
            <Button disabled={busy || newPin.length < 4} onClick={resetPin}>
              Reset PIN & QR
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setResetFor(null);
                setNewPin("");
              }}
            >
              Cancel
            </Button>
          </div>
        </Card>
      )}

      {fetching ? (
        <p className="text-brand-muted">Loading...</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-brand-surface text-left text-brand-muted">
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Grade</th>
                <th className="px-4 py-3 font-medium">Boarding</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.id} className={i % 2 === 0 ? "bg-white" : "bg-brand-surface/60"}>
                  <td className="px-4 py-3 font-mono text-xs">{s.studentNumber}</td>
                  <td className="px-4 py-3 font-medium">
                    {s.firstName} {s.middleName ?? ""} {s.lastName}
                  </td>
                  <td className="px-4 py-3">{s.grade}</td>
                  <td className="px-4 py-3 capitalize">{s.boardingStatus.toLowerCase()}</td>
                  <td className="px-4 py-3 capitalize">{s.status.toLowerCase()}</td>
                  <td className="px-4 py-3">
                    <Button variant="secondary" onClick={() => setResetFor(s)}>
                      Reset PIN
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PortalLayout>
  );
}
