import { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import http from "@/lib/http";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { useFulfilment } from "@/contexts/FulfilmentContext";
import AddressDialog from "@/components/AddressDialog";
import { MapPin, Plus, Pencil } from "lucide-react";
import { ArrowLeft, Check, Clock3, Truck, CreditCard, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { API_BASE_URL as API } from "@/config/api";
import { loadRazorpayCheckout } from "@/lib/razorpay";

// Phone autofill on a handset supplies the number however it is stored in
// Contacts: "+91 98765 43210", "098765 43210", with hyphens or NBSPs. The API
// takes ten bare digits, so reduce whatever arrives to that.
function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

// FastAPI reports validation failures as a list of error objects. Handing that
// straight to the toast shows the customer nothing they can act on.
function describeError(err) {
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const field = detail[0]?.loc?.filter(part => part !== "body").join(" ");
    return field ? `Please check the ${field.replace(/_/g, " ")} you entered.` : null;
  }
  return null;
}

export default function Checkout() {
  const { items, total, clearCart, removeItem } = useCart();
  const { outlet, isDineIn: dineInChosen } = useFulfilment();
  // The branch can be cleared from another tab while this page is open; a
  // dine in order without one would read outlet.code off nothing.
  const isDineIn = dineInChosen && Boolean(outlet?.code);
  // Whatever "pay when it changes hands" is called here.
  const payOnHandover = isDineIn ? "counter" : "cod";
  const [addresses, setAddresses] = useState([]);
  const [addressesLoaded, setAddressesLoaded] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState(null);

  useEffect(() => {
    setPaymentMethod(current => (
      current === "razorpay" ? current : payOnHandover
    ));
  }, [payOnHandover]);
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
  // Items in the cart that the shop has since marked out of stock.
  const [soldOut, setSoldOut] = useState([]);
  const [onlinePaymentAvailable, setOnlinePaymentAvailable] = useState(false);
  const [paymentConfigLoading, setPaymentConfigLoading] = useState(true);
  const [form, setForm] = useState({ customer_name: "", customer_email: "", customer_phone: "", delivery_address: "", notes: "" });

  // Auto-fill from the account, preferring what was saved from the last order
  // so a returning customer only has to read the form, not retype it. The
  // login phone is the fallback; it is an identity rather than a delivery
  // number, so it only stands in when nothing has been saved yet.
  useEffect(() => {
    if (user && user !== false) {
      setForm(prev => ({
        ...prev,
        customer_name: prev.customer_name || user.name || "",
        customer_email: prev.customer_email || user.email || "",
        customer_phone: prev.customer_phone
          || normalizePhone(user.delivery_phone)
          || normalizePhone(user.phone)
          || "",
        delivery_address: prev.delivery_address || user.delivery_address || "",
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
          customer_phone: normalizePhone(data.customer_phone),
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

  // The cart can sit for a long time before anyone reaches this page, so check
  // it on arrival. The server refuses an out of stock item when the order is
  // placed, but that is after the whole form has been filled in.
  // Keyed on what is in the cart rather than on the array itself: an empty
  // cart hands back a fresh [] on every render, and depending on that would
  // refire this effect, set state, render again, and never stop.
  const cartKey = items.map(item => `${item.productId}:${item.size}`).sort().join("|");

  useEffect(() => {
    if (retryOrderId || !cartKey) { setSoldOut(current => (current.length ? [] : current)); return; }
    let active = true;
    http.get(`${API}/api/products${isDineIn ? `?outlet=${encodeURIComponent(outlet.code)}` : ""}`)
      .then(({ data }) => {
        if (!active) return;
        const unavailable = new Set(
          data.filter(product => !product.is_available).map(product => product.id),
        );
        setSoldOut(items.filter(item => unavailable.has(item.productId)));
      })
      .catch(() => { /* the server still refuses it at the end */ });
    return () => { active = false; };
    // items is read inside but deliberately not a dependency; cartKey is its
    // stable stand-in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey, retryOrderId, isDineIn, outlet]);

  useEffect(() => {
    if (isDineIn || retryOrderId) { setAddressesLoaded(true); return; }
    let active = true;
    http.get(`${API}/api/me/addresses`)
      .then(({ data }) => {
        if (!active) return;
        setAddresses(data);
        setSelectedAddressId(current => current || (data.find(a => a.is_default) || data[0])?.id || "");
      })
      .catch(() => {})
      .finally(() => { if (active) setAddressesLoaded(true); });
    return () => { active = false; };
  }, [isDineIn, retryOrderId]);

  const selectedAddress = addresses.find(a => a.id === selectedAddressId) || null;

  // The chosen address is what the order is actually sent with, so the form
  // follows it rather than the two drifting apart.
  useEffect(() => {
    if (!selectedAddress) return;
    setForm(prev => ({
      ...prev,
      customer_phone: selectedAddress.customer_phone,
      delivery_address: selectedAddress.delivery_address,
    }));
  }, [selectedAddress]);

  const handleAddressSaved = (book, editedId) => {
    setAddresses(book);
    // Land on whatever was just added, or stay on what was being edited.
    const added = editedId ? null : book.find(a => !addresses.some(old => old.id === a.id));
    setSelectedAddressId(added?.id || editedId || selectedAddressId);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: name === "customer_phone" ? normalizePhone(value) : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!retryOrder && items.length === 0) { toast.error("Your cart is empty"); return; }
    if (!isDineIn && !retryOrder && !selectedAddress) {
      toast.error("Choose a delivery address, or add one.");
      return;
    }
    if (!form.customer_name || !form.customer_phone || (!isDineIn && !form.delivery_address)) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (!/^[6-9]\d{9}$/.test(form.customer_phone)) {
      toast.error("Enter a 10-digit Indian mobile number, without +91.");
      return;
    }
    setLoading(true);
    let checkoutOpened = false;
    try {
      const orderData = {
        ...form,
        items: items.map(i => ({ product_id: i.productId, size: i.size, quantity: i.quantity })),
        fulfilment: isDineIn ? "dine_in" : "delivery",
        ...(isDineIn ? { outlet_code: outlet.code, delivery_address: "" } : {}),
        payment_method: paymentMethod,
      };

      if (paymentMethod === "razorpay") {
        if (!onlinePaymentAvailable) {
          toast.error(`Online payment is currently unavailable. Please choose ${isDineIn ? "Pay at Counter" : "Cash on Delivery"}.`);
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
            contact: `+91${form.customer_phone}`,
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
        toast.error(describeError(err) || "Failed to place order. Please try again.");
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
            <br />Payment: <span>{
              orderPlaced.payment_method === "cod" ? "Cash on Delivery"
                : orderPlaced.payment_method === "counter" ? "Pay at Counter"
                  : "Online Payment"
            }</span>
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
          <>
          {soldOut.length > 0 && (
          <div
            className="mb-6 rounded-2xl border border-[#D3494E]/25 bg-[#D3494E]/[0.06] px-5 py-4"
            role="alert"
            data-testid="sold-out-notice"
          >
            <p className="text-sm font-medium text-[#2C241B] mb-2">
              {soldOut.length === 1 ? "One item is" : `${soldOut.length} items are`} no longer available
            </p>
            <ul className="space-y-2">
              {soldOut.map(item => (
                <li key={item.itemId} className="flex items-center justify-between gap-4 text-sm">
                  <span className="text-[#5C5042]">{item.name} ({item.size})</span>
                  <button
                    type="button"
                    onClick={() => removeItem(item.itemId)}
                    className="text-[#D3494E] font-medium hover:underline shrink-0"
                    data-testid={`remove-sold-out-${item.itemId}`}
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-[#5C5042]">
              Remove {soldOut.length === 1 ? "it" : "them"} to carry on with the rest of your order.
            </p>
          </div>
        )}

        <AddressDialog
          open={addressDialogOpen}
          onOpenChange={setAddressDialogOpen}
          address={editingAddress}
          onSaved={handleAddressSaved}
        />

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
                        <Input name="customer_phone" type="tel" inputMode="numeric" autoComplete="tel" maxLength={10} placeholder="10-digit mobile" value={form.customer_phone} onChange={handleChange} readOnly={Boolean(retryOrder)} required className="mt-1 border-[#E3DCD2] focus:ring-[#D96C4A]" data-testid="input-phone" />
                      </div>
                    </div>
                    {isDineIn ? (
                      /* Nowhere to deliver to, so the branch stands in for the
                         address rather than leaving a blank where one was. */
                      <div className="rounded-xl border border-[#8A9A5B]/30 bg-[#8A9A5B]/[0.07] px-4 py-3" data-testid="dine-in-summary">
                        <p className="text-xs uppercase tracking-[0.15em] text-[#5C5042] mb-1">Eating at</p>
                        <p className="text-sm font-medium text-[#2C241B]">{outlet?.name}</p>
                        {outlet?.address && (
                          <p className="text-xs text-[#5C5042] mt-0.5 leading-relaxed">{outlet.address}</p>
                        )}
                        <Link to="/dine-in" className="inline-block mt-2 text-xs text-[#D96C4A] font-medium hover:underline">
                          Change branch
                        </Link>
                      </div>
                    ) : retryOrder ? (
                      <div>
                        <Label className="text-sm font-medium text-[#2C241B]">Delivery Address</Label>
                        <Textarea name="delivery_address" value={form.delivery_address} readOnly rows={3} className="mt-1 border-[#E3DCD2]" data-testid="input-address" />
                      </div>
                    ) : (
                      /* Picked from the book rather than typed out again. The
                         form still carries the values, so what is sent cannot
                         drift from what is shown. */
                      <div data-testid="address-picker">
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <Label className="text-sm font-medium text-[#2C241B]">Deliver to *</Label>
                          <button
                            type="button"
                            onClick={() => { setEditingAddress(null); setAddressDialogOpen(true); }}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#D96C4A] hover:underline"
                            data-testid="add-address-btn"
                          >
                            <Plus className="w-3.5 h-3.5" /> Add address
                          </button>
                        </div>

                        {!addressesLoaded ? (
                          <p className="text-sm text-[#5C5042]">Loading your addresses...</p>
                        ) : addresses.length === 0 ? (
                          <button
                            type="button"
                            onClick={() => { setEditingAddress(null); setAddressDialogOpen(true); }}
                            className="w-full rounded-xl border border-dashed border-[#E3DCD2] px-4 py-6 text-center hover:border-[#D96C4A] transition-colors"
                            data-testid="no-addresses"
                          >
                            <MapPin className="w-5 h-5 text-[#D96C4A] mx-auto mb-2" strokeWidth={1.5} />
                            <p className="text-sm font-medium text-[#2C241B]">Add a delivery address</p>
                            <p className="text-xs text-[#5C5042] mt-0.5">We&apos;ll save it for next time.</p>
                          </button>
                        ) : (
                          <div className="space-y-2">
                            {addresses.map(entry => (
                              <label
                                key={entry.id}
                                className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                                  selectedAddressId === entry.id
                                    ? "border-[#D96C4A] bg-[#D96C4A]/5"
                                    : "border-[#E3DCD2] hover:border-[#D96C4A]/50"
                                }`}
                                data-testid={`address-option-${entry.id}`}
                              >
                                <input
                                  type="radio"
                                  name="address"
                                  checked={selectedAddressId === entry.id}
                                  onChange={() => setSelectedAddressId(entry.id)}
                                  className="accent-[#D96C4A] mt-1"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-2">
                                    <span className="text-sm font-medium text-[#2C241B]">{entry.label}</span>
                                    {entry.is_default && (
                                      <span className="text-[10px] uppercase tracking-[0.1em] text-[#4A7c59] bg-[#4A7c59]/10 rounded-full px-2 py-0.5">
                                        Default
                                      </span>
                                    )}
                                  </span>
                                  <span className="block text-xs text-[#5C5042] mt-0.5 leading-relaxed">
                                    {entry.delivery_address}
                                  </span>
                                  <span className="block text-xs text-[#5C5042] mt-0.5">{entry.customer_phone}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setEditingAddress(entry);
                                    setAddressDialogOpen(true);
                                  }}
                                  className="text-[#5C5042] hover:text-[#D96C4A] shrink-0"
                                  aria-label={`Edit ${entry.label}`}
                                  data-testid={`edit-address-${entry.id}`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
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
                      <label className={`flex items-center gap-4 p-4 rounded-xl border cursor-pointer transition-all ${paymentMethod === payOnHandover ? "border-[#D96C4A] bg-[#D96C4A]/5" : "border-[#E3DCD2] hover:border-[#D96C4A]/50"}`} data-testid={`payment-${payOnHandover}`}>
                        <input type="radio" name="payment" value={payOnHandover} checked={paymentMethod === payOnHandover} onChange={() => setPaymentMethod(payOnHandover)} className="accent-[#D96C4A]" />
                        {isDineIn
                          ? <Store className="w-5 h-5 text-[#5C5042]" strokeWidth={1.5} />
                          : <Truck className="w-5 h-5 text-[#5C5042]" strokeWidth={1.5} />}
                        <div>
                          <p className="font-medium text-sm text-[#2C241B]">
                            {isDineIn ? "Pay at Counter" : "Cash on Delivery"}
                          </p>
                          <p className="text-xs text-[#5C5042]">
                            {isDineIn ? "Pay when you collect your order" : "Pay when your order arrives"}
                          </p>
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
                    disabled={loading || soldOut.length > 0 || (paymentMethod === "razorpay" && !onlinePaymentAvailable)}
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
          </>
        )}
      </div>
    </div>
  );
}
