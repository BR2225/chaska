import { useState, useMemo } from "react";
import { Plus, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function ProductCard({ product }) {
  const { addItem } = useCart();
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedSize, setSelectedSize] = useState(product.sizes?.[0] || null);
  const [added, setAdded] = useState(false);

  // Products carrying several shots let the visitor step through them; the rest
  // keep the one image they have always had.
  const gallery = useMemo(() => {
    const shots = (product.images?.length ? product.images : [product.image]).filter(Boolean);
    return shots.length ? shots : [];
  }, [product.images, product.image]);
  const [shotIndex, setShotIndex] = useState(0);

  // The whole card is a link to the product, so every control inside it has to
  // stop the click before it navigates.
  const showShot = (e, next) => {
    e.preventDefault();
    e.stopPropagation();
    setShotIndex((next + gallery.length) % gallery.length);
  };

  const handleAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (authLoading) {
      toast.info("Checking your account. Please try again in a moment.");
      return;
    }
    if (!user || user.role !== "customer") {
      toast.info("Sign in or create an account to add items to your cart.");
      navigate("/login", { state: { from: location, reason: "cart" } });
      return;
    }
    if (!addItem(product, selectedSize)) return;
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
        <div className="relative h-[240px] overflow-hidden">
          {/* Stacked and cross-faded rather than swapped, so the card never
              shows a gap while the next shot decodes. */}
          {gallery.map((shot, index) => (
            <img
              key={shot}
              src={shot}
              alt={index === 0 ? product.name : ""}
              aria-hidden={index === 0 ? undefined : true}
              loading={index === 0 ? undefined : "lazy"}
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-700 group-hover:scale-105 ${
                index === shotIndex ? "opacity-100" : "opacity-0"
              }`}
            />
          ))}
          {product.featured && (
            <span className="absolute top-3 left-3 bg-[#D96C4A] text-white text-xs uppercase tracking-[0.15em] px-3 py-1 rounded-full font-medium">
              Featured
            </span>
          )}

          {gallery.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => showShot(e, shotIndex - 1)}
                aria-label={`Previous photo of ${product.name}`}
                className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#FDF0DB]/85 text-[#2C241B] flex items-center justify-center shadow-sm transition-colors hover:bg-[#FDF0DB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D96C4A]"
                data-testid={`photo-prev-${product.id}`}
              >
                <ChevronLeft className="w-5 h-5" strokeWidth={1.75} />
              </button>
              <button
                type="button"
                onClick={(e) => showShot(e, shotIndex + 1)}
                aria-label={`Next photo of ${product.name}`}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-[#FDF0DB]/85 text-[#2C241B] flex items-center justify-center shadow-sm transition-colors hover:bg-[#FDF0DB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D96C4A]"
                data-testid={`photo-next-${product.id}`}
              >
                <ChevronRight className="w-5 h-5" strokeWidth={1.75} />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {gallery.map((shot, index) => (
                  <button
                    key={shot}
                    type="button"
                    onClick={(e) => showShot(e, index)}
                    aria-label={`Show photo ${index + 1} of ${gallery.length}`}
                    aria-current={index === shotIndex}
                    className={`h-2 rounded-full transition-all ${
                      index === shotIndex ? "w-5 bg-[#FDF0DB]" : "w-2 bg-[#FDF0DB]/60 hover:bg-[#FDF0DB]/90"
                    }`}
                    data-testid={`photo-dot-${product.id}-${index}`}
                  />
                ))}
              </div>
            </>
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
