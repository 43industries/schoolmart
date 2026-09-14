"use client";

import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { authApi, getAccessToken, setAccessToken, type UserProfile } from "@/lib/api";

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const AUTH_PUBLIC_PATHS = ["/login", "/register", "/student/activate"];

function isAuthPublicPath(pathname: string): boolean {
  return AUTH_PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const authGen = useRef(0);

  const refresh = useCallback(async () => {
    const gen = authGen.current;
    try {
      const token = getAccessToken();
      if (token) {
        const profile = await authApi.me();
        if (gen !== authGen.current) return;
        setUser(profile);
        return;
      }

      // Cookie restore only off login/register so rotating refresh never fights submit.
      const pathname = typeof window !== "undefined" ? window.location.pathname : "";
      if (isAuthPublicPath(pathname)) {
        if (gen === authGen.current) {
          setUser(null);
        }
        return;
      }

      const tokens = await authApi.refresh();
      if (gen !== authGen.current) return;
      setAccessToken(tokens.accessToken);
      const profile = await authApi.me();
      if (gen !== authGen.current) return;
      setUser(profile);
    } catch {
      if (gen !== authGen.current) return;
      setAccessToken(null);
      setUser(null);
    } finally {
      if (gen === authGen.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = async (identifier: string, password: string) => {
    const gen = ++authGen.current;
    const result = await authApi.login({ identifier: identifier.trim(), password });
    setAccessToken(result.accessToken);
    const profile = await authApi.me();
    if (gen !== authGen.current) return profile;
    setUser(profile);
    setLoading(false);
    return profile;
  };

  const logout = async () => {
    authGen.current += 1;
    try {
      await authApi.logout();
    } catch {
      // still clear local session
    }
    setAccessToken(null);
    setUser(null);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

export function getPrimaryRole(user: UserProfile): string {
  const priority = ["SUPER_ADMIN", "SCHOOL_ADMIN", "FINANCE", "SUPPORT", "PARENT", "VENDOR", "DRIVER", "STUDENT"];
  for (const role of priority) {
    if (user.roles.some((r) => r.role === role)) return role;
  }
  return user.roles[0]?.role ?? "PARENT";
}

export function getDashboardPath(role: string): string {
  switch (role) {
    case "SUPER_ADMIN": return "/admin";
    case "SCHOOL_ADMIN": return "/school";
    case "FINANCE": return "/admin/finance";
    case "SUPPORT": return "/admin/support";
    case "PARENT": return "/parent";
    case "VENDOR": return "/vendor";
    case "STUDENT": return "/student";
    default: return "/parent";
  }
}
