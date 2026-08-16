import { useState, useEffect } from "react";
import http from "@/lib/http";
import { Plus, Pencil, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { API_BASE_URL as API } from "@/config/api";

const emptyProduct = { name: "", category: "bomboloni", description: "", price: 0, image: "", sizes: [], is_available: true, featured: false };

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyProduct);
  const [sizeInput, setSizeInput] = useState({ name: "", price: "" });

  const load = () => http.get(`${API}/api/products`).then(r => setProducts(r.data));
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(emptyProduct); setDialogOpen(true); };
  const openEdit = (p) => { setEditing(p.id); setForm({ name: p.name, category: p.category, description: p.description, price: p.price, image: p.image, sizes: p.sizes || [], is_available: p.is_available, featured: p.featured }); setDialogOpen(true); };

  const addSize = () => {
    if (!sizeInput.name || !sizeInput.price) return;
    setForm(prev => ({ ...prev, sizes: [...prev.sizes, { name: sizeInput.name, price: Number(sizeInput.price) }] }));
    setSizeInput({ name: "", price: "" });
  };
  const removeSize = (idx) => setForm(prev => ({ ...prev, sizes: prev.sizes.filter((_, i) => i !== idx) }));

  const handleSave = async () => {
    try {
      if (editing) {
        await http.put(`${API}/api/products/${editing}`, form);
        toast.success("Product updated");
      } else {
        await http.post(`${API}/api/products`, form);
        toast.success("Product created");
      }
      setDialogOpen(false);
      load();
    } catch {
      toast.error("Failed to save product");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this product?")) return;
    try {
      await http.delete(`${API}/api/products/${id}`);
      toast.success("Product deleted");
      load();
    } catch {
      toast.error("Failed to delete");
    }
  };

  return (
    <div data-testid="admin-products-page">
      <div className="flex items-center justify-between mb-8">
        <h1 className="font-['Cormorant_Garamond'] text-3xl font-medium text-[#2C241B]">Products</h1>
        <Button onClick={openNew} className="bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-lg" data-testid="add-product-btn">
          <Plus className="w-4 h-4 mr-2" /> Add Product
        </Button>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-lg border border-[#E3DCD2] shadow-sm overflow-x-auto" data-testid="products-table">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E3DCD2]">
              <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-[#5C5042] font-medium">Product</th>
              <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-[#5C5042] font-medium">Category</th>
              <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-[#5C5042] font-medium">Price</th>
              <th className="text-left px-5 py-3 text-xs uppercase tracking-wider text-[#5C5042] font-medium">Status</th>
              <th className="text-right px-5 py-3 text-xs uppercase tracking-wider text-[#5C5042] font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className="border-b border-[#E3DCD2]/50 hover:bg-[#F4F0E6]/50 transition-colors" data-testid={`product-row-${p.id}`}>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <img src={p.image} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                    <div>
                      <p className="font-medium text-[#2C241B]">{p.name}</p>
                      {p.featured && <span className="text-xs text-[#D96C4A]">Featured</span>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-[#5C5042] capitalize">{p.category}</td>
                <td className="px-5 py-3 text-[#2C241B] font-medium">₹{p.price}</td>
                <td className="px-5 py-3">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full ${p.is_available ? "bg-[#4A7c59]/10 text-[#4A7c59]" : "bg-[#D3494E]/10 text-[#D3494E]"}`}>
                    {p.is_available ? "Available" : "Unavailable"}
                  </span>
                </td>
                <td className="px-5 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => openEdit(p)} className="p-1.5 text-[#5C5042] hover:text-[#D96C4A] transition-colors" data-testid={`edit-product-${p.id}`}>
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(p.id)} className="p-1.5 text-[#5C5042] hover:text-[#D3494E] transition-colors" data-testid={`delete-product-${p.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg bg-[#FDFBF7] border-[#E3DCD2] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-['Cormorant_Garamond'] text-2xl text-[#2C241B]">
              {editing ? "Edit Product" : "New Product"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-sm text-[#2C241B]">Name</Label>
              <Input value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} className="mt-1 border-[#E3DCD2]" data-testid="product-name-input" />
            </div>
            <div>
              <Label className="text-sm text-[#2C241B]">Category</Label>
              <Select value={form.category} onValueChange={v => setForm(p => ({...p, category: v}))}>
                <SelectTrigger className="mt-1 border-[#E3DCD2]" data-testid="product-category-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bomboloni">Bomboloni</SelectItem>
                  <SelectItem value="tiramisu">Tiramisu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm text-[#2C241B]">Description</Label>
              <Textarea value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))} rows={3} className="mt-1 border-[#E3DCD2]" data-testid="product-description-input" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm text-[#2C241B]">Base Price (₹)</Label>
                <Input type="number" value={form.price} onChange={e => setForm(p => ({...p, price: Number(e.target.value)}))} className="mt-1 border-[#E3DCD2]" data-testid="product-price-input" />
              </div>
              <div>
                <Label className="text-sm text-[#2C241B]">Image URL</Label>
                <Input value={form.image} onChange={e => setForm(p => ({...p, image: e.target.value}))} className="mt-1 border-[#E3DCD2]" data-testid="product-image-input" />
              </div>
            </div>
            {/* Sizes */}
            <div>
              <Label className="text-sm text-[#2C241B]">Sizes</Label>
              <div className="flex gap-2 mt-1">
                <Input placeholder="Size name" value={sizeInput.name} onChange={e => setSizeInput(p => ({...p, name: e.target.value}))} className="border-[#E3DCD2]" data-testid="size-name-input" />
                <Input placeholder="Price" type="number" value={sizeInput.price} onChange={e => setSizeInput(p => ({...p, price: e.target.value}))} className="w-24 border-[#E3DCD2]" data-testid="size-price-input" />
                <Button type="button" onClick={addSize} variant="outline" size="sm" className="border-[#E3DCD2]" data-testid="add-size-btn">Add</Button>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {form.sizes.map((s, i) => (
                  <span key={i} className="inline-flex items-center gap-1 bg-[#F4F0E6] text-sm px-3 py-1 rounded-full">
                    {s.name}: ₹{s.price}
                    <button onClick={() => removeSize(i)} className="text-[#D3494E]"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_available} onCheckedChange={v => setForm(p => ({...p, is_available: v}))} data-testid="product-available-switch" />
                <Label className="text-sm text-[#5C5042]">Available</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.featured} onCheckedChange={v => setForm(p => ({...p, featured: v}))} data-testid="product-featured-switch" />
                <Label className="text-sm text-[#5C5042]">Featured</Label>
              </div>
            </div>
            <Button onClick={handleSave} className="w-full bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-lg" data-testid="save-product-btn">
              {editing ? "Update Product" : "Create Product"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
