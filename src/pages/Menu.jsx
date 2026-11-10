import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import http from "@/lib/http";
import ProductCard from "@/components/ProductCard";
import { API_BASE_URL as API } from "@/config/api";
import ChaskaLoader from "@/components/ChaskaLoader";
import { useFulfilment } from "@/contexts/FulfilmentContext";
import { Store, Bike } from "lucide-react";
import { Link } from "react-router-dom";

export default function Menu() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get("category") || "all";
  const { mode, outlet } = useFulfilment();
  const outletCode = mode === "dine_in" ? outlet?.code : null;

  const lastLoadedAt = useRef(0);

  const loadProducts = useCallback(({ quiet } = {}) => {
    // Availability is per counter, so the branch has to go with the request
    // or the menu shows the online stock list to somebody standing in a shop.
    const query = new URLSearchParams();
    if (activeCategory !== "all") query.set("category", activeCategory);
    if (outletCode) query.set("outlet", outletCode);
    const params = query.toString() ? `?${query}` : "";
    if (!quiet) setLoading(true);
    // Stamped before the request, not after: focus and visibilitychange both
    // fire when a tab is returned to, and a timestamp written on arrival would
    // let the second one through while the first is still in flight.
    lastLoadedAt.current = Date.now();
    return http.get(`${API}/api/products${params}`)
      .then(r => { setProducts(r.data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [activeCategory, outletCode]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  // A menu left open does not know the shop has sold out of something. Fetch
  // again when the tab is looked at after a while, quietly, so the page is
  // simply right rather than correcting itself in front of the reader.
  useEffect(() => {
    const STALE_AFTER_MS = 30000;
    const refreshIfStale = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastLoadedAt.current < STALE_AFTER_MS) return;
      loadProducts({ quiet: true });
    };
    window.addEventListener("focus", refreshIfStale);
    document.addEventListener("visibilitychange", refreshIfStale);
    return () => {
      window.removeEventListener("focus", refreshIfStale);
      document.removeEventListener("visibilitychange", refreshIfStale);
    };
  }, [loadProducts]);

  // One card discovering it is sold out tells the rest of the page, so the
  // same item is not still offered further down the list.
  const markSoldOut = useCallback((productId) => {
    setProducts(current => current.map(p => (
      p.id === productId ? { ...p, is_available: false } : p
    )));
  }, []);

  const categories = [
    { value: "all", label: "All" },
    { value: "bomboloni", label: "Bomboloni" },
    { value: "desserts", label: "Desserts" },
  ];

  return (
    <div className="pt-24 sm:pt-28 pb-16" data-testid="menu-page">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 sm:px-8 mb-12">
        <p className="text-sm uppercase tracking-[0.2em] text-[#D96C4A] mb-3 font-medium">Our Menu</p>
        <h1 className="font-['Cormorant_Garamond'] text-4xl sm:text-5xl font-light text-[#2C241B] tracking-tighter mb-6">
          Discover Our Desserts
        </h1>

        {/* Which counter this menu is showing. Availability differs between
            branches, so leaving it unsaid invites ordering from the wrong one. */}
        <Link
          to="/dine-in"
          className="inline-flex items-center gap-2 text-xs text-[#5C5042] hover:text-[#D96C4A] border border-[#E3DCD2] rounded-full px-4 py-2 mb-6 transition-colors"
          data-testid="menu-fulfilment"
        >
          {mode === "dine_in" ? <Store className="w-3.5 h-3.5" /> : <Bike className="w-3.5 h-3.5" />}
          {mode === "dine_in"
            ? <>Showing what&apos;s on the counter at <span className="font-medium text-[#2C241B]">{outlet?.name}</span></>
            : mode === "delivery"
              ? <>Showing what we can <span className="font-medium text-[#2C241B]">deliver</span></>
              : <>Choose <span className="font-medium text-[#2C241B]">delivery or dine in</span></>}
          <span className="text-[#D96C4A] font-medium">Change</span>
        </Link>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-3" data-testid="category-filter">
          {categories.map(c => (
            <button
              key={c.value}
              onClick={() => setSearchParams(c.value === "all" ? {} : { category: c.value })}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                activeCategory === c.value
                  ? "bg-[#2C241B] text-[#FDFBF7]"
                  : "bg-white text-[#5C5042] border border-[#E3DCD2] hover:border-[#D96C4A] hover:text-[#D96C4A]"
              }`}
              data-testid={`filter-${c.value}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        {loading ? (
          <ChaskaLoader label="Loading the menu" fullScreen={false} className="rounded-2xl" />
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-['Cormorant_Garamond'] text-2xl text-[#5C5042]">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="products-grid">
            {products.map(p => <ProductCard key={p.id} product={p} onSoldOut={markSoldOut} />)}
          </div>
        )}
      </div>
    </div>
  );
}
