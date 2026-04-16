import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useCart } from "@/contexts/CartContext";
import { ArrowLeft, Check, Truck, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const [loading, setLoading] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(null);
  const [form, setForm] = useState({ customer_name: "", customer_email: "", customer_phone: "", delivery_address: "", notes: "" });

  const handleChange = (e) => setForm(prev => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (items.length === 0) { toast.error("Your cart is empty"); return; }
    if (!form.customer_name || !form.customer_phone || !form.delivery_address) {
      toast.error("Please fill in all required fields");
      return;
    }
    setLoading(true);
    try {
      const orderData = {
        ...form,
        items: items.map(i => ({ product_id: i.productId, name: i.name, size: i.size, price: i.price, quantity: i.quantity })),
        payment_method: paymentMethod,
      };

      if (paymentMethod === "razorpay") {
        // Check if Razorpay is configured
        const configRes = await axios.get(`${API}/api/razorpay/config`);
        if (!configRes.data.enabled) {
          toast.error("Online payment is currently unavailable. Please use Cash on Delivery.");
          setLoading(false);
          return;
        }
        // Create Razorpay order
        const rpOrder = await axios.post(`${API}/api/razorpay/create-order`, { amount: total * 100 });
        const options = {
          key: configRes.data.key_id,
          amount: rpOrder.data.amount,
          currency: rpOrder.data.currency,
          order_id: rpOrder.data.id,
          name: "Chaska",
          description: "Italian Desserts Order",
          handler: async (response) => {
            await axios.post(`${API}/api/razorpay/verify`, response);
            const res = await axios.post(`${API}/api/orders`, { ...orderData, razorpay_order_id: rpOrder.data.id });
            setOrderPlaced(res.data);
            clearCart();
            toast.success("Order placed successfully!");
          },
        };
        const rzp = new window.Razorpay(options);
        rzp.open();
        setLoading(false);
        return;
      }

      const res = await axios.post(`${API}/api/orders`, orderData);
      setOrderPlaced(res.data);
      clearCart();
      toast.success("Order placed successfully!");
    } catch (err) {
      toast.error("Failed to place order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (orderPlaced) {
    return (
      <div className="pt-28 pb-16 min-h-[80vh] flex items-center" data-testid="order-confirmation">
        <div className="max-w-lg mx-auto px-6 text-center">
          <div className="w-16 h-16 bg-[#4A7c59] rounded-full flex items-center justify-center mx-auto mb-6">
            <Check className="w-8 h-8 text-white" />
          </div>
          <h1 className="font-['Cormorant_Garamond'] text-4xl font-medium text-[#2C241B] mb-3">Order Confirmed!</h1>
          <p className="text-[#5C5042] mb-2">Thank you for your order.</p>
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
          <Link to={`/track-order`} className="block mt-3">
            <Button variant="outline" className="border-[#2C241B] text-[#2C241B] hover:bg-[#2C241B] hover:text-[#FDFBF7] rounded-full px-8" data-testid="track-order-link">
              Track Your Order
            </Button>
          </Link>
        </div>
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

        {items.length === 0 ? (
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
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="customer_name" className="text-sm font-medium text-[#2C241B]">Full Name *</Label>
                      <Input name="customer_name" value={form.customer_name} onChange={handleChange} required className="mt-1 border-[#E3DCD2] focus:ring-[#D96C4A] focus:border-[#D96C4A]" data-testid="input-name" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="customer_email" className="text-sm font-medium text-[#2C241B]">Email</Label>
                        <Input name="customer_email" type="email" value={form.customer_email} onChange={handleChange} className="mt-1 border-[#E3DCD2] focus:ring-[#D96C4A]" data-testid="input-email" />
                      </div>
                      <div>
                        <Label htmlFor="customer_phone" className="text-sm font-medium text-[#2C241B]">Phone *</Label>
                        <Input name="customer_phone" type="tel" value={form.customer_phone} onChange={handleChange} required className="mt-1 border-[#E3DCD2] focus:ring-[#D96C4A]" data-testid="input-phone" />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="delivery_address" className="text-sm font-medium text-[#2C241B]">Delivery Address *</Label>
                      <Textarea name="delivery_address" value={form.delivery_address} onChange={handleChange} required rows={3} className="mt-1 border-[#E3DCD2] focus:ring-[#D96C4A]" data-testid="input-address" />
                    </div>
                    <div>
                      <Label htmlFor="notes" className="text-sm font-medium text-[#2C241B]">Order Notes</Label>
                      <Textarea name="notes" value={form.notes} onChange={handleChange} rows={2} className="mt-1 border-[#E3DCD2] focus:ring-[#D96C4A]" placeholder="Special instructions..." data-testid="input-notes" />
                    </div>
                  </div>
                </div>

                {/* Payment Method */}
                <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E3DCD2]/50 shadow-sm">
                  <h2 className="font-['Cormorant_Garamond'] text-2xl font-medium text-[#2C241B] mb-6">Payment Method</h2>
                  <div className="space-y-3">
                    <label className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${paymentMethod === "cod" ? "border-[#D96C4A] bg-[#D96C4A]/5" : "border-[#E3DCD2] hover:border-[#D96C4A]/50"}`} data-testid="payment-cod">
                      <input type="radio" name="payment" value="cod" checked={paymentMethod === "cod"} onChange={() => setPaymentMethod("cod")} className="accent-[#D96C4A]" />
                      <Truck className="w-5 h-5 text-[#5C5042]" strokeWidth={1.5} />
                      <div>
                        <p className="font-medium text-sm text-[#2C241B]">Cash on Delivery</p>
                        <p className="text-xs text-[#5C5042]">Pay when your order arrives</p>
                      </div>
                    </label>
                    <label className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${paymentMethod === "razorpay" ? "border-[#D96C4A] bg-[#D96C4A]/5" : "border-[#E3DCD2] hover:border-[#D96C4A]/50"}`} data-testid="payment-razorpay">
                      <input type="radio" name="payment" value="razorpay" checked={paymentMethod === "razorpay"} onChange={() => setPaymentMethod("razorpay")} className="accent-[#D96C4A]" />
                      <CreditCard className="w-5 h-5 text-[#5C5042]" strokeWidth={1.5} />
                      <div>
                        <p className="font-medium text-sm text-[#2C241B]">Pay Online (Razorpay)</p>
                        <p className="text-xs text-[#5C5042]">UPI, Cards, Net Banking</p>
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
                    {items.map(item => (
                      <div key={item.itemId} className="flex justify-between text-sm" data-testid={`summary-item-${item.itemId}`}>
                        <span className="text-[#5C5042]">{item.name} ({item.size}) x{item.quantity}</span>
                        <span className="text-[#2C241B] font-medium">&#8377;{item.price * item.quantity}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-[#E3DCD2] pt-4 mb-6">
                    <div className="flex justify-between">
                      <span className="text-[#5C5042]">Subtotal</span>
                      <span className="font-['Cormorant_Garamond'] text-2xl font-semibold text-[#2C241B]">&#8377;{total}</span>
                    </div>
                    <p className="text-xs text-[#8A9A5B] mt-1">Free delivery on all orders</p>
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-full h-12 text-base font-medium"
                    data-testid="place-order-btn"
                  >
                    {loading ? "Processing..." : `Place Order - ₹${total}`}
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
