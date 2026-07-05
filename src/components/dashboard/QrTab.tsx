import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { listAccessCodes } from "@/lib/access-codes.functions";
import type { Shop, CodeRow } from "./types";

export function QrTab({ shop }: { shop: Shop }) {
  const fetchCodes = useServerFn(listAccessCodes);
  const [rows, setRows] = useState<CodeRow[]>([]);
  const [filter, setFilter] = useState<"all" | "unused">("unused");

  useEffect(() => {
    fetchCodes({ data: { shopId: shop.id } }).then((r) => setRows((r.rows as CodeRow[]) ?? [])).catch(() => {});
  }, [fetchCodes, shop.id]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shopUrl = `${origin}/s/${shop.slug}`;
  const codeUrl = (code: string) => `${origin}/s/${shop.slug}?code=${encodeURIComponent(code)}`;

  const list = rows.filter((r) => (filter === "unused" ? !r.is_used : true));

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
        .shop-qr svg { width: 240px !important; height: 240px !important; }
      }`}</style>

      <div className="glass rounded-2xl p-4 no-print space-y-2">
        <p className="text-xs uppercase tracking-widest text-gold">How it works</p>
        <p className="text-sm text-muted-foreground">
          Customers scan a QR with their phone camera and spin on their own device — no app required.
          The <span className="text-foreground font-semibold">Shop QR</span> opens the entry page where they enter any access code.
          A <span className="text-foreground font-semibold">Per-code QR</span> opens the entry page with the code already filled in — they just type their name and spin.
        </p>
        <div className="flex gap-2 flex-wrap pt-2">
          <button onClick={() => window.print()} className="px-3 py-2 rounded-lg bg-primary text-white font-bold text-sm">Print this page</button>
          <button onClick={() => setFilter(filter === "all" ? "unused" : "all")} className="px-3 py-2 rounded-lg bg-white/5 text-sm">
            Showing: {filter === "all" ? "All codes" : "Unused only"}
          </button>
        </div>
      </div>

      <div id="qr-print" className="space-y-6">
        <div className="qr-card glass rounded-2xl p-6 flex flex-col items-center text-center">
          <p className="text-xs uppercase tracking-widest text-gold">Shop QR — scan to spin</p>
          <h2 className="text-2xl font-black mt-1">{shop.name}</h2>
          <div className="qr-code mt-4 p-4 bg-white rounded-xl">
            <QRCodeSVG value={shopUrl} size={240} level="M" includeMargin={false} />
          </div>
          <p className="mt-3 text-xs break-all opacity-80">{shopUrl}</p>
          <p className="mt-2 text-[11px] opacity-70">Point your phone camera at the code to open the spin page.</p>
        </div>

        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground mb-3 no-print">Per-code QRs ({list.length})</p>
          {list.length === 0 ? (
            <p className="text-sm text-muted-foreground no-print">No codes to show. Generate codes in the Codes tab first.</p>
          ) : (
            <div className="qr-grid grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {list.map((r) => (
                <div key={r.code} className="qr-card glass rounded-xl p-5 flex flex-col items-center text-center">
                  <div className="qr-code p-3 bg-white rounded-lg">
                    <QRCodeSVG value={codeUrl(r.code)} size={170} level="M" includeMargin={false} />
                  </div>
                  <p className="mt-3 font-mono text-sm tracking-widest break-all">{r.code}</p>
                  <p className="text-xs opacity-70">{shop.name}</p>
                  {r.is_used && <p className="text-xs text-destructive no-print">used</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
