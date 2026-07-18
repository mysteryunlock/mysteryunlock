import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { RotateCcw, Search as SearchIcon, Volume2, VolumeX } from "lucide-react";
import { motion } from "framer-motion";
import { SpinWheel } from "@/components/SpinWheel";
import type { Prize } from "@/lib/spin-store";
import { usePrizesBySlug } from "@/lib/prizes-hook";
import { spinAndRecord } from "@/lib/access-codes.functions";
import { listPublicCampaigns } from "@/lib/campaigns.functions";
import { playClick, isSoundEnabled, setSoundEnabled } from "@/lib/sounds";
import { haptic } from "@/lib/haptics";
import { trackGameStarted, trackGameCompleted } from "@/lib/analytics";
import { parseServerValidationError } from "@/lib/utils";
import { codeChars, slugSchema } from "@/lib/validation";

const search = z.object({
  code:    codeChars,
  c:       slugSchema.optional(),
  name:    z.string().min(1).max(40).optional(),
  contact: z.string().min(1).max(30).optional(),
  email:   z.string().min(1).max(255).optional(),
  portal:  z.string().optional(),
});

export const Route = createFileRoute("/s/$slug/spin")({
  validateSearch: search,
  head: ({ params }) => ({ meta: [{ title: `Spin — ${params.slug}` }] }),
  component: SpinPage,
});

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function WheelSkeleton() {
  return (
    <div
      className="w-full aspect-square rounded-full overflow-hidden relative"
      style={{ background: "radial-gradient(circle at 50% 50%, #1a2744 0%, #0f1a2e 100%)" }}
    >
      <div className="absolute inset-0 overflow-hidden rounded-full">
        <div
          className="absolute inset-y-0 w-1/2 animate-skeleton-shimmer"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }}
        />
      </div>
      {Array.from({ length: 8 }, (_, i) => (
        <div
          key={i}
          className="absolute inset-0"
          style={{ transform: `rotate(${i * 45}deg)`, borderRight: "1px solid rgba(255,255,255,0.06)", transformOrigin: "center" }}
        />
      ))}
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

// ─── Mute toggle ─────────────────────────────────────────────────────────────

