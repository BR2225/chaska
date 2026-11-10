import { Link, useNavigate } from "react-router-dom";
import { Store, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import FulfilmentChooser from "@/components/FulfilmentChooser";
import { useFulfilment } from "@/contexts/FulfilmentContext";

export default function DineIn() {
  const { mode, outlet, outletsLoaded, dineInAvailable } = useFulfilment();
  const navigate = useNavigate();

  return (
    <div className="pt-24 sm:pt-28 pb-16 min-h-[80vh]" data-testid="dine-in-page">
      <div className="max-w-3xl mx-auto px-6 sm:px-8">
        <p className="text-sm uppercase tracking-[0.2em] text-[#D96C4A] mb-3 font-medium">Where to eat</p>
        <h1 className="font-['Cormorant_Garamond'] text-4xl sm:text-5xl font-light text-[#2C241B] tracking-tighter mb-3">
          Dine In or Delivery
        </h1>
        <p className="text-sm text-[#5C5042] mb-10 max-w-xl leading-relaxed">
          Each branch keeps its own counter, so what&apos;s available can differ between
          them. Telling us where you are means the menu shows what you can actually
          order right now.
        </p>

        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#E3DCD2]/50 shadow-[0_8px_30px_rgb(44,36,27,0.06)]">
          <FulfilmentChooser onDone={() => navigate("/menu")} />
        </div>

        {mode && (
          <div className="mt-8 flex flex-wrap items-center gap-4" data-testid="dine-in-current">
            <p className="text-sm text-[#5C5042]">
              {mode === "dine_in"
                ? <>Ordering to eat at <span className="text-[#2C241B] font-medium">{outlet?.name}</span>.</>
                : <>Ordering for <span className="text-[#2C241B] font-medium">delivery</span>.</>}
            </p>
            <Link to="/menu">
              <Button className="bg-[#D96C4A] text-white hover:bg-[#C25D3E] rounded-full px-6" data-testid="dine-in-browse">
                Browse the menu <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
          </div>
        )}

        {outletsLoaded && !dineInAvailable && (
          <div className="mt-8 flex items-start gap-3 text-sm text-[#5C5042]" data-testid="dine-in-none">
            <Store className="w-4 h-4 text-[#D96C4A] mt-0.5 shrink-0" strokeWidth={1.5} />
            <p>
              No branches are taking dine-in orders at the moment. Delivery is still
              running as usual.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
