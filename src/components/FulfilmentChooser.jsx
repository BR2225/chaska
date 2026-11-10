import { useState } from "react";
import { Bike, MapPin, Store, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFulfilment } from "@/contexts/FulfilmentContext";

/**
 * How the order reaches the customer: brought to them, or eaten at a counter.
 *
 * Asked once and remembered. Shown as a panel rather than a blocking modal so
 * somebody who only wants to read the menu is never trapped behind it.
 */
export default function FulfilmentChooser({ onDone, compact = false }) {
  const { outlets, outletsLoaded, dineInAvailable, chooseDelivery, chooseDineIn, choice } = useFulfilment();
  const [pickingOutlet, setPickingOutlet] = useState(choice?.mode === "dine_in");

  const takeDelivery = () => {
    chooseDelivery();
    onDone?.();
  };

  const takeOutlet = (outlet) => {
    chooseDineIn(outlet);
    onDone?.();
  };

  return (
    <div data-testid="fulfilment-chooser">
      {!compact && (
        <>
          <h2 className="font-['Cormorant_Garamond'] text-2xl sm:text-3xl font-medium text-[#2C241B] mb-1">
            How would you like your order?
          </h2>
          <p className="text-sm text-[#5C5042] mb-6">
            You can change this at any time.
          </p>
        </>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={takeDelivery}
          className={`text-left rounded-2xl border p-5 transition-all hover:border-[#D96C4A] hover:shadow-sm ${
            choice?.mode === "delivery" ? "border-[#D96C4A] bg-[#D96C4A]/[0.06]" : "border-[#E3DCD2] bg-white"
          }`}
          data-testid="choose-delivery"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-[#D96C4A]/10 flex items-center justify-center">
              <Bike className="w-4 h-4 text-[#D96C4A]" strokeWidth={1.5} />
            </div>
            <span className="font-medium text-[#2C241B]">Delivery</span>
            {choice?.mode === "delivery" && <Check className="w-4 h-4 text-[#4A7c59] ml-auto" />}
          </div>
          <p className="text-xs text-[#5C5042] leading-relaxed">
            Brought to your address.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setPickingOutlet(true)}
          disabled={!dineInAvailable}
          className={`text-left rounded-2xl border p-5 transition-all ${
            dineInAvailable ? "hover:border-[#D96C4A] hover:shadow-sm" : "opacity-60 cursor-not-allowed"
          } ${
            choice?.mode === "dine_in" ? "border-[#D96C4A] bg-[#D96C4A]/[0.06]" : "border-[#E3DCD2] bg-white"
          }`}
          data-testid="choose-dine-in"
        >
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-[#8A9A5B]/10 flex items-center justify-center">
              <Store className="w-4 h-4 text-[#8A9A5B]" strokeWidth={1.5} />
            </div>
            <span className="font-medium text-[#2C241B]">Dine In</span>
            {choice?.mode === "dine_in" && <Check className="w-4 h-4 text-[#4A7c59] ml-auto" />}
          </div>
          <p className="text-xs text-[#5C5042] leading-relaxed">
            {outletsLoaded && !dineInAvailable
              ? "No branches open for this just now."
              : "Order ahead and eat at one of our counters."}
          </p>
        </button>
      </div>

      {pickingOutlet && dineInAvailable && (
        <div className="mt-5" data-testid="outlet-list">
          <p className="text-xs uppercase tracking-[0.15em] text-[#5C5042] mb-3">Choose a branch</p>
          <div className="space-y-2">
            {outlets.map(outlet => {
              const selected = choice?.mode === "dine_in" && choice.outlet.code === outlet.code;
              return (
                <button
                  key={outlet.code}
                  type="button"
                  onClick={() => takeOutlet(outlet)}
                  className={`w-full text-left rounded-xl border px-4 py-3 flex items-start gap-3 transition-all hover:border-[#D96C4A] ${
                    selected ? "border-[#D96C4A] bg-[#D96C4A]/[0.06]" : "border-[#E3DCD2] bg-white"
                  }`}
                  data-testid={`outlet-${outlet.code}`}
                >
                  <MapPin className="w-4 h-4 text-[#D96C4A] mt-0.5 shrink-0" strokeWidth={1.5} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[#2C241B]">{outlet.name}</span>
                    {outlet.address && (
                      <span className="block text-xs text-[#5C5042] leading-relaxed">{outlet.address}</span>
                    )}
                  </span>
                  {selected && <Check className="w-4 h-4 text-[#4A7c59] ml-auto shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {!compact && (
        <p className="text-xs text-[#5C5042] mt-5">
          Browsing the menu doesn&apos;t need a choice &mdash; we only ask so prices and
          availability are right for you.
        </p>
      )}
    </div>
  );
}

export function FulfilmentChooserPanel({ onClose }) {
  return (
    <div
      className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E3DCD2]/50 shadow-[0_8px_30px_rgb(44,36,27,0.08)]"
      data-testid="fulfilment-panel"
    >
      <FulfilmentChooser onDone={onClose} />
      {onClose && (
        <Button
          type="button"
          onClick={onClose}
          variant="outline"
          className="mt-5 w-full border-[#E3DCD2] text-[#5C5042] hover:bg-[#F4F0E6] rounded-full"
          data-testid="fulfilment-close"
        >
          Not now
        </Button>
      )}
    </div>
  );
}
