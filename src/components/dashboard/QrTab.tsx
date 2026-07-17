import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { listAccessCodes } from "@/lib/access-codes.functions";
import type { Shop, CodeRow } from "./types";

interface CampaignRef {
  id: string;
  slug: string;
  name: string;
}

interface QrTabProps {
  shop: Shop;
  /** The campaign whose QR codes and access codes are shown. null = no campaign selected yet. */
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

  const origin  = typeof window !== "undefined" ? window.location.origin : "";

  // Campaign QR — opens the campaign directly, no picker needed.
  const campaignUrl = campaign
    ? `${origin}/s/${shop.slug}?c=${encodeURIComponent(campaign.slug)}`
    : `${origin}/s/${shop.slug}`;

  // Per-code QR — pre-fills both the campaign AND the code.
  const codeUrl = (code: string) =>
    campaign
      ? `${origin}/s/${shop.slug}?c=${encodeURIComponent(campaign.slug)}&code=${encodeURIComponent(code)}`
      : `${origin}/s/${shop.slug}?code=${encodeURIComponent(code)}`;

  const list = rows.filter((r) => (filter === "unused" ? !r.is_used : true));

  if (!campaign) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Select a campaign above to see its QR codes.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <style>{`@media print {
        @page { margin: 12mm; }
        body * { visibility: hidden; }
        #qr-print, #qr-print * { visibility: visible; }
        #qr-print { position: absolute; left: 0; top: 0; width: 100%; background: white !important; color: black !important; padding: 0; }
        .no-print { display: none !important; }
        .qr-card { break-inside: avoid; page-break-inside: avoid; border: 1px solid #ddd !important; background: white !important; color: black !important; padding: 20px !important; }
        .qr-grid { gap: 24px !important; grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        .qr-code svg { width: 170px !important; height: 170px !important; }
        .campaign-qr svg { width: 240px !important; height: 240px !important; }
      }`}</style>

      <div className="glass rounded-2xl p-4 no-print space-y-2">
        <p className="text-xs uppercase tracking-widest text-gold">How it works</p>
        <p className="text-sm text-muted-foreground">
          The <span className="text-foreground font-semibold">Campaign QR</span> opens{" "}
          <span className="text-foreground font-semibold">{campaign.name}</span> directly — customers
          never see a campaign picker. A{" "}
          <span className="text-foreground font-semibold">Per-code QR</span> opens the same campaign
          with the code pre-filled; customers just enter their name and spin.
        </p>
        <div className="flex gap-2 flex-wrap pt-2">
          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-lg bg-primary text-white font-bold text-sm"
          >
            Print this page
          </button>
          <button
            onClick={() => setFilter(filter === "all" ? "unused" : "all")}
            className="px-3 py-2 rounded-lg bg-white/5 text-sm"
          >
            Showing: {filter === "all" ? "All codes" : "Unused only"}
          </button>
        </div>
      </div>

      <div id="qr-print" className="space-y-6">
        {/* Campaign QR — routes directly to this campaign, no picker */}
        <div className="qr-card glass rounded-2xl p-6 flex flex-col items-center text-center">
          <p className="text-xs uppercase tracking-widest text-gold">Campaign QR — scan to play</p>
          <h2 className="text-2xl font-black mt-1">{campaign.name}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{shop.name}</p>
          <div className="campaign-qr mt-4 p-4 bg-white rounded-xl">
            <QRCodeSVG value={campaignUrl} size={240} level="M" includeMargin={false} />
          </div>
          <p className="mt-3 text-xs break-all opacity-80">{campaignUrl}</p>
          <p className="mt-2 text-[11px] opacity-70">
            Scanning opens <strong>{campaign.name}</strong> directly — no campaign selection required.
          </p>
        </div>

        {/* Per-code QRs */}
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 no-print">
            Per-code QRs ({list.length})
          </p>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground no-print">
              No codes to show. Generate codes in the Access Codes section below first.
            </p>
          ) : (
            <div className="qr-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {list.map((r) => (
                <div
                  key={r.code}
                  className="qr-card glass rounded-xl p-5 flex flex-col items-center text-center"
                >
                  <div className="qr-code p-3 bg-white rounded-lg">
                    <QRCodeSVG value={codeUrl(r.code)} size={170} level="M" includeMargin={false} />
                  </div>
                  <p className="mt-3 font-mono text-sm tracking-widest break-all">{r.code}</p>
                  <p className="text-xs opacity-70">{campaign.name}</p>
                  {r.is_used && (
                    <p className="text-xs text-destructive no-print">used</p>
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
