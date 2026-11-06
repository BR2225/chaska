import { useEffect, useState } from "react";
import { MapPin, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// Contacts and autofill hand over numbers however they are stored: "+91 98765
// 43210", a leading zero, hyphens. The API takes ten bare digits.
function normalizePhone(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

function describeError(err, fallback) {
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(entry => entry.msg).join(" ");
  return fallback;
}

export default function DeliveryDetailsCard() {
  const { user, saveDeliveryDetails } = useAuth();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customer_phone: "", delivery_address: "" });

  const savedPhone = user?.delivery_phone || "";
  const savedAddress = user?.delivery_address || "";
  const hasSaved = Boolean(savedPhone && savedAddress);

  // Re-seed whenever the stored values change, so opening the form always
  // starts from what is actually saved rather than a stale edit.
  useEffect(() => {
    setForm({ customer_phone: savedPhone, delivery_address: savedAddress });
  }, [savedPhone, savedAddress]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!/^[6-9]\d{9}$/.test(form.customer_phone)) {
      toast.error("Enter a 10-digit Indian mobile number, without +91.");
      return;
    }
    if (form.delivery_address.trim().length < 5) {
      toast.error("Enter a delivery address.");
      return;
    }
    setSaving(true);
    try {
      await saveDeliveryDetails(form.customer_phone, form.delivery_address.trim());
      setEditing(false);
      toast.success("Delivery details saved.");
    } catch (err) {
      toast.error(describeError(err, "Could not save your details. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setForm({ customer_phone: savedPhone, delivery_address: savedAddress });
    setEditing(false);
  };

  return (
    <div
      className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E3DCD2]/50 shadow-[0_8px_30px_rgb(44,36,27,0.06)] mb-10"
      data-testid="delivery-details-card"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#D96C4A]/10 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-4 h-4 text-[#D96C4A]" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="font-['Cormorant_Garamond'] text-2xl font-medium text-[#2C241B] leading-tight">
              Delivery details
            </h2>
            <p className="text-xs text-[#5C5042]">Used to fill in your next order</p>
          </div>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 text-sm text-[#D96C4A] font-medium hover:underline shrink-0"
            data-testid="delivery-details-edit"
          >
            <Pencil className="w-3.5 h-3.5" /> {hasSaved ? "Change" : "Add"}
          </button>
        )}
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-4" data-testid="delivery-details-form">
          <div>
            <Label className="text-sm font-medium text-[#2C241B]">Phone</Label>
            <Input
              name="customer_phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              maxLength={10}
              value={form.customer_phone}
              onChange={(e) => setForm(prev => ({ ...prev, customer_phone: normalizePhone(e.target.value) }))}
              placeholder="10-digit mobile"
              className="mt-1 border-[#E3DCD2]"
              data-testid="delivery-details-phone"
            />
          </div>
          <div>
            <Label className="text-sm font-medium text-[#2C241B]">Delivery address</Label>
            <Textarea
              name="delivery_address"
              rows={3}
              maxLength={500}
              value={form.delivery_address}
              onChange={(e) => setForm(prev => ({ ...prev, delivery_address: e.target.value }))}
              placeholder="Flat, street, landmark, area"
              className="mt-1 border-[#E3DCD2]"
              data-testid="delivery-details-address"
            />
          </div>
          <div className="flex gap-3">
            <Button
              type="submit"
              disabled={saving}
              className="bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-full px-6"
              data-testid="delivery-details-save"
            >
              {saving ? "Saving..." : "Save"}
            </Button>
            <Button
              type="button"
              onClick={cancel}
              variant="outline"
              className="border-[#E3DCD2] text-[#5C5042] hover:bg-[#F4F0E6] rounded-full px-6"
              data-testid="delivery-details-cancel"
            >
              Cancel
            </Button>
          </div>
        </form>
      ) : hasSaved ? (
        <div className="space-y-1 text-sm" data-testid="delivery-details-saved">
          <p className="text-[#2C241B]">{savedPhone}</p>
          <p className="text-[#5C5042] leading-relaxed">{savedAddress}</p>
        </div>
      ) : (
        <p className="text-sm text-[#5C5042]" data-testid="delivery-details-empty">
          Nothing saved yet. Add your phone and address here, or place an order and
          we&apos;ll remember what you type.
        </p>
      )}
    </div>
  );
}
