import { Link } from "react-router-dom";
import { useCart } from "@/contexts/CartContext";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CartSheet() {
  const { items, removeItem, updateQuantity, total } = useCart();

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center px-4">
        <ShoppingBag className="w-16 h-16 text-[#E3DCD2] mb-4" strokeWidth={1} />
        <p className="font-['Cormorant_Garamond'] text-2xl text-[#2C241B] mb-2">Your cart is empty</p>
        <p className="text-sm text-[#5C5042] mb-6">Discover our delicious bomboloni and tiramisu</p>
        <Link to="/menu">
          <Button className="bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-full px-8" data-testid="browse-menu-btn">
            Browse Menu
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full" data-testid="cart-sheet-content">
      <div className="flex-1 overflow-y-auto py-4 space-y-4">
        {items.map(item => (
          <div key={item.itemId} className="flex gap-3 p-3 bg-white rounded-xl border border-[#E3DCD2]/50" data-testid={`cart-item-${item.itemId}`}>
            <img src={item.image} alt={item.name} className="w-16 h-16 rounded-lg object-cover" />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-[#2C241B] truncate">{item.name}</h4>
              <p className="text-xs text-[#5C5042]">{item.size}</p>
              <p className="text-sm font-semibold text-[#D96C4A] mt-1">&#8377;{item.price * item.quantity}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <button onClick={() => removeItem(item.itemId)} className="text-[#5C5042] hover:text-[#D3494E] transition-colors" data-testid={`remove-${item.itemId}`}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <div className="flex items-center gap-2 bg-[#F4F0E6] rounded-full px-1">
                <button onClick={() => updateQuantity(item.itemId, item.quantity - 1)} className="p-1 text-[#5C5042] hover:text-[#D96C4A]" data-testid={`decrease-${item.itemId}`}>
                  <Minus className="w-3 h-3" />
                </button>
                <span className="text-xs font-medium w-4 text-center">{item.quantity}</span>
                <button onClick={() => updateQuantity(item.itemId, item.quantity + 1)} className="p-1 text-[#5C5042] hover:text-[#D96C4A]" data-testid={`increase-${item.itemId}`}>
                  <Plus className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-[#E3DCD2] pt-4 mt-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-[#5C5042]">Subtotal</span>
          <span className="font-['Cormorant_Garamond'] text-2xl font-semibold text-[#2C241B]">&#8377;{total}</span>
        </div>
        <Link to="/checkout" className="block">
          <Button className="w-full bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-full h-12 text-base font-medium" data-testid="checkout-btn">
            Proceed to Checkout
          </Button>
        </Link>
      </div>
    </div>
  );
}
