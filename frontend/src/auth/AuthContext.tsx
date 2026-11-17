import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, type RegisterInput, type User } from "../api";

interface AuthState {
  user: User | null;
  loading: boolean; // 처음 로그인 여부를 확인하는 동안 true
  login: (identifier: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // 앱을 열 때 세션 쿠키가 살아 있는지 확인한다.
  useEffect(() => {
    api.auth
      .me()
      .then((r) => setUser(r.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  // 어떤 API든 401이 오면(로그인 만료) 로그인 상태를 비운다. RequireAuth 가 로그인 화면으로 보낸다.
  useEffect(() => {
    const onUnauthorized = () => setUser(null);
    window.addEventListener("auth:unauthorized", onUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", onUnauthorized);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const { user } = await api.auth.login(identifier, password);
    setUser(user);
    return user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    await api.auth.register(input);
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setUser(null);
    }
  }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout }), [user, loading, login, register, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 는 AuthProvider 안에서만 사용할 수 있습니다.");
  return ctx;
}
