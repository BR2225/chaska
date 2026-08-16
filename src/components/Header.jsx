import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ShoppingBag, Menu, X, User, LogOut, ClipboardList } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useAuth } from "@/contexts/AuthContext";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import CartSheet from "@/components/CartSheet";

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { itemCount } = useCart();
  const { user, logout } = useAuth();
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");

  if (isAdmin) return null;

  const navLinks = [
    { to: "/", label: "Home" },
    { to: "/menu", label: "Menu" },
    { to: "/my-orders", label: "Orders" },
    { to: "/contact", label: "Contact" },
  ];

  const handleLogout = async () => { await logout(); };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-[#FDFBF7]/80 backdrop-blur-xl border-b border-[#E3DCD2]/50" data-testid="main-header">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 flex items-center justify-between h-16 sm:h-20">
        <Link to="/" className="flex items-center gap-2.5" data-testid="logo-link">
          <img
            src="/chaska-mark.png"
            alt=""
            aria-hidden="true"
            className="h-9 sm:h-11 w-auto shrink-0 object-contain"
          />
          <div>
            <span className="font-['Boogaloo'] text-2xl sm:text-3xl text-[#2C241B] tracking-wide block leading-none">
              CHASKA
            </span>
            <span className="text-[8px] uppercase tracking-[0.15em] text-[#5C5042] leading-none">
              Handmade Bliss on Your Way
            </span>
          </div>
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
              data-testid={`nav-${l.label.toLowerCase().replace(/\s/g, '-')}`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          {/* User Account */}
          {user && user.role === "admin" && (
            <Link to="/admin/dashboard" data-testid="admin-link">
              <Button variant="ghost" size="sm" className="text-[#5C5042] hover:text-[#D96C4A] text-xs">
                <User className="w-4 h-4 mr-1" /> Admin
              </Button>
            </Link>
          )}

          {user && user !== false ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1.5 p-2 text-[#2C241B] hover:text-[#D96C4A] transition-colors" aria-label="Open account menu" data-testid="user-menu-btn">
                  <div className="w-7 h-7 rounded-full bg-[#D96C4A]/10 flex items-center justify-center">
                    <User className="w-3.5 h-3.5 text-[#D96C4A]" strokeWidth={1.5} />
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48 bg-[#FDFBF7] border-[#E3DCD2]">
                <div className="px-3 py-2">
                  <p className="text-sm font-medium text-[#2C241B] truncate">{user.name}</p>
                  <p className="text-xs text-[#5C5042] truncate">{user.email || user.phone}</p>
                </div>
                <DropdownMenuSeparator className="bg-[#E3DCD2]" />
                {user.role !== "admin" && (
                  <DropdownMenuItem asChild>
                    <Link to="/my-orders" className="flex items-center gap-2 cursor-pointer" data-testid="my-orders-link">
                      <ClipboardList className="w-4 h-4" /> Orders
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={handleLogout} className="flex items-center gap-2 cursor-pointer text-[#D3494E]" data-testid="logout-btn">
                  <LogOut className="w-4 h-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : user === false ? (
            <Link to="/login" data-testid="login-link">
              <Button variant="ghost" size="sm" className="text-[#5C5042] hover:text-[#D96C4A] text-xs font-medium">
                <User className="w-4 h-4 mr-1" /> Login
              </Button>
            </Link>
          ) : null}

          {/* Cart */}
          {user?.role === "customer" ? (
            <Sheet>
              <SheetTrigger asChild>
                <button className="relative p-2 text-[#2C241B] hover:text-[#D96C4A] transition-colors" aria-label={`Open cart with ${itemCount} items`} data-testid="cart-button">
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
          ) : user === false ? (
            <Link to="/login" state={{ from: location, reason: "cart" }} className="p-2 text-[#2C241B] hover:text-[#D96C4A] transition-colors" aria-label="Sign in to use your cart" data-testid="cart-login-link">
              <ShoppingBag className="w-5 h-5" strokeWidth={1.5} />
            </Link>
          ) : null}

          {/* Mobile menu */}
          <button className="md:hidden p-2 text-[#2C241B]" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"} data-testid="mobile-menu-toggle">
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <nav className="md:hidden bg-[#FDFBF7] border-b border-[#E3DCD2] px-6 py-4 space-y-3" data-testid="mobile-nav">
          {navLinks.map(l => (
            <Link key={l.to} to={l.to} onClick={() => setMobileOpen(false)}
              className="block text-sm uppercase tracking-[0.15em] font-medium text-[#5C5042] hover:text-[#D96C4A]">
              {l.label}
            </Link>
          ))}
          {user === false && (
            <Link to="/login" onClick={() => setMobileOpen(false)} className="block text-sm uppercase tracking-[0.15em] font-medium text-[#D96C4A]">
              Login / Register
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}
