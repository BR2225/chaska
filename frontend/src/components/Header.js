import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShoppingBag, Menu, X, User } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import CartSheet from "@/components/CartSheet";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { itemCount } = useCart();
  const { user } = useAuth();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  if (isAdmin) return null;

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/menu", label: "Menu" },
    { to: "/contact", label: "Contact" },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#FDFBF7]/80 backdrop-blur-xl border-b border-[#E3DCD2]/50" data-testid="main-header">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 flex items-center justify-between h-16 sm:h-20">
        <Link to="/" className="flex items-center gap-2" data-testid="logo-link">
          <span className="font-['Cormorant_Garamond'] text-2xl sm:text-3xl font-semibold text-[#2C241B] tracking-tight">
            Dolce<span className="text-[#D96C4A]">Vita</span>
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-8" data-testid="desktop-nav">
          {navLinks.map(l => (
            <Link
              key={l.to}
              to={l.to}
              className={`text-sm uppercase tracking-[0.15em] font-medium transition-colors duration-200 hover:text-[#D96C4A] ${
                location.pathname === l.to ? "text-[#D96C4A]" : "text-[#5C5042]"
              }`}
              data-testid={`nav-${l.label.toLowerCase()}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {user && user.role === "admin" && (
            <Link to="/admin/dashboard" data-testid="admin-link">
              <Button variant="ghost" size="sm" className="text-[#5C5042] hover:text-[#D96C4A]">
                <User className="w-4 h-4 mr-1" /> Admin
              </Button>
            </Link>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <button className="relative p-2 text-[#2C241B] hover:text-[#D96C4A] transition-colors" data-testid="cart-button">
                <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
                {itemCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#D96C4A] text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">
                    {itemCount}
                  </span>
                )}
              </button>
            </SheetTrigger>
            <SheetContent className="w-full sm:max-w-md bg-[#FDFBF7] border-l border-[#E3DCD2]">
              <SheetHeader>
                <SheetTitle className="font-['Cormorant_Garamond'] text-2xl text-[#2C241B]">Your Cart</SheetTitle>
              </SheetHeader>
              <CartSheet />
            </SheetContent>
          </Sheet>

          {/* Mobile menu */}
          <button className="md:hidden p-2 text-[#2C241B]" onClick={() => setMobileOpen(!mobileOpen)} data-testid="mobile-menu-toggle">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <nav className="md:hidden bg-[#FDFBF7] border-b border-[#E3DCD2] px-6 py-4 space-y-3" data-testid="mobile-nav">
          {navLinks.map(l => (
            <Link
              key={l.to}
              to={l.to}
              onClick={() => setMobileOpen(false)}
              className="block text-sm uppercase tracking-[0.15em] font-medium text-[#5C5042] hover:text-[#D96C4A]"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
