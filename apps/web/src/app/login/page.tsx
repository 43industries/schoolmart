"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth, getPrimaryRole, getDashboardPath } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";

export default function LoginPage() {
  const { login, user } = useAuth();
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    router.replace(getDashboardPath(getPrimaryRole(user)));
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const profile = await login(identifier, password);
      router.replace(getDashboardPath(getPrimaryRole(profile)));
    } catch (err) {
      if (err instanceof ApiError) {
        const hint =
          process.env.NODE_ENV === "development" && err.status === 401
            ? " Check email/password — demo accounts use Demo@SchoolMart2026."
            : "";
        const req =
          process.env.NODE_ENV === "development" && err.requestId
            ? ` [${err.requestId}]`
            : "";
        setError(`${err.message}${hint}${req}`);
      } else if (err instanceof Error && err.message) {
        setError(err.message);
      } else {
        setError("Login failed. Check the browser Network tab for the API host being called.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-brand-muted">
        Redirecting...
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 overflow-hidden bg-brand-surface lg:block">
        <Image
          src="/graphics/auth.png"
          alt="Student collecting a care package at school"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute bottom-10 left-10 right-10 text-white">
          <p className="text-2xl font-bold">Tracked deliveries to school</p>
          <p className="mt-2 text-white/80">Vendors aggregate and deliver. Parents order, pay and track. Students collect securely.</p>
        </div>
      </div>
      <div className="flex w-full flex-col items-center justify-center px-4 py-12 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <Logo size="lg" />
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Log in to your account</CardTitle>
              <CardDescription>Enter your email or phone number and password.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
              <Input label="Email or phone" type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required />
              <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
            <p className="mt-4 text-center text-sm text-brand-muted">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-semibold text-brand-teal hover:underline">Register as parent</Link>
              {" · "}
              <Link href="/student/activate" className="font-semibold text-brand-teal hover:underline">Activate student</Link>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
