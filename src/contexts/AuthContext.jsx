import { createContext, useContext, useState, useEffect, useCallback } from "react";
import http, { hasStoredSession } from "@/lib/http";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = useCallback(async () => {
    // A visitor with no session cookie has nothing to restore, so asking the
    // API would only ever return 401 on every page load.
    if (!hasStoredSession()) {
      setUser(false);
      setLoading(false);
      return;
    }
    try {
      const { data } = await http.get("/api/auth/me");
      setUser(data);
    } catch {
      setUser(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useEffect(() => {
    const expireSession = () => setUser(false);
    window.addEventListener("chaska:auth-expired", expireSession);
    return () => window.removeEventListener("chaska:auth-expired", expireSession);
  }, []);

  const login = async (identifier, password) => {
    const { data } = await http.post("/api/auth/login", { identifier, password });
    setUser(data);
    return data;
  };

  const register = async (fullName, identifier, password) => {
    const { data } = await http.post("/api/auth/register", { full_name: fullName, identifier, password });
    setUser(data);
    return data;
  };

  const logout = async () => {
    await http.post("/api/auth/logout");
    setUser(false);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
