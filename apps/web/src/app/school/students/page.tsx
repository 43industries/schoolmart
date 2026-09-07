"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { schoolAdminApi } from "@/lib/api";
import { PortalLayout } from "@/components/layout/portal-layout";

const navItems = [
  { href: "/school", label: "Dashboard" },
  { href: "/school/students", label: "Students" },
  { href: "/school/parent-links", label: "Parent Links" },
  { href: "/school/catalog", label: "Catalog" },
  { href: "/school/settings", label: "Settings" },
];

interface Student {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  grade: string;
  className?: string;
  boardingStatus: string;
  status: string;
}

export default function SchoolStudentsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<Student[]>([]);
  const [fetching, setFetching] = useState(true);

  const schoolId = user?.roles.find((r) => r.role === "SCHOOL_ADMIN")?.scopeId;

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (schoolId) {
      schoolAdminApi.students(schoolId)
        .then((res) => setStudents(res.students as Student[]))
        .catch(() => {})
        .finally(() => setFetching(false));
    }
  }, [schoolId]);

  if (loading || !user) return null;

  return (
    <PortalLayout title="School Admin Portal" navItems={navItems}>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-brand-ink">Students</h2>
        <p className="text-brand-muted">{students.length} students enrolled</p>
      </div>

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
              </tr>
            </thead>
            <tbody>
              {students.map((s, i) => (
                <tr key={s.id} className={i % 2 === 0 ? "bg-white" : "bg-brand-surface/60"}>
                  <td className="px-4 py-3 font-mono text-xs">{s.studentNumber}</td>
                  <td className="px-4 py-3 font-medium">{s.firstName} {s.lastName}</td>
                  <td className="px-4 py-3">{s.grade}</td>
                  <td className="px-4 py-3 capitalize">{s.boardingStatus.toLowerCase()}</td>
                  <td className="px-4 py-3 capitalize">{s.status.toLowerCase()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PortalLayout>
  );
}
