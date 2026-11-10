import { useCallback, useEffect, useState } from "react";
import { MapPin, Plus, Pencil, Trash2, Check } from "lucide-react";
import http from "@/lib/http";
import { toast } from "sonner";
import { API_BASE_URL as API } from "@/config/api";
import AddressDialog from "@/components/AddressDialog";

function describeError(err, fallback) {
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(e => e.msg).join(" ");
  return fallback;
}

export default function DeliveryDetailsCard() {
  const [addresses, setAddresses] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState("");

  const load = useCallback(() => {
    return http.get(`${API}/api/me/addresses`)
      .then(({ data }) => setAddresses(data))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => { load(); }, [load]);

  const makeDefault = async (entry) => {
    setBusyId(entry.id);
    try {
      const { data } = await http.put(`${API}/api/me/addresses/${encodeURIComponent(entry.id)}/default`);
      setAddresses(data);
      toast.success(`${entry.label} is now your default.`);
    } catch (err) {
      toast.error(describeError(err, "Could not change the default."));
    } finally {
      setBusyId("");
    }
  };

  const remove = async (entry) => {
    if (!window.confirm(`Remove ${entry.label}?`)) return;
    setBusyId(entry.id);
    try {
      const { data } = await http.delete(`${API}/api/me/addresses/${encodeURIComponent(entry.id)}`);
      setAddresses(data);
      toast.success("Address removed.");
    } catch (err) {
      toast.error(describeError(err, "Could not remove the address."));
    } finally {
      setBusyId("");
    }
  };

  return (
    <div
      className="bg-white rounded-2xl p-6 sm:p-7 border border-[#E3DCD2]/50 shadow-[0_8px_30px_rgb(44,36,27,0.06)] mb-10"
      data-testid="delivery-details-card"
    >
      <div className="flex items-start justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#D96C4A]/10 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-4 h-4 text-[#D96C4A]" strokeWidth={1.5} />
          </div>
          <div>
            <h2 className="font-['Cormorant_Garamond'] text-2xl font-medium text-[#2C241B] leading-tight">
              Delivery addresses
            </h2>
            <p className="text-xs text-[#5C5042]">Pick one at checkout instead of typing it again</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setEditing(null); setDialogOpen(true); }}
          className="flex items-center gap-1.5 text-sm text-[#D96C4A] font-medium hover:underline shrink-0"
          data-testid="delivery-details-edit"
        >
          <Plus className="w-3.5 h-3.5" /> Add
        </button>
      </div>

      {!loaded ? (
        <p className="text-sm text-[#5C5042]">Loading your addresses...</p>
      ) : addresses.length === 0 ? (
        <p className="text-sm text-[#5C5042]" data-testid="delivery-details-empty">
          Nothing saved yet. Add one here, or at checkout, and we&apos;ll keep it for
          next time.
        </p>
      ) : (
        <div className="space-y-3" data-testid="delivery-details-saved">
          {addresses.map(entry => (
            <div
              key={entry.id}
              className="flex items-start justify-between gap-4 rounded-xl border border-[#E3DCD2] px-4 py-3"
              data-testid={`saved-address-${entry.id}`}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-sm font-medium text-[#2C241B]">
                  {entry.label}
                  {entry.is_default && (
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] text-[#4A7c59] bg-[#4A7c59]/10 rounded-full px-2 py-0.5">
                      <Check className="w-3 h-3" /> Default
                    </span>
                  )}
                </p>
                <p className="text-xs text-[#5C5042] mt-0.5 leading-relaxed">{entry.delivery_address}</p>
                <p className="text-xs text-[#5C5042] mt-0.5">{entry.customer_phone}</p>
                {!entry.is_default && (
                  <button
                    type="button"
                    onClick={() => makeDefault(entry)}
                    disabled={busyId === entry.id}
                    className="mt-1.5 text-xs text-[#D96C4A] font-medium hover:underline disabled:opacity-50"
                    data-testid={`make-default-${entry.id}`}
                  >
                    Make default
                  </button>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => { setEditing(entry); setDialogOpen(true); }}
                  className="text-[#5C5042] hover:text-[#D96C4A]"
                  aria-label={`Edit ${entry.label}`}
                  data-testid={`edit-saved-${entry.id}`}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => remove(entry)}
                  disabled={busyId === entry.id}
                  className="text-[#5C5042] hover:text-[#D3494E] disabled:opacity-50"
                  aria-label={`Remove ${entry.label}`}
                  data-testid={`remove-saved-${entry.id}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <AddressDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        address={editing}
        onSaved={(book) => setAddresses(book)}
      />
    </div>
  );
}
