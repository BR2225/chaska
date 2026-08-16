import { useCallback, useState, useEffect } from "react";
import http from "@/lib/http";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { API_BASE_URL as API } from "@/config/api";

const statusOptions = ["pending", "payment_pending", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"];

export default function AdminOrders() {
  const [orders, setOrders] = useState([]);
  const [filterStatus, setFilterStatus] = useState("all");

  const load = useCallback(() => {
    const params = filterStatus !== "all" ? `?status=${filterStatus}` : "";
    http.get(`${API}/api/orders${params}`).then(r => setOrders(r.data)).catch(() => {});
  }, [filterStatus]);
  useEffect(() => { load(); }, [load]);

  const updateStatus = async (orderId, status) => {
    try {
      await http.put(`${API}/api/orders/${orderId}/status`, { status });
      toast.success("Order status updated");
      load();
    } catch {
      toast.error("Failed to update status");
    }
  };

  return (
    <div data-testid="admin-orders-page">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-['Cormorant_Garamond'] text-3xl font-medium text-[#2C241B]">Orders</h1>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px] border-[#E3DCD2]" data-testid="order-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Orders</SelectItem>
            {statusOptions.map(s => (
              <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4" data-testid="orders-list">
        {orders.length === 0 ? (
          <div className="bg-white rounded-lg border border-[#E3DCD2] p-12 text-center">
            <p className="text-[#5C5042]">No orders found</p>
          </div>
        ) : orders.map(o => (
          <div key={o.id} className="bg-white rounded-lg border border-[#E3DCD2] shadow-sm p-5" data-testid={`order-card-${o.id}`}>
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <p className="font-semibold text-[#2C241B]">{o.id}</p>
                <p className="text-sm text-[#5C5042]">{o.customer_name} &middot; {o.customer_phone}</p>
                <p className="text-xs text-[#5C5042] mt-0.5">{o.delivery_address}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-lg text-[#2C241B]">₹{o.total}</p>
                <p className="text-xs text-[#5C5042] capitalize">{o.payment_method === "cod" ? "Cash on Delivery" : "Razorpay"} &middot; {o.payment_status}</p>
              </div>
            </div>

            {/* Items */}
            <div className="bg-[#F4F0E6] rounded-lg p-3 mb-4">
              {o.items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm py-1">
                  <span className="text-[#5C5042]">{item.name} ({item.size}) x{item.quantity}</span>
                  <span className="text-[#2C241B] font-medium">₹{item.price * item.quantity}</span>
                </div>
              ))}
            </div>

            {/* Status */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs text-[#5C5042]">Status:</span>
                <Select value={o.status} onValueChange={(v) => updateStatus(o.id, v)}>
                  <SelectTrigger className="w-[180px] h-8 text-sm border-[#E3DCD2]" data-testid={`order-status-select-${o.id}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(s => (
                      <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-xs text-[#5C5042]">
                {o.created_at && new Date(o.created_at).toLocaleString()}
              </span>
            </div>
            {o.notes && <p className="text-xs text-[#5C5042] mt-2 italic">Note: {o.notes}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
