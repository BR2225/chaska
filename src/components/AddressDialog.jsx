import { useEffect, useState } from "react";
import http from "@/lib/http";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { API_BASE_URL as API } from "@/config/api";

// Contacts and autofill supply numbers however they are stored: "+91 98765
// 43210", a leading zero, hyphens. The API takes ten bare digits.
function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function describeError(err, fallback) {
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(e => e.msg).join(" ");
  return fallback;
}

const SUGGESTED_LABELS = ["Home", "Work", "Other"];

/**
 * Add or change one saved address.
 *
 * Returns the whole book to onSaved, because the server rearranges the
 * default when one is set and the caller should not have to work that out.
 */
export default function AddressDialog({ open, onOpenChange, address = null, onSaved }) {
  const editing = Boolean(address);
  const [form, setForm] = useState({ label: "Home", customer_phone: "", delivery_address: "", is_default: false });
  const [saving, setSaving] = useState(false);

  // Re-seed each time it opens, so a cancelled edit is not still showing the
  // next time the dialog is used.
  useEffect(() => {
    if (!open) return;
    setForm(address
      ? {
        label: address.label || "Home",
        customer_phone: address.customer_phone || "",
        delivery_address: address.delivery_address || "",
        is_default: Boolean(address.is_default),
      }
      : { label: "Home", customer_phone: "", delivery_address: "", is_default: false });
  }, [open, address]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(form.customer_phone)) {
      toast.error("Enter a 10-digit Indian mobile number, without +91.");
      return;
    }
    if (form.delivery_address.trim().length < 5) {
      toast.error("Enter the address to deliver to.");
      return;
    }
    setSaving(true);
    try {
      const payload = { ...form, delivery_address: form.delivery_address.trim(), label: form.label.trim() || "Home" };
      const { data } = editing
        ? await http.put(`${API}/api/me/addresses/${encodeURIComponent(address.id)}`, payload)
        : await http.post(`${API}/api/me/addresses`, payload);
      onSaved?.(data, editing ? address.id : null);
      onOpenChange(false);
      toast.success(editing ? "Address updated." : "Address saved.");
    } catch (err) {
      toast.error(describeError(err, "Could not save the address."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[#FDF0DB] border-[#E3DCD2] max-h-[92vh] overflow-y-auto" data-testid="address-dialog">
        <DialogTitle className="font-['Cormorant_Garamond'] text-2xl font-medium text-[#2C241B]">
          {editing ? "Edit address" : "Add a new address"}
        </DialogTitle>
        <DialogDescription className="text-sm text-[#5C5042] -mt-1">
          Saved to your account, so you can pick it next time instead of typing it again.
        </DialogDescription>

        <form onSubmit={handleSubmit} className="space-y-4 mt-1">
          <div>
            <Label className="text-sm font-medium text-[#2C241B]">Label</Label>
            <Input
              value={form.label}
              onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
              maxLength={40}
              placeholder="Home"
              className="mt-1 border-[#E3DCD2] bg-white"
              data-testid="address-label"
            />
            <div className="flex gap-2 mt-2">
              {SUGGESTED_LABELS.map(suggestion => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, label: suggestion }))}
                  className={`text-xs rounded-full px-3 py-1 border transition-colors ${
                    form.label === suggestion
                      ? "border-[#D96C4A] bg-[#D96C4A]/10 text-[#2C241B]"
                      : "border-[#E3DCD2] text-[#5C5042] hover:border-[#D96C4A]"
                  }`}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium text-[#2C241B]">Phone</Label>
            <Input
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              value={form.customer_phone}
              onChange={e => setForm(p => ({ ...p, customer_phone: normalizePhone(e.target.value) }))}
              placeholder="10-digit mobile"
              className="mt-1 border-[#E3DCD2] bg-white"
              data-testid="address-phone"
            />
          </div>

          <div>
            <Label className="text-sm font-medium text-[#2C241B]">Address</Label>
            <Textarea
              rows={3}
              maxLength={500}
              value={form.delivery_address}
              onChange={e => setForm(p => ({ ...p, delivery_address: e.target.value }))}
              placeholder="Flat, street, landmark, area"
              className="mt-1 border-[#E3DCD2] bg-white"
              data-testid="address-text"
            />
          </div>

          <label className="flex items-center gap-2.5 text-sm text-[#5C5042] cursor-pointer">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={e => setForm(p => ({ ...p, is_default: e.target.checked }))}
              className="accent-[#D96C4A] w-4 h-4"
              data-testid="address-default"
            />
            Use this one by default
          </label>

          <div className="flex gap-3 pt-1">
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-full px-6"
              data-testid="address-save"
            >
              {saving ? "Saving..." : "Save address"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-[#E3DCD2] text-[#5C5042] hover:bg-[#F4F0E6] rounded-full px-6"
            >
              Cancel
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
