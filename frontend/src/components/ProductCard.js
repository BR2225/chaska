import { useState } from "react";
import { Plus, Check } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { Link } from "react-router-dom";

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const [selectedSize, setSelectedSize] = useState(product.sizes?.[0] || null);
  const [added, setAdded] = useState(false);

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, selectedSize);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const handleSizeClick = (e, size) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedSize(size);
  };

  const displayPrice = selectedSize ? selectedSize.price : product.price;

  return (
    <Link to={`/menu/${product.id}`} className="group block" data-testid={`product-card-${product.id}`}>
      <div className="bg-white rounded-2xl shadow-[0_8px_30px_rgb(44,36,27,0.06)] border border-[#E3DCD2]/50 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgb(44,36,27,0.1)] overflow-hidden">
        <div className="relative overflow-hidden">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-[240px] object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {product.featured && (
            <span className="absolute top-3 left-3 bg-[#D96C4A] text-white text-xs uppercase tracking-[0.15em] px-3 py-1 rounded-full font-medium">
              Featured
            </span>
          )}
        </div>
        <div className="p-5 sm:p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[#8A9A5B] font-medium mb-1">{product.category}</p>
          <h3 className="font-['Cormorant_Garamond'] text-xl sm:text-2xl font-semibold text-[#2C241B] mb-2 group-hover:text-[#D96C4A] transition-colors">
            {product.name}
          </h3>
          <p className="text-sm text-[#5C5042] leading-relaxed mb-4 line-clamp-2">{product.description}</p>

          {product.sizes && product.sizes.length > 1 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {product.sizes.map(s => (
                <button
                  key={s.name}
                  onClick={(e) => handleSizeClick(e, s)}
                  className={`text-xs px-3 py-1.5 rounded-full border transition-all duration-200 ${
                    selectedSize?.name === s.name
                      ? "bg-[#2C241B] text-[#FDFBF7] border-[#2C241B]"
                      : "border-[#E3DCD2] text-[#5C5042] hover:border-[#D96C4A]"
                  }`}
                  data-testid={`size-${product.id}-${s.name.toLowerCase().replace(/\s/g, '-')}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="font-['Cormorant_Garamond'] text-2xl font-semibold text-[#2C241B]">
              &#8377;{displayPrice}
            </span>
            <button
              onClick={handleAdd}
              disabled={added}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-300 ${
                added
                  ? "bg-[#4A7c59] text-white"
                  : "bg-[#D96C4A] text-white hover:bg-[#C25D3E] hover:shadow-lg"
              }`}
              data-testid={`add-to-cart-${product.id}`}
            >
              {added ? <><Check className="w-4 h-4" /> Added</> : <><Plus className="w-4 h-4" /> Add</>}
            </button>
          </div>
        </div>
      </div>
    </Link>
  );
}
