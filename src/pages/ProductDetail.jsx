import { useState, useEffect } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import http from "@/lib/http";
import { ArrowLeft, Plus, Check, Star } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { API_BASE_URL as API } from "@/config/api";

export default function ProductDetail() {
  const { id } = useParams();
  const [product, setProduct] = useState(null);
  const [status, setStatus] = useState("loading");
  const [reloadKey, setReloadKey] = useState(0);
  const [selectedSize, setSelectedSize] = useState(null);
  const [added, setAdded] = useState(false);
  const { addItem } = useCart();
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Cancelled so a slow response for a previous id cannot overwrite a newer one.
    let cancelled = false;
    setStatus("loading");
    setProduct(null);
    setSelectedSize(null);
    http.get(`${API}/api/products/${id}`)
      .then(r => {
        if (cancelled) return;
        setProduct(r.data);
        setSelectedSize(r.data.sizes?.[0] || null);
        setStatus("ready");
      })
      .catch(error => {
        if (cancelled) return;
        // A removed product is a dead end; anything else is worth retrying.
        setStatus(error.response?.status === 404 ? "missing" : "error");
      });
    return () => { cancelled = true; };
  }, [id, reloadKey]);

  const handleAdd = () => {
    if (!product) return;
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

  if (status === "loading") {
    return (
      <div className="pt-28 pb-16 max-w-7xl mx-auto px-6 sm:px-8" role="status" aria-label="Loading dessert">
        <div className="animate-pulse grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="h-[400px] bg-[#F4F0E6] rounded-2xl" />
          <div className="space-y-4">
            <div className="h-4 w-20 bg-[#F4F0E6] rounded" />
            <div className="h-8 w-3/4 bg-[#F4F0E6] rounded" />
            <div className="h-20 bg-[#F4F0E6] rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (status !== "ready" || !product) {
    const missing = status === "missing";
    return (
      <div className="pt-28 pb-16 max-w-7xl mx-auto px-6 sm:px-8" data-testid="product-detail-unavailable">
        <div className="max-w-md mx-auto text-center bg-white rounded-2xl border border-[#E3DCD2] p-10">
          <h1 className="font-['Cormorant_Garamond'] text-3xl font-medium text-[#2C241B]">
            {missing ? "This dessert is off the menu" : "We could not load this dessert"}
          </h1>
          <p className="text-sm text-[#5C5042] mt-3">
            {missing
              ? "It may have sold out or been taken down. The rest of the menu is still here."
              : "Something went wrong reaching our kitchen. Please try again in a moment."}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            {!missing && (
              <Button
                onClick={() => setReloadKey(key => key + 1)}
                className="rounded-full px-6 bg-[#D96C4A] text-white hover:bg-[#C25D3E]"
                data-testid="product-detail-retry"
              >
                Try again
              </Button>
            )}
            <Link
              to="/menu"
              className="inline-flex items-center gap-2 text-sm text-[#5C5042] hover:text-[#D96C4A] transition-colors"
              data-testid="product-detail-back-to-menu"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Menu
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const displayPrice = selectedSize ? selectedSize.price : product.price;

  return (
    <div className="pt-24 sm:pt-28 pb-16" data-testid="product-detail-page">
      <div className="max-w-7xl mx-auto px-6 sm:px-8">
        <Link to="/menu" className="inline-flex items-center gap-2 text-sm text-[#5C5042] hover:text-[#D96C4A] mb-8 transition-colors" data-testid="back-to-menu">
          <ArrowLeft className="w-4 h-4" /> Back to Menu
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          <div className="rounded-2xl overflow-hidden">
            <img src={product.image} alt={product.name} className="w-full h-[350px] md:h-[450px] object-cover" />
          </div>

          <div className="flex flex-col justify-center">
            <p className="text-sm uppercase tracking-[0.2em] text-[#8A9A5B] font-medium mb-2">{product.category}</p>
            <h1 className="font-['Cormorant_Garamond'] text-4xl sm:text-5xl font-medium text-[#2C241B] tracking-tighter mb-4">
              {product.name}
            </h1>
            <p className="text-[#5C5042] leading-relaxed mb-6">{product.description}</p>

            {product.sizes && product.sizes.length > 1 && (
              <div className="mb-6">
                <p className="text-sm font-medium text-[#2C241B] mb-3">Select Size</p>
                <div className="flex flex-wrap gap-3">
                  {product.sizes.map(s => (
                    <button
                      key={s.name}
                      onClick={() => setSelectedSize(s)}
                      className={`px-5 py-2.5 rounded-full text-sm border transition-all duration-200 ${
                        selectedSize?.name === s.name
                          ? "bg-[#2C241B] text-[#FDFBF7] border-[#2C241B]"
                          : "border-[#E3DCD2] text-[#5C5042] hover:border-[#D96C4A]"
                      }`}
                      data-testid={`detail-size-${s.name.toLowerCase().replace(/\s/g, '-')}`}
                    >
                      {s.name} - &#8377;{s.price}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-6">
              <span className="font-['Cormorant_Garamond'] text-4xl font-semibold text-[#2C241B]">&#8377;{displayPrice}</span>
              <Button
                onClick={handleAdd}
                disabled={added}
                className={`rounded-full px-8 py-3 h-auto text-base font-medium transition-all duration-300 ${
                  added ? "bg-[#4A7c59] text-white" : "bg-[#D96C4A] text-white hover:bg-[#C25D3E] hover:shadow-lg"
                }`}
                data-testid="detail-add-to-cart"
              >
                {added ? <><Check className="w-4 h-4 mr-2" /> Added to Cart</> : <><Plus className="w-4 h-4 mr-2" /> Add to Cart</>}
              </Button>
            </div>

            {product.featured && (
              <div className="mt-6 flex items-center gap-2 text-sm text-[#E8A317]">
                <Star className="w-4 h-4 fill-[#E8A317]" /> Chef&apos;s Recommendation
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
