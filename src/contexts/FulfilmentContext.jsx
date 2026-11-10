import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import http from "@/lib/http";
import { API_BASE_URL as API } from "@/config/api";

const FulfilmentContext = createContext(null);

const STORAGE_KEY = "chaska_fulfilment";

// Remembered rather than asked for on every visit: somebody who eats at the
// Patia counter every week should not have to say so each time. It is only a
// convenience, so a browser that refuses storage simply asks again.
function readStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved?.mode === "delivery") return { mode: "delivery", outlet: null };
    if (saved?.mode === "dine_in" && saved.outlet?.code) {
      return { mode: "dine_in", outlet: saved.outlet };
    }
  } catch {
    // Private windows and blocked site data both land here.
  }
  return null;
}

function writeStored(value) {
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Not being able to remember is survivable; failing the page is not.
  }
}

export function FulfilmentProvider({ children }) {
  const [choice, setChoice] = useState(() => readStored());
  const [outlets, setOutlets] = useState([]);
  const [outletsLoaded, setOutletsLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    http.get(`${API}/api/outlets`)
      .then(({ data }) => { if (active) setOutlets(data); })
      .catch(() => { /* with no branches reachable, delivery still works */ })
      .finally(() => { if (active) setOutletsLoaded(true); });
    return () => { active = false; };
  }, []);

  // A branch that closes should not leave somebody ordering into it.
  useEffect(() => {
    if (!outletsLoaded || choice?.mode !== "dine_in") return;
    const stillOpen = outlets.some(o => o.code === choice.outlet.code);
    if (!stillOpen) {
      setChoice(null);
      writeStored(null);
    }
  }, [outletsLoaded, outlets, choice]);

  const chooseDelivery = useCallback(() => {
    const next = { mode: "delivery", outlet: null };
    setChoice(next);
    writeStored(next);
  }, []);

  const chooseDineIn = useCallback((outlet) => {
    const next = { mode: "dine_in", outlet };
    setChoice(next);
    writeStored(next);
  }, []);

  const clearChoice = useCallback(() => {
    setChoice(null);
    writeStored(null);
  }, []);

  const value = useMemo(() => ({
    choice,
    mode: choice?.mode ?? null,
    outlet: choice?.outlet ?? null,
    isDineIn: choice?.mode === "dine_in",
    hasChosen: choice !== null,
    outlets,
    outletsLoaded,
    dineInAvailable: outlets.length > 0,
    chooseDelivery,
    chooseDineIn,
    clearChoice,
  }), [choice, outlets, outletsLoaded, chooseDelivery, chooseDineIn, clearChoice]);

  return (
    <FulfilmentContext.Provider value={value}>
      {children}
    </FulfilmentContext.Provider>
  );
}

export const useFulfilment = () => useContext(FulfilmentContext);
