import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
// canvas-confetti loaded on demand (only on win) to keep initial bundle lean
import { toast } from "sonner";
import { Copy, Download, Share2 } from "lucide-react";
import { usePrizesBySlug } from "@/lib/prizes-hook";
import { getPublicShop } from "@/lib/shops.functions";
import { playClick } from "@/lib/sounds";
import { codeChars, slugSchema } from "@/lib/validation";

const search = z.object({
  pid: z.string().min(1).max(64),
  code: codeChars,
  c: slugSchema.optional(),
  contact: z.string().min(1).max(30).optional(),
  name: z.string().min(1).max(40).optional(),
});

export const Route = createFileRoute("/s/$slug/result")({
  validateSearch: search,
  head: ({ params }) => ({ meta: [{ title: `Result — ${params.slug}` }] }),
  component: ResultPage,
});

function normalizePhone(input: string): string | null {
  // Strip spaces, dashes, parens; keep leading +
  const cleaned = input.replace(/[^\d+]/g, "");
  if (!cleaned) return null;
  // wa.me requires digits only; if no +, assume already-international or leave as-is
  return cleaned.replace(/^\+/, "");
}

function ResultPage() {
  const { slug } = Route.useParams();
  const { pid, code, c: campaignSlug, contact, name } = Route.useSearch();
  const navigate = useNavigate();
  const { prizes, isLoading, campaignNotFound } = usePrizesBySlug(slug, campaignSlug);

  const fetchShop = useServerFn(getPublicShop);
  const shopQuery = useQuery({
    queryKey: ["public-shop", slug],
    queryFn: async () => (await fetchShop({ data: { slug } })).shop,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
  });
  const p = prizes.find((x) => x.id === pid);
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLCanvasElement | null>(null);
  const [cardUrl, setCardUrl] = useState<string | null>(null);

  const shop = shopQuery.data;
  const shopName = shop?.name ?? "";

  const summary =
    p?.isWin
      ? `🎉 I just won ${p.name} at ${shopName}! Claim code: ${code}.`
      : `I spun the wheel at ${shopName}. Code: ${code}. Try your luck too!`;

  const shareToWhatsAppCustomer = () => {
    playClick();
    const phone = contact ? normalizePhone(contact) : null;
    const baseText = p?.isWin
      ? `🎉 Congratulations${name ? `, ${name}` : ""}!\n\nYou won *${p?.name}* at *${shopName}*.\n\nShow this message at the shop to claim your prize.\nClaim code: ${code}`
      : summary;
    const url = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(baseText)}`
      : `https://wa.me/?text=${encodeURIComponent(baseText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const shareGeneric = () => {
    playClick();
    const url = `https://wa.me/?text=${encodeURIComponent(summary)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const copySummary = async () => {
    playClick();
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      toast.success("Summary copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy summary");
    }
  };

  // Build the shareable branded win-card on canvas
  useEffect(() => {
    if (!p?.isWin || !shop) return;
    const canvas = cardRef.current;
    if (!canvas) return;
    const W = 1080;
    const H = 1350;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Light background gradient (cream → soft blue)
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#FBF7EE");
    bg.addColorStop(1, "#EAF1FB");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Decorative navy ring
    ctx.strokeStyle = "rgba(31, 52, 96, 0.85)";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(40, 40, W - 80, H - 80, 36);
    ctx.stroke();

    const drawTextBlock = () => {
      // Shop name
      ctx.fillStyle = "#1f3460";
      ctx.textAlign = "center";
      ctx.font = "bold 64px system-ui, -apple-system, sans-serif";
      const shopNameText = String(shop.name).toUpperCase();
      ctx.fillText(shopNameText, W / 2, 380, W - 160);

      // "YOU WON" label
      ctx.fillStyle = "rgba(31, 52, 96, 0.65)";
      ctx.font = "600 36px system-ui, -apple-system, sans-serif";
      ctx.fillText("CONGRATULATIONS — YOU WON", W / 2, 470);

      // Prize name (navy, big)
      ctx.fillStyle = "#C9892B";
      ctx.font = "900 100px system-ui, -apple-system, sans-serif";
      ctx.fillText(String(p.name), W / 2, 620, W - 160);

      // Winner name
      if (name) {
        ctx.fillStyle = "#1f3460";
        ctx.font = "600 42px system-ui, -apple-system, sans-serif";
        ctx.fillText(`Winner: ${name}`, W / 2, 720);
      }

      // Code box
      ctx.fillStyle = "rgba(31, 52, 96, 0.06)";
      const codeBoxY = 1080;
      ctx.beginPath();
      ctx.roundRect(180, codeBoxY, W - 360, 140, 20);
      ctx.fill();
      ctx.strokeStyle = "rgba(31, 52, 96, 0.4)";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "rgba(31, 52, 96, 0.6)";
      ctx.font = "500 28px system-ui, -apple-system, sans-serif";
      ctx.fillText("CLAIM CODE", W / 2, codeBoxY + 50);
      ctx.fillStyle = "#1f3460";
      ctx.font = "bold 58px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.fillText(String(code), W / 2, codeBoxY + 110);

      // Footer
      ctx.fillStyle = "rgba(31, 52, 96, 0.55)";
      ctx.font = "500 28px system-ui, -apple-system, sans-serif";
      ctx.fillText("Visit the shop to claim your prize", W / 2, H - 90);

      setCardUrl(canvas.toDataURL("image/png"));
    };

    // Try to draw the shop logo at the top
    const logoSrc = shop.logo_url;
    if (logoSrc) {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        // Circular logo
        const size = 220;
        const cx = W / 2;
        const cy = 220;
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, cx - size / 2, cy - size / 2, size, size);
        ctx.restore();
        // navy ring around logo
        ctx.strokeStyle = "#1f3460";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(cx, cy, size / 2 + 4, 0, Math.PI * 2);
        ctx.stroke();
        drawTextBlock();
      };
      img.onerror = () => drawTextBlock();
      img.src = logoSrc;
    } else {
      drawTextBlock();
    }
  }, [p, shop, code, name]);

  const downloadCard = () => {
    playClick();
    if (!cardUrl) return;
    const a = document.createElement("a");
    a.href = cardUrl;
    a.download = `${shopName || "win"}-${code}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Win card downloaded");
  };

  const shareCard = async () => {
    playClick();
    if (!cardUrl) return;
    try {
      const blob = await (await fetch(cardUrl)).blob();
      const file = new File([blob], `${shopName || "win"}-${code}.png`, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: summary });
        return;
      }
      downloadCard();
    } catch {
      downloadCard();
    }
  };

  useEffect(() => {
    if (!p?.isWin) return;
    let t1: ReturnType<typeof setTimeout>;
    let t2: ReturnType<typeof setTimeout>;
    import("canvas-confetti").then(({ default: confetti }) => {
      const burst = () => confetti({ particleCount: 80, spread: 75, origin: { y: 0.4 }, colors: ["#FF7A00", "#F5C542", "#ffffff"] });
      burst();
      t1 = setTimeout(burst, 400);
      t2 = setTimeout(burst, 900);
    });
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [p?.isWin]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  if (campaignNotFound) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 text-center gap-4">
        <p className="text-2xl">🔍</p>
        <p className="font-bold text-foreground text-lg">Campaign not found</p>
        <p className="text-sm text-muted-foreground max-w-xs">
          The campaign link you used is no longer active or doesn't exist.
        </p>
        <button
          onClick={() => navigate({ to: "/s/$slug", params: { slug }, search: {} })}
          className="mt-4 gradient-primary text-[#0F1115] font-bold py-3 px-8 rounded-xl glow-orange"
        >
          Go to Main Page
        </button>
      </div>
    );
  }

  if (!p) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading…</div>;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-10 text-center">
      {/* Hidden canvas used to generate the shareable card */}
      <canvas ref={cardRef} className="hidden" />

      <div className="animate-float-up">
        <div className={`w-64 h-64 rounded-3xl overflow-hidden mx-auto ${p.isWin ? "glow-orange" : ""} bg-[#0F1115] border border-white/10`}>
          <img src={p.image} alt={p.name} className="w-full h-full object-cover" />
        </div>
        <h2 className="mt-8 text-2xl font-black tracking-wide">
          {p.isWin ? "Congratulations!" : "Better Luck Next Time!"}
        </h2>
        {p.isWin && <p className="mt-2 text-muted-foreground">You Won</p>}
        <p className={`mt-2 text-3xl font-black ${p.isWin ? "text-gold" : "text-foreground"}`}>
          {p.isWin ? p.name : "Try Again"}
        </p>
        {p.isWin && shopQuery.data && (
          <p className="mt-4 text-sm text-muted-foreground max-w-xs mx-auto">
            Claim your prize at <span className="text-foreground font-semibold">{shopQuery.data.name}</span>.
          </p>
        )}
        <p className="mt-3 text-[11px] text-muted-foreground font-mono">Code: {code}</p>

        <button
          onClick={() => { playClick(); navigate({ to: "/s/$slug", params: { slug } }); }}
          className="mt-10 w-full max-w-sm gradient-primary text-[#0F1115] glow-orange font-bold text-lg py-4 rounded-xl"
        >
          Done
        </button>

        {p.isWin && (
          <div className="mt-4 w-full max-w-sm mx-auto space-y-3">
            {/* Card preview */}
            {cardUrl && (
              <img
                src={cardUrl}
                alt="Your win card"
                className="w-full rounded-2xl border border-white/15 shadow-xl"
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={shareCard}
                className="flex items-center justify-center gap-2 py-3 rounded-xl gradient-primary text-[#0F1115] font-bold transition-colors disabled:opacity-50"
                aria-label="Send prize photo on WhatsApp"
                disabled={!cardUrl}
              >
                <Share2 className="w-5 h-5" />
                Send Prize Photo
              </button>
              <button
                onClick={downloadCard}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-foreground font-semibold transition-colors disabled:opacity-50"
                aria-label="Download win card"
                disabled={!cardUrl}
              >
                <Download className="w-5 h-5" />
                Save Image
              </button>
            </div>

            <button
              onClick={shareToWhatsAppCustomer}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white font-bold transition-colors"
              aria-label="Send to my WhatsApp"
            >
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075a8.058 8.058 0 0 1-2.356-1.458 8.84 8.84 0 0 1-1.639-2.03c-.173-.297-.018-.458.13-.607.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.36 7.829h-.004c-1.054 0-2.088-.288-2.99-.821l-.214-.128-2.221.582.594-2.166-.139-.222a6.224 6.224 0 0 1-1.158-3.644c0-3.431 2.79-6.22 6.22-6.22 1.662 0 3.225.648 4.4 1.824a6.196 6.196 0 0 1 1.824 4.4c0 3.431-2.79 6.22-6.222 6.22M12 2C6.477 2 2 6.477 2 12c0 1.89.53 3.668 1.453 5.182L2 22l5.026-1.31A9.973 9.973 0 0 0 12 22c5.523 0 10-4.477 10-10S17.523 2 12 2"/>
              </svg>
              {contact ? "Send Text Receipt (no photo)" : "Send Text Only"}
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={shareGeneric}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-foreground font-semibold transition-colors text-sm"
                aria-label="Share to anyone on WhatsApp"
              >
                Share to Friend
              </button>
              <button
                onClick={copySummary}
                className="flex items-center justify-center gap-2 py-3 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-foreground font-semibold transition-colors text-sm"
                aria-label="Copy summary"
              >
                <Copy className="w-4 h-4" />
                {copied ? "Copied" : "Copy Text"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
