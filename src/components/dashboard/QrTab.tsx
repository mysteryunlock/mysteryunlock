import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { Printer, SlidersHorizontal, QrCode, Smartphone } from "lucide-react";
import { listAccessCodes } from "@/lib/access-codes.functions";
import type { Shop, CodeRow } from "./types";

interface CampaignRef {
  id: string;
  slug: string;
  name: string;
}

interface QrTabProps {
  shop: Shop;
  campaign: CampaignRef | null;
}

export function QrTab({ shop, campaign }: QrTabProps) {
  const fetchCodes = useServerFn(listAccessCodes);
  const [rows,   setRows]   = useState<CodeRow[]>([]);
  const [filter, setFilter] = useState<"all" | "unused">("unused");

  useEffect(() => {
    if (!campaign) return;
    fetchCodes({ data: { shopId: shop.id, campaignId: campaign.id } })
      .then((r) => setRows(((r as { rows: CodeRow[] }).rows) ?? []))
      .catch(() => {});
  }, [fetchCodes, shop.id, campaign?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const campaignUrl = campaign
    ? `${origin}/s/${shop.slug}?c=${encodeURIComponent(campaign.slug)}`
    : `${origin}/s/${shop.slug}`;

  const codeUrl = (code: string) =>
    campaign
      ? `${origin}/s/${shop.slug}?c=${encodeURIComponent(campaign.slug)}&code=${encodeURIComponent(code)}`
      : `${origin}/s/${shop.slug}?code=${encodeURIComponent(code)}`;

  const list = rows.filter((r) => (filter === "unused" ? !r.is_used : true));

  if (!campaign) {
    return (
      <div className="rounded-[20px] bg-white border border-[#0C2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] flex flex-col items-center justify-center py-14 px-6 text-center">
        <div className="w-14 h-14 rounded-2xl bg-[#F0F2F8] grid place-items-center mb-4">
          <QrCode className="w-6 h-6 text-[#4a5b78]" strokeWidth={1.5} />
        </div>
        <p className="font-bold text-[#0C2340]">No campaign selected</p>
        <p className="text-sm text-[#6b7a93] mt-1.5 max-w-xs leading-relaxed">
          Select a campaign from the Campaign Hub above to view and print its QR codes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Print-only styles */}
      <style>{`
        @media print {
          @page { margin: 12mm; }
          body * { visibility: hidden; }
          #qr-print, #qr-print * { visibility: visible; }
          #qr-print { position: absolute; left: 0; top: 0; width: 100%; background: white !important; color: black !important; padding: 0; }
          .no-print { display: none !important; }
          .qr-card { break-inside: avoid; page-break-inside: avoid; border: 1px solid #ddd !important; background: white !important; color: black !important; padding: 20px !important; }
          .qr-grid { gap: 24px !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .qr-code svg { width: 170px !important; height: 170px !important; }
          .campaign-qr svg { width: 240px !important; height: 240px !important; }
        }
      `}</style>

      {/* How it works info card */}
      <div className="no-print rounded-[20px] bg-white border border-[#0C2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#FF6B1A]/10 text-[#FF6B1A] grid place-items-center shrink-0">
            <Smartphone className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#0C2340] leading-tight">How QR codes work</p>
            <p className="text-xs text-[#6b7a93] mt-1 leading-relaxed">
              The <span className="font-semibold text-[#0C2340]">Campaign QR</span> opens{" "}
              <span className="font-semibold text-[#0C2340]">{campaign.name}</span> directly — customers
              never see a picker. A{" "}
              <span className="font-semibold text-[#0C2340]">Per-code QR</span> opens the same campaign
              with the access code pre-filled; the customer just enters their name and spins.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 pt-3 border-t border-[#0C2340]/6">
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0C2340] text-white text-sm font-bold hover:opacity-90 transition-opacity active:scale-[0.98] min-h-[44px]"
          >
            <Printer className="w-4 h-4" strokeWidth={1.75} />
            Print all QR codes
          </button>
          <button
            onClick={() => setFilter(filter === "all" ? "unused" : "all")}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#F5F7FA] border border-[#0C2340]/10 text-sm font-semibold text-[#0C2340] hover:bg-[#ECEFF5] transition-colors min-h-[44px]"
          >
            <SlidersHorizontal className="w-4 h-4" strokeWidth={1.75} />
            {filter === "all" ? "Showing: All codes" : "Showing: Unused only"}
          </button>
        </div>
      </div>

      {/* ── Printable content area ── */}
      <div id="qr-print" className="space-y-5">

        {/* Campaign QR */}
        <div className="qr-card rounded-[20px] bg-white border border-[#0C2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] p-6 flex flex-col items-center text-center">
          <span className="inline-block text-[10px] font-black uppercase tracking-widest text-[#FF6B1A] bg-[#FF6B1A]/8 px-3 py-1 rounded-full mb-3">
            Campaign QR · Scan to play
          </span>
          <h2 className="text-[22px] font-display font-black text-[#0C2340] leading-tight">{campaign.name}</h2>
          <p className="text-xs text-[#6b7a93] mt-0.5">{shop.name}</p>
          <div className="campaign-qr mt-5 p-4 bg-white rounded-2xl shadow-[0_2px_12px_-4px_rgba(12,35,64,0.10)] border border-[#0C2340]/6">
            <QRCodeSVG value={campaignUrl} size={220} level="M" includeMargin={false} />
          </div>
          <p className="mt-3 text-[11px] text-[#4a5b78] break-all font-mono max-w-xs">{campaignUrl}</p>
          <p className="mt-2 text-[11px] text-[#6b7a93] max-w-xs">
            Scanning opens <strong className="text-[#0C2340]">{campaign.name}</strong> directly — no campaign selection required.
          </p>
        </div>

        {/* Per-code QRs */}
        <div>
          <div className="no-print flex items-center justify-between mb-3 px-0.5">
            <p className="text-xs font-black uppercase tracking-widest text-[#6b7a93]">
              Per-code QRs
            </p>
            <span className="text-xs font-semibold text-[#0C2340] bg-[#F0F2F8] px-2.5 py-1 rounded-full">
              {list.length} code{list.length !== 1 ? "s" : ""}
            </span>
          </div>

          {list.length === 0 ? (
            <div className="no-print rounded-[20px] bg-white border border-[#0C2340]/8 shadow-[0_4px_20px_-8px_rgba(12,35,64,0.12)] flex flex-col items-center justify-center py-10 px-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[#F0F2F8] grid place-items-center mb-3">
                <QrCode className="w-5 h-5 text-[#4a5b78]" strokeWidth={1.5} />
              </div>
              <p className="text-sm font-semibold text-[#0C2340]">No codes to display</p>
              <p className="text-xs text-[#6b7a93] mt-1 max-w-xs leading-relaxed">
                {filter === "unused"
                  ? "All codes for this campaign have been used. Switch to \"All codes\" to see them."
                  : "Generate access codes in the Codes section of the Campaign Hub."}
              </p>
            </div>
          ) : (
            <div className="qr-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {list.map((r) => (
                <div
                  key={r.code}
                  className={`qr-card rounded-[20px] bg-white border shadow-[0_2px_12px_-4px_rgba(12,35,64,0.08)] p-5 flex flex-col items-center text-center transition-colors ${
                    r.is_used
                      ? "border-[#0C2340]/5 opacity-60"
                      : "border-[#0C2340]/8 hover:border-[#FF6B1A]/35"
                  }`}
                >
                  <div className="qr-code p-3 bg-white rounded-xl shadow-[0_1px_6px_-2px_rgba(12,35,64,0.08)] border border-[#0C2340]/6">
                    <QRCodeSVG value={codeUrl(r.code)} size={150} level="M" includeMargin={false} />
                  </div>
                  <p className="mt-3 font-mono text-sm font-bold tracking-widest text-[#0C2340] break-all">{r.code}</p>
                  <p className="text-[11px] text-[#6b7a93] mt-0.5">{campaign.name}</p>
                  {r.is_used && (
                    <span className="no-print mt-1.5 text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">
                      Used
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
