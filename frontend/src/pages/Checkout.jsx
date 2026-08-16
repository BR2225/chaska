import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import http from "@/lib/http";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Check, Clock3, Truck, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { API_BASE_URL as API } from "@/config/api";
import { loadRazorpayCheckout } from "@/lib/razorpay";

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const retryOrderId = searchParams.get("retry");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(null);
  const [pendingPaymentOrder, setPendingPaymentOrder] = useState(null);
  const [retryOrder, setRetryOrder] = useState(null);
  const [retryOrderLoading, setRetryOrderLoading] = useState(Boolean(retryOrderId));
  const [onlinePaymentAvailable, setOnlinePaymentAvailable] = useState(false);
  const [paymentConfigLoading, setPaymentConfigLoading] = useState(true);
  const [form, setForm] = useState({ customer_name: "", customer_email: "", customer_phone: "", delivery_address: "", notes: "" });

  // Auto-fill from logged-in user
  useEffect(() => {
    if (user && user !== false) {
      setForm(prev => ({
        ...prev,
        customer_name: prev.customer_name || user.name || "",
        customer_email: prev.customer_email || user.email || "",
        customer_phone: prev.customer_phone || user.phone?.replace(/^\+91/, "") || "",
      }));
    }
  }, [user]);

  useEffect(() => {
    let active = true;
    http.get(`${API}/api/razorpay/config`)
      .then(({ data }) => {
        if (active) setOnlinePaymentAvailable(Boolean(data.enabled));
      })
      .catch(() => {
        if (active) setOnlinePaymentAvailable(false);
      })
      .finally(() => {
        if (active) setPaymentConfigLoading(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!retryOrderId) {
      setRetryOrderLoading(false);
      return undefined;
    }
    let active = true;
    setRetryOrderLoading(true);
    http.get(`${API}/api/orders/${encodeURIComponent(retryOrderId)}`)
      .then(({ data }) => {
        if (!active) return;
        if (data.payment_method !== "razorpay" || data.payment_status === "paid") {
          toast.info(data.payment_status === "paid" ? "This order is already paid." : "This order cannot be paid online.");
          navigate("/my-orders", { replace: true });
          return;
        }
        setRetryOrder(data);
        setPaymentMethod("razorpay");
        setForm({
          customer_name: data.customer_name || "",
          customer_email: data.customer_email || "",
          customer_phone: data.customer_phone || "",
          delivery_address: data.delivery_address || "",
          notes: data.notes || "",
        });
      })
      .catch(() => {
        toast.error("Unable to load that pending payment.");
        navigate("/my-orders", { replace: true });
      })
      .finally(() => {
        if (active) setRetryOrderLoading(false);
      });
    return () => { active = false; };
  }, [retryOrderId, navigate]);

  const checkoutItems = retryOrder
    ? retryOrder.items.map((item, index) => ({
        ...item,
        itemId: `${retryOrder.id}-${index}`,
        productId: item.product_id,
      }))
    : items;
  const checkoutTotal = retryOrder?.total ?? total;

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!retryOrder && items.length === 0) { toast.error("Your cart is empty"); return; }
    if (!form.customer_name || !form.customer_phone || !form.delivery_address) {
      toast.error("Please fill in all required fields");
      return;
    }
    setLoading(true);
    let checkoutOpened = false;
    try {
      const orderData = {
        ...form,
        items: items.map(i => ({ product_id: i.productId, size: i.size, quantity: i.quantity })),
        payment_method: paymentMethod,
      };

      if (paymentMethod === "razorpay") {
        if (!onlinePaymentAvailable) {
          toast.error("Online payment is currently unavailable. Please use Cash on Delivery.");
          return;
        }
        const checkoutLoaded = await loadRazorpayCheckout();
        if (!checkoutLoaded || !window.Razorpay) {
          toast.error("Payment checkout failed to load. Please refresh and try again.");
          return;
        }

        const orderFingerprint = retryOrder
          ? `retry:${retryOrder.id}`
          : JSON.stringify(orderData);
        const reusableOrder = pendingPaymentOrder?.fingerprint === orderFingerprint
          ? pendingPaymentOrder.order
          : null;
        const chaskaOrder = retryOrder || reusableOrder || (await http.post(
            `${API}/api/orders`,
            orderData,
          )).data;
        setPendingPaymentOrder({ order: chaskaOrder, fingerprint: orderFingerprint });

        const rpOrder = await http.post(
          `${API}/api/orders/${chaskaOrder.id}/razorpay-order`,
          { payment_token: chaskaOrder.payment_token || null },
        );
        const options = {
          key: rpOrder.data.key_id,
          amount: rpOrder.data.amount,
          currency: rpOrder.data.currency,
          order_id: rpOrder.data.razorpay_order_id,
          name: "Chaska",
          description: "Italian Desserts Order",
          image: `${window.location.origin}/chaska-mark.png`,
          prefill: {
            name: form.customer_name,
            email: form.customer_email,
            contact: `+91${form.customer_phone.replace(/^\+91/, "")}`,
          },
          theme: { color: "#D96C4A" },
          retry: { enabled: true },
          handler: async (response) => {
            setLoading(true);
            try {
              const verification = await http.post(`${API}/api/payments/razorpay/verify`, {
                order_id: chaskaOrder.id,
                payment_token: chaskaOrder.payment_token || null,
                ...response,
              });
              const paid = verification.data.status === "paid";
              setOrderPlaced({
                ...chaskaOrder,
                status: paid ? "confirmed" : "payment_pending",
                payment_status: paid ? "paid" : "processing",
              });
              setPendingPaymentOrder(null);
              if (!retryOrder) clearCart();
              toast[paid ? "success" : "info"](
                paid
                  ? "Payment captured and order confirmed!"
                  : "Payment is processing. We will confirm it automatically.",
              );
            } catch {
              setOrderPlaced({ ...chaskaOrder, status: "payment_pending", payment_status: "processing" });
              if (!retryOrder) clearCart();
              toast.error(`Payment verification is pending for ${chaskaOrder.id}. Check Orders before paying again.`);
            } finally {
              setLoading(false);
            }
          },
          modal: {
            confirm_close: true,
            animation: true,
            ondismiss: () => {
              setLoading(false);
              toast.info(`Payment was not completed. Order ${chaskaOrder.id} is still pending.`);
            },
          },
        };
        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", () => {
          setLoading(false);
          toast.error("Payment failed. You can safely retry this order from Orders.");
        });
        rzp.open();
        checkoutOpened = true;
        return;
      }

      const res = await http.post(`${API}/api/orders`, orderData);
      setOrderPlaced(res.data);
      clearCart();
      toast.success("Order placed successfully!");
    } catch (err) {
      if (err.response?.status === 401) {
        toast.error("Please sign in to place your order.");
        navigate("/login", { state: { from: { pathname: "/checkout" } }, replace: true });
      } else if (err.response?.status === 403) {
        toast.error("A customer account is required to place orders.");
      } else {
        toast.error(err.response?.data?.detail || "Failed to place order. Please try again.");
      }
    } finally {
      if (!checkoutOpened) setLoading(false);
    }
  };

  if (orderPlaced) {
    const paymentProcessing = orderPlaced.payment_method === "razorpay" && orderPlaced.payment_status !== "paid";
    return (
      <div className="pt-28 pb-16 min-h-[80vh] flex items-center" data-testid="order-confirmation">
        <div className="max-w-lg mx-auto px-6 text-center">
          <div className={`w-16 h-16 ${paymentProcessing ? "bg-[#C98A2E]" : "bg-[#4A7c59]"} rounded-full flex items-center justify-center mx-auto mb-6`}>
            {paymentProcessing
              ? <Clock3 className="w-8 h-8 text-white" />
              : <Check className="w-8 h-8 text-white" />}
          </div>
          <h1 className="font-['Cormorant_Garamond'] text-4xl font-medium text-[#2C241B] mb-3">
            {paymentProcessing ? "Payment Processing" : "Order Confirmed!"}
          </h1>
          <p className="text-[#5C5042] mb-2">
            {paymentProcessing
              ? "Your order is saved. We will confirm it automatically after Razorpay reports the captured payment."
              : "Thank you for your order."}
          </p>
          <p className="text-sm text-[#5C5042] bg-[#F4F0E6] rounded-lg p-4 mb-6">
            Order ID: <span className="font-semibold text-[#2C241B]" data-testid="order-id">{orderPlaced.id}</span>
            <br />Total: <span className="font-semibold text-[#D96C4A]">&#8377;{orderPlaced.total}</span>
            <br />Payment: <span className="capitalize">{orderPlaced.payment_method === "cod" ? "Cash on Delivery" : "Online Payment"}</span>
          </p>
          <Link to="/menu">
            <Button className="bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-full px-8" data-testid="continue-shopping-btn">
              Continue Shopping
            </Button>
          </Link>
          <Link to="/my-orders" className="block mt-3">
            <Button variant="outline" className="border-[#D96C4A] text-[#D96C4A] hover:bg-[#D96C4A] hover:text-white rounded-full px-8">
              View Orders
            </Button>
          </Link>
          <Link to={`/track-order?id=${encodeURIComponent(orderPlaced.id)}&token=${encodeURIComponent(orderPlaced.tracking_token || "")}`} className="block mt-3">
            <Button variant="outline" className="border-[#2C241B] text-[#2C241B] hover:bg-[#2C241B] hover:text-[#FDFBF7] rounded-full px-8" data-testid="track-order-link">
              Track Your Order
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  if (retryOrderLoading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center text-[#5C5042]" role="status">
        Loading your pending order…
      </div>
    );
  }

  return (
    <div className="pt-24 sm:pt-28 pb-16" data-testid="checkout-page">
      <div className="max-w-5xl mx-auto px-6 sm:px-8">
        <Link to="/menu" className="inline-flex items-center gap-2 text-sm text-[#5C5042] hover:text-[#D96C4A] mb-8 transition-colors" data-testid="back-to-menu-checkout">
          <ArrowLeft className="w-4 h-4" /> Continue Shopping
        </Link>
        <h1 className="font-['Cormorant_Garamond'] text-4xl sm:text-5xl font-light text-[#2C241B] tracking-tighter mb-10">Checkout</h1>

        {checkoutItems.length === 0 ? (
          <div className="text-center py-20">
            <p className="font-['Cormorant_Garamond'] text-2xl text-[#5C5042] mb-4">Your cart is empty</p>
            <Link to="/menu"><Button className="bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-full px-8">Browse Menu</Button></Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
              {/* Form */}
              <div className="lg:col-span-7 space-y-6">
                <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E3DCD2]/50 shadow-sm">
                  <h2 className="font-['Cormorant_Garamond'] text-2xl font-medium text-[#2C241B] mb-6">Delivery Details</h2>
                  {retryOrder && (
                    <p className="-mt-4 mb-5 text-xs text-[#5C5042]">
                      Retrying payment for {retryOrder.id}. Delivery details are locked to the saved order.
                    </p>
                  )}
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="customer_name" className="text-sm font-medium text-[#2C241B]">Full Name *</Label>
                      <Input name="customer_name" value={form.customer_name} onChange={handleChange} readOnly={Boolean(retryOrder)} required className="mt-1 border-[#E3DCD2] focus:ring-[#D96C4A] focus:border-[#D96C4A]" data-testid="input-name" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="customer_email" className="text-sm font-medium text-[#2C241B]">Email</Label>
                        <Input name="customer_email" type="email" value={form.customer_email} onChange={handleChange} readOnly={Boolean(retryOrder)} className="mt-1 border-[#E3DCD2] focus:ring-[#D96C4A]" data-testid="input-email" />
                      </div>
                      <div>
                        <Label htmlFor="customer_phone" className="text-sm font-medium text-[#2C241B]">Phone *</Label>
                        <Input name="customer_phone" type="tel" value={form.customer_phone} onChange={handleChange} readOnly={Boolean(retryOrder)} required className="mt-1 border-[#E3DCD2] focus:ring-[#D96C4A]" data-testid="input-phone" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="delivery_address" className="text-sm font-medium text-[#2C241B]">Delivery Address *</Label>
                      <Textarea name="delivery_address" value={form.delivery_address} onChange={handleChange} readOnly={Boolean(retryOrder)} required rows={3} className="mt-1 border-[#E3DCD2] focus:ring-[#D96C4A]" data-testid="input-address" />
                    </div>
                    <div>
                      <Label htmlFor="notes" className="text-sm font-medium text-[#2C241B]">Order Notes</Label>
                      <Textarea name="notes" value={form.notes} onChange={handleChange} readOnly={Boolean(retryOrder)} rows={2} className="mt-1 border-[#E3DCD2] focus:ring-[#D96C4A]" placeholder="Special instructions..." data-testid="input-notes" />
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E3DCD2]/50 shadow-sm">
                  <h2 className="font-['Cormorant_Garamond'] text-2xl font-medium text-[#2C241B] mb-6">Payment Method</h2>
                  <div className="space-y-3">
                    {!retryOrder && (
                      <label className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${paymentMethod === "cod" ? "border-[#D96C4A] bg-[#D96C4A]/5" : "border-[#E3DCD2] hover:border-[#D96C4A]/50"}`} data-testid="payment-cod">
                        <input type="radio" name="payment" value="cod" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} className="accent-[#D96C4A]" />
                        <Truck className="w-5 h-5 text-[#5C5042]" strokeWidth={1.5} />
                        <div>
                          <p className="font-medium text-sm text-[#2C241B]">Cash on Delivery</p>
                          <p className="text-xs text-[#5C5042]">Pay when your order arrives</p>
                        </div>
                      </label>
                    )}
                    <label className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${onlinePaymentAvailable ? "cursor-pointer" : "cursor-not-allowed opacity-60"} ${paymentMethod === "razorpay" ? "border-[#D96C4A] bg-[#D96C4A]/5" : "border-[#E3DCD2] hover:border-[#D96C4A]/50"}`} data-testid="payment-razorpay">
                      <input type="radio" name="payment" value="razorpay" disabled={!onlinePaymentAvailable} checked={paymentMethod === "razorpay"} onChange={() => setPaymentMethod("razorpay")} className="accent-[#D96C4A]" />
                      <CreditCard className="w-5 h-5 text-[#5C5042]" strokeWidth={1.5} />
                      <div>
                        <p className="font-medium text-sm text-[#2C241B]">Pay Online (Razorpay)</p>
                        <p className="text-xs text-[#5C5042]">
                          {paymentConfigLoading
                            ? "Checking availability..."
                            : onlinePaymentAvailable
                              ? "UPI, Cards, Net Banking"
                              : "Temporarily unavailable"}
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-5">
                <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E3DCD2]/50 shadow-sm sticky top-28">
                  <h2 className="font-['Cormorant_Garamond'] text-2xl font-medium text-[#2C241B] mb-6">Order Summary</h2>
                  <div className="space-y-3 mb-6">
                    {checkoutItems.map(item => (
                      <div key={item.itemId} className="flex justify-between text-sm" data-testid={`summary-item-${item.itemId}`}>
                        <span className="text-[#5C5042]">{item.name} ({item.size}) x{item.quantity}</span>
                        <span className="text-[#2C241B] font-medium">&#8377;{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-[#E3DCD2] pt-4 mb-6">
                    <div className="flex justify-between">
                      <span className="text-[#5C5042]">Subtotal</span>
                      <span className="font-['Cormorant_Garamond'] text-2xl font-semibold text-[#2C241B]">&#8377;{checkoutTotal}</span>
                    </div>
                    <p className="text-xs text-[#8A9A5B] mt-1">Free delivery on all orders</p>
                  </div>
                  <Button
                    type="submit"
                    disabled={loading || (paymentMethod === "razorpay" && !onlinePaymentAvailable)}
                    className="w-full bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-full h-12 text-base font-medium"
                    data-testid="place-order-btn"
                  >
                    {loading
                      ? "Processing..."
                      : paymentMethod === "razorpay"
                        ? `${retryOrder ? "Retry Payment" : "Pay Securely"} - ₹${checkoutTotal}`
                        : `Place Order - ₹${checkoutTotal}`}
                  </Button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
