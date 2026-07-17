import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { RotateCcw, Search as SearchIcon } from "lucide-react";
import { SpinWheel } from "@/components/SpinWheel";
import type { Prize } from "@/lib/spin-store";
import { usePrizesBySlug } from "@/lib/prizes-hook";
import { spinAndRecord } from "@/lib/access-codes.functions";
import { listPublicCampaigns } from "@/lib/campaigns.functions";
import { playClick } from "@/lib/sounds";
import { trackGameStarted, trackGameCompleted } from "@/lib/analytics";
import { parseServerValidationError } from "@/lib/utils";
import { codeChars, slugSchema } from "@/lib/validation";

const search = z.object({
  code:    codeChars,
  c:       slugSchema.optional(),
  name:    z.string().min(1).max(40).optional(),
  contact: z.string().min(1).max(30).optional(),
  email:   z.string().min(1).max(255).optional(),
  // portal="1" signals an authenticated customer — forwarded to result page
  portal:  z.string().optional(),
});

export const Route = createFileRoute("/s/$slug/spin")({
  validateSearch: search,
  head: ({ params }) => ({ meta: [{ title: `Spin — ${params.slug}` }] }),
  component: SpinPage,
});

// ─── Premium loading skeleton ──────────────────────────────────────────────────

function WheelSkeleton() {
  return (
    <div
      className="w-full aspect-square rounded-full overflow-hidden relative"
      style={{ background: "radial-gradient(circle at 50% 50%, #1a2744 0%, #0f1a2e 100%)" }}
    >
      {/* Shimmer sweep */}
      <div className="absolute inset-0 overflow-hidden rounded-full">
        <div
          className="absolute inset-y-0 w-1/2 animate-skeleton-shimmer"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
          }}
        />
      </div>

      {/* Wheel spokes suggestion */}
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="absolute inset-0"
          style={{
            transform:   `rotate(${i * 45}deg)`,
            borderRight: "1px solid rgba(255,255,255,0.06)",
            transformOrigin: "center",
          }}
        />
      ))}

      {/* Hub */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-[22%] h-[22%] rounded-full bg-white/10 flex items-center justify-center">
          <RotateCcw className="w-8 h-8 text-white/50" strokeWidth={1.5} />
        </div>
      </div>

      <p className="absolute bottom-8 left-0 right-0 text-center text-white/35 text-xs tracking-wide">
        Loading your wheel…
      </p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function SpinPage() {
  const { slug } = Route.useParams();
  const { code, c: campaignSlug, name, contact, email, portal } = Route.useSearch();
  const navigate = useNavigate();
  const { prizes, isLoading, campaignNotFound } = usePrizesBySlug(slug, campaignSlug);
  const fetchCampaigns = useServerFn(listPublicCampaigns);
  const campaignsQ = useQuery({
    queryKey: ["public-campaigns", slug],
    queryFn: async () => (await fetchCampaigns({ data: { slug } })).campaigns,
    staleTime: 5 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });
  const [accent, setAccent] = useState<string | undefined>(undefined);

  useEffect(() => {
    const list = campaignsQ.data ?? [];
    const match = campaignSlug
      ? list.find((c) => c.slug === campaignSlug)
      : list.find((c) => c.is_default) ?? list[0];
    const theme = match?.theme as { accent?: string } | null | undefined;
    if (theme?.accent) setAccent(theme.accent);
  }, [campaignsQ.data, campaignSlug]);

  const spin = useServerFn(spinAndRecord);
  const [spinning, setSpinning] = useState(false);
  const [target,   setTarget]   = useState<number | null>(null);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState("");

  const handleSpin = () => {
    if (spinning || done || prizes.length === 0) return;
    playClick();
    setError("");
    setSpinning(true);
    setTarget(null);
    trackGameStarted("spin", slug, code);

    (async () => {
      try {
        const res = await spin({
          data: {
            slug,
            code,
            ...(campaignSlug ? { campaignSlug } : {}),
            name:    name?.trim()    || undefined,
            contact: contact?.trim() || undefined,
            email:   email?.trim()   || undefined,
          },
        });
        if (!res.ok) {
          setSpinning(false);
          setTarget(null);
          setError("This code is invalid or has already been used.");
          return;
        }
        const idx = prizes.findIndex((p) => p.id === res.prize.id);
        setTarget(idx >= 0 ? idx : 0);
      } catch (err) {
        setSpinning(false);
        setTarget(null);
        setError(parseServerValidationError(err) ?? "Could not complete your spin. Please try again.");
      }
    })();
  };

  const handleComplete = (prize: Prize) => {
    trackGameCompleted("spin", slug, code, prize.isWin);
    setDone(true);
    setTimeout(() => {
      navigate({
        to: "/s/$slug/result",
        params: { slug },
        search: {
          code,
          pid: prize.id,
          ...(campaignSlug ? { c:       campaignSlug } : {}),
          ...(contact      ? { contact               } : {}),
          ...(name         ? { name                  } : {}),
          ...(portal       ? { portal                } : {}),
        },
      });
    }, 600);
  };

  return (
    <div
      className="flex flex-col items-center px-4 pt-4 pb-[max(2.5rem,env(safe-area-inset-bottom))]"
      style={{ minHeight: "100dvh" }}
    >
      {/* Header row */}
      <div className="w-full flex items-center justify-between mb-2">
        <button
          onClick={() => { playClick(); navigate({ to: "/s/$slug", params: { slug }, search: campaignSlug ? { c: campaignSlug } : {} }); }}
          className="flex items-center gap-1 text-sm text-muted-foreground px-2 py-2 min-w-[44px] min-h-[44px] rounded-lg hover:bg-white/5 active:scale-95 transition-all duration-150"
          aria-label="Back"
        >
          ← Back
        </button>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-500/15 border border-sky-500/20">
          <RotateCcw className="w-3.5 h-3.5 text-sky-300" strokeWidth={2} />
          <span className="text-xs font-bold text-sky-300 tracking-wide uppercase">Spin Wheel</span>
        </div>

        <span className="w-[68px]" />
      </div>

      <p className="text-center text-muted-foreground text-sm mb-3">
        {name ? <><span className="text-foreground font-semibold">{name}</span> · </> : null}
        Code <span className="text-foreground font-mono font-semibold tracking-widest">{code}</span>
      </p>

      <div className="w-[min(96vw,560px)] mt-2">
        {campaignNotFound ? (
          <div className="aspect-square flex flex-col items-center justify-center gap-3 text-center px-6">
            <SearchIcon className="w-10 h-10 text-muted-foreground" strokeWidth={1.5} />
            <p className="font-bold text-foreground">Campaign not found</p>
            <p className="text-sm text-muted-foreground">
              The campaign link you used is no longer active or doesn't exist.
              Try the{" "}
              <button
                onClick={() => navigate({ to: "/s/$slug", params: { slug }, search: {} })}
                className="underline text-foreground"
              >
                main shop page
              </button>{" "}
              instead.
            </p>
          </div>
        ) : isLoading || prizes.length === 0 ? (
          <WheelSkeleton />
        ) : (
          <SpinWheel prizes={prizes} spinning={spinning} targetIndex={target} onComplete={handleComplete} accent={accent} />
        )}
      </div>

      {error && <p className="mt-4 text-destructive text-sm text-center">{error}</p>}

      <button
        onClick={handleSpin}
        disabled={spinning || done || isLoading || prizes.length === 0 || campaignNotFound}
        className="mt-8 w-full max-w-sm gradient-primary text-[#0F1115] font-black text-xl tracking-widest py-5 rounded-2xl transition-all duration-150 hover:brightness-110 hover:shadow-xl hover:shadow-orange-500/30 active:scale-[0.96] disabled:opacity-60 disabled:pointer-events-none"
      >
        {spinning ? "SPINNING..." : "SPIN NOW"}
      </button>
    </div>
  );
}
