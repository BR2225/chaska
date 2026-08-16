import { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [cartOwner, setCartOwner] = useState(null);
  const customerId = user && user.role === "customer" ? user.id : null;
  const canUseCart = Boolean(customerId);

  useEffect(() => {
    if (!customerId) {
      setCartOwner(null);
      setItems([]);
      return;
    }

    try {
      const saved = localStorage.getItem(`chaska-cart:${customerId}`);
      const parsed = saved ? JSON.parse(saved) : [];
      setItems(Array.isArray(parsed) ? parsed : []);
    } catch {
      setItems([]);
    }
    setCartOwner(customerId);
  }, [customerId]);

  useEffect(() => {
    if (!cartOwner || cartOwner !== customerId) return;
    try {
      localStorage.setItem(`chaska-cart:${cartOwner}`, JSON.stringify(items));
    } catch {
      // The in-memory cart remains usable if browser storage is unavailable.
    }
  }, [cartOwner, customerId, items]);

  const addItem = (product, size = null, quantity = 1) => {
    if (!canUseCart || cartOwner !== customerId) return false;
    const itemId = size ? `${product.id}-${size.name}` : product.id;
    const price = size ? size.price : product.price;
    setItems(prev => {
      const existing = prev.find(i => i.itemId === itemId);
      if (existing) {
        return prev.map(i => i.itemId === itemId ? { ...i, quantity: i.quantity + quantity } : i);
      }
      return [...prev, { itemId, productId: product.id, name: product.name, size: size?.name || "Standard", price, quantity, image: product.image }];
    });
    return true;
  };

  const removeItem = (itemId) => {
    if (!canUseCart) return;
    setItems(prev => prev.filter(i => i.itemId !== itemId));
  };
  const updateQuantity = (itemId, quantity) => {
    if (!canUseCart) return;
    if (quantity <= 0) return removeItem(itemId);
    setItems(prev => prev.map(i => i.itemId === itemId ? { ...i, quantity } : i));
  };
  const clearCart = () => {
    if (canUseCart) setItems([]);
  };
  const visibleItems = canUseCart && cartOwner === customerId ? items : [];
  const total = visibleItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = visibleItems.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items: visibleItems, addItem, removeItem, updateQuantity, clearCart, total, itemCount, canUseCart }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
