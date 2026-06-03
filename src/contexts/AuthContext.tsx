import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiFetch, getAccessToken, setAccessToken } from "../lib/api";

export interface AuthUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (payload: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) => Promise<{ needsConfirmation?: boolean }>;
  logout: () => Promise<void>;
  recoverPassword: (email: string) => Promise<string>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    const raw = localStorage.getItem("classify_user");
    if (raw) {
      try {
        setUser(JSON.parse(raw) as AuthUser);
      } catch {
        setAccessToken(null);
      }
    }
    setLoading(false);
  }, []);

  const persistSession = useCallback((accessToken: string, nextUser: AuthUser) => {
    setAccessToken(accessToken);
    localStorage.setItem("classify_user", JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiFetch<{
      accessToken: string;
      user: AuthUser;
    }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    persistSession(data.accessToken, data.user);
  }, [persistSession]);

  const register = useCallback(
    async (payload: {
      email: string;
      password: string;
      firstName: string;
      lastName: string;
    }) => {
      const data = await apiFetch<{
        accessToken?: string;
        user?: AuthUser;
        message?: string;
      }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (data.accessToken && data.user) {
        persistSession(data.accessToken, data.user);
        return {};
      }
      return { needsConfirmation: true };
    },
    [persistSession]
  );

  const logout = useCallback(async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } finally {
      setAccessToken(null);
      localStorage.removeItem("classify_user");
      setUser(null);
    }
  }, []);

  const recoverPassword = useCallback(async (email: string) => {
    const data = await apiFetch<{ message: string }>("/api/auth/recover-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
    return data.message;
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, recoverPassword }),
    [user, loading, login, register, logout, recoverPassword]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
