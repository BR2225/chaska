import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Package, Truck, CheckCircle, Clock, XCircle } from "lucide-react";
import http from "@/lib/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { API_BASE_URL as API } from "@/config/api";

const statusSteps = [
  { key: "pending", label: "Order Placed", icon: Clock },
  { key: "confirmed", label: "Confirmed", icon: CheckCircle },
  { key: "preparing", label: "Preparing", icon: Package },
  { key: "out_for_delivery", label: "Out for Delivery", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle },
];

function getStepIndex(status) {
  if (status === "cancelled") return -1;
  const idx = statusSteps.findIndex(s => s.key === status);
  return idx >= 0 ? idx : 0;
}

export default function TrackOrder() {
  const [searchParams] = useSearchParams();
  const [orderId, setOrderId] = useState(() => searchParams.get("id") || "");
  const [trackingToken, setTrackingToken] = useState(() => searchParams.get("token") || "");
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const findOrder = async () => {
    if (!orderId.trim()) return;
    setLoading(true);
    setError("");
    setOrder(null);
    try {
      const { data } = await http.get(`${API}/api/tracking/orders/${orderId.trim()}`, {
        params: trackingToken ? { token: trackingToken } : {},
      });
      setOrder(data);
    } catch {
      setError("Order not found. Please check your order ID and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    findOrder();
  };

  useEffect(() => {
    if (searchParams.get("id")) findOrder();
    // Query parameters are only used to perform the initial lookup.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentStep = order ? getStepIndex(order.status) : -1;

  return (
    <div className="pt-24 sm:pt-28 pb-16 min-h-[80vh]" data-testid="track-order-page">
      <div className="max-w-3xl mx-auto px-6 sm:px-8">
        <div className="text-center mb-10">
          <p className="text-sm uppercase tracking-[0.2em] text-[#D96C4A] mb-3 font-medium">Order Status</p>
          <h1 className="font-['Cormorant_Garamond'] text-4xl sm:text-5xl font-light text-[#2C241B] tracking-tighter mb-4">
            Track Your Order
          </h1>
          <p className="text-[#5C5042] text-sm">Enter your order ID to check the current status</p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-3 max-w-md mx-auto mb-10" data-testid="track-order-form">
          <Input
            placeholder="Enter Order ID (e.g., ORD-A1B2C3D4)"
            value={orderId}
            onChange={e => { setOrderId(e.target.value); setTrackingToken(""); }}
            className="border-[#E3DCD2] focus:ring-[#D96C4A] focus:border-[#D96C4A] h-11"
            data-testid="track-order-input"
          />
          <Button
            type="submit"
            disabled={loading}
            className="bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-full px-6 h-11 shrink-0"
            data-testid="track-order-btn"
          >
            <Search className="w-4 h-4 mr-2" /> {loading ? "Searching..." : "Track"}
          </Button>
        </form>

        {error && (
          <div className="text-center py-8" data-testid="track-order-error">
            <XCircle className="w-12 h-12 text-[#D3494E]/40 mx-auto mb-3" />
            <p className="text-[#5C5042]">{error}</p>
          </div>
        )}

        {order && (
          <div className="space-y-6 animate-fade-in-up" data-testid="track-order-result">
            {/* Order Info Card */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E3DCD2]/50 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                  <p className="text-xs uppercase tracking-[0.15em] text-[#5C5042] mb-1">Order ID</p>
                  <p className="text-lg font-semibold text-[#2C241B]" data-testid="track-order-id">{order.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-[0.15em] text-[#5C5042] mb-1">Total</p>
                  <p className="text-lg font-semibold text-[#D96C4A]">&#8377;{order.total}</p>
                </div>
              </div>

              {/* Status Timeline */}
              {order.status === "cancelled" ? (
                <div className="bg-[#D3494E]/5 border border-[#D3494E]/20 rounded-xl p-4 text-center" data-testid="order-cancelled">
                  <XCircle className="w-8 h-8 text-[#D3494E] mx-auto mb-2" />
                  <p className="font-medium text-[#D3494E]">Order Cancelled</p>
                </div>
              ) : (
                <div className="relative" data-testid="order-status-timeline">
                  <div className="flex justify-between items-start">
                    {statusSteps.map((step, idx) => {
                      const StepIcon = step.icon;
                      const isActive = idx <= currentStep;
                      const isCurrent = idx === currentStep;
                      return (
                        <div key={step.key} className="flex flex-col items-center flex-1 relative">
                          {idx > 0 && (
                            <div className={`absolute top-4 right-1/2 w-full h-0.5 -translate-y-1/2 ${idx <= currentStep ? "bg-[#4A7c59]" : "bg-[#E3DCD2]"}`} />
                          )}
                          <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                            isCurrent ? "bg-[#4A7c59] text-white ring-4 ring-[#4A7c59]/20" :
                            isActive ? "bg-[#4A7c59] text-white" : "bg-[#E3DCD2] text-[#5C5042]"
                          }`}>
                            <StepIcon className="w-4 h-4" strokeWidth={1.5} />
                          </div>
                          <p className={`text-xs mt-2 text-center ${isActive ? "text-[#2C241B] font-medium" : "text-[#5C5042]"}`}>
                            {step.label}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Order Items */}
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E3DCD2]/50 shadow-sm">
              <h3 className="font-['Cormorant_Garamond'] text-xl font-medium text-[#2C241B] mb-4">Order Items</h3>
              <div className="space-y-3">
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm py-2 border-b border-[#E3DCD2]/50 last:border-0">
                    <span className="text-[#5C5042]">{item.name} ({item.size})</span>
                    <span className="text-[#2C241B] font-medium">&times; {item.quantity}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-[#E3DCD2] flex justify-between">
                <span className="text-sm text-[#5C5042]">Payment</span>
                <span className="text-sm text-[#2C241B] font-medium capitalize">{order.payment_method === "cod" ? "Cash on Delivery" : "Online"}</span>
              </div>
              <div className="mt-2 flex justify-between">
                <span className="text-sm text-[#5C5042]">Payment status</span>
                <span className="text-sm text-[#2C241B] capitalize">{order.payment_status}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
