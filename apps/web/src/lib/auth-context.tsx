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

/** Bumped on login/logout so in-flight bootstrap cannot overwrite a newer session. */
let sessionEpoch = 0;
/** Dedupe Strict Mode overlapping bootstrap (refresh-token rotation is single-use). */
let restoreInFlight: Promise<UserProfile> | null = null;

async function restoreSession(): Promise<UserProfile> {
  if (restoreInFlight) return restoreInFlight;

  const epoch = sessionEpoch;
  const run = (async () => {
    const existing = getAccessToken();
    if (existing) {
      try {
        const profile = await authApi.me();
        if (epoch !== sessionEpoch) throw new Error("session superseded");
        return profile;
      } catch (err) {
        if (epoch !== sessionEpoch) throw err;
        // Stale bearer in sessionStorage — fall back to httpOnly refresh cookie
        setAccessToken(null);
      }
    }

    const tokens = await authApi.refresh();
    if (epoch !== sessionEpoch) throw new Error("session superseded");
    setAccessToken(tokens.accessToken);
    const profile = await authApi.me();
    if (epoch !== sessionEpoch) throw new Error("session superseded");
    return profile;
  })();

  restoreInFlight = run.finally(() => {
    if (restoreInFlight === run) restoreInFlight = null;
  });

  return restoreInFlight;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const authGen = useRef(0);

  const refresh = useCallback(async () => {
    const gen = authGen.current;
    try {
      const profile = await restoreSession();
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
    sessionEpoch += 1;
    setLoading(true);
    try {
      // Let any in-flight bootstrap refresh finish first so its Set-Cookie
      // cannot land after login and rotate away the new session.
      if (restoreInFlight) {
        await restoreInFlight.catch(() => undefined);
      }

      const result = await authApi.login({ identifier: identifier.trim(), password });
      setAccessToken(result.accessToken);
      const profile = await authApi.me();
      if (gen !== authGen.current) return profile;
      setUser(profile);
      return profile;
    } catch (err) {
      if (gen === authGen.current) {
        setAccessToken(null);
        setUser(null);
      }
      throw err;
    } finally {
      if (gen === authGen.current) setLoading(false);
    }
  };

  const logout = async () => {
    authGen.current += 1;
    sessionEpoch += 1;
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
