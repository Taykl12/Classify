import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  apiFetch,
  apiFetchWithRetry,
  clearStoredSession,
  getAccessToken,
  registerUnauthorizedHandler,
  setAccessToken,
} from "../lib/api";

export interface AuthUser {
  id: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  /** Cargo para el sidebar, ej. Alumno, Profesor */
  roleLabel?: string;
  profilePhotoUrl?: string | null;
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
  refreshUser: (nextUser: AuthUser) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const persistSession = useCallback((accessToken: string, nextUser: AuthUser) => {
    setAccessToken(accessToken);
    localStorage.setItem("classify_user", JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  useEffect(() => registerUnauthorizedHandler(() => setUser(null)), []);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await apiFetchWithRetry<{ user: AuthUser }>("/api/auth/me");
        if (!cancelled) persistSession(token, data.user);
      } catch {
        if (!cancelled) {
          clearStoredSession();
          setUser(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [persistSession]);

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
      clearStoredSession();
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

  const refreshUser = useCallback(
    (nextUser: AuthUser) => {
      const token = getAccessToken();
      if (token) persistSession(token, nextUser);
    },
    [persistSession]
  );

  const value = useMemo(
    () => ({ user, loading, login, register, logout, recoverPassword, refreshUser }),
    [user, loading, login, register, logout, recoverPassword, refreshUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}
