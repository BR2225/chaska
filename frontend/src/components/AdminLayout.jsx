import { useState, useEffect } from "react";
import { Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import http from "@/lib/http";
import { useAuth } from "@/contexts/AuthContext";
import { LayoutDashboard, Package, ShoppingCart, MessageSquare, LogOut } from "lucide-react";
import { API_BASE_URL as API } from "@/config/api";

export default function AdminLayout({ children }) {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (loading || !user || user.role !== "admin") return;
    http.get(`${API}/api/admin/stats`)
      .then(r => setStats(r.data)).catch(() => {});
  }, [user, loading]);

  const handleLogout = async () => { await logout(); navigate("/admin/login"); };

  const navItems = [
    { to: "/admin/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/admin/products", icon: Package, label: "Products" },
    { to: "/admin/orders", icon: ShoppingCart, label: "Orders" },
    { to: "/admin/contacts", icon: MessageSquare, label: "Messages" },
  ];

  if (loading) {
    return <div className="min-h-screen bg-[#FDFBF7] flex items-center justify-center text-[#5C5042]">Loading...</div>;
  }
  if (!user || user.role !== "admin") return <Navigate to="/admin/login" replace />;

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex" data-testid="admin-layout">
      {/* Sidebar */}
      <aside className="w-64 bg-[#F4F0E6] border-r border-[#E3DCD2] flex flex-col fixed h-full" data-testid="admin-sidebar">
        <div className="p-6 border-b border-[#E3DCD2]">
          <Link to="/" className="block">
            <div className="flex items-center gap-2.5">
              <img src="/chaska-logo.jpeg" alt="Chaska" className="h-10 w-auto rounded-lg" />
              <div>
                <h2 className="font-['Boogaloo'] text-xl text-[#2C241B] tracking-wide leading-none">CHASKA</h2>
                <p className="text-[8px] text-[#5C5042] mt-0.5 uppercase tracking-wider">Admin Panel</p>
              </div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map(item => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  active ? "bg-white text-[#D96C4A] border-l-2 border-[#D96C4A] shadow-sm" : "text-[#5C5042] hover:bg-white/60 hover:text-[#2C241B]"
                }`}
                data-testid={`admin-nav-${item.label.toLowerCase()}`}
              >
                <item.icon className="w-4 h-4" strokeWidth={1.5} />
                {item.label}
                {item.label === "Orders" && stats?.pending_orders > 0 && (
                  <span className="ml-auto bg-[#D96C4A] text-white text-xs px-2 py-0.5 rounded-full">{stats.pending_orders}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-[#E3DCD2]">
          <button onClick={handleLogout} className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-[#5C5042] hover:bg-white/60 hover:text-[#D3494E] w-full transition-colors" data-testid="admin-logout-btn">
            <LogOut className="w-4 h-4" strokeWidth={1.5} /> Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-6 sm:p-8" data-testid="admin-main-content">
        {children}
      </main>
    </div>
  );
}
