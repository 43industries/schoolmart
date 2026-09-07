"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { authApi, type UserProfile } from "@/lib/api";

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const profile = await authApi.me();
      setUser(profile);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (identifier: string, password: string) => {
    await authApi.login({ identifier, password });
    await refresh();
  };

  const logout = async () => {
    await authApi.logout();
    setUser(null);
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
