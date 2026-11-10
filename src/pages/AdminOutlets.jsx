import { useState } from "react";
import { Store, Plus, Check, X } from "lucide-react";
import http from "@/lib/http";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { API_BASE_URL as API } from "@/config/api";
import { useAdminScope } from "@/contexts/AdminScopeContext";
import ChaskaLoader from "@/components/ChaskaLoader";

const EMPTY = { code: "", name: "", address: "" };

function describeError(err, fallback) {
  const detail = err.response?.data?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) return detail.map(e => e.msg).join(" ");
  return fallback;
}

export default function AdminOutlets() {
  const { outlets, loading, reloadOutlets, chooseScope } = useAdminScope();
  const [form, setForm] = useState(EMPTY);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyCode, setBusyCode] = useState("");

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!/^[A-Za-z]{2,4}\d{1,3}$/.test(form.code.trim())) {
      toast.error("A code is two to four letters then a number, like CH1.");
      return;
    }
    if (form.name.trim().length < 2) {
      toast.error("Give the branch a name.");
      return;
    }
    setSaving(true);
    try {
      await http.post(`${API}/api/admin/outlets`, {
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        address: form.address.trim(),
        is_active: true,
      });
      await reloadOutlets();
      setForm(EMPTY);
      setCreating(false);
      toast.success(`${form.code.trim().toUpperCase()} added.`);
    } catch (err) {
      toast.error(describeError(err, "Could not add the branch."));
    } finally {
      setSaving(false);
    }
  };

  const setActive = async (outlet, isActive) => {
    setBusyCode(outlet.code);
    try {
      await http.put(`${API}/api/admin/outlets/${outlet.code}`, { is_active: isActive });
      await reloadOutlets();
      toast.success(isActive ? `${outlet.name} is taking orders.` : `${outlet.name} is closed to new orders.`);
    } catch (err) {
      toast.error(describeError(err, "Could not change the branch."));
    } finally {
      setBusyCode("");
    }
  };

  if (loading) return <ChaskaLoader label="Loading branches" fullScreen={false} className="rounded-2xl" />;

  return (
    <div data-testid="admin-outlets-page">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="font-['Cormorant_Garamond'] text-3xl font-medium text-[#2C241B]">Outlets</h1>
          <p className="text-sm text-[#5C5042] mt-1">
            Each branch keeps its own counter. Use the Managing picker to switch to one
            and set what it is serving.
          </p>
        </div>
        {!creating && (
          <Button
            onClick={() => setCreating(true)}
            className="bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-full px-5"
            data-testid="add-outlet-btn"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add branch
          </Button>
        )}
      </div>

      {creating && (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-2xl p-6 border border-[#E3DCD2]/50 mb-6"
          data-testid="outlet-form"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <Label className="text-sm font-medium text-[#2C241B]">Code</Label>
              <Input
                value={form.code}
                onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                placeholder="CH1"
                maxLength={7}
                className="mt-1 border-[#E3DCD2]"
                data-testid="outlet-code"
              />
              <p className="mt-1 text-xs text-[#5C5042]">Letters then a number. Cannot be changed later.</p>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-sm font-medium text-[#2C241B]">Name</Label>
              <Input
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Patia Branch"
                maxLength={120}
                className="mt-1 border-[#E3DCD2]"
                data-testid="outlet-name"
              />
            </div>
          </div>
          <div className="mt-4">
            <Label className="text-sm font-medium text-[#2C241B]">Address</Label>
            <Input
              value={form.address}
              onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
              placeholder="Infront of KFC, Chandaka Industrial Estate, Patia"
              maxLength={300}
              className="mt-1 border-[#E3DCD2]"
              data-testid="outlet-address"
            />
            <p className="mt-1 text-xs text-[#5C5042]">Shown to customers choosing where to eat.</p>
          </div>
          <div className="flex gap-3 mt-5">
            <Button type="submit" disabled={saving} className="bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-full px-6" data-testid="outlet-save">
              {saving ? "Adding..." : "Add branch"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setCreating(false); setForm(EMPTY); }}
              className="border-[#E3DCD2] text-[#5C5042] hover:bg-[#F4F0E6] rounded-full px-6"
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {outlets.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-[#E3DCD2]/50" data-testid="no-outlets">
          <Store className="w-12 h-12 text-[#E3DCD2] mx-auto mb-3" strokeWidth={1} />
          <p className="font-['Cormorant_Garamond'] text-2xl text-[#2C241B] mb-1">No branches yet</p>
          <p className="text-sm text-[#5C5042]">
            Add one and Dine In appears for customers.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {outlets.map(outlet => (
            <div
              key={outlet.code}
              className="bg-white rounded-2xl p-5 border border-[#E3DCD2]/50 flex flex-wrap items-center justify-between gap-4"
              data-testid={`outlet-row-${outlet.code}`}
            >
              <div className="min-w-0">
                <p className="flex items-center gap-2 font-medium text-[#2C241B]">
                  <span className="text-xs font-mono bg-[#F4F0E6] rounded px-1.5 py-0.5">{outlet.code}</span>
                  {outlet.name}
                  {outlet.is_active
                    ? <span className="inline-flex items-center gap-1 text-xs text-[#4A7c59]"><Check className="w-3 h-3" /> Open</span>
                    : <span className="inline-flex items-center gap-1 text-xs text-[#D3494E]"><X className="w-3 h-3" /> Closed</span>}
                </p>
                {outlet.address && <p className="text-xs text-[#5C5042] mt-1">{outlet.address}</p>}
                <p className="text-xs text-[#5C5042] mt-1">
                  {(outlet.unavailable_product_ids?.length || 0) === 0
                    ? "Serving everything on the menu"
                    : `${outlet.unavailable_product_ids.length} item(s) off the counter`}
                </p>
              </div>
              <div className="flex items-center gap-4 shrink-0">
                <button
                  type="button"
                  onClick={() => chooseScope(outlet.code)}
                  className="text-xs text-[#D96C4A] font-medium hover:underline"
                  data-testid={`manage-${outlet.code}`}
                >
                  Manage this counter
                </button>
                <Switch
                  checked={outlet.is_active}
                  disabled={busyCode === outlet.code}
                  onCheckedChange={v => setActive(outlet, v)}
                  data-testid={`outlet-active-${outlet.code}`}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
