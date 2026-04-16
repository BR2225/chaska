import { createContext, useContext, useState, useEffect } from "react";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem("cart");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem("cart", JSON.stringify(items));
  }, [items]);

  const addItem = (product, size = null, quantity = 1) => {
    const itemId = size ? `${product.id}-${size.name}` : product.id;
    const price = size ? size.price : product.price;
    setItems(prev => {
      const existing = prev.find(i => i.itemId === itemId);
      if (existing) {
        return prev.map(i => i.itemId === itemId ? { ...i, quantity: i.quantity + quantity } : i);
      }
      return [...prev, { itemId, productId: product.id, name: product.name, size: size?.name || "Standard", price, quantity, image: product.image }];
    });
  };

  const removeItem = (itemId) => setItems(prev => prev.filter(i => i.itemId !== itemId));
  const updateQuantity = (itemId, quantity) => {
    if (quantity <= 0) return removeItem(itemId);
    setItems(prev => prev.map(i => i.itemId === itemId ? { ...i, quantity } : i));
  };
  const clearCart = () => setItems([]);
  const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  const itemCount = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, total, itemCount }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
