import { useState, useEffect } from "react";
import http from "@/lib/http";
import { Package, ShoppingCart, Star, DollarSign, MessageSquare, TrendingUp } from "lucide-react";
import { API_BASE_URL as API } from "@/config/api";

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);

  useEffect(() => {
    http.get(`${API}/api/admin/stats`).then(r => setStats(r.data)).catch(() => {});
    http.get(`${API}/api/orders`).then(r => setRecentOrders(r.data.slice(0, 5))).catch(() => {});
  }, []);

  const statCards = stats ? [
    { label: "Total Revenue", value: `₹${stats.total_revenue?.toLocaleString() || 0}`, icon: DollarSign, color: "#4A7c59" },
    { label: "Total Orders", value: stats.total_orders, icon: ShoppingCart, color: "#D96C4A" },
    { label: "Pending Orders", value: stats.pending_orders, icon: TrendingUp, color: "#E8A317" },
    { label: "Products", value: stats.total_products, icon: Package, color: "#8A9A5B" },
    { label: "Reviews", value: stats.total_reviews, icon: Star, color: "#D96C4A" },
    { label: "Unread Messages", value: stats.unread_contacts, icon: MessageSquare, color: "#5C5042" },
  ] : [];

  return (
    <div data-testid="admin-dashboard">
      <h1 className="font-['Cormorant_Garamond'] text-3xl font-medium text-[#2C241B] mb-8">Dashboard</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8" data-testid="admin-stats-grid">
        {statCards.map(s => (
          <div key={s.label} className="bg-white rounded-lg border border-[#E3DCD2] p-5 shadow-sm" data-testid={`stat-${s.label.toLowerCase().replace(/\s/g, '-')}`}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs uppercase tracking-[0.15em] text-[#5C5042]">{s.label}</p>
              <s.icon className="w-4 h-4" style={{ color: s.color }} strokeWidth={1.5} />
            </div>
            <p className="text-2xl font-semibold text-[#2C241B]">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Recent Orders */}
      <div className="bg-white rounded-lg border border-[#E3DCD2] shadow-sm" data-testid="recent-orders-table">
        <div className="p-5 border-b border-[#E3DCD2]">
          <h2 className="font-['Cormorant_Garamond'] text-xl font-medium text-[#2C241B]">Recent Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#E3DCD2]">
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-[#5C5042] font-medium">Order ID</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-[#5C5042] font-medium">Customer</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-[#5C5042] font-medium">Total</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-[#5C5042] font-medium">Status</th>
                <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-[#5C5042] font-medium">Payment</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 ? (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-[#5C5042]">No orders yet</td></tr>
              ) : (
                recentOrders.map(o => (
                  <tr key={o.id} className="border-b border-[#E3DCD2]/50 hover:bg-[#F4F0E6]/50 transition-colors">
                    <td className="px-5 py-3 font-medium text-[#2C241B]">{o.id}</td>
                    <td className="px-5 py-3 text-[#5C5042]">{o.customer_name}</td>
                    <td className="px-5 py-3 text-[#2C241B] font-medium">₹{o.total}</td>
                    <td className="px-5 py-3">
                      <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${
                        o.status === "pending" ? "bg-[#E8A317]/10 text-[#E8A317]" :
                        o.status === "confirmed" ? "bg-[#8A9A5B]/10 text-[#8A9A5B]" :
                        o.status === "delivered" ? "bg-[#4A7c59]/10 text-[#4A7c59]" :
                        o.status === "cancelled" ? "bg-[#D3494E]/10 text-[#D3494E]" :
                        "bg-[#5C5042]/10 text-[#5C5042]"
                      }`}>{o.status}</span>
                    </td>
                    <td className="px-5 py-3 text-[#5C5042] capitalize">{o.payment_method === "cod" ? "COD" : "Razorpay"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
