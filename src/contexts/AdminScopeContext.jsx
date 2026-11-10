import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import http from "@/lib/http";
import { API_BASE_URL as API } from "@/config/api";

const AdminScopeContext = createContext(null);

const STORAGE_KEY = "chaska_admin_scope";

// Which counter the admin is looking after: the online side, or one branch.
// Remembered so switching page does not drop them back to Online mid-task.
function readStored() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "online";
  } catch {
    return "online";
  }
}

export function AdminScopeProvider({ children }) {
  const [scope, setScope] = useState(() => readStored());
  const [outlets, setOutlets] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadOutlets = useCallback(() => {
    return http.get(`${API}/api/admin/outlets`)
      .then(({ data }) => setOutlets(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadOutlets(); }, [loadOutlets]);

  // A branch that is deleted or renamed away should not leave the admin
  // editing a counter that no longer exists.
  useEffect(() => {
    if (loading || scope === "online") return;
    if (!outlets.some(o => o.code === scope)) chooseScope("online");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, outlets, scope]);

  const chooseScope = useCallback((next) => {
    setScope(next);
    try { window.localStorage.setItem(STORAGE_KEY, next); } catch { /* not essential */ }
  }, []);

  const value = useMemo(() => {
    const outlet = scope === "online" ? null : outlets.find(o => o.code === scope) || null;
    return {
      scope,
      outlet,
      isOnline: scope === "online",
      scopeLabel: outlet ? outlet.name : "Online",
      outlets,
      loading,
      chooseScope,
      reloadOutlets: loadOutlets,
    };
  }, [scope, outlets, loading, chooseScope, loadOutlets]);

  return (
    <AdminScopeContext.Provider value={value}>
      {children}
    </AdminScopeContext.Provider>
  );
}

export const useAdminScope = () => useContext(AdminScopeContext);
