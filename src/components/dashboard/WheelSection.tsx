import { useMemo, useState } from "react";
import { SpinWheel } from "@/components/SpinWheel";
import { rowToPrize } from "@/lib/spin-store";
import { Btn } from "@/components/ds";
import type { Shop, Prize } from "./types";

export function WheelSection({ shop, prizes, onEditColors, onAssign }: { shop: Shop; prizes: Prize[]; onEditColors: () => void; onAssign: () => void }) {
  const [spinning, setSpinning] = useState(false);
  const [target, setTarget] = useState<number | null>(null);
  const [last, setLast] = useState<string | null>(null);

  const wheelPrizes = useMemo(() => prizes.map((p) => rowToPrize(p as any)), [prizes]);

  const testSpin = () => {
    if (wheelPrizes.length === 0 || spinning) return;
    const idx = Math.floor(Math.random() * wheelPrizes.length);
    setTarget(idx);
    setSpinning(true);
    setLast(null);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-[20px] bg-white border border-[#0c2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-5">
        {wheelPrizes.length === 0 ? (
          <p className="text-sm text-[#4a5b78] text-center py-10">Add prizes first to preview the wheel.</p>
        ) : (
          <div className="flex flex-col items-center">
            <SpinWheel
              prizes={wheelPrizes}
              spinning={spinning}
              targetIndex={target}
              onComplete={(p) => { setSpinning(false); setTarget(null); setLast(p.name); }}
              centerLogo={shop.logo_url ?? undefined}
              centerLabel={shop.name}
            />
            {last && (
              <p className="mt-3 text-sm font-bold text-[#0c2340]">Landed on: <span className="text-[#FF6B1A]">{last}</span></p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Btn variant="primary" className="rounded-2xl py-3" onClick={testSpin} disabled={spinning || wheelPrizes.length === 0}>
          {spinning ? "Spinning…" : "Test spin"}
        </Btn>
        <button onClick={onAssign} className="rounded-2xl bg-white border border-[#0c2340]/10 hover:bg-[#F5F7FA] text-[#0c2340] font-bold py-3">
          Assign prizes
        </button>
        <button onClick={onEditColors} className="rounded-2xl bg-white border border-[#0c2340]/10 hover:bg-[#F5F7FA] text-[#0c2340] font-bold py-3">
          Edit wheel colors
        </button>
      </div>
    </div>
  );
}
