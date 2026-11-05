import { createContext, useContext, useState, useEffect, useCallback } from "react";
import http, { hasStoredSession, rememberSession, forgetSession } from "@/lib/http";
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
    for (let attempt = 0; ; attempt++) {
      try {
        const { data } = await http.get("/api/auth/me");
        setUser(data);
        break;
      } catch (error) {
        // A 401 here means the server has ended the session. Anything else (a
        // timeout, a cold start, a dropped connection) is retried rather than
        // treated as signed out.
        const ended = error.response?.status === 401;
        if (ended || attempt >= 2) {
          if (ended) forgetSession();
          setUser(false);
          break;
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { checkAuth(); }, [checkAuth]);

  useEffect(() => {
    const expireSession = () => setUser(false);
    window.addEventListener("chaska:auth-expired", expireSession);
    return () => window.removeEventListener("chaska:auth-expired", expireSession);
  }, []);

  const login = async (identifier, password) => {
    const { data } = await http.post("/api/auth/login", { identifier, password });
    rememberSession();
    setUser(data);
    return data;
  };

  const register = async (fullName, identifier, password) => {
    const { data } = await http.post("/api/auth/register", { full_name: fullName, identifier, password });
    rememberSession();
    setUser(data);
    return data;
  };

  const logout = async () => {
    try {
      await http.post("/api/auth/logout");
    } finally {
      forgetSession();
      setUser(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
