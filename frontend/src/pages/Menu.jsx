import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import http from "@/lib/http";
import ProductCard from "@/components/ProductCard";
import { API_BASE_URL as API } from "@/config/api";

export default function Menu() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const activeCategory = searchParams.get("category") || "all";

  useEffect(() => {
    const params = activeCategory !== "all" ? `?category=${activeCategory}` : "";
    http.get(`${API}/api/products${params}`)
      .then(r => { setProducts(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [activeCategory]);

  const categories = [
    { value: "all", label: "All Desserts" },
    { value: "bomboloni", label: "Bomboloni" },
    { value: "tiramisu", label: "Tiramisu" },
  ];

  return (
    <div className="pt-24 sm:pt-28 pb-16" data-testid="menu-page">
      {/* Header */}
      <div className="max-w-7xl mx-auto px-6 sm:px-8 mb-12">
        <p className="text-sm uppercase tracking-[0.2em] text-[#D96C4A] mb-3 font-medium">Our Menu</p>
        <h1 className="font-['Cormorant_Garamond'] text-4xl sm:text-5xl font-light text-[#2C241B] tracking-tighter mb-6">
          Discover Our Desserts
        </h1>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#E3DCD2]/50 overflow-hidden animate-pulse">
                <div className="h-[240px] bg-[#F4F0E6]" />
                <div className="p-6 space-y-3">
                  <div className="h-3 w-20 bg-[#F4F0E6] rounded" />
                  <div className="h-5 w-3/4 bg-[#F4F0E6] rounded" />
                  <div className="h-3 w-full bg-[#F4F0E6] rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-['Cormorant_Garamond'] text-2xl text-[#5C5042]">No products found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="products-grid">
            {products.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