function MuteToggle() {
  // Initialise from localStorage so the preference persists across page loads.
  const [muted, setMuted] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("sc_muted");
      if (stored !== null) return stored === "true";
    } catch {}
    return !isSoundEnabled();
  });

  // Sync the sound engine with the persisted preference on first mount.
  useEffect(() => { setSoundEnabled(!muted); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = useCallback(() => {
    const next = !muted;
    setMuted(next);
    setSoundEnabled(!next);
    try { localStorage.setItem("sc_muted", String(next)); } catch {}
  }, [muted]);

  return (
    <motion.button
      onClick={toggle}
      aria-label={muted ? "Unmute sounds" : "Mute sounds"}
      className="flex items-center justify-center w-9 h-9 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/8 transition-colors duration-150"
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.93 }}
      title={muted ? "Unmute" : "Mute"}
    >
      {muted
        ? <VolumeX className="w-4 h-4" strokeWidth={2} />
        : <Volume2 className="w-4 h-4" strokeWidth={2} />}
    </motion.button>
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
    queryFn: async () => ((await fetchCampaigns({ data: { slug } })) as { campaigns: unknown[] }).campaigns,
    staleTime: 5 * 60_000,
    gcTime:    10 * 60_000,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  });

  const [accent, setAccent] = useState<string | undefined>(undefined);
  useEffect(() => {
    const list = (campaignsQ.data ?? []) as { slug?: string; is_default?: boolean; theme?: { accent?: string } }[];
    const match = campaignSlug
      ? list.find((c) => c.slug === campaignSlug)
      : list.find((c) => c.is_default) ?? list[0];
    if (match?.theme?.accent) setAccent(match.theme.accent);
  }, [campaignsQ.data, campaignSlug]);

  const spin    = useServerFn(spinAndRecord);
  const [spinning, setSpinning] = useState(false);
  const [target,   setTarget]   = useState<number | null>(null);
  const [done,     setDone]     = useState(false);
  const [error,    setError]    = useState("");
  const [isWin,    setIsWin]    = useState<boolean | null>(null);

  const handleSpin = () => {
    if (spinning || done || prizes.length === 0) return;
    playClick();
    haptic("light");
    setError("");
    setIsWin(null);
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
        }) as { ok: boolean; prize: { id: string } };

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
    setIsWin(prize.isWin ?? false);
    setDone(true);
    setTimeout(() => {
      navigate({
        to:     "/s/$slug/result",
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
    }, 700);
  };

  const isDisabled = spinning || done || isLoading || prizes.length === 0 || campaignNotFound;

  return (
    <div
      className="flex flex-col items-center px-4 pt-4 pb-[max(2.5rem,env(safe-area-inset-bottom))]"
      style={{ minHeight: "100dvh" }}
    >
      {/* ── Header ── */}
      <div className="w-full flex items-center justify-between mb-2">
        <button
          onClick={() => {
            playClick();
            navigate({ to: "/s/$slug", params: { slug }, search: campaignSlug ? { c: campaignSlug } : {} });
          }}
          disabled={spinning && !done}
          className="flex items-center gap-1 text-sm text-muted-foreground px-2 py-2 min-w-[44px] min-h-[44px] rounded-lg hover:bg-white/5 active:scale-95 transition-all duration-150 disabled:opacity-40 disabled:pointer-events-none"
          aria-label="Back"
        >
          ← Back
        </button>

        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FF6B1A]/10 border border-[#FF6B1A]/25">
          <RotateCcw className="w-3.5 h-3.5 text-[#FF6B1A]" strokeWidth={2} />
          <span className="text-xs font-bold text-[#FF6B1A] tracking-wide uppercase">Spin Wheel</span>
        </div>

        <MuteToggle />
      </div>

      {/* ── Code / name subtitle ── */}
      <p className="text-center text-muted-foreground text-sm mb-4">
        {name ? <><span className="text-foreground font-semibold">{name}</span> · </> : null}
        Code <span className="text-foreground font-mono font-semibold tracking-widest">{code}</span>
      </p>

      {/* ── Wheel ── */}
      <div className="w-[min(96vw,520px)] mt-1 relative">
        {campaignNotFound ? (
          <div className="aspect-square flex flex-col items-center justify-center gap-3 text-center px-6">
            <SearchIcon className="w-10 h-10 text-muted-foreground" strokeWidth={1.5} />
            <p className="font-bold text-foreground">Campaign not found</p>
            <p className="text-sm text-muted-foreground">
              The campaign link you used is no longer active or doesn't exist.{" "}
              <button
                onClick={() => navigate({ to: "/s/$slug", params: { slug }, search: {} })}
                className="underline text-foreground"
              >
                Try the main shop page
              </button>
            </p>
          </div>
        ) : isLoading || prizes.length === 0 ? (
          <WheelSkeleton />
        ) : (
          <SpinWheel
            prizes={prizes}
            spinning={spinning}
            targetIndex={target}
            onComplete={handleComplete}
            accent={accent}
          />
        )}
      </div>

      {/* ── Result message ── */}
      {done && isWin !== null && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.34, 1.56, 0.64, 1] }}
          className="mt-5 text-center"
        >
          {isWin ? (
            <p className="text-lg font-black text-[#FF6B1A] tracking-wide">
              Congratulations — you won! 🎉
            </p>
          ) : (
            <p className="text-base font-semibold text-[#4a5b78]">
              Better luck next time — thanks for playing!
            </p>
          )}
        </motion.div>
      )}

      {error && <p className="mt-4 text-destructive text-sm text-center">{error}</p>}

      {/* ── Spin button ── */}
      <motion.button
        onClick={handleSpin}
        disabled={isDisabled}
        className="mt-7 w-full max-w-sm gradient-primary text-[#0F1115] font-black text-xl tracking-widest py-5 rounded-2xl transition-colors duration-150 disabled:opacity-60 disabled:pointer-events-none"
        whileHover={isDisabled ? undefined : { y: -2, boxShadow: "0 16px 40px rgba(255,107,26,0.38)" }}
        whileTap={isDisabled  ? undefined : { scale: 0.96 }}
      >
        {spinning ? "SPINNING…" : done ? "DONE" : "SPIN NOW"}
      </motion.button>
    </div>
  );
}
