import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import { Package, Clock, CheckCircle, Truck, XCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const API = process.env.REACT_APP_BACKEND_URL;

const statusConfig = {
  pending: { icon: Clock, color: "#E8A317", label: "Pending" },
  confirmed: { icon: CheckCircle, color: "#8A9A5B", label: "Confirmed" },
  preparing: { icon: Package, color: "#D96C4A", label: "Preparing" },
  out_for_delivery: { icon: Truck, color: "#D96C4A", label: "Out for Delivery" },
  delivered: { icon: CheckCircle, color: "#4A7c59", label: "Delivered" },
  cancelled: { icon: XCircle, color: "#D3494E", label: "Cancelled" },
};

export default function MyOrders() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user === false) { navigate("/login"); return; }
    if (!user) return;
    axios.get(`${API}/api/my-orders`, { withCredentials: true })
      .then(r => { setOrders(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="pt-24 sm:pt-28 pb-16 min-h-[80vh]" data-testid="my-orders-page">
      <div className="max-w-4xl mx-auto px-6 sm:px-8">
        <p className="text-sm uppercase tracking-[0.2em] text-[#D96C4A] mb-3 font-medium">Your Account</p>
        <h1 className="font-['Cormorant_Garamond'] text-4xl sm:text-5xl font-light text-[#2C241B] tracking-tighter mb-10">
          My Orders
        </h1>

        {loading ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-[#E3DCD2]/50 p-6 animate-pulse">
                <div className="h-4 w-32 bg-[#F4F0E6] rounded mb-3" />
                <div className="h-3 w-48 bg-[#F4F0E6] rounded mb-2" />
                <div className="h-3 w-24 bg-[#F4F0E6] rounded" />
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20" data-testid="no-orders">
            <Package className="w-16 h-16 text-[#E3DCD2] mx-auto mb-4" strokeWidth={1} />
            <p className="font-['Cormorant_Garamond'] text-2xl text-[#2C241B] mb-2">No orders yet</p>
            <p className="text-sm text-[#5C5042] mb-6">Your delicious desserts are waiting for you!</p>
            <Link to="/menu">
              <Button className="bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-full px-8" data-testid="browse-menu-btn">
                Browse Menu
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4" data-testid="orders-list">
            {orders.map(o => {
              const sc = statusConfig[o.status] || statusConfig.pending;
              const StatusIcon = sc.icon;
              return (
                <div key={o.id} className="bg-white rounded-2xl border border-[#E3DCD2]/50 shadow-[0_4px_20px_rgb(44,36,27,0.04)] p-5 sm:p-6 transition-all hover:shadow-[0_8px_30px_rgb(44,36,27,0.08)]" data-testid={`my-order-${o.id}`}>
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <p className="font-semibold text-[#2C241B] text-sm">{o.id}</p>
                      <p className="text-xs text-[#5C5042] mt-0.5">
                        {o.created_at && new Date(o.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full"
                        style={{ backgroundColor: `${sc.color}15`, color: sc.color }}
                        data-testid={`order-status-${o.id}`}
                      >
                        <StatusIcon className="w-3.5 h-3.5" /> {sc.label}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5 mb-4">
                    {o.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-[#5C5042]">{item.name} ({item.size}) &times;{item.quantity}</span>
                        <span className="text-[#2C241B] font-medium">&#8377;{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#E3DCD2]/50">
                    <div className="flex items-center gap-4">
                      <span className="font-['Cormorant_Garamond'] text-xl font-semibold text-[#2C241B]">&#8377;{o.total}</span>
                      <span className="text-xs text-[#5C5042] capitalize">{o.payment_method === "cod" ? "COD" : "Online"}</span>
                    </div>
                    <Link to={`/track-order`} className="text-xs text-[#D96C4A] hover:text-[#C25D3E] font-medium flex items-center gap-1 transition-colors" data-testid={`track-${o.id}`}>
                      Track <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
