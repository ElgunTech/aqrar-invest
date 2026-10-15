import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import type { User } from "./types";

interface AuthState {
  user: User | null;
  loading: boolean;
  refresh: () => Promise<User | null>;
  login: (email: string, password: string) => Promise<User>;
  register: (data: { fullName: string; email: string; phone: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const u = await api<User>("/api/v1/auth/me");
      setUser(u);
      return u;
    } catch {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email: string, password: string) => {
    const u = await api<User>("/api/v1/auth/login", { method: "POST", body: { email, password } });
    setUser(u);
    return u;
  };

  const register = async (data: { fullName: string; email: string; phone: string; password: string }) => {
    const u = await api<User>("/api/v1/auth/register", { method: "POST", body: data });
    setUser(u);
    return u;
  };

  const logout = async () => {
    await api("/api/v1/auth/logout", { method: "POST" });
    // the offline copy of personal data must not outlive the session on a shared device
    try { await caches.delete("aqrar-api"); } catch { /* caches unavailable */ }
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, refresh, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}

export const isStaff = (u: User | null) => !!u && u.role !== "INVESTOR";
